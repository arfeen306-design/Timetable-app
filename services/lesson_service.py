"""Service layer for Lesson operations."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import Lesson
from repositories.lesson_repo import LessonRepository

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class LessonService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.repo = LessonRepository(db)

    def get_all(self) -> list[Lesson]:
        return self.repo.get_all()

    def get_by_id(self, lesson_id: int) -> Lesson | None:
        return self.repo.get_by_id(lesson_id)

    def create(self, lesson: Lesson, allowed_room_ids: list[int] | None = None) -> Lesson:
        lesson = self.repo.create(lesson)
        if allowed_room_ids:
            self.repo.set_allowed_rooms(lesson.id, allowed_room_ids)
        return lesson

    def update(self, lesson: Lesson, allowed_room_ids: list[int] | None = None) -> Lesson:
        lesson = self.repo.update(lesson)
        if allowed_room_ids is not None:
            self.repo.set_allowed_rooms(lesson.id, allowed_room_ids)
        return lesson

    def delete(self, lesson_id: int) -> None:
        self.repo.delete(lesson_id)

    def get_allowed_rooms(self, lesson_id: int) -> list[int]:
        return self.repo.get_allowed_rooms(lesson_id)
