"""Project repository — school-scoped project CRUD."""
from __future__ import annotations
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.models.project import Project


def list_by_school(db: Session, school_id: int, include_archived: bool = False) -> List[Project]:
    q = db.query(Project).filter(Project.school_id == school_id)
    if not include_archived:
        q = q.filter(Project.archived.is_(False))
    return q.order_by(Project.updated_at.desc()).all()


def get_by_id(db: Session, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id).first()


def get_by_id_and_school(db: Session, project_id: int, school_id: int) -> Optional[Project]:
    return db.query(Project).filter(
        Project.id == project_id,
        Project.school_id == school_id,
    ).first()


def create(db: Session, school_id: int, name: str, academic_year: str = "") -> Project:
    p = Project(school_id=school_id, name=name, academic_year=academic_year)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
