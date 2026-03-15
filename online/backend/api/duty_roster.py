"""Duty Roster API — CRUD for teacher duty assignments (gate / hall / lunch / …)."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
import io

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.models.duty_roster_model import DutyRoster
from backend.models.teacher_model import Teacher
from backend.models.school_settings import SchoolSettings

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class DutyRosterCreate(BaseModel):
    teacher_id:   int
    duty_type:    str
    day_of_week:  int   # 0–6
    period_index: int
    notes:        Optional[str] = None


class DutyRosterUpdate(BaseModel):
    teacher_id:   Optional[int] = None
    duty_type:    Optional[str] = None
    day_of_week:  Optional[int] = None
    period_index: Optional[int] = None
    notes:        Optional[str] = None


class DutyRosterResponse(BaseModel):
    id:           int
    project_id:   int
    teacher_id:   int
    duty_type:    str
    day_of_week:  int
    period_index: int
    notes:        Optional[str]

    class Config:
        from_attributes = True


# ── Service: conflict check ───────────────────────────────────────────────────

def check_duty_conflict(
    db: Session,
    project_id: int,
    teacher_id: int,
    day_of_week: int,
    period_index: int,
    exclude_id: Optional[int] = None,
) -> None:
    """
    Raise HTTP 409 if the teacher already has a duty assignment in
    (day_of_week, period_index) for this project.
    Pass exclude_id on update to ignore the record being edited.
    """
    q = (
        db.query(DutyRoster)
        .filter(
            DutyRoster.project_id   == project_id,
            DutyRoster.teacher_id   == teacher_id,
            DutyRoster.day_of_week  == day_of_week,
            DutyRoster.period_index == period_index,
        )
    )
    if exclude_id is not None:
        q = q.filter(DutyRoster.id != exclude_id)
    if q.first():
        raise HTTPException(
            status_code=409,
            detail="This teacher already has a duty assignment in that slot.",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[DutyRosterResponse])
def list_duty_roster(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    return (
        db.query(DutyRoster)
        .filter(DutyRoster.project_id == project.id)
        .order_by(DutyRoster.day_of_week, DutyRoster.period_index)
        .all()
    )


@router.post("", response_model=DutyRosterResponse)
def create_duty_entry(
    data: DutyRosterCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    check_duty_conflict(
        db, project.id, data.teacher_id, data.day_of_week, data.period_index
    )
    entry = DutyRoster(
        project_id=project.id,
        teacher_id=data.teacher_id,
        duty_type=data.duty_type,
        day_of_week=data.day_of_week,
        period_index=data.period_index,
        notes=data.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=DutyRosterResponse)
def get_duty_entry(
    entry_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DutyRoster)
        .filter(DutyRoster.id == entry_id, DutyRoster.project_id == project.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")
    return entry


@router.patch("/{entry_id}", response_model=DutyRosterResponse)
def update_duty_entry(
    entry_id: int,
    data: DutyRosterUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DutyRoster)
        .filter(DutyRoster.id == entry_id, DutyRoster.project_id == project.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")

    patch = data.model_dump(exclude_unset=True)

    # Recompute conflict with the merged values
    check_duty_conflict(
        db,
        project.id,
        patch.get("teacher_id",   entry.teacher_id),
        patch.get("day_of_week",  entry.day_of_week),
        patch.get("period_index", entry.period_index),
        exclude_id=entry_id,
    )

    for key, val in patch.items():
        setattr(entry, key, val)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_duty_entry(
    entry_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DutyRoster)
        .filter(DutyRoster.id == entry_id, DutyRoster.project_id == project.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")
    db.delete(entry)
    db.commit()

# ── PDF export ────────────────────────────────────────────────────────────────

@router.get("/export-pdf")
def export_duty_roster_pdf(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate a duty roster PDF using ReportLab."""
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        raise HTTPException(501, "reportlab not installed on server.")

    settings = (
        db.query(SchoolSettings)
        .filter(SchoolSettings.project_id == project.id)
        .first()
    )
    days_per_week    = settings.days_per_week    if settings else 5
    periods_per_day  = settings.periods_per_day  if settings else 8

    DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    entries = (
        db.query(DutyRoster)
        .filter(DutyRoster.project_id == project.id)
        .order_by(DutyRoster.day_of_week, DutyRoster.period_index)
        .all()
    )

    teachers = {t.id: t for t in db.query(Teacher).filter(Teacher.project_id == project.id).all()}

    # Build cell map
    cell_map: dict[tuple[int, int], str] = {}
    for e in entries:
        t = teachers.get(e.teacher_id)
        t_label = (t.code or f"{t.first_name[0]}{(t.last_name or [''])[0]}").upper() if t else "?"
        cell_map[(e.day_of_week, e.period_index)] = f"{t_label}\n{e.duty_type}"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=14, spaceAfter=6)
    sub_style   = ParagraphStyle("Sub",   parent=styles["Normal"],   fontSize=8,  textColor=colors.grey)

    col_labels = ["Period"] + [DAY_NAMES[d] for d in range(days_per_week)]
    table_data = [col_labels]
    for p in range(periods_per_day):
        row = [f"P{p + 1}"]
        for d in range(days_per_week):
            row.append(cell_map.get((d, p), ""))
        table_data.append(row)

    col_width = (270 * mm - 20 * mm) / max(1, days_per_week + 1)
    col_widths = [20 * mm] + [col_width] * days_per_week

    tbl = Table(table_data, colWidths=col_widths, rowHeights=12 * mm)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#4f46e5")),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  9),
        ("FONTNAME",      (0, 1), (0, -1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))

    import datetime
    story = [
        Paragraph(f"{project.name} — Duty Roster", title_style),
        Paragraph(f"Generated {datetime.datetime.utcnow().strftime('%d %b %Y, %H:%M')} UTC", sub_style),
        Spacer(1, 6 * mm),
        tbl,
    ]
    doc.build(story)
    buf.seek(0)

    fname = f"duty_roster_{project.name or project.id}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})
