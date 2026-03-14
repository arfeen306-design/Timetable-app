"""Service layer for Subject operations."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import Subject
from repositories.subject_repo import SubjectRepository
from utils.display_utils import subject_sort_key

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class SubjectService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.repo = SubjectRepository(db)

    def get_all(self) -> list[Subject]:
        """Return all subjects in stable order (category, name)."""
        subjects = self.repo.get_all()
        subjects.sort(key=subject_sort_key)
        return subjects

    def get_by_id(self, subject_id: int) -> Subject | None:
        return self.repo.get_by_id(subject_id)

    def create(self, subject: Subject) -> Subject:
        if not subject.code:
            subject.code = subject.name[:3].upper()
        existing_name = self.repo.get_by_name(subject.name)
        if existing_name:
            raise ValueError("A subject with this name already exists.")
        existing_code = self.repo.get_by_code(subject.code)
        if existing_code:
            raise ValueError("A subject with this code already exists.")
        return self.repo.create(subject)

    def update(self, subject: Subject) -> Subject:
        existing_name = self.repo.get_by_name(subject.name, exclude_id=subject.id)
        if existing_name:
            raise ValueError("A subject with this name already exists.")
        existing_code = self.repo.get_by_code(subject.code, exclude_id=subject.id)
        if existing_code:
            raise ValueError("A subject with this code already exists.")
        return self.repo.update(subject)

    def delete(self, subject_id: int) -> None:
        self.repo.delete(subject_id)
