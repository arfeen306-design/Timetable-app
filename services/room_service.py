"""Service layer for Room operations."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import Room
from repositories.room_repo import RoomRepository

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class RoomService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.repo = RoomRepository(db)

    def get_all(self) -> list[Room]:
        return self.repo.get_all()

    def get_by_id(self, room_id: int) -> Room | None:
        return self.repo.get_by_id(room_id)

    def create(self, room: Room) -> Room:
        if not room.code:
            room.code = room.name[:4].upper()
        return self.repo.create(room)

    def update(self, room: Room) -> Room:
        return self.repo.update(room)

    def delete(self, room_id: int) -> None:
        self.repo.delete(room_id)
