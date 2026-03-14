"""SQLite implementation of TimetableDataProvider using the existing DatabaseConnection."""
from __future__ import annotations
from typing import TYPE_CHECKING

from core.data_provider import TimetableDataProvider

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class SqliteDataProvider:
    """Read-only data provider that delegates to a SQLite DatabaseConnection."""

    def __init__(self, db: DatabaseConnection) -> None:
        self._db = db

    def get_school(self) -> dict | None:
        row = self._db.fetchone("SELECT * FROM school LIMIT 1")
        return dict(row) if row else None

    def get_subjects(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM subject")
        return [dict(r) for r in rows]

    def get_classes(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM school_class")
        return [dict(r) for r in rows]

    def get_teachers(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM teacher")
        return [dict(r) for r in rows]

    def get_rooms(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM room")
        return [dict(r) for r in rows]

    def get_lessons(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM lesson")
        return [dict(r) for r in rows]

    def get_constraints(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM time_constraint")
        return [dict(r) for r in rows]

    def get_locked_entries(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM timetable_entry WHERE locked = 1")
        return [dict(r) for r in rows]

    def get_lesson_allowed_rooms(self) -> list[dict]:
        rows = self._db.fetchall("SELECT * FROM lesson_allowed_room")
        return [dict(r) for r in rows]
