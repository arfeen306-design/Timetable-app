"""Service layer for Teacher operations."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import Teacher
from repositories.teacher_repo import TeacherRepository
from utils.display_utils import teacher_sort_key

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class TeacherService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.repo = TeacherRepository(db)

    def get_all(self) -> list[Teacher]:
        """Return all teachers in stable order (last name, first name)."""
        teachers = self.repo.get_all()
        teachers.sort(key=teacher_sort_key)
        return teachers

    def get_by_id(self, teacher_id: int) -> Teacher | None:
        return self.repo.get_by_id(teacher_id)

    def create(self, teacher: Teacher) -> Teacher:
        if not teacher.code:
            first = teacher.first_name[:1].upper() if teacher.first_name else ""
            last = teacher.last_name[:2].upper() if teacher.last_name else ""
            teacher.code = f"{first}{last}"
        existing = self.repo.get_by_first_last(
            teacher.first_name, teacher.last_name
        )
        if existing:
            raise ValueError(
                "A teacher with this first and last name already exists. "
                "Please use a different name or edit the existing teacher."
            )
        return self.repo.create(teacher)

    def update(self, teacher: Teacher) -> Teacher:
        existing = self.repo.get_by_first_last(
            teacher.first_name, teacher.last_name, exclude_id=teacher.id
        )
        if existing:
            raise ValueError(
                "A teacher with this first and last name already exists. "
                "Please use a different name."
            )
        return self.repo.update(teacher)

    def delete(self, teacher_id: int) -> None:
        self.repo.delete(teacher_id)
