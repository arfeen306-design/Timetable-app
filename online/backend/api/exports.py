"""Direct exports — Excel, CSV, PDF from Postgres. No SQLite adapter needed."""
from __future__ import annotations
import io
import tempfile
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.timetable_repo import get_latest_run, get_entries_with_joins
from backend.repositories.school_settings_repo import get_by_project

router = APIRouter()


def _ensure_completed_run(db: Session, project_id: int):
    run = get_latest_run(db, project_id)
    if not run or run.status != "completed":
        raise HTTPException(400, "No completed timetable run. Generate first.")
    return run


def _get_all_entries(db: Session, project_id: int, run_id: int) -> list[dict]:
    return get_entries_with_joins(db, project_id, run_id=run_id)


def _get_settings(db: Session, project_id: int):
    s = get_by_project(db, project_id)
    days = getattr(s, "days_per_week", 5) if s else 5
    periods = getattr(s, "periods_per_day", 7) if s else 7
    name = getattr(s, "name", "") if s else ""
    return days, periods, name


DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# ─── EXCEL ───────────────────────────────────────────────────────────────────

@router.get("/excel")
def export_excel(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
    except ImportError:
        raise HTTPException(501, "openpyxl not installed on server.")

    run = _ensure_completed_run(db, project.id)
    entries = _get_all_entries(db, project.id, run.id)
    days, periods, school_name = _get_settings(db, project.id)

    # Group entries
    by_class: dict[str, list[dict]] = {}
    by_teacher: dict[str, list[dict]] = {}
    for e in entries:
        cn = e.get("class_name", "?")
        tn = e.get("teacher_name", "?")
        by_class.setdefault(cn, []).append(e)
        by_teacher.setdefault(tn, []).append(e)

    wb = Workbook()
    hdr_font = Font(bold=True, size=11, color="FFFFFF")
    hdr_fill = PatternFill("solid", fgColor="2C3E50")
    hdr_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin = Border(left=Side("thin"), right=Side("thin"), top=Side("thin"), bottom=Side("thin"))

    def _write_timetable(ws, title: str, group_entries: list[dict], label_key: str):
        ws.cell(1, 1, title).font = Font(bold=True, size=14)
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=periods + 1)
        # Headers
        r = 3
        ws.cell(r, 1, "Day").font = hdr_font
        ws.cell(r, 1).fill = hdr_fill; ws.cell(r, 1).alignment = hdr_align; ws.cell(r, 1).border = thin
        ws.column_dimensions["A"].width = 10
        for p in range(periods):
            c = ws.cell(r, p + 2, f"P{p+1}")
            c.font = hdr_font; c.fill = hdr_fill; c.alignment = hdr_align; c.border = thin
            ws.column_dimensions[get_column_letter(p + 2)].width = 14
        # Build lookup
        lookup: dict[tuple[int,int], dict] = {}
        for e in group_entries:
            lookup[(e["day_index"], e["period_index"])] = e
        # Rows
        for d in range(days):
            row = r + 1 + d
            ws.cell(row, 1, DAY_SHORT[d]).font = Font(bold=True)
            ws.cell(row, 1).alignment = cell_align; ws.cell(row, 1).border = thin
            for p in range(periods):
                cell = ws.cell(row, p + 2)
                cell.border = thin; cell.alignment = cell_align
                e = lookup.get((d, p))
                if e:
                    code = e.get("subject_code") or e.get("subject_name", "")
                    lbl = e.get(label_key, "")
                    room = e.get("room_name", "")
                    text = code
                    if lbl: text += f"\n{lbl}"
                    if room: text += f"\n{room}"
                    cell.value = text
                    color = (e.get("subject_color") or "#4A90D9").lstrip("#")
                    try:
                        ri, gi, bi = int(color[:2],16), int(color[2:4],16), int(color[4:6],16)
                        lr = min(ri + 60, 255); lg = min(gi + 60, 255); lb = min(bi + 60, 255)
                        cell.fill = PatternFill("solid", fgColor=f"{lr:02X}{lg:02X}{lb:02X}")
                    except (ValueError, IndexError):
                        pass

    # Class sheets
    for cn in sorted(by_class.keys()):
        ws = wb.create_sheet(title=f"C-{cn}"[:31])
        _write_timetable(ws, f"Class: {cn}", by_class[cn], "teacher_name")

    # Teacher sheets
    for tn in sorted(by_teacher.keys()):
        ws = wb.create_sheet(title=f"T-{tn}"[:31])
        _write_timetable(ws, f"Teacher: {tn}", by_teacher[tn], "class_name")

    # Master timetable
    ws_master = wb.create_sheet(title="Master Timetable")
    ws_master.cell(1, 1, f"{school_name} — Master Timetable").font = Font(bold=True, size=14)
    row = 3
    for cn in sorted(by_class.keys()):
        ws_master.cell(row, 1, f"Class: {cn}").font = Font(bold=True, size=11)
        row += 1
        ws_master.cell(row, 1, "Day").font = hdr_font
        ws_master.cell(row, 1).fill = hdr_fill
        for p in range(periods):
            c = ws_master.cell(row, p + 2, f"P{p+1}")
            c.font = hdr_font; c.fill = hdr_fill; c.alignment = hdr_align
        row += 1
        lookup = {(e["day_index"], e["period_index"]): e for e in by_class[cn]}
        for d in range(days):
            ws_master.cell(row, 1, DAY_SHORT[d]).font = Font(bold=True)
            for p in range(periods):
                e = lookup.get((d, p))
                if e:
                    ws_master.cell(row, p + 2, e.get("subject_code") or e.get("subject_name", ""))
            row += 1
        row += 1

    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"timetable_{project.name or project.id}.xlsx"
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ─── CSV ─────────────────────────────────────────────────────────────────────

