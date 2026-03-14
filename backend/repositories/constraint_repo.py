"""TimeConstraint repository — project-scoped CRUD."""
from __future__ import annotations
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.models.constraint_model import TimeConstraint


def list_by_project(db: Session, project_id: int) -> List[TimeConstraint]:
    return (
        db.query(TimeConstraint)
        .filter(TimeConstraint.project_id == project_id)
        .order_by(TimeConstraint.entity_type, TimeConstraint.entity_id, TimeConstraint.day_index, TimeConstraint.period_index)
        .all()
    )


def get_by_id(db: Session, constraint_id: int) -> Optional[TimeConstraint]:
    return db.query(TimeConstraint).filter(TimeConstraint.id == constraint_id).first()


def get_by_id_and_project(db: Session, constraint_id: int, project_id: int) -> Optional[TimeConstraint]:
    return (
        db.query(TimeConstraint)
        .filter(TimeConstraint.id == constraint_id, TimeConstraint.project_id == project_id)
        .first()
    )


def create(
    db: Session,
    project_id: int,
    *,
    entity_type: str,
    entity_id: int,
    day_index: int,
    period_index: int,
    constraint_type: str = "unavailable",
    weight: int = 10,
    is_hard: bool = True,
) -> TimeConstraint:
    c = TimeConstraint(
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        day_index=day_index,
        period_index=period_index,
        constraint_type=constraint_type,
        weight=weight,
        is_hard=is_hard,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def update(db: Session, constraint_id: int, project_id: int, **kwargs) -> Optional[TimeConstraint]:
    c = get_by_id_and_project(db, constraint_id, project_id)
    if not c:
        return None
    for k, v in kwargs.items():
        if hasattr(c, k):
            setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


def delete(db: Session, constraint_id: int, project_id: int) -> bool:
    c = get_by_id_and_project(db, constraint_id, project_id)
    if not c:
        return False
    db.delete(c)
    db.commit()
    return True
