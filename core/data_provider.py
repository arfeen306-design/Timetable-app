"""Data provider interface for timetable solver and validation.

The core engine (solver, validators) uses this read-only interface so it can
run with data from SQLite (desktop) or from an in-memory snapshot loaded from
PostgreSQL (web backend). Implementations must return dict-like rows with the
same keys as the current SQLite schema (e.g. id, name, days_per_week, etc.).
"""
from __future__ import annotations
from typing import Any, Protocol


class TimetableDataProvider(Protocol):
    """Read-only project data for solver and validation. Dict rows use schema column names."""

    def get_school(self) -> dict[str, Any] | None:
        """Single school row (e.g. from school table). None if not configured."""
        ...

    def get_subjects(self) -> list[dict[str, Any]]:
        """All subject rows."""
        ...

    def get_classes(self) -> list[dict[str, Any]]:
        """All school_class rows."""
        ...

    def get_teachers(self) -> list[dict[str, Any]]:
        """All teacher rows."""
        ...

    def get_rooms(self) -> list[dict[str, Any]]:
        """All room rows."""
        ...

    def get_lessons(self) -> list[dict[str, Any]]:
        """All lesson rows."""
        ...

    def get_constraints(self) -> list[dict[str, Any]]:
        """All time_constraint rows."""
        ...

    def get_locked_entries(self) -> list[dict[str, Any]]:
        """Timetable entries with locked=1."""
        ...

    def get_lesson_allowed_rooms(self) -> list[dict[str, Any]]:
        """All lesson_allowed_room rows."""
        ...
