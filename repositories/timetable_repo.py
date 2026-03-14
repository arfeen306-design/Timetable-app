"""Repository for TimetableEntry entity."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import TimetableEntry

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class TimetableRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_all(self) -> list[TimetableEntry]:
        rows = self.db.fetchall("""
            SELECT te.*,
                   t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, s.code AS subject_code,
                   s.color AS subject_color,
                   c.name AS class_name,
                   r.name AS room_name,
                   l.teacher_id, l.subject_id, l.class_id
            FROM timetable_entry te
            JOIN lesson l ON te.lesson_id = l.id
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
            LEFT JOIN room r ON te.room_id = r.id
            ORDER BY te.day_index, te.period_index
        """)
        return [self._from_row(r) for r in rows]

    def get_by_class(self, class_id: int) -> list[TimetableEntry]:
        rows = self.db.fetchall("""
            SELECT te.*,
                   t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, s.code AS subject_code,
                   s.color AS subject_color,
                   c.name AS class_name,
                   r.name AS room_name,
                   l.teacher_id, l.subject_id, l.class_id
            FROM timetable_entry te
            JOIN lesson l ON te.lesson_id = l.id
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
            LEFT JOIN room r ON te.room_id = r.id
            WHERE l.class_id = ?
            ORDER BY te.day_index, te.period_index
        """, (class_id,))
        return [self._from_row(r) for r in rows]

    def get_by_teacher(self, teacher_id: int) -> list[TimetableEntry]:
        rows = self.db.fetchall("""
            SELECT te.*,
                   t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, s.code AS subject_code,
                   s.color AS subject_color,
                   c.name AS class_name,
                   r.name AS room_name,
                   l.teacher_id, l.subject_id, l.class_id
            FROM timetable_entry te
            JOIN lesson l ON te.lesson_id = l.id
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
            LEFT JOIN room r ON te.room_id = r.id
            WHERE l.teacher_id = ?
            ORDER BY te.day_index, te.period_index
        """, (teacher_id,))
        return [self._from_row(r) for r in rows]

    def get_by_room(self, room_id: int) -> list[TimetableEntry]:
        rows = self.db.fetchall("""
            SELECT te.*,
                   t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, s.code AS subject_code,
                   s.color AS subject_color,
                   c.name AS class_name,
                   r.name AS room_name,
                   l.teacher_id, l.subject_id, l.class_id
            FROM timetable_entry te
            JOIN lesson l ON te.lesson_id = l.id
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
            LEFT JOIN room r ON te.room_id = r.id
            WHERE te.room_id = ?
            ORDER BY te.day_index, te.period_index
        """, (room_id,))
        return [self._from_row(r) for r in rows]

    def save_entries(self, entries: list[TimetableEntry]) -> None:
        # Delete non-locked entries, keep locked ones
        self.db.execute("DELETE FROM timetable_entry WHERE locked = 0")
        for e in entries:
            if e.locked:
                # Check if it already exists
                existing = self.db.fetchone(
                    "SELECT id FROM timetable_entry WHERE lesson_id=? AND day_index=? AND period_index=?",
                    (e.lesson_id, e.day_index, e.period_index),
                )
                if existing:
                    continue
            self.db.execute(
                "INSERT INTO timetable_entry (lesson_id, day_index, period_index, room_id, locked) "
                "VALUES (?,?,?,?,?)",
                (e.lesson_id, e.day_index, e.period_index, e.room_id, int(e.locked)),
            )
        self.db.commit()

    def clear_all(self) -> None:
        self.db.execute("DELETE FROM timetable_entry")
        self.db.commit()

    def lock_entry(self, entry_id: int) -> None:
        self.db.execute("UPDATE timetable_entry SET locked=1 WHERE id=?", (entry_id,))
        self.db.commit()

    def unlock_entry(self, entry_id: int) -> None:
        self.db.execute("UPDATE timetable_entry SET locked=0 WHERE id=?", (entry_id,))
        self.db.commit()

    def get_unscheduled_lessons(self) -> list[dict]:
        """Lessons where scheduled count < periods_per_week. Returns list of dicts with
        lesson_id, teacher_name, subject_name, class_name, periods_per_week, scheduled_count.
        """
        rows = self.db.fetchall("""
            SELECT l.id AS lesson_id, l.periods_per_week,
                   t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, c.name AS class_name,
                   (SELECT COUNT(*) FROM timetable_entry te WHERE te.lesson_id = l.id) AS scheduled_count
            FROM lesson l
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
        """)
        return [
            {
                "lesson_id": r["lesson_id"],
                "teacher_name": r["teacher_name"],
                "subject_name": r["subject_name"],
                "class_name": r["class_name"],
                "periods_per_week": r["periods_per_week"],
                "scheduled_count": r["scheduled_count"],
            }
            for r in rows
            if r["scheduled_count"] < r["periods_per_week"]
        ]

    def get_locked_entries(self) -> list[TimetableEntry]:
        rows = self.db.fetchall("""
            SELECT te.*,
                   t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, s.code AS subject_code,
                   s.color AS subject_color,
                   c.name AS class_name,
                   r.name AS room_name,
                   l.teacher_id, l.subject_id, l.class_id
            FROM timetable_entry te
            JOIN lesson l ON te.lesson_id = l.id
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
            LEFT JOIN room r ON te.room_id = r.id
            WHERE te.locked = 1
            ORDER BY te.day_index, te.period_index
        """)
        return [self._from_row(r) for r in rows]

    @staticmethod
    def _from_row(row) -> TimetableEntry:
        keys = row.keys()
        return TimetableEntry(
            id=row["id"], lesson_id=row["lesson_id"],
            day_index=row["day_index"], period_index=row["period_index"],
            room_id=row["room_id"], locked=bool(row["locked"]),
            teacher_name=row["teacher_name"] if "teacher_name" in keys else "",
            subject_name=row["subject_name"] if "subject_name" in keys else "",
            subject_code=row["subject_code"] if "subject_code" in keys else "",
            subject_color=row["subject_color"] if "subject_color" in keys else "",
            class_name=row["class_name"] if "class_name" in keys else "",
            room_name=row["room_name"] if "room_name" in keys else "",
            teacher_id=row["teacher_id"] if "teacher_id" in keys else None,
            subject_id=row["subject_id"] if "subject_id" in keys else None,
            class_id=row["class_id"] if "class_id" in keys else None,
        )
