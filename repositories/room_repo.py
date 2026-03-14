"""Repository for Room entity."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import Room

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class RoomRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_all(self) -> list[Room]:
        rows = self.db.fetchall("SELECT * FROM room ORDER BY name")
        return [self._from_row(r) for r in rows]

    def get_by_id(self, room_id: int) -> Optional[Room]:
        row = self.db.fetchone("SELECT * FROM room WHERE id=?", (room_id,))
        return self._from_row(row) if row else None

    def create(self, r: Room) -> Room:
        self.db.execute(
            "INSERT INTO room (name, code, room_type, capacity, color, home_class_id) "
            "VALUES (?,?,?,?,?,?)",
            (r.name, r.code, r.room_type, r.capacity, r.color, r.home_class_id),
        )
        self.db.commit()
        r.id = self.db.last_insert_id()
        return r

    def update(self, r: Room) -> Room:
        self.db.execute(
            "UPDATE room SET name=?, code=?, room_type=?, capacity=?, color=?, "
            "home_class_id=? WHERE id=?",
            (r.name, r.code, r.room_type, r.capacity, r.color, r.home_class_id, r.id),
        )
        self.db.commit()
        return r

    def delete(self, room_id: int) -> None:
        self.db.execute("DELETE FROM room WHERE id=?", (room_id,))
        self.db.commit()

    @staticmethod
    def _from_row(row) -> Room:
        return Room(
            id=row["id"], name=row["name"], code=row["code"],
            room_type=row["room_type"], capacity=row["capacity"],
            color=row["color"], home_class_id=row["home_class_id"],
        )
