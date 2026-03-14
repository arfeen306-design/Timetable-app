"""Service layer for TimeConstraint operations."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import TimeConstraint
from repositories.constraint_repo import ConstraintRepository

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class ConstraintService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.repo = ConstraintRepository(db)

    def get_all(self) -> list[TimeConstraint]:
        return self.repo.get_all()

    def get_by_entity(self, entity_type: str, entity_id: int) -> list[TimeConstraint]:
        return self.repo.get_by_entity(entity_type, entity_id)

    def create(self, constraint: TimeConstraint) -> TimeConstraint:
        return self.repo.create(constraint)

    def delete(self, constraint_id: int) -> None:
        self.repo.delete(constraint_id)

    def save_availability_grid(
        self, entity_type: str, entity_id: int,
        unavailable_slots: list[tuple[int, int]],
    ) -> None:
        self.repo.save_availability_grid(entity_type, entity_id, unavailable_slots)
