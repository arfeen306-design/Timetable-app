"""TimetableRun and TimetableEntry repository — create run, save entries, get for review."""
from __future__ import annotations
from typing import Optional, List
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from backend.models.timetable_model import TimetableRun, TimetableEntry
from backend.models.lesson_model import Lesson
from backend.models.teacher_model import Teacher
from backend.models.project import Subject
from backend.models.class_model import SchoolClass
from backend.models.room_model import Room


def create_run(
    db: Session,
    project_id: int,
    status: str = "running",
    message: Optional[str] = None,
) -> TimetableRun:
    r = TimetableRun(project_id=project_id, status=status, message=message)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def finish_run(
    db: Session,
    run_id: int,
    status: str = "completed",
    entries_count: int = 0,
    message: Optional[str] = None,
) -> None:
    r = db.query(TimetableRun).filter(TimetableRun.id == run_id).first()
    if not r:
        return
    r.status = status
    r.finished_at = datetime.utcnow()
    r.entries_count = entries_count
    if message is not None:
        r.message = message
    db.commit()


def get_latest_run(db: Session, project_id: int) -> Optional[TimetableRun]:
    return (
        db.query(TimetableRun)
        .filter(TimetableRun.project_id == project_id)
        .order_by(TimetableRun.created_at.desc())
        .first()
    )


def delete_entries_for_run(db: Session, project_id: int, run_id: Optional[int] = None) -> None:
    """Delete non-locked entries for project (and optionally for a specific run)."""
    q = db.query(TimetableEntry).filter(
        TimetableEntry.project_id == project_id,
        TimetableEntry.locked.is_(False),
    )
    if run_id is not None:
        q = q.filter(TimetableEntry.run_id == run_id)
    q.delete(synchronize_session=False)
    db.commit()


def save_entries(
    db: Session,
    project_id: int,
    run_id: int,
    entries: List[dict],
) -> None:
    """entries: list of {lesson_id, day_index, period_index, room_id, locked}"""
    for e in entries:
        row = TimetableEntry(
            project_id=project_id,
            run_id=run_id,
            lesson_id=e["lesson_id"],
            day_index=e["day_index"],
            period_index=e["period_index"],
            room_id=e.get("room_id"),
            locked=e.get("locked", False),
        )
        db.add(row)
    db.commit()


def get_entries_with_joins(
    db: Session,
    project_id: int,
    run_id: Optional[int] = None,
    class_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    room_id: Optional[int] = None,
) -> List[dict]:
    """Load entries with lesson/teacher/subject/class/room names for review."""
    q = (
        db.query(
            TimetableEntry.id,
            TimetableEntry.lesson_id,
            TimetableEntry.day_index,
            TimetableEntry.period_index,
            TimetableEntry.room_id,
            TimetableEntry.locked,
            Lesson.teacher_id,
            Lesson.subject_id,
            Lesson.class_id,
            Teacher.first_name,
            Teacher.last_name,
            Subject.name.label("subject_name"),
            Subject.code.label("subject_code"),
            Subject.color.label("subject_color"),
            SchoolClass.name.label("class_name"),
            Room.name.label("room_name"),
        )
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .join(Teacher, Lesson.teacher_id == Teacher.id)
        .join(Subject, Lesson.subject_id == Subject.id)
        .join(SchoolClass, Lesson.class_id == SchoolClass.id)
        .outerjoin(Room, TimetableEntry.room_id == Room.id)
        .filter(TimetableEntry.project_id == project_id)
    )
    if run_id is not None:
        q = q.filter(TimetableEntry.run_id == run_id)
    if class_id is not None:
        q = q.filter(Lesson.class_id == class_id)
    if teacher_id is not None:
        q = q.filter(Lesson.teacher_id == teacher_id)
    if room_id is not None:
        q = q.filter(TimetableEntry.room_id == room_id)
    q = q.order_by(TimetableEntry.day_index, TimetableEntry.period_index)
    rows = q.all()
    return [
        {
            "id": r.id,
            "lesson_id": r.lesson_id,
            "day_index": r.day_index,
            "period_index": r.period_index,
            "room_id": r.room_id,
            "locked": r.locked,
            "teacher_id": r.teacher_id,
            "subject_id": r.subject_id,
            "class_id": r.class_id,
            "teacher_name": f"{r.first_name or ''} {r.last_name or ''}".strip(),
            "subject_name": r.subject_name or "",
            "subject_code": r.subject_code or "",
            "subject_color": r.subject_color or "",
            "class_name": r.class_name or "",
            "room_name": r.room_name or "",
        }
        for r in rows
    ]


def get_unscheduled_lessons(db: Session, project_id: int) -> List[dict]:
    """Lessons where scheduled count < periods_per_week."""
    subq = (
        db.query(TimetableEntry.lesson_id, func.count(TimetableEntry.id).label("scheduled_count"))
        .filter(TimetableEntry.project_id == project_id)
        .group_by(TimetableEntry.lesson_id)
        .subquery()
    )
    rows = (
        db.query(
            Lesson.id.label("lesson_id"),
            Lesson.periods_per_week,
            Teacher.first_name,
            Teacher.last_name,
            Subject.name.label("subject_name"),
            SchoolClass.name.label("class_name"),
            func.coalesce(subq.c.scheduled_count, 0).label("scheduled_count"),
        )
        .join(Teacher, Lesson.teacher_id == Teacher.id)
        .join(Subject, Lesson.subject_id == Subject.id)
        .join(SchoolClass, Lesson.class_id == SchoolClass.id)
        .outerjoin(subq, Lesson.id == subq.c.lesson_id)
        .filter(Lesson.project_id == project_id)
        .all()
    )
    return [
        {
            "lesson_id": r.lesson_id,
            "periods_per_week": r.periods_per_week,
            "teacher_name": f"{r.first_name or ''} {r.last_name or ''}".strip(),
            "subject_name": r.subject_name or "",
            "class_name": r.class_name or "",
            "scheduled_count": r.scheduled_count or 0,
        }
        for r in rows
        if (r.scheduled_count or 0) < r.periods_per_week
    ]
