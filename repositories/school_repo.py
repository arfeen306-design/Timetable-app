"""Repository for School entity."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import School

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class SchoolRepository:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get(self) -> Optional[School]:
        row = self.db.fetchone("SELECT * FROM school LIMIT 1")
        if row is None:
            return None
        return School(
            id=row["id"], name=row["name"], academic_year=row["academic_year"],
            days_per_week=row["days_per_week"], periods_per_day=row["periods_per_day"],
            weekend_days=row["weekend_days"], bell_schedule_json=row["bell_schedule_json"],
        )

    def save(self, school: School) -> School:
        existing = self.get()
        if existing:
            self.db.execute(
                "UPDATE school SET name=?, academic_year=?, days_per_week=?, "
                "periods_per_day=?, weekend_days=?, bell_schedule_json=? WHERE id=?",
                (school.name, school.academic_year, school.days_per_week,
                 school.periods_per_day, school.weekend_days,
                 school.bell_schedule_json, existing.id),
            )
            school.id = existing.id
        else:
            self.db.execute(
                "INSERT INTO school (name, academic_year, days_per_week, "
                "periods_per_day, weekend_days, bell_schedule_json) VALUES (?,?,?,?,?,?)",
                (school.name, school.academic_year, school.days_per_week,
                 school.periods_per_day, school.weekend_days, school.bell_schedule_json),
            )
            school.id = self.db.last_insert_id()
        self.db.commit()
        return school
