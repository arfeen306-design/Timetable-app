"""Substitution API — mark absent, find free teachers, assign substitutes."""
from __future__ import annotations
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.teacher_model import Teacher
from backend.models.lesson_model import Lesson
from backend.models.timetable_model import TimetableEntry
from backend.models.substitution_model import TeacherAbsence, Substitution
from backend.models.project import Subject
from backend.models.class_model import SchoolClass
from backend.models.room_model import Room
from backend.services.workload_service import get_free_teachers, get_teacher_workload
from backend.services.week_utils import get_or_create_week, resolve_week_number, get_or_create_teacher_week_sub


router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AbsentRequest(BaseModel):
    date: str  # YYYY-MM-DD
    teacher_ids: List[int]
    reason: str = ""


class AssignRequest(BaseModel):
    date: str  # YYYY-MM-DD
    period_index: int
    absent_teacher_id: int
    sub_teacher_id: int
    lesson_id: int
    room_id: Optional[int] = None
    notes: str = ""
    force_override: bool = False  # if true, bypass the 2-sub limit


# ─── Mark Absent ──────────────────────────────────────────────────────────────

@router.post("/absent")
def mark_absent(
    data: AbsentRequest,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Mark teachers as absent for a date. Returns their scheduled slots for that day."""
    target_date = date.fromisoformat(data.date)
    day_index = target_date.weekday()

    # Create absence records (upsert — skip if already absent)
    created = []
    for tid in data.teacher_ids:
        exists = db.query(TeacherAbsence).filter(
            TeacherAbsence.project_id == project_id,
            TeacherAbsence.teacher_id == tid,
            TeacherAbsence.date == target_date,
        ).first()
        if not exists:
            absence = TeacherAbsence(
                project_id=project_id, teacher_id=tid,
                date=target_date, reason=data.reason,
                week_number=resolve_week_number(target_date),
            )
            db.add(absence)
            created.append(tid)
    db.commit()

    # Return the absent teachers' scheduled slots for that day
    # Join Subject, Class, Room to return names for the UI
    slots = (
        db.query(
            TimetableEntry.id.label("entry_id"),
            TimetableEntry.period_index,
            TimetableEntry.room_id,
            Lesson.id.label("lesson_id"),
            Lesson.teacher_id,
            Lesson.subject_id,
            Lesson.class_id,
            Subject.name.label("subject_name"),
            SchoolClass.name.label("class_name"),
            Room.name.label("room_name"),
        )
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .outerjoin(Subject, Lesson.subject_id == Subject.id)
        .outerjoin(SchoolClass, Lesson.class_id == SchoolClass.id)
        .outerjoin(Room, TimetableEntry.room_id == Room.id)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.day_index == day_index,
            Lesson.teacher_id.in_(data.teacher_ids),
        )
        .order_by(Lesson.teacher_id, TimetableEntry.period_index)
        .all()
    )

    return {
        "ok": True,
        "absences_created": created,
        "date": data.date,
        "day_index": day_index,
        "slots": [
            {
                "entry_id": s.entry_id,
                "period_index": s.period_index,
                "room_id": s.room_id,
                "lesson_id": s.lesson_id,
                "teacher_id": s.teacher_id,
                "subject_id": s.subject_id,
                "class_id": s.class_id,
                "subject_name": s.subject_name or "",
                "class_name": s.class_name or "",
                "room_name": s.room_name or "",
            }
            for s in slots
        ],
    }


# ─── Teacher Slots (for cover-specific-lesson) ────────────────────────────────

@router.get("/teacher-slots")
def teacher_day_slots(
    project_id: int = Path(...),
    dt: str = Query(..., alias="date", description="YYYY-MM-DD"),
    teacher_id: int = Query(..., description="Teacher ID"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Get a teacher's timetable slots for a specific day (for busy teacher coverage)."""
    target_date = date.fromisoformat(dt)
    day_index = target_date.weekday()

    slots = (
        db.query(
            TimetableEntry.id.label("entry_id"),
            TimetableEntry.period_index,
            TimetableEntry.room_id,
            Lesson.id.label("lesson_id"),
            Lesson.teacher_id,
            Lesson.subject_id,
            Lesson.class_id,
            Subject.name.label("subject_name"),
            SchoolClass.name.label("class_name"),
            Room.name.label("room_name"),
        )
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .outerjoin(Subject, Lesson.subject_id == Subject.id)
        .outerjoin(SchoolClass, Lesson.class_id == SchoolClass.id)
        .outerjoin(Room, TimetableEntry.room_id == Room.id)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.day_index == day_index,
            Lesson.teacher_id == teacher_id,
        )
        .order_by(TimetableEntry.period_index)
        .all()
    )

    return [
        {
            "entry_id": s.entry_id,
            "period_index": s.period_index,
            "room_id": s.room_id,
            "lesson_id": s.lesson_id,
            "teacher_id": s.teacher_id,
            "subject_id": s.subject_id,
            "class_id": s.class_id,
            "subject_name": s.subject_name or "",
            "class_name": s.class_name or "",
            "room_name": s.room_name or "",
        }
        for s in slots
    ]


