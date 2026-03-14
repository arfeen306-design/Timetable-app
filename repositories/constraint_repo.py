"""Repository for TimeConstraint entity."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import TimeConstraint

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class ConstraintRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_all(self) -> list[TimeConstraint]:
        rows = self.db.fetchall("SELECT * FROM time_constraint ORDER BY entity_type, entity_id")
        return [self._from_row(r) for r in rows]

    def get_by_entity(self, entity_type: str, entity_id: int) -> list[TimeConstraint]:
        rows = self.db.fetchall(
            "SELECT * FROM time_constraint WHERE entity_type=? AND entity_id=?",
            (entity_type, entity_id),
        )
        return [self._from_row(r) for r in rows]

    def create(self, c: TimeConstraint) -> TimeConstraint:
        self.db.execute(
            "INSERT INTO time_constraint (entity_type, entity_id, day_index, "
            "period_index, constraint_type, weight, is_hard) VALUES (?,?,?,?,?,?,?)",
            (c.entity_type, c.entity_id, c.day_index, c.period_index,
             c.constraint_type, c.weight, int(c.is_hard)),
        )
        self.db.commit()
        c.id = self.db.last_insert_id()
        return c

    def delete(self, constraint_id: int) -> None:
        self.db.execute("DELETE FROM time_constraint WHERE id=?", (constraint_id,))
        self.db.commit()

    def delete_by_entity(self, entity_type: str, entity_id: int) -> None:
        self.db.execute(
            "DELETE FROM time_constraint WHERE entity_type=? AND entity_id=?",
            (entity_type, entity_id),
        )
        self.db.commit()

    def save_availability_grid(
        self, entity_type: str, entity_id: int,
        unavailable_slots: list[tuple[int, int]],
    ) -> None:
        """Replace all unavailable constraints for an entity with a new set."""
        self.db.execute(
            "DELETE FROM time_constraint WHERE entity_type=? AND entity_id=? "
            "AND constraint_type='unavailable'",
            (entity_type, entity_id),
        )
        for day, period in unavailable_slots:
            self.db.execute(
                "INSERT INTO time_constraint (entity_type, entity_id, day_index, "
                "period_index, constraint_type, weight, is_hard) VALUES (?,?,?,?,?,?,?)",
                (entity_type, entity_id, day, period, "unavailable", 10, 1),
            )
        self.db.commit()

    @staticmethod
    def _from_row(row) -> TimeConstraint:
        return TimeConstraint(
            id=row["id"], entity_type=row["entity_type"],
            entity_id=row["entity_id"], day_index=row["day_index"],
            period_index=row["period_index"], constraint_type=row["constraint_type"],
            weight=row["weight"], is_hard=bool(row["is_hard"]),
        )
