"""Lessons API — full CRUD with allowed_room_ids, project-scoped."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.lesson_repo import (
    list_by_project,
    get_by_id_and_project,
    create as create_lesson,
    update as update_lesson,
    delete as delete_lesson,
    get_allowed_room_ids,
)

router = APIRouter()


class LessonCreate(BaseModel):
    teacher_id: int
    subject_id: int
    class_id: int
    group_id: Optional[int] = None
    periods_per_week: int = 1
    duration: int = 1
    priority: int = 5
    locked: bool = False
    preferred_room_id: Optional[int] = None
    notes: str = ""
    allowed_room_ids: Optional[List[int]] = None


class LessonUpdate(BaseModel):
    teacher_id: Optional[int] = None
    subject_id: Optional[int] = None
    class_id: Optional[int] = None
    group_id: Optional[int] = None
    periods_per_week: Optional[int] = None
    duration: Optional[int] = None
    priority: Optional[int] = None
    locked: Optional[bool] = None
    preferred_room_id: Optional[int] = None
    notes: Optional[str] = None
    allowed_room_ids: Optional[List[int]] = None


class LessonResponse(BaseModel):
    id: int
    project_id: int
    teacher_id: int
    subject_id: int
    class_id: int
    group_id: Optional[int] = None
    periods_per_week: int
    duration: int
    priority: int
    locked: bool
    preferred_room_id: Optional[int] = None
    notes: str
    allowed_room_ids: List[int] = []

    class Config:
        from_attributes = True


def _lesson_to_response(lesson, allowed_ids: List[int]) -> LessonResponse:
    d = {
        "id": lesson.id,
        "project_id": lesson.project_id,
        "teacher_id": lesson.teacher_id,
        "subject_id": lesson.subject_id,
        "class_id": lesson.class_id,
        "group_id": lesson.group_id,
        "periods_per_week": lesson.periods_per_week,
        "duration": lesson.duration,
        "priority": lesson.priority,
        "locked": lesson.locked,
        "preferred_room_id": lesson.preferred_room_id,
        "notes": lesson.notes or "",
        "allowed_room_ids": allowed_ids,
    }
    return LessonResponse.model_validate(d)


@router.get("", response_model=list[LessonResponse])
def list_lessons(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    items = list_by_project(db, project.id)
    return [_lesson_to_response(l, get_allowed_room_ids(db, l.id)) for l in items]


class BulkLessonClassItem(BaseModel):
    class_id: int
    periods_per_week: int = 1


class BulkLessonsCreate(BaseModel):
    """Assign one teacher + one subject to multiple classes (same as desktop Bulk Assign)."""
    teacher_id: int
    subject_id: int
    classes: List[BulkLessonClassItem]  # class_id + periods per week for each


class BulkLessonsResult(BaseModel):
    created: int
    errors: List[dict]


@router.post("/bulk", response_model=BulkLessonsResult)
def bulk_create_lessons(
    data: BulkLessonsCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    created = 0
    errors: List[dict] = []
    for i, item in enumerate(data.classes):
        try:
            create_lesson(
                db,
                project_id=project.id,
                teacher_id=data.teacher_id,
                subject_id=data.subject_id,
                class_id=item.class_id,
                periods_per_week=item.periods_per_week,
            )
            created += 1
        except Exception as e:
            errors.append({"row": i + 1, "message": str(e)})
    return BulkLessonsResult(created=created, errors=errors)


class CopyFromClassRequest(BaseModel):
    source_class_id: int
    target_class_ids: List[int]


class CopyFromClassResult(BaseModel):
    copied: int  # number of new lessons created


@router.post("/copy-from-class", response_model=CopyFromClassResult)
def copy_lessons_from_class(
    data: CopyFromClassRequest,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Copy all lessons from source class to each target class (same teacher, subject, periods)."""
    from backend.repositories.lesson_repo import list_by_project
    lessons_source = [l for l in list_by_project(db, project.id) if l.class_id == data.source_class_id]
    copied = 0
    for target_id in data.target_class_ids:
        if target_id == data.source_class_id:
            continue
        for l in lessons_source:
            try:
                create_lesson(
                    db,
                    project_id=project.id,
                    teacher_id=l.teacher_id,
                    subject_id=l.subject_id,
                    class_id=target_id,
                    periods_per_week=l.periods_per_week,
                    duration=l.duration,
                    priority=l.priority,
                )
                copied += 1
            except Exception:
                pass  # skip duplicates or constraint errors
    return CopyFromClassResult(copied=copied)


@router.get("/{lesson_id}", response_model=LessonResponse)
def get_lesson(
    lesson_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    l = get_by_id_and_project(db, lesson_id, project.id)
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return _lesson_to_response(l, get_allowed_room_ids(db, l.id))


@router.post("", response_model=LessonResponse)
def create_lesson_endpoint(
    data: LessonCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    l = create_lesson(
        db,
        project_id=project.id,
        teacher_id=data.teacher_id,
        subject_id=data.subject_id,
        class_id=data.class_id,
        group_id=data.group_id,
        periods_per_week=data.periods_per_week,
        duration=data.duration,
        priority=data.priority,
        locked=data.locked,
        preferred_room_id=data.preferred_room_id,
        notes=data.notes,
        allowed_room_ids=data.allowed_room_ids,
    )
    return _lesson_to_response(l, get_allowed_room_ids(db, l.id))


@router.patch("/{lesson_id}", response_model=LessonResponse)
def update_lesson_endpoint(
    lesson_id: int,
    data: LessonUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    payload = data.model_dump(exclude_unset=True)
    l = update_lesson(db, lesson_id, project.id, **payload)
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return _lesson_to_response(l, get_allowed_room_ids(db, l.id))


@router.delete("/{lesson_id}", status_code=204)
def delete_lesson_endpoint(
    lesson_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not delete_lesson(db, lesson_id, project.id):
        raise HTTPException(status_code=404, detail="Lesson not found")
