"""SchoolClass repository — project-scoped CRUD."""
from __future__ import annotations
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.models.class_model import SchoolClass


def list_by_project(db: Session, project_id: int) -> List[SchoolClass]:
    return (
        db.query(SchoolClass)
        .filter(SchoolClass.project_id == project_id)
        .order_by(SchoolClass.grade, SchoolClass.name)
        .all()
    )


def get_by_id(db: Session, class_id: int) -> Optional[SchoolClass]:
    return db.query(SchoolClass).filter(SchoolClass.id == class_id).first()


def get_by_id_and_project(db: Session, class_id: int, project_id: int) -> Optional[SchoolClass]:
    return (
        db.query(SchoolClass)
        .filter(SchoolClass.id == class_id, SchoolClass.project_id == project_id)
        .first()
    )


def find_by_grade_section_stream(
    db: Session, project_id: int, grade: str, section: str, stream: str
) -> Optional[SchoolClass]:
    """Find class by grade/section/stream within project (for duplicate check)."""
    return (
        db.query(SchoolClass)
        .filter(
            SchoolClass.project_id == project_id,
            SchoolClass.grade == (grade or "").strip(),
            SchoolClass.section == (section or "").strip(),
            SchoolClass.stream == (stream or "").strip(),
        )
        .first()
    )


def create(
    db: Session,
    project_id: int,
    *,
    grade: str,
    section: str = "",
    stream: str = "",
    name: str = "",
    code: str = "",
    color: str = "#50C878",
    class_teacher_id: Optional[int] = None,
    home_room_id: Optional[int] = None,
    strength: int = 30,
) -> SchoolClass:
    if not name:
        name = f"{grade}{section or ''}".strip() or "Class"
    c = SchoolClass(
        project_id=project_id,
        grade=grade,
        section=section,
        stream=stream,
        name=name,
        code=code,
        color=color,
        class_teacher_id=class_teacher_id,
        home_room_id=home_room_id,
        strength=strength,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def update(
    db: Session,
    class_id: int,
    project_id: int,
    **kwargs,
) -> Optional[SchoolClass]:
    c = get_by_id_and_project(db, class_id, project_id)
    if not c:
        return None
    for k, v in kwargs.items():
        if hasattr(c, k):
            setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


def delete(db: Session, class_id: int, project_id: int) -> bool:
    c = get_by_id_and_project(db, class_id, project_id)
    if not c:
        return False
    db.delete(c)
    db.commit()
    return True
