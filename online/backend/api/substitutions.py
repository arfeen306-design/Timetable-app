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


# ─── Substitution History (multi-date, filterable) ────────────────────────────

@router.get("/history")
def substitution_history(
    project_id: int = Path(...),
    date_from: str = Query(None, description="Start date YYYY-MM-DD"),
    date_to: str = Query(None, description="End date YYYY-MM-DD"),
    teacher_id: int = Query(None, description="Filter by absent or sub teacher ID"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Return enriched substitution history across a date range."""
    q = db.query(Substitution).filter(Substitution.project_id == project_id)

    if date_from:
        q = q.filter(Substitution.date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(Substitution.date <= date.fromisoformat(date_to))
    if teacher_id:
        from sqlalchemy import or_
        q = q.filter(or_(
            Substitution.absent_teacher_id == teacher_id,
            Substitution.sub_teacher_id == teacher_id,
        ))

    subs = q.order_by(Substitution.date.desc(), Substitution.period_index).all()

    result = []
    for s in subs:
        subject_name = ""
        class_name = ""
        if s.lesson:
            if s.lesson.subject_id:
                subj = db.query(Subject).filter(Subject.id == s.lesson.subject_id).first()
                subject_name = subj.name if subj else ""
            if s.lesson.class_id:
                cls = db.query(SchoolClass).filter(SchoolClass.id == s.lesson.class_id).first()
                class_name = cls.name if cls else ""

        room_name = ""
        if s.room_id:
            room = db.query(Room).filter(Room.id == s.room_id).first()
            room_name = room.name if room else ""

        # Get absence reason
        absence = db.query(TeacherAbsence).filter(
            TeacherAbsence.project_id == project_id,
            TeacherAbsence.teacher_id == s.absent_teacher_id,
            TeacherAbsence.date == s.date,
        ).first()

        result.append({
            "id": s.id,
            "date": str(s.date),
            "period_index": s.period_index,
            "absent_teacher_id": s.absent_teacher_id,
            "absent_teacher_name": f"{s.absent_teacher.first_name} {s.absent_teacher.last_name}".strip() if s.absent_teacher else "",
            "sub_teacher_id": s.sub_teacher_id,
            "sub_teacher_name": f"{s.sub_teacher.first_name} {s.sub_teacher.last_name}".strip() if s.sub_teacher else "",
            "subject_name": subject_name,
            "class_name": class_name,
            "room_name": room_name,
            "is_override": s.is_override,
            "reason": absence.reason if absence else "",
            "notes": s.notes,
            "created_at": s.created_at.isoformat() if s.created_at else "",
        })

    return result


@router.get("/history/export-pdf")
def export_history_pdf(
    project_id: int = Path(...),
    date_from: str = Query(None, description="Start date YYYY-MM-DD"),
    date_to: str = Query(None, description="End date YYYY-MM-DD"),
    teacher_id: int = Query(None, description="Filter by teacher ID"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate a PDF report of substitution history."""
    from reportlab.lib.units import mm
    from reportlab.platypus import Spacer
    from utils.pdf_engine import PDFEngine

    engine = PDFEngine(db, project)

    # Re-use the history query
    q = db.query(Substitution).filter(Substitution.project_id == project_id)
    if date_from:
        q = q.filter(Substitution.date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(Substitution.date <= date.fromisoformat(date_to))
    if teacher_id:
        from sqlalchemy import or_
        q = q.filter(or_(
            Substitution.absent_teacher_id == teacher_id,
            Substitution.sub_teacher_id == teacher_id,
        ))

    subs = q.order_by(Substitution.date.desc(), Substitution.period_index).all()

    # Build subtitle
    parts = []
    if date_from:
        parts.append(f"From {date_from}")
    if date_to:
        parts.append(f"To {date_to}")
    subtitle = " · ".join(parts) if parts else "All Records"

    story = engine.header("Substitution Report", subtitle=subtitle)

    if not subs:
        from reportlab.platypus import Paragraph
        story.append(Paragraph("No substitution records found.", engine.body_style))
    else:
        header = ["Date", "Lesson", "Absent Teacher", "Substitute", "Subject", "Class", "Status"]
        rows = [header]
        for s in subs:
            absent_name = f"{s.absent_teacher.first_name} {s.absent_teacher.last_name}".strip() if s.absent_teacher else ""
            sub_name = f"{s.sub_teacher.first_name} {s.sub_teacher.last_name}".strip() if s.sub_teacher else ""
            subject_name = ""
            class_name = ""
            if s.lesson:
                if s.lesson.subject_id:
                    subj = db.query(Subject).filter(Subject.id == s.lesson.subject_id).first()
                    subject_name = subj.name if subj else ""
                if s.lesson.class_id:
                    cls = db.query(SchoolClass).filter(SchoolClass.id == s.lesson.class_id).first()
                    class_name = cls.name if cls else ""
            status = "Override" if s.is_override else "Assigned"
            rows.append([
                str(s.date),
                f"Lesson {s.period_index + 1}",
                absent_name,
                sub_name,
                subject_name,
                class_name,
                status,
            ])

        col_w = [22 * mm, 14 * mm, 30 * mm, 30 * mm, 28 * mm, 28 * mm, 18 * mm]
        tbl = engine.smart_fit_table(rows, col_w)
        story.extend([Spacer(1, 4 * mm), tbl])

    story += engine.signature_block()
    story += engine.footer()

    fname = f"substitution_report_{date_from or 'all'}_{date_to or 'all'}.pdf"
    return engine.build(story, filename=fname)


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


# ─── Pending (Unassigned) Periods ─────────────────────────────────────────────

@router.get("/pending")
def pending_periods(
    project_id: int = Path(...),
    dt: str = Query(..., alias="date", description="YYYY-MM-DD"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Return all unassigned slots for a date — absent teachers' timetable
    entries that have no substitution yet. Survives page navigation."""
    target_date = date.fromisoformat(dt)
    day_index = target_date.weekday()

    # 1. Who is absent?
    absences = db.query(TeacherAbsence).filter(
        TeacherAbsence.project_id == project_id,
        TeacherAbsence.date == target_date,
    ).all()
    absent_ids = [a.teacher_id for a in absences]
    if not absent_ids:
        return []

    # 2. Their timetable entries for that day
    entries = (
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
            Lesson.teacher_id.in_(absent_ids),
        )
        .order_by(Lesson.teacher_id, TimetableEntry.period_index)
        .all()
    )

    # 3. Already-assigned substitutions
    assigned_keys = set()
    subs = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
    ).all()
    for s in subs:
        assigned_keys.add((s.absent_teacher_id, s.period_index))

    # 4. Return unassigned only
    return [
        {
            "entry_id": e.entry_id,
            "period_index": e.period_index,
            "room_id": e.room_id,
            "lesson_id": e.lesson_id,
            "teacher_id": e.teacher_id,
            "subject_id": e.subject_id,
            "class_id": e.class_id,
            "subject_name": e.subject_name or "",
            "class_name": e.class_name or "",
            "room_name": e.room_name or "",
        }
        for e in entries
        if (e.teacher_id, e.period_index) not in assigned_keys
    ]


# ─── Pending with Suggestions (batch) ────────────────────────────────────────

@router.get("/pending-with-suggestions")
def pending_with_suggestions(
    project_id: int = Path(...),
    dt: str = Query(..., alias="date", description="YYYY-MM-DD"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Return pending slots + top-3 suggested free teachers for each, in ONE call.
    Replaces N separate free-teachers API calls with a single batch request."""
    from sqlalchemy import func as sqla_func

    target_date = date.fromisoformat(dt)
    day_index = target_date.weekday()

    # 1. Absent teachers
    absences = db.query(TeacherAbsence).filter(
        TeacherAbsence.project_id == project_id,
        TeacherAbsence.date == target_date,
    ).all()
    absent_ids = [a.teacher_id for a in absences]
    if not absent_ids:
        return {"slots": [], "suggestions": {}}

    # 2. Timetable entries for absent teachers
    entries = (
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
            Lesson.teacher_id.in_(absent_ids),
        )
        .order_by(Lesson.teacher_id, TimetableEntry.period_index)
        .all()
    )

    # 3. Already-assigned substitutions
    subs_today = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
    ).all()
    assigned_keys = {(s.absent_teacher_id, s.period_index) for s in subs_today}

    # Unassigned slots
    pending = [
        {
            "entry_id": e.entry_id, "period_index": e.period_index,
            "room_id": e.room_id, "lesson_id": e.lesson_id,
            "teacher_id": e.teacher_id, "subject_id": e.subject_id,
            "class_id": e.class_id, "subject_name": e.subject_name or "",
            "class_name": e.class_name or "", "room_name": e.room_name or "",
        }
        for e in entries
        if (e.teacher_id, e.period_index) not in assigned_keys
    ]

    if not pending:
        return {"slots": [], "suggestions": {}}

    # 4. Batch-compute suggestions: one set of queries for ALL periods
    all_teachers = db.query(Teacher).filter(Teacher.project_id == project_id).all()
    teachers_by_id = {t.id: t for t in all_teachers}

    # Busy map: period_index → set of teacher_ids busy at that period
    busy_q = (
        db.query(TimetableEntry.period_index, Lesson.teacher_id)
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.day_index == day_index,
        )
        .all()
    )
    busy_map: dict[int, set[int]] = {}
    for row in busy_q:
        busy_map.setdefault(row.period_index, set()).add(row.teacher_id)

    # Sub-busy map: teachers already covering subs at each period today
    sub_busy_q = db.query(Substitution.period_index, Substitution.sub_teacher_id).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
    ).all()
    sub_busy_map: dict[int, set[int]] = {}
    for row in sub_busy_q:
        sub_busy_map.setdefault(row.period_index, set()).add(row.sub_teacher_id)

    absent_set = set(absent_ids)

    # Periods today per teacher
    periods_today_q = (
        db.query(Lesson.teacher_id, sqla_func.count(TimetableEntry.id).label("cnt"))
        .join(TimetableEntry, TimetableEntry.lesson_id == Lesson.id)
        .filter(TimetableEntry.project_id == project_id, TimetableEntry.day_index == day_index)
        .group_by(Lesson.teacher_id)
        .all()
    )
    periods_today_map = {r.teacher_id: r.cnt for r in periods_today_q}

    # Subs this week per teacher
    wk_start = target_date - __import__("datetime").timedelta(days=target_date.weekday())
    wk_end = wk_start + __import__("datetime").timedelta(days=6)
    subs_week_q = (
        db.query(Substitution.sub_teacher_id, sqla_func.count(Substitution.id).label("cnt"))
        .filter(
            Substitution.project_id == project_id,
            Substitution.date >= wk_start,
            Substitution.date <= wk_end,
        )
        .group_by(Substitution.sub_teacher_id)
        .all()
    )
    subs_week_map = {r.sub_teacher_id: r.cnt for r in subs_week_q}

    # Teacher subject lookup
    from backend.models.teacher_model import TeacherSubject
    subject_q = (
        db.query(TeacherSubject.teacher_id, Subject.name)
        .join(Subject, TeacherSubject.subject_id == Subject.id)
        .filter(TeacherSubject.teacher_id.in_([t.id for t in all_teachers]))
        .all()
    )
    subject_map: dict[int, str] = {}
    for tid, sname in subject_q:
        if tid not in subject_map:
            subject_map[tid] = sname

    # 5. For each pending period, find top-3 free teachers
    suggestions: dict[str, list] = {}
    for slot in pending:
        pi = slot["period_index"]
        busy_at_period = busy_map.get(pi, set())
        sub_busy_at_period = sub_busy_map.get(pi, set())
        excluded = busy_at_period | sub_busy_at_period | absent_set

        free = []
        for t in all_teachers:
            if t.id in excluded:
                continue
            pt = periods_today_map.get(t.id, 0)
            sw = subs_week_map.get(t.id, 0)
            name = f"{t.first_name or ''} {t.last_name or ''}".strip()
            free.append({
                "teacher_id": t.id,
                "teacher_name": name,
                "initials": "".join(w[0] for w in name.split() if w).upper()[:2],
                "subject": subject_map.get(t.id, ""),
                "periods_today": pt,
                "subs_this_week": sw,
                "sub_limit_reached": sw >= 2,
                "best_fit": False,
            })

        # Fairness sort
        free.sort(key=lambda x: (x["periods_today"], x["subs_this_week"]))
        if free:
            free[0]["best_fit"] = True

        key = f"{slot['teacher_id']}-{pi}"
        suggestions[key] = free[:3]

    return {"slots": pending, "suggestions": suggestions}


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
    """Generate daily substitution PDF using shared PDFEngine."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer
    from utils.pdf_engine import PDFEngine

    target_date = date.fromisoformat(dt)
    wk_number = resolve_week_number(target_date)
    academic_year = (
        f"{target_date.year}-{str(target_date.year + 1)[-2:]}"
        if target_date.month >= 8
        else f"{target_date.year - 1}-{str(target_date.year)[-2:]}"
    )

    engine = PDFEngine(db, project)

    # Get absences + substitutions
    absences = db.query(TeacherAbsence).filter(
        TeacherAbsence.project_id == project_id,
        TeacherAbsence.date == target_date,
    ).all()

    all_subs = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
    ).order_by(Substitution.period_index).all()

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

    # Build story
    date_str = target_date.strftime("%A, %d %B %Y")
    story = engine.header(
        "Daily Substitution Schedule",
        subtitle=f"Academic Year {academic_year} · Week {wk_number}",
        date_str=date_str,
    )

    # Absent teachers summary
    if absences:
        absent_parts = []
        for a in absences:
            tname = f"{a.teacher.first_name} {a.teacher.last_name}".strip() if a.teacher else ""
            absent_parts.append(f"• {tname} — {a.reason or 'No reason'}")
        absent_text = "&nbsp;&nbsp;&nbsp;".join(absent_parts)
        story.append(Paragraph(f'<font color="#dc2626"><b>TEACHERS ABSENT TODAY</b></font>', engine.body_style))
        story.append(Paragraph(f'<font color="#dc2626">{absent_text}</font>', engine.small_style))
        story.append(Spacer(1, 5 * mm))

    # Per-teacher tables
    for absence in absences:
        teacher = absence.teacher
        if not teacher:
            continue
        tname = f"{teacher.first_name} {teacher.last_name}".strip()
        teacher_subs = subs_by_teacher.get(teacher.id, [])

        story.append(Paragraph(
            f"<b>{tname}</b> &nbsp; <font color='#6366f1'>{absence.reason or ''}</font>",
            engine.body_style,
        ))
        story.append(Spacer(1, 2 * mm))

        if not teacher_subs:
            story.append(Paragraph("<i>No substitutions assigned</i>", engine.small_style))
            story.append(Spacer(1, 5 * mm))
            continue

        header = ["PERIOD", "CLASS", "ROOM", "SUBSTITUTED BY", "SUB'S SUBJECT", "SUBS THIS WEEK"]
        rows = [header]

        for s in teacher_subs:
            sub_name = f"{s.sub_teacher.first_name} {s.sub_teacher.last_name}".strip() if s.sub_teacher else ""
            sub_subject = ""
            if s.lesson and s.lesson.subject_id:
                from backend.models.project import Subject as SubjectModel
                subj = db.query(SubjectModel).filter(SubjectModel.id == s.lesson.subject_id).first()
                sub_subject = subj.name if subj else ""

            class_name = ""
            if s.lesson and s.lesson.class_id:
                cls = db.query(SchoolClass).filter(SchoolClass.id == s.lesson.class_id).first()
                class_name = cls.name if cls else ""

            room_name = ""
            if s.room_id:
                room = db.query(Room).filter(Room.id == s.room_id).first()
                room_name = room.name if room else ""

            stw = subs_this_week_q.get(s.sub_teacher_id, 0)
            subs_label = f"{stw} of 2"
            if s.is_override:
                subs_label = f"{stw} of 2 ⚠"
                sub_name = f"{sub_name}\nOVERRIDE"

            rows.append([
                f"Lesson {s.period_index + 1}",
                class_name,
                room_name,
                sub_name,
                sub_subject,
                subs_label,
            ])

        # Build extra styles for overrides and period column coloring
        extra = []
        for i, s in enumerate(teacher_subs):
            if s.is_override:
                extra.append(("TEXTCOLOR", (3, i + 1), (3, i + 1), colors.HexColor("#dc2626")))
                extra.append(("FONTNAME", (3, i + 1), (3, i + 1), "Helvetica-Bold"))
                extra.append(("TEXTCOLOR", (5, i + 1), (5, i + 1), colors.HexColor("#dc2626")))
        for i in range(1, len(rows)):
            extra.append(("TEXTCOLOR", (0, i), (0, i), colors.HexColor("#6366f1")))
            extra.append(("FONTNAME", (0, i), (0, i), "Helvetica-Bold"))

        col_widths = [35, 65, 55, 110, 80, 70]
        tbl = engine.smart_fit_table(rows, col_widths, extra_styles=extra)
        story.append(tbl)
        story.append(Spacer(1, 6 * mm))

    story += engine.signature_block()
    story += engine.footer()

    filename = f"substitution_{target_date.strftime('%d-%m-%Y')}.pdf"
    return engine.build(story, filename=filename)

