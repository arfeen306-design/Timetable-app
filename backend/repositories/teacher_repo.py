"""Teacher repository — project-scoped CRUD and teacher_subject mapping."""
from __future__ import annotations
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.models.teacher_model import Teacher, TeacherSubject
from backend.models.project import Subject


def list_by_project(db: Session, project_id: int) -> List[Teacher]:
    return (
        db.query(Teacher)
        .filter(Teacher.project_id == project_id)
        .order_by(Teacher.first_name, Teacher.last_name)
        .all()
    )


def get_by_id(db: Session, teacher_id: int) -> Optional[Teacher]:
    return db.query(Teacher).filter(Teacher.id == teacher_id).first()


def get_by_id_and_project(db: Session, teacher_id: int, project_id: int) -> Optional[Teacher]:
    return (
        db.query(Teacher)
        .filter(Teacher.id == teacher_id, Teacher.project_id == project_id)
        .first()
    )


def find_by_name(db: Session, project_id: int, first_name: str, last_name: str) -> Optional[Teacher]:
    """Find teacher by first+last name within project (for duplicate check)."""
    return (
        db.query(Teacher)
        .filter(
            Teacher.project_id == project_id,
            Teacher.first_name.ilike(first_name.strip()),
            Teacher.last_name.ilike((last_name or "").strip()),
        )
        .first()
    )


def create(
    db: Session,
    project_id: int,
    *,
    first_name: str,
    last_name: str = "",
    code: str = "",
    title: str = "Mr.",
    color: str = "#E8725A",
    max_periods_day: int = 6,
    max_periods_week: int = 30,
    email: str = "",
    whatsapp_number: str = "",
) -> Teacher:
    t = Teacher(
        project_id=project_id,
        first_name=first_name,
        last_name=last_name,
        code=code,
        title=title,
        color=color,
        max_periods_day=max_periods_day,
        max_periods_week=max_periods_week,
        email=email,
        whatsapp_number=whatsapp_number,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def update(db: Session, teacher_id: int, project_id: int, **kwargs) -> Optional[Teacher]:
    t = get_by_id_and_project(db, teacher_id, project_id)
    if not t:
        return None
    for k, v in kwargs.items():
        if hasattr(t, k):
            setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


def delete(db: Session, teacher_id: int, project_id: int) -> bool:
    t = get_by_id_and_project(db, teacher_id, project_id)
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True


def get_subject_ids_for_teacher(db: Session, teacher_id: int) -> List[int]:
    rows = (
        db.query(TeacherSubject.subject_id)
        .filter(TeacherSubject.teacher_id == teacher_id)
        .all()
    )
    return [r[0] for r in rows]


def set_teacher_subjects(db: Session, teacher_id: int, subject_ids: List[int]) -> None:
    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_id).delete()
    for sid in subject_ids:
        db.add(TeacherSubject(teacher_id=teacher_id, subject_id=sid))
    db.commit()
