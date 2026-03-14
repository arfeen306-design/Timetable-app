"""Room repository — project-scoped CRUD."""
from __future__ import annotations
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.models.room_model import Room


def list_by_project(db: Session, project_id: int) -> List[Room]:
    return db.query(Room).filter(Room.project_id == project_id).order_by(Room.name).all()


def get_by_id(db: Session, room_id: int) -> Optional[Room]:
    return db.query(Room).filter(Room.id == room_id).first()


def get_by_id_and_project(db: Session, room_id: int, project_id: int) -> Optional[Room]:
    return db.query(Room).filter(Room.id == room_id, Room.project_id == project_id).first()


def create(
    db: Session,
    project_id: int,
    *,
    name: str,
    code: str = "",
    room_type: str = "Classroom",
    capacity: int = 40,
    color: str = "#9B59B6",
    home_class_id: Optional[int] = None,
) -> Room:
    r = Room(
        project_id=project_id,
        name=name,
        code=code,
        room_type=room_type,
        capacity=capacity,
        color=color,
        home_class_id=home_class_id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def update(db: Session, room_id: int, project_id: int, **kwargs) -> Optional[Room]:
    r = get_by_id_and_project(db, room_id, project_id)
    if not r:
        return None
    for k, v in kwargs.items():
        if hasattr(r, k):
            setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


def delete(db: Session, room_id: int, project_id: int) -> bool:
    r = get_by_id_and_project(db, room_id, project_id)
    if not r:
        return False
    db.delete(r)
    db.commit()
    return True
