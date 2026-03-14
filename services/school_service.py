"""Service layer for School operations."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from models.domain import School
from repositories.school_repo import SchoolRepository

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class SchoolService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.repo = SchoolRepository(db)

    def get_school(self) -> Optional[School]:
        return self.repo.get()

    def save_school(self, school: School) -> School:
        return self.repo.save(school)

    def get_or_create(self) -> School:
        school = self.repo.get()
        if school is None:
            school = School(name="My School", academic_year="2025-2026")
            school = self.repo.save(school)
        return school
