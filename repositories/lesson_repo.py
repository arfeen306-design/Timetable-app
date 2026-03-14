"""Repository for Lesson and LessonAllowedRoom entities."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import Lesson, LessonAllowedRoom

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class LessonRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_all(self) -> list[Lesson]:
        rows = self.db.fetchall("""
            SELECT l.*, t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, c.name AS class_name
            FROM lesson l
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
            ORDER BY c.name, s.name
        """)
        return [self._from_row(r) for r in rows]

    def get_by_id(self, lesson_id: int) -> Optional[Lesson]:
        row = self.db.fetchone("""
            SELECT l.*, t.first_name || ' ' || t.last_name AS teacher_name,
                   s.name AS subject_name, c.name AS class_name
            FROM lesson l
            JOIN teacher t ON l.teacher_id = t.id
            JOIN subject s ON l.subject_id = s.id
            JOIN school_class c ON l.class_id = c.id
            WHERE l.id=?
        """, (lesson_id,))
        return self._from_row(row) if row else None

    def create(self, l: Lesson) -> Lesson:
        self.db.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, group_id, "
            "periods_per_week, duration, priority, locked, preferred_room_id, notes) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (l.teacher_id, l.subject_id, l.class_id, l.group_id,
             l.periods_per_week, l.duration, l.priority, int(l.locked),
             l.preferred_room_id, l.notes),
        )
        self.db.commit()
        l.id = self.db.last_insert_id()
        return l

    def update(self, l: Lesson) -> Lesson:
        self.db.execute(
            "UPDATE lesson SET teacher_id=?, subject_id=?, class_id=?, group_id=?, "
            "periods_per_week=?, duration=?, priority=?, locked=?, "
            "preferred_room_id=?, notes=? WHERE id=?",
            (l.teacher_id, l.subject_id, l.class_id, l.group_id,
             l.periods_per_week, l.duration, l.priority, int(l.locked),
             l.preferred_room_id, l.notes, l.id),
        )
        self.db.commit()
        return l

    def delete(self, lesson_id: int) -> None:
        self.db.execute("DELETE FROM lesson WHERE id=?", (lesson_id,))
        self.db.commit()

    def count_by_teacher(self, teacher_id: int) -> int:
        row = self.db.fetchone("SELECT COUNT(*) AS n FROM lesson WHERE teacher_id=?", (teacher_id,))
        return row["n"] if row else 0

    def get_allowed_rooms(self, lesson_id: int) -> list[int]:
        rows = self.db.fetchall(
            "SELECT room_id FROM lesson_allowed_room WHERE lesson_id=?", (lesson_id,)
        )
        return [r["room_id"] for r in rows]

    def set_allowed_rooms(self, lesson_id: int, room_ids: list[int]) -> None:
        self.db.execute("DELETE FROM lesson_allowed_room WHERE lesson_id=?", (lesson_id,))
        for rid in room_ids:
            self.db.execute(
                "INSERT INTO lesson_allowed_room (lesson_id, room_id) VALUES (?,?)",
                (lesson_id, rid),
            )
        self.db.commit()

    @staticmethod
    def _from_row(row) -> Lesson:
        return Lesson(
            id=row["id"], teacher_id=row["teacher_id"], subject_id=row["subject_id"],
            class_id=row["class_id"], group_id=row["group_id"],
            periods_per_week=row["periods_per_week"], duration=row["duration"],
            priority=row["priority"], locked=bool(row["locked"]),
            preferred_room_id=row["preferred_room_id"], notes=row["notes"],
            teacher_name=row["teacher_name"] if "teacher_name" in row.keys() else "",
            subject_name=row["subject_name"] if "subject_name" in row.keys() else "",
            class_name=row["class_name"] if "class_name" in row.keys() else "",
        )
