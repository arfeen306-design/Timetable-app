"""Subject repository — project-scoped subject CRUD."""
from __future__ import annotations
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.models.project import Subject


def list_by_project(db: Session, project_id: int) -> List[Subject]:
    return db.query(Subject).filter(Subject.project_id == project_id).order_by(Subject.name).all()


def get_by_id(db: Session, subject_id: int) -> Optional[Subject]:
    return db.query(Subject).filter(Subject.id == subject_id).first()


def get_by_id_and_project(db: Session, subject_id: int, project_id: int) -> Optional[Subject]:
    return (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.project_id == project_id)
        .first()
    )


def create(
    db: Session,
    project_id: int,
    name: str,
    code: str = "",
    color: str = "#4A90D9",
    category: str = "Core",
    max_per_day: int = 2,
    double_allowed: bool = False,
    preferred_room_type: str = "",
) -> Subject:
    s = Subject(
        project_id=project_id,
        name=name,
        code=code,
        color=color,
        category=category,
        max_per_day=max_per_day,
        double_allowed=double_allowed,
        preferred_room_type=preferred_room_type,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def update(db: Session, subject_id: int, project_id: int, **kwargs) -> Optional[Subject]:
    s = get_by_id_and_project(db, subject_id, project_id)
    if not s:
        return None
    for k, v in kwargs.items():
        if hasattr(s, k):
            setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


def delete(db: Session, subject_id: int, project_id: int) -> bool:
    s = get_by_id_and_project(db, subject_id, project_id)
    if not s:
        return False
    db.delete(s)
    db.commit()
    return True