# ─── Free Teachers ────────────────────────────────────────────────────────────

@router.get("/free-teachers")
def free_teachers(
    project_id: int = Path(...),
    dt: str = Query(..., alias="date", description="YYYY-MM-DD"),
    period: int = Query(..., description="Period index (0-based)"),
    absent_ids: str = Query("", description="Comma-separated absent teacher IDs"),
    week: Optional[str] = Query(None, description="ISO week e.g. 2025-W12"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Find teachers not scheduled at a given slot and not absent."""
    target_date = date.fromisoformat(dt)
    ids = [int(x) for x in absent_ids.split(",") if x.strip().isdigit()]
    return get_free_teachers(db, project_id, target_date, period, ids, week)


# ─── Assign Substitute ───────────────────────────────────────────────────────

@router.post("/assign")
def assign_substitute(
    data: AssignRequest,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Assign a substitute teacher. Returns 409 if weekly limit exceeded (unless force_override)."""
    target_date = date.fromisoformat(data.date)
    day_index = target_date.weekday()
    wk_number = resolve_week_number(target_date)

    # Verify both teachers exist
    absent = db.query(Teacher).filter(Teacher.id == data.absent_teacher_id, Teacher.project_id == project_id).first()
    sub = db.query(Teacher).filter(Teacher.id == data.sub_teacher_id, Teacher.project_id == project_id).first()
    if not absent or not sub:
        raise HTTPException(404, "Teacher not found")

    # Ensure academic week exists
    aw = get_or_create_week(db, project_id, target_date)

    # ── 2-sub guard ──────────────────────────────────────────────────────────
    week_sub = get_or_create_teacher_week_sub(db, project_id, data.sub_teacher_id, aw.id)

    if week_sub.sub_count >= 2 and not data.force_override:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "LIMIT_EXCEEDED",
                "teacher_name": f"{sub.first_name or ''} {sub.last_name or ''}".strip(),
                "sub_count": week_sub.sub_count,
                "override_count": week_sub.override_count,
                "message": f"Teacher has already taken {week_sub.sub_count} substitution(s) this week (limit: 2).",
            },
        )

    is_override = week_sub.sub_count >= 2 and data.force_override

    # ── Check existing / create substitution ─────────────────────────────────
    existing = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
        Substitution.period_index == data.period_index,
        Substitution.absent_teacher_id == data.absent_teacher_id,
    ).first()

    if existing:
        existing.sub_teacher_id = data.sub_teacher_id
        existing.notes = data.notes
        existing.week_number = wk_number
        existing.academic_week_id = aw.id
        existing.is_override = is_override
    else:
        substitution = Substitution(
            project_id=project_id,
            date=target_date,
            week_number=wk_number,
            academic_week_id=aw.id,
            day_index=day_index,
            period_index=data.period_index,
            absent_teacher_id=data.absent_teacher_id,
            sub_teacher_id=data.sub_teacher_id,
            lesson_id=data.lesson_id,
            room_id=data.room_id,
            is_override=is_override,
            notes=data.notes,
        )
        db.add(substitution)

    # Update TeacherWeekSub counters
    if is_override:
        week_sub.override_count += 1
    else:
        week_sub.sub_count += 1

    db.commit()

    sub_id = existing.id if existing else substitution.id
    workload = get_teacher_workload(db, project_id, data.sub_teacher_id)
    return {
        "ok": True,
        "id": sub_id,
        "is_override": is_override,
        "sub_count": week_sub.sub_count,
        "override_count": week_sub.override_count,
        "message": "Override recorded" if is_override else "Substitution assigned",
        "sub_workload": workload,
    }


# ─── List Substitutions ──────────────────────────────────────────────────────

