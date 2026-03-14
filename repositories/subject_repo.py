"""Repository for Subject entity."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import Subject

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class SubjectRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_all(self) -> list[Subject]:
        rows = self.db.fetchall("SELECT * FROM subject ORDER BY name")
        return [self._from_row(r) for r in rows]

    def get_by_id(self, subject_id: int) -> Optional[Subject]:
        row = self.db.fetchone("SELECT * FROM subject WHERE id=?", (subject_id,))
        return self._from_row(row) if row else None

    def get_by_name(self, name: str, exclude_id: Optional[int] = None) -> Optional[Subject]:
        if not (name or name.strip()):
            return None
        q = "SELECT * FROM subject WHERE LOWER(TRIM(name)) = LOWER(?)"
        params: list = [name.strip()]
        if exclude_id is not None:
            q += " AND id != ?"
            params.append(exclude_id)
        q += " LIMIT 1"
        row = self.db.fetchone(q, tuple(params))
        return self._from_row(row) if row else None

    def get_by_code(self, code: str, exclude_id: Optional[int] = None) -> Optional[Subject]:
        if not (code or code.strip()):
            return None
        q = "SELECT * FROM subject WHERE LOWER(TRIM(code)) = LOWER(?)"
        params: list = [code.strip()]
        if exclude_id is not None:
            q += " AND id != ?"
            params.append(exclude_id)
        q += " LIMIT 1"
        row = self.db.fetchone(q, tuple(params))
        return self._from_row(row) if row else None

    def create(self, s: Subject) -> Subject:
        self.db.execute(
            "INSERT INTO subject (name, code, color, category, max_per_day, "
            "double_allowed, preferred_room_type) VALUES (?,?,?,?,?,?,?)",
            (s.name, s.code, s.color, s.category, s.max_per_day,
             int(s.double_allowed), s.preferred_room_type),
        )
        self.db.commit()
        s.id = self.db.last_insert_id()
        return s

    def update(self, s: Subject) -> Subject:
        self.db.execute(
            "UPDATE subject SET name=?, code=?, color=?, category=?, max_per_day=?, "
            "double_allowed=?, preferred_room_type=? WHERE id=?",
            (s.name, s.code, s.color, s.category, s.max_per_day,
             int(s.double_allowed), s.preferred_room_type, s.id),
        )
        self.db.commit()
        return s

    def delete(self, subject_id: int) -> None:
        self.db.execute("DELETE FROM subject WHERE id=?", (subject_id,))
        self.db.commit()

    @staticmethod
    def _from_row(row) -> Subject:
        return Subject(
            id=row["id"], name=row["name"], code=row["code"], color=row["color"],
            category=row["category"], max_per_day=row["max_per_day"],
            double_allowed=bool(row["double_allowed"]),
            preferred_room_type=row["preferred_room_type"],
        )
