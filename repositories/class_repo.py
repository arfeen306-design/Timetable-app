"""Repository for SchoolClass entity."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import SchoolClass

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class ClassRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_all(self) -> list[SchoolClass]:
        rows = self.db.fetchall("SELECT * FROM school_class ORDER BY grade, section")
        return [self._from_row(r) for r in rows]

    def get_by_id(self, class_id: int) -> Optional[SchoolClass]:
        row = self.db.fetchone("SELECT * FROM school_class WHERE id=?", (class_id,))
        return self._from_row(row) if row else None

    def get_by_grade_section_stream(
        self,
        grade: str,
        section: str,
        stream: str,
        exclude_id: Optional[int] = None,
    ) -> Optional[SchoolClass]:
        g = (grade or "").strip()
        s = (section or "").strip()
        t = (stream or "").strip()
        q = (
            "SELECT * FROM school_class WHERE LOWER(TRIM(grade)) = LOWER(?) "
            "AND LOWER(TRIM(COALESCE(section, ''))) = LOWER(?) "
            "AND LOWER(TRIM(COALESCE(stream, ''))) = LOWER(?)"
        )
        params: list = [g, s, t]
        if exclude_id is not None:
            q += " AND id != ?"
            params.append(exclude_id)
        q += " LIMIT 1"
        row = self.db.fetchone(q, tuple(params))
        return self._from_row(row) if row else None

    def create(self, c: SchoolClass) -> SchoolClass:
        self.db.execute(
            "INSERT INTO school_class (grade, section, stream, name, code, color, "
            "class_teacher_id, home_room_id, strength) VALUES (?,?,?,?,?,?,?,?,?)",
            (c.grade, c.section, c.stream, c.name, c.code, c.color,
             c.class_teacher_id, c.home_room_id, c.strength),
        )
        self.db.commit()
        c.id = self.db.last_insert_id()
        return c

    def update(self, c: SchoolClass) -> SchoolClass:
        self.db.execute(
            "UPDATE school_class SET grade=?, section=?, stream=?, name=?, code=?, "
            "color=?, class_teacher_id=?, home_room_id=?, strength=? WHERE id=?",
            (c.grade, c.section, c.stream, c.name, c.code, c.color,
             c.class_teacher_id, c.home_room_id, c.strength, c.id),
        )
        self.db.commit()
        return c

    def delete(self, class_id: int) -> None:
        self.db.execute("DELETE FROM school_class WHERE id=?", (class_id,))
        self.db.commit()

    @staticmethod
    def _from_row(row) -> SchoolClass:
        return SchoolClass(
            id=row["id"], grade=row["grade"], section=row["section"],
            stream=row["stream"], name=row["name"], code=row["code"],
            color=row["color"], class_teacher_id=row["class_teacher_id"],
            home_room_id=row["home_room_id"], strength=row["strength"],
        )