@router.get("")
def list_substitutions(
    project_id: int = Path(...),
    dt: str = Query(..., alias="date", description="YYYY-MM-DD"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """List all substitutions for a date."""
    target_date = date.fromisoformat(dt)
    subs = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
    ).order_by(Substitution.period_index).all()

    return [
        {
            "id": s.id,
            "period_index": s.period_index,
            "absent_teacher_id": s.absent_teacher_id,
            "absent_teacher_name": f"{s.absent_teacher.first_name} {s.absent_teacher.last_name}".strip() if s.absent_teacher else "",
            "sub_teacher_id": s.sub_teacher_id,
            "sub_teacher_name": f"{s.sub_teacher.first_name} {s.sub_teacher.last_name}".strip() if s.sub_teacher else "",
            "lesson_id": s.lesson_id,
            "room_id": s.room_id,
            "notes": s.notes,
        }
        for s in subs
    ]


# ─── List Absences ────────────────────────────────────────────────────────────

@router.get("/absences")
def list_absences(
    project_id: int = Path(...),
    dt: str = Query(..., alias="date", description="YYYY-MM-DD"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """List absent teachers for a date."""
    target_date = date.fromisoformat(dt)
    absences = db.query(TeacherAbsence).filter(
        TeacherAbsence.project_id == project_id,
        TeacherAbsence.date == target_date,
    ).all()

    return [
        {
            "id": a.id,
            "teacher_id": a.teacher_id,
            "teacher_name": f"{a.teacher.first_name} {a.teacher.last_name}".strip() if a.teacher else "",
            "reason": a.reason,
        }
        for a in absences
    ]


# ─── Delete Substitution ─────────────────────────────────────────────────────

@router.delete("/{sub_id}")
def delete_substitution(
    sub_id: int,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Remove a substitution."""
    s = db.query(Substitution).filter(Substitution.id == sub_id, Substitution.project_id == project_id).first()
    if not s:
        raise HTTPException(404, "Substitution not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ─── Remove Absence ──────────────────────────────────────────────────────────

@router.delete("/absence/{absence_id}")
def remove_absence(
    absence_id: int,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Remove an absence record (and its substitutions)."""
    a = db.query(TeacherAbsence).filter(TeacherAbsence.id == absence_id, TeacherAbsence.project_id == project_id).first()
    if not a:
        raise HTTPException(404, "Absence not found")
    # Also remove substitutions for this teacher on this date
    db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == a.date,
        Substitution.absent_teacher_id == a.teacher_id,
    ).delete(synchronize_session=False)
    db.delete(a)
    db.commit()
    return {"ok": True}


# ─── Export PDF ──────────────────────────────────────────────────────────────

@router.get("/export-pdf")
def export_substitution_pdf(
    project_id: int = Path(...),
    dt: str = Query(..., alias="date", description="YYYY-MM-DD"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate daily substitution PDF."""
    from io import BytesIO
    from datetime import datetime as dt_mod
    from fastapi.responses import Response
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from backend.models.school import School, SchoolMembership
    from backend.models.project import Project

    target_date = date.fromisoformat(dt)
    wk_number = resolve_week_number(target_date)
    academic_year = f"{target_date.year}-{str(target_date.year + 1)[-2:]}" if target_date.month >= 8 else f"{target_date.year - 1}-{str(target_date.year)[-2:]}"

    # Get school name
    proj = db.query(Project).filter(Project.id == project_id).first()
    school_name = "School"
    if proj:
        membership = db.query(SchoolMembership).filter(SchoolMembership.user_id == proj.user_id).first()
        if membership:
            school = db.query(School).filter(School.id == membership.school_id).first()
            if school:
                school_name = school.name or "School"

    # Get absences + substitutions
    absences = db.query(TeacherAbsence).filter(
        TeacherAbsence.project_id == project_id,
        TeacherAbsence.date == target_date,
    ).all()

    all_subs = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
    ).order_by(Substitution.period_index).all()

    # Group subs by absent teacher
    subs_by_teacher: dict[int, list] = {}
    for s in all_subs:
        subs_by_teacher.setdefault(s.absent_teacher_id, []).append(s)

    # Count subs this week per sub teacher
    week_start = target_date - __import__("datetime").timedelta(days=target_date.weekday())
    week_end = week_start + __import__("datetime").timedelta(days=4)
    from sqlalchemy import func as sqla_func
    subs_this_week_q = dict(
        db.query(Substitution.sub_teacher_id, sqla_func.count(Substitution.id))
        .filter(
            Substitution.project_id == project_id,
            Substitution.date >= week_start,
            Substitution.date <= week_end,
        )
        .group_by(Substitution.sub_teacher_id)
        .all()
    )

    # Build PDF
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    elements = []

    # Title style
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=14, spaceAfter=2*mm)
    subtitle_style = ParagraphStyle("subtitle", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#6366f1"))
    small_style = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=colors.grey)
    normal_style = ParagraphStyle("normal", parent=styles["Normal"], fontSize=9)

    # Header
    elements.append(Paragraph(f"<b>{school_name}</b>", title_style))
    elements.append(Paragraph("Daily Substitution Schedule", subtitle_style))
    elements.append(Spacer(1, 2*mm))
    date_str = target_date.strftime("%d/%m/%Y")
    now_str = dt_mod.now().strftime("%d/%m/%Y %I:%M %p")
    elements.append(Paragraph(f"Academic Year {academic_year} · Week {wk_number} &nbsp;&nbsp; | &nbsp;&nbsp; Generated: {now_str}", small_style))
    elements.append(Spacer(1, 5*mm))

    # Absent teachers summary
    if absences:
        absent_parts = []
        for a in absences:
            tname = f"{a.teacher.first_name} {a.teacher.last_name}".strip() if a.teacher else ""
            absent_parts.append(f"• {tname} — {a.reason or 'No reason'}")
        absent_text = "&nbsp;&nbsp;&nbsp;".join(absent_parts)
        elements.append(Paragraph(f'<font color="#dc2626"><b>TEACHERS ABSENT TODAY</b></font>', normal_style))
        elements.append(Paragraph(f'<font color="#dc2626">{absent_text}</font>', small_style))
        elements.append(Spacer(1, 5*mm))

    # Per-teacher tables
    for absence in absences:
        teacher = absence.teacher
        if not teacher:
            continue
        tname = f"{teacher.first_name} {teacher.last_name}".strip()
        teacher_subs = subs_by_teacher.get(teacher.id, [])

        elements.append(Paragraph(f"<b>{tname}</b> &nbsp; <font color='#6366f1'>{absence.reason or ''}</font>", normal_style))
        elements.append(Spacer(1, 2*mm))

        if not teacher_subs:
            elements.append(Paragraph("<i>No substitutions assigned</i>", small_style))
            elements.append(Spacer(1, 5*mm))
            continue

        # Table header
        header = ["PERIOD", "CLASS", "ROOM", "SUBSTITUTED BY", "SUB'S SUBJECT", "SUBS THIS WEEK"]
        rows = [header]

        for s in teacher_subs:
            sub_name = f"{s.sub_teacher.first_name} {s.sub_teacher.last_name}".strip() if s.sub_teacher else ""
            sub_subject = ""
            if s.lesson and s.lesson.subject_id:
                from backend.models.project import Subject as SubjectModel
                subj = db.query(SubjectModel).filter(SubjectModel.id == s.lesson.subject_id).first()
                sub_subject = subj.name if subj else ""

            # Class name
            class_name = ""
            if s.lesson and s.lesson.class_id:
                cls = db.query(SchoolClass).filter(SchoolClass.id == s.lesson.class_id).first()
                class_name = cls.name if cls else ""

            # Room name
            room_name = ""
            if s.room_id:
                room = db.query(Room).filter(Room.id == s.room_id).first()
                room_name = room.name if room else ""

            stw = subs_this_week_q.get(s.sub_teacher_id, 0)
            subs_label = f"{stw} of 2"
            if s.is_override:
                subs_label = f"{stw} of 2 ⚠"

            if s.is_override:
                sub_name = f"{sub_name}\nOVERRIDE"

            rows.append([
                f"P{s.period_index + 1}",
                class_name,
                room_name,
                sub_name,
                sub_subject,
                subs_label,
            ])

        col_widths = [35, 65, 55, 110, 80, 70]
        t = Table(rows, colWidths=col_widths)

        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#64748b")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTSIZE", (0, 0), (-1, 0), 7),
            ("ALIGN", (0, 0), (-1, 0), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ]

        # Color override rows red
        for i, s in enumerate(teacher_subs):
            if s.is_override:
                style_cmds.append(("TEXTCOLOR", (3, i + 1), (3, i + 1), colors.HexColor("#dc2626")))
                style_cmds.append(("FONTNAME", (3, i + 1), (3, i + 1), "Helvetica-Bold"))
                style_cmds.append(("TEXTCOLOR", (5, i + 1), (5, i + 1), colors.HexColor("#dc2626")))

        # Color period column
        for i in range(1, len(rows)):
            style_cmds.append(("TEXTCOLOR", (0, i), (0, i), colors.HexColor("#6366f1")))
            style_cmds.append(("FONTNAME", (0, i), (0, i), "Helvetica-Bold"))

        t.setStyle(TableStyle(style_cmds))
        elements.append(t)
        elements.append(Spacer(1, 6*mm))

    # Signature lines
    elements.append(Spacer(1, 15*mm))
    sig_data = [["", "", ""], ["_" * 25, "_" * 25, "_" * 25], ["Prepared by", "Vice Principal / HOD", "Principal"]]
    sig_table = Table(sig_data, colWidths=[140, 140, 140])
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 2), (-1, 2), colors.grey),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(sig_table)

    # Footer
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph(f"Schedulr — School OS · Generated automatically &nbsp;&nbsp;&nbsp;&nbsp; Page 1 of 1", small_style))

    doc.build(elements)
    pdf_bytes = buf.getvalue()

    filename = f"substitution_{target_date.strftime('%d-%m-%Y')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