@router.get("/csv")
def export_csv(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    import csv as csv_mod

    run = _ensure_completed_run(db, project.id)
    entries = _get_all_entries(db, project.id, run.id)

    buf = io.StringIO()
    writer = csv_mod.writer(buf)
    writer.writerow(["Day", "Period", "Class", "Subject", "Subject Code", "Teacher", "Room"])
    for e in sorted(entries, key=lambda x: (x["day_index"], x["period_index"], x.get("class_name", ""))):
        writer.writerow([
            DAY_NAMES[e["day_index"]] if e["day_index"] < len(DAY_NAMES) else f"Day{e['day_index']+1}",
            e["period_index"] + 1,
            e.get("class_name", ""),
            e.get("subject_name", ""),
            e.get("subject_code", ""),
            e.get("teacher_name", ""),
            e.get("room_name", ""),
        ])

    content = buf.getvalue().encode("utf-8")
    fname = f"timetable_{project.name or project.id}.csv"
    return StreamingResponse(io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ─── PDF ─────────────────────────────────────────────────────────────────────

@router.get("/pdf")
def export_pdf(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
    except ImportError:
        raise HTTPException(501, "reportlab not installed on server.")

    run = _ensure_completed_run(db, project.id)
    entries = _get_all_entries(db, project.id, run.id)
    days, periods, school_name = _get_settings(db, project.id)

    by_class: dict[str, list[dict]] = {}
    for e in entries:
        by_class.setdefault(e.get("class_name", "?"), []).append(e)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    elements = []
    title_style = styles["Title"]
    normal = styles["Normal"]

    elements.append(Paragraph(f"{school_name} — Timetable", title_style))
    elements.append(Spacer(1, 10))

    for cn in sorted(by_class.keys()):
        elements.append(Paragraph(f"Class: {cn}", styles["Heading2"]))
        lookup = {(e["day_index"], e["period_index"]): e for e in by_class[cn]}
        header = ["Day"] + [f"P{p+1}" for p in range(periods)]
        data = [header]
        for d in range(days):
            row = [DAY_SHORT[d]]
            for p in range(periods):
                e = lookup.get((d, p))
                if e:
                    code = e.get("subject_code") or e.get("subject_name", "")
                    teacher = e.get("teacher_name", "")
                    row.append(f"{code}\n{teacher}")
                else:
                    row.append("")
            data.append(row)

        col_w = [30*mm] + [22*mm] * periods
        tbl = Table(data, colWidths=col_w, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        elements.append(tbl)
        elements.append(Spacer(1, 12))

    doc.build(elements)
    buf.seek(0)
    fname = f"timetable_{project.name or project.id}.pdf"
    return StreamingResponse(buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("")
def list_exports(project: Project = Depends(get_project_or_404)):
    return {"exports": []}
