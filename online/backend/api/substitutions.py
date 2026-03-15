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
from backend.services.workload_service import get_free_teachers


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
            )
            db.add(absence)
            created.append(tid)
    db.commit()

    # Return the absent teachers' scheduled slots for that day
    slots = (
        db.query(
            TimetableEntry.id.label("entry_id"),
            TimetableEntry.period_index,
            TimetableEntry.room_id,
            Lesson.id.label("lesson_id"),
            Lesson.teacher_id,
            Lesson.subject_id,
            Lesson.class_id,
        )
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
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
            }
            for s in slots
        ],
    }


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
    """Assign a substitute teacher for a specific period."""
    target_date = date.fromisoformat(data.date)
    day_index = target_date.weekday()

    # Verify both teachers exist
    absent = db.query(Teacher).filter(Teacher.id == data.absent_teacher_id, Teacher.project_id == project_id).first()
    sub = db.query(Teacher).filter(Teacher.id == data.sub_teacher_id, Teacher.project_id == project_id).first()
    if not absent or not sub:
        raise HTTPException(404, "Teacher not found")

    # Check if substitution already exists for this slot
    existing = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == target_date,
        Substitution.period_index == data.period_index,
        Substitution.absent_teacher_id == data.absent_teacher_id,
    ).first()
    if existing:
        # Update existing
        existing.sub_teacher_id = data.sub_teacher_id
        existing.notes = data.notes
        db.commit()
        return {"ok": True, "id": existing.id, "message": "Substitution updated"}

    substitution = Substitution(
        project_id=project_id,
        date=target_date,
        day_index=day_index,
        period_index=data.period_index,
        absent_teacher_id=data.absent_teacher_id,
        sub_teacher_id=data.sub_teacher_id,
        lesson_id=data.lesson_id,
        room_id=data.room_id,
        notes=data.notes,
    )
    db.add(substitution)
    db.commit()
    db.refresh(substitution)
    return {"ok": True, "id": substitution.id, "message": "Substitution assigned"}


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
