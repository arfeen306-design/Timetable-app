"""Workload API — teacher load overview, individual, and yearly breakdown."""
from __future__ import annotations
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.teacher_model import Teacher
from backend.models.lesson_model import Lesson
from backend.models.timetable_model import TimetableEntry
from backend.models.substitution_model import Substitution
from backend.services.workload_service import get_teacher_workload, get_all_workloads

router = APIRouter()


@router.get("/overview")
def workload_overview(
    project_id: int = Path(...),
    week: Optional[str] = Query(None, description="ISO week e.g. 2025-W12"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """All teachers' workload for a project."""
    return get_all_workloads(db, project_id, week)


@router.get("/{teacher_id}")
def workload_detail(
    project_id: int = Path(...),
    teacher_id: int = Path(...),
    week: Optional[str] = Query(None, description="ISO week e.g. 2025-W12"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Single teacher workload."""
    data = get_teacher_workload(db, project_id, teacher_id, week)
    if not data:
        raise HTTPException(404, "Teacher not found")
    return data


@router.get("/{teacher_id}/yearly")
def workload_yearly(
    project_id: int = Path(...),
    teacher_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Yearly workload breakdown — 40 rows (one per school week).

    Returns: [{week_number, start_date, scheduled, substitutions, total, max}]
    Used by the frontend stacked bar chart (indigo=scheduled, coral=subs).
    """
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id, Teacher.project_id == project_id
    ).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")

    max_pw = teacher.max_periods_week or 30

    # Scheduled = fixed count (same every week since it's a generated timetable)
    scheduled = (
        db.query(func.count(TimetableEntry.id))
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .filter(TimetableEntry.project_id == project_id, Lesson.teacher_id == teacher_id)
        .scalar() or 0
    )

    # Substitutions grouped by week_number
    subs_by_week = dict(
        db.query(Substitution.week_number, func.count(Substitution.id))
        .filter(
            Substitution.project_id == project_id,
            Substitution.sub_teacher_id == teacher_id,
            Substitution.week_number.isnot(None),
        )
        .group_by(Substitution.week_number)
        .all()
    )

    # Academic year: Aug 1 → ~40 weeks
    today = date.today()
    year_start = date(today.year, 8, 1) if today.month >= 8 else date(today.year - 1, 8, 1)
    monday_of_start = year_start - timedelta(days=year_start.weekday())

    weeks = []
    for wn in range(1, 41):
        monday = monday_of_start + timedelta(weeks=wn - 1)
        sub_count = subs_by_week.get(wn, 0)
        weeks.append({
            "week_number": wn,
            "start_date": monday.isoformat(),
            "scheduled": scheduled,
            "substitutions": sub_count,
            "total": scheduled + sub_count,
            "max": max_pw,
        })

    return {
        "teacher_id": teacher.id,
        "teacher_name": f"{teacher.first_name or ''} {teacher.last_name or ''}".strip(),
        "max": max_pw,
        "weeks": weeks,
    }


@router.get("/export-pdf")
def export_workload_pdf(
    project_id: int = Path(...),
    week: Optional[str] = Query(None, description="ISO week e.g. 2025-W12"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate a one-page PDF of all teachers' workload for the given week."""
    from io import BytesIO
    from fastapi.responses import Response
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    from utils.pdf_branding import MyznycaBrandingFlowable

    # Fetch data
    data = get_all_workloads(db, project_id, week)

    # School name
    from backend.repositories.school_settings_repo import get_by_project
    settings = get_by_project(db, project_id)
    school_name = settings.school_name if settings and settings.school_name else "School"

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()

    elements = []

    # Header
    elements.append(Paragraph(f"<b>{school_name}</b>", styles["Title"]))
    week_label = week or "Current Week"
    elements.append(Paragraph(f"<font color='#4F46E5'>Weekly Workload Report</font> · {week_label}", styles["Normal"]))
    elements.append(Spacer(1, 8*mm))

    # Table
    header = ["#", "Teacher", "Code", "Scheduled", "Subs", "Total", "Max", "Utilisation"]
    rows = [header]
    over_limit_rows = []

    for i, t in enumerate(data):
        util_pct = t.get("utilization_pct", 0)
        util_str = f"{util_pct:.0f}%"
        if util_pct > 100:
            util_str += " ⚠"
            over_limit_rows.append(i + 1)  # 1-indexed for table rows

        rows.append([
            str(i + 1),
            t.get("teacher_name", ""),
            t.get("teacher_code", ""),
            str(t.get("scheduled", 0)),
            str(t.get("substitutions", 0)),
            str(t.get("total", 0)),
            str(t.get("max", 30)),
            util_str,
        ])

    tbl = Table(rows, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (3, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]

    # Highlight over-limit rows in amber
    for row_idx in over_limit_rows:
        style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#FEF3C7")))

    tbl.setStyle(TableStyle(style_cmds))
    elements.append(tbl)

    # Summary
    elements.append(Spacer(1, 6*mm))
    total_teachers = len(data)
    over_count = len(over_limit_rows)
    elements.append(Paragraph(
        f"<font size=8 color='#64748B'>{total_teachers} teachers tracked · "
        f"{over_count} over limit · Generated by Myzynca · myzynca.com</font>",
        styles["Normal"],
    ))

    elements.append(Spacer(1, 0.3 * cm))
    elements.append(MyznycaBrandingFlowable())

    doc.build(elements)
    pdf_bytes = buf.getvalue()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename=workload_{week or "current"}.pdf',
        },
    )

