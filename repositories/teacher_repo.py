"""Repository for Teacher entity."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import Teacher

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class TeacherRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_all(self) -> list[Teacher]:
        rows = self.db.fetchall("SELECT * FROM teacher ORDER BY first_name, last_name")
        return [self._from_row(r) for r in rows]

    def get_by_id(self, teacher_id: int) -> Optional[Teacher]:
        row = self.db.fetchone("SELECT * FROM teacher WHERE id=?", (teacher_id,))
        return self._from_row(row) if row else None

    def get_by_first_last(
        self, first_name: str, last_name: str, exclude_id: Optional[int] = None
    ) -> Optional[Teacher]:
        first = (first_name or "").strip()
        last = (last_name or "").strip()
        if not first:
            return None
        q = (
            "SELECT * FROM teacher WHERE LOWER(TRIM(first_name)) = LOWER(?) "
            "AND LOWER(TRIM(COALESCE(last_name, ''))) = LOWER(?)"
        )
        params: list = [first, last]
        if exclude_id is not None:
            q += " AND id != ?"
            params.append(exclude_id)
        q += " LIMIT 1"
        row = self.db.fetchone(q, tuple(params))
        return self._from_row(row) if row else None

    def create(self, t: Teacher) -> Teacher:
        self.db.execute(
            "INSERT INTO teacher (first_name, last_name, code, title, color, "
            "max_periods_day, max_periods_week, email, whatsapp_number) VALUES (?,?,?,?,?,?,?,?,?)",
            (t.first_name, t.last_name, t.code, t.title, t.color,
             t.max_periods_day, t.max_periods_week, t.email or "", t.whatsapp_number or ""),
        )
        self.db.commit()
        t.id = self.db.last_insert_id()
        return t

    def update(self, t: Teacher) -> Teacher:
        self.db.execute(
            "UPDATE teacher SET first_name=?, last_name=?, code=?, title=?, color=?, "
            "max_periods_day=?, max_periods_week=?, email=?, whatsapp_number=? WHERE id=?",
            (t.first_name, t.last_name, t.code, t.title, t.color,
             t.max_periods_day, t.max_periods_week, t.email or "", t.whatsapp_number or "", t.id),
        )
        self.db.commit()
        return t

    def delete(self, teacher_id: int) -> None:
        self.db.execute("DELETE FROM teacher WHERE id=?", (teacher_id,))
        self.db.commit()

    @staticmethod
    def _from_row(row) -> Teacher:
        return Teacher(
            id=row["id"], first_name=row["first_name"], last_name=row["last_name"],
            code=row["code"], title=row["title"], color=row["color"],
            max_periods_day=row["max_periods_day"],
            max_periods_week=row["max_periods_week"],
            email=row["email"] if "email" in row.keys() else "",
            whatsapp_number=row["whatsapp_number"] if "whatsapp_number" in row.keys() else "",
        )
