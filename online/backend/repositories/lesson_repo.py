"""Lesson and LessonAllowedRoom repository — project-scoped CRUD."""
from __future__ import annotations
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.models.lesson_model import Lesson, LessonAllowedRoom


def list_by_project(db: Session, project_id: int) -> List[Lesson]:
    return db.query(Lesson).filter(Lesson.project_id == project_id).all()


def get_by_id(db: Session, lesson_id: int) -> Optional[Lesson]:
    return db.query(Lesson).filter(Lesson.id == lesson_id).first()


def get_by_id_and_project(db: Session, lesson_id: int, project_id: int) -> Optional[Lesson]:
    return (
        db.query(Lesson)
        .filter(Lesson.id == lesson_id, Lesson.project_id == project_id)
        .first()
    )


def create(
    db: Session,
    project_id: int,
    *,
    teacher_id: int,
    subject_id: int,
    class_id: int,
    group_id: Optional[int] = None,
    periods_per_week: int = 1,
    duration: int = 1,
    priority: int = 5,
    locked: bool = False,
    preferred_room_id: Optional[int] = None,
    notes: str = "",
    allowed_room_ids: Optional[List[int]] = None,
    commit: bool = True,
) -> Lesson:
    l = Lesson(
        project_id=project_id,
        teacher_id=teacher_id,
        subject_id=subject_id,
        class_id=class_id,
        group_id=group_id,
        periods_per_week=periods_per_week,
        duration=duration,
        priority=priority,
        locked=locked,
        preferred_room_id=preferred_room_id,
        notes=notes,
    )
    db.add(l)
    db.flush()
    if allowed_room_ids:
        for rid in allowed_room_ids:
            db.add(LessonAllowedRoom(lesson_id=l.id, room_id=rid))
    if commit:
        db.commit()
        db.refresh(l)
    return l


def update(db: Session, lesson_id: int, project_id: int, **kwargs) -> Optional[Lesson]:
    l = get_by_id_and_project(db, lesson_id, project_id)
    if not l:
        return None
    allowed_room_ids = kwargs.pop("allowed_room_ids", None)
    for k, v in kwargs.items():
        if hasattr(l, k):
            setattr(l, k, v)
    if allowed_room_ids is not None:
        db.query(LessonAllowedRoom).filter(LessonAllowedRoom.lesson_id == lesson_id).delete()
        for rid in allowed_room_ids:
            db.add(LessonAllowedRoom(lesson_id=lesson_id, room_id=rid))
    db.commit()
    db.refresh(l)
    return l


def delete(db: Session, lesson_id: int, project_id: int) -> bool:
    l = get_by_id_and_project(db, lesson_id, project_id)
    if not l:
        return False
    db.delete(l)
    db.commit()
    return True


def get_allowed_room_ids(db: Session, lesson_id: int) -> List[int]:
    rows = (
        db.query(LessonAllowedRoom.room_id)
        .filter(LessonAllowedRoom.lesson_id == lesson_id)
        .all()
    )
    return [r[0] for r in rows]


def batch_get_allowed_room_ids(db: Session, lesson_ids: List[int]) -> dict[int, List[int]]:
    """Fetch allowed room IDs for many lessons in ONE query. Returns {lesson_id: [room_ids]}."""
    if not lesson_ids:
        return {}
    from collections import defaultdict
    result: dict[int, List[int]] = defaultdict(list)
    rows = (
        db.query(LessonAllowedRoom.lesson_id, LessonAllowedRoom.room_id)
        .filter(LessonAllowedRoom.lesson_id.in_(lesson_ids))
        .all()
    )
    for lid, rid in rows:
        result[lid].append(rid)
    return result
