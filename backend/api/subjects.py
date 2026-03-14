"""Subjects API: full CRUD."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.subject_repo import list_by_project, get_by_id_and_project, create as create_subject, update as update_subject, delete as delete_subject

router = APIRouter()


class SubjectCreate(BaseModel):
    name: str
    code: str = ""
    color: str = "#4A90D9"
    category: str = "Core"
    max_per_day: int = 2
    double_allowed: bool = False
    preferred_room_type: str = ""


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    max_per_day: Optional[int] = None
    double_allowed: Optional[bool] = None
    preferred_room_type: Optional[str] = None


class SubjectResponse(BaseModel):
    id: int
    project_id: int
    name: str
    code: str
    color: str
    category: str
    max_per_day: int
    double_allowed: bool
    preferred_room_type: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[SubjectResponse])
def list_subjects(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """List subjects for a project."""
    subjects = list_by_project(db, project.id)
    return [SubjectResponse.model_validate(s) for s in subjects]


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Get one subject. 404 if not in project."""
    s = get_by_id_and_project(db, subject_id, project.id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    return SubjectResponse.model_validate(s)


@router.post("", response_model=SubjectResponse)
def create_subject_endpoint(
    data: SubjectCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Create a subject in the project."""
    s = create_subject(
        db,
        project_id=project.id,
        name=data.name,
        code=data.code,
        color=data.color,
        category=data.category,
        max_per_day=data.max_per_day,
        double_allowed=data.double_allowed,
        preferred_room_type=data.preferred_room_type,
    )
    return SubjectResponse.model_validate(s)


@router.patch("/{subject_id}", response_model=SubjectResponse)
def update_subject_endpoint(
    subject_id: int,
    data: SubjectUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Update a subject. 404 if not in project."""
    s = update_subject(
        db, subject_id, project.id,
        **data.model_dump(exclude_unset=True),
    )
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    return SubjectResponse.model_validate(s)


@router.delete("/{subject_id}", status_code=204)
def delete_subject_endpoint(
    subject_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Delete a subject. 404 if not in project."""
    if not delete_subject(db, subject_id, project.id):
        raise HTTPException(status_code=404, detail="Subject not found")
