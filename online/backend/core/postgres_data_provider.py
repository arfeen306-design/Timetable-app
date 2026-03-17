"""
PostgresDataProvider — backend adapter for the core timetable engine.

Loads all project-scoped data from PostgreSQL and returns dicts with keys matching
the desktop SQLite schema so the core engine (solver, validators) can run unchanged.
"""
from __future__ import annotations
from typing import Any

from sqlalchemy.orm import Session, joinedload

from backend.models.project import Project
from backend.models.school_settings import SchoolSettings
from backend.models.class_model import SchoolClass
from backend.models.teacher_model import Teacher, TeacherSubject
from backend.models.room_model import Room
from backend.models.project import Subject
from backend.models.lesson_model import Lesson, LessonAllowedRoom
from backend.models.constraint_model import TimeConstraint
from backend.models.timetable_model import TimetableRun, TimetableEntry


def _row_dict(keys: list[str], row: Any) -> dict[str, Any]:
    """Build dict from ORM row with given keys; convert bools to int for schema compatibility if needed."""
    out: dict[str, Any] = {}
    for k in keys:
        if not hasattr(row, k):
            continue
        v = getattr(row, k)
        if v is None:
            out[k] = None
        elif k in ("double_allowed", "locked", "is_hard") and isinstance(v, bool):
            out[k] = 1 if v else 0  # core engine may expect int from SQLite
        else:
            out[k] = v
    return out


class PostgresDataProvider:
    """Read-only data provider that loads project data from PostgreSQL."""

    def __init__(self, db: Session, project_id: int) -> None:
        self._db = db
        self._project_id = project_id

    def get_school(self) -> dict[str, Any] | None:
        settings = (
            self._db.query(SchoolSettings)
            .filter(SchoolSettings.project_id == self._project_id)
            .first()
        )
        if not settings:
            return None
        return {
            "id": settings.id,
            "name": settings.name or "",
            "academic_year": settings.academic_year or "",
            "days_per_week": settings.days_per_week,
            "periods_per_day": settings.periods_per_day,
            "period_duration_minutes": getattr(settings, "period_duration_minutes", 45),
            "weekend_days": settings.weekend_days or "5,6",
            "working_days": getattr(settings, "working_days", "1,2,3,4,5"),
            "bell_schedule_json": settings.bell_schedule_json or "{}",
            "breaks_json": getattr(settings, "breaks_json", "[]"),
            "school_start_time": getattr(settings, "school_start_time", "08:00"),
            "school_end_time": getattr(settings, "school_end_time", "15:00"),
            "friday_start_time": getattr(settings, "friday_start_time", None),
            "friday_end_time": getattr(settings, "friday_end_time", None),
            "daily_limits_json": getattr(settings, "daily_limits_json", "{}"),
        }

    def get_subjects(self) -> list[dict[str, Any]]:
        rows = (
            self._db.query(Subject)
            .filter(Subject.project_id == self._project_id)
            .order_by(Subject.name)
            .all()
        )
        keys = ["id", "name", "code", "color", "category", "max_per_day", "double_allowed", "preferred_room_type"]
        return [_row_dict(keys, r) for r in rows]

    def get_classes(self) -> list[dict[str, Any]]:
        rows = (
            self._db.query(SchoolClass)
            .filter(SchoolClass.project_id == self._project_id)
            .order_by(SchoolClass.grade, SchoolClass.name)
            .all()
        )
        keys = ["id", "grade", "section", "stream", "name", "code", "color", "class_teacher_id", "home_room_id", "strength"]
        return [_row_dict(keys, r) for r in rows]

    def get_teachers(self) -> list[dict[str, Any]]:
        rows = (
            self._db.query(Teacher)
            .filter(Teacher.project_id == self._project_id)
            .order_by(Teacher.first_name, Teacher.last_name)
            .all()
        )
        keys = ["id", "first_name", "last_name", "code", "title", "color", "max_periods_day", "max_periods_week", "email", "whatsapp_number"]
        return [_row_dict(keys, r) for r in rows]

    def get_rooms(self) -> list[dict[str, Any]]:
        rows = (
            self._db.query(Room)
            .filter(Room.project_id == self._project_id)
            .order_by(Room.name)
            .all()
        )
        keys = ["id", "name", "code", "room_type", "capacity", "color", "home_class_id"]
        return [_row_dict(keys, r) for r in rows]

    def get_lessons(self) -> list[dict[str, Any]]:
        rows = (
            self._db.query(Lesson)
            .filter(Lesson.project_id == self._project_id)
            .all()
        )
        keys = ["id", "teacher_id", "subject_id", "class_id", "group_id", "periods_per_week", "duration", "priority", "locked", "preferred_room_id", "notes"]
        return [_row_dict(keys, r) for r in rows]

    def get_constraints(self) -> list[dict[str, Any]]:
        rows = (
            self._db.query(TimeConstraint)
            .filter(TimeConstraint.project_id == self._project_id)
            .all()
        )
        keys = ["id", "entity_type", "entity_id", "day_index", "period_index", "constraint_type", "weight", "is_hard"]
        return [_row_dict(keys, r) for r in rows]

    def get_locked_entries(self) -> list[dict[str, Any]]:
        rows = (
            self._db.query(TimetableEntry)
            .filter(
                TimetableEntry.project_id == self._project_id,
                TimetableEntry.locked.is_(True),
            )
            .all()
        )
        keys = ["id", "lesson_id", "day_index", "period_index", "room_id", "locked"]
        return [_row_dict(keys, r) for r in rows]

    def get_lesson_allowed_rooms(self) -> list[dict[str, Any]]:
        # Join through Lesson to ensure we only get rooms for lessons in this project
        rows = (
            self._db.query(LessonAllowedRoom)
            .join(Lesson)
            .filter(Lesson.project_id == self._project_id)
            .all()
        )
        keys = ["id", "lesson_id", "room_id"]
        return [_row_dict(keys, r) for r in rows]
