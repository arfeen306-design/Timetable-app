"""
Export adapter: build a temp SQLite from PostgresDataProvider + timetable entries,
then call desktop export_excel/export_pdf/export_csv. Requires PYTHONPATH with project root.
"""
from __future__ import annotations
import os
import tempfile
from typing import Any, List

try:
    from database.connection import DatabaseConnection
    from database.schema import SCHEMA_SQL
    _DB_AVAILABLE = True
except ImportError:
    _DB_AVAILABLE = False


def _check_db() -> None:
    if not _DB_AVAILABLE:
        raise RuntimeError("Desktop database module not available. Set PYTHONPATH to project root.")


def _insert_school(db: Any, school: dict) -> None:
    db.execute(
        """INSERT OR REPLACE INTO school (id, name, academic_year, days_per_week, periods_per_day, weekend_days, bell_schedule_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            school["id"],
            school.get("name", ""),
            school.get("academic_year", ""),
            school.get("days_per_week", 5),
            school.get("periods_per_day", 7),
            school.get("weekend_days", "5,6"),
            school.get("bell_schedule_json", "[]") or "[]",
        ),
    )


def _insert_subjects(db: Any, subjects: List[dict]) -> None:
    for s in subjects:
        db.execute(
            """INSERT OR REPLACE INTO subject (id, name, code, color, category, max_per_day, double_allowed, preferred_room_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                s["id"],
                s.get("name", ""),
                s.get("code", ""),
                s.get("color", "#4A90D9"),
                s.get("category", "Core"),
                s.get("max_per_day", 2),
                1 if s.get("double_allowed") else 0,
                s.get("preferred_room_type", "") or "",
            ),
        )


def _insert_classes(db: Any, classes: List[dict]) -> None:
    for c in classes:
        db.execute(
            """INSERT OR REPLACE INTO school_class (id, grade, section, stream, name, code, color, class_teacher_id, home_room_id, strength)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                c["id"],
                c.get("grade", ""),
                c.get("section", ""),
                c.get("stream", ""),
                c.get("name", ""),
                c.get("code", ""),
                c.get("color", "#50C878"),
                c.get("class_teacher_id"),
                c.get("home_room_id"),
                c.get("strength", 30),
            ),
        )


def _insert_teachers(db: Any, teachers: List[dict]) -> None:
    for t in teachers:
        db.execute(
            """INSERT OR REPLACE INTO teacher (id, first_name, last_name, code, title, color, max_periods_day, max_periods_week, email, whatsapp_number)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                t["id"],
                t.get("first_name", ""),
                t.get("last_name", ""),
                t.get("code", ""),
                t.get("title", "Mr."),
                t.get("color", "#E8725A"),
                t.get("max_periods_day", 6),
                t.get("max_periods_week", 30),
                t.get("email", "") or "",
                t.get("whatsapp_number", "") or "",
            ),
        )


def _insert_teacher_subjects(db: Any, provider: Any) -> None:
    """Teacher-subject mapping: we need to get it from provider. PostgresDataProvider doesn't expose it directly; get_teachers doesn't include subject ids. So we need to pass teacher_subjects as list of (teacher_id, subject_id)."""
    # If provider has get_teacher_subjects we could use it. For now we skip or get from DB in the API and pass in.
    pass


def _insert_rooms(db: Any, rooms: List[dict]) -> None:
    for r in rooms:
        db.execute(
            """INSERT OR REPLACE INTO room (id, name, code, room_type, capacity, color, home_class_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                r["id"],
                r.get("name", ""),
                r.get("code", ""),
                r.get("room_type", "Classroom"),
                r.get("capacity", 40),
                r.get("color", "#9B59B6"),
                r.get("home_class_id"),
            ),
        )


def _insert_lessons(db: Any, lessons: List[dict]) -> None:
    for l in lessons:
        db.execute(
            """INSERT OR REPLACE INTO lesson (id, teacher_id, subject_id, class_id, group_id, periods_per_week, duration, priority, locked, preferred_room_id, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                l["id"],
                l["teacher_id"],
                l["subject_id"],
                l["class_id"],
                l.get("group_id"),
                l.get("periods_per_week", 1),
                l.get("duration", 1),
                l.get("priority", 5),
                1 if l.get("locked") else 0,
                l.get("preferred_room_id"),
                l.get("notes", "") or "",
            ),
        )


def _insert_lesson_allowed_rooms(db: Any, allowed: List[dict]) -> None:
    for a in allowed:
        db.execute(
            "INSERT OR IGNORE INTO lesson_allowed_room (lesson_id, room_id) VALUES (?, ?)",
            (a["lesson_id"], a["room_id"]),
        )


def _insert_constraints(db: Any, constraints: List[dict]) -> None:
    for c in constraints:
        db.execute(
            """INSERT OR REPLACE INTO time_constraint (id, entity_type, entity_id, day_index, period_index, constraint_type, weight, is_hard)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                c["id"],
                c.get("entity_type", "unavailable"),
                c["entity_id"],
                c["day_index"],
                c["period_index"],
                c.get("constraint_type", "unavailable"),
                c.get("weight", 10),
                1 if c.get("is_hard") else 0,
            ),
        )


def _insert_timetable_entries(db: Any, entries: List[dict]) -> None:
    for e in entries:
        db.execute(
            """INSERT INTO timetable_entry (lesson_id, day_index, period_index, room_id, locked)
               VALUES (?, ?, ?, ?, ?)""",
            (
                e["lesson_id"],
                e["day_index"],
                e["period_index"],
                e.get("room_id"),
                1 if e.get("locked") else 0,
            ),
        )


def build_sqlite_from_provider(
    provider: Any,
    entries: List[dict],
) -> tuple[DatabaseConnection, str]:
    """
    Build a temp SQLite database from provider data and timetable entries.
    Returns (DatabaseConnection, path_to_sqlite). Caller must call conn.close() when done.
    """
    _check_db()
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    db = DatabaseConnection(path)
    db.open()
    db.initialize_schema()

    school = provider.get_school()
    if school:
        _insert_school(db, school)
    _insert_subjects(db, provider.get_subjects())
    _insert_classes(db, provider.get_classes())
    _insert_teachers(db, provider.get_teachers())
    _insert_rooms(db, provider.get_rooms())
    _insert_lessons(db, provider.get_lessons())
    _insert_lesson_allowed_rooms(db, provider.get_lesson_allowed_rooms())
    _insert_constraints(db, provider.get_constraints())
    _insert_timetable_entries(db, entries)
    db.commit()
    return db, path
