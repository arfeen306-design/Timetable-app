"""Service layer for SchoolClass operations."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import SchoolClass
from repositories.class_repo import ClassRepository
from utils.display_utils import class_sort_key

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class ClassService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.repo = ClassRepository(db)

    def get_all(self) -> list[SchoolClass]:
        """Return all classes in logical academic order (grade, section, stream)."""
        classes = self.repo.get_all()
        classes.sort(key=class_sort_key)
        return classes

    def get_by_id(self, class_id: int) -> SchoolClass | None:
        return self.repo.get_by_id(class_id)

    def create(self, cls: SchoolClass) -> SchoolClass:
        if not cls.name:
            cls.name = f"Grade {cls.grade} {cls.section}".strip()
        if not cls.code:
            cls.code = f"{cls.grade}{cls.section[:1]}".strip()
        existing = self.repo.get_by_grade_section_stream(
            cls.grade, cls.section, cls.stream
        )
        if existing:
            raise ValueError(
                "A class with this grade, section, and stream already exists. "
                "Please use different values or edit the existing class."
            )
        return self.repo.create(cls)

    def update(self, cls: SchoolClass) -> SchoolClass:
        existing = self.repo.get_by_grade_section_stream(
            cls.grade, cls.section, cls.stream, exclude_id=cls.id
        )
        if existing:
            raise ValueError(
                "A class with this grade, section, and stream already exists. "
                "Please use different values."
            )
        return self.repo.update(cls)

    def delete(self, class_id: int) -> None:
        self.repo.delete(class_id)
