"""Project API: list, create, get, duplicate, update, delete."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from backend.auth.deps import get_current_user
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.project_repo import list_by_school, get_by_id_and_school, create as create_project

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str = "New Project"
    academic_year: str = ""


class ProjectResponse(BaseModel):
    id: int
    school_id: int
    name: str
    academic_year: str
    archived: bool
    last_generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List projects for the current school. School A cannot see School B's projects."""
    school_id = current_user.get("school_id")
    if school_id is None:
        return []
    projects = list_by_school(db, school_id)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("", response_model=ProjectResponse)
def create_project_endpoint(
    data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project for the current school."""
    school_id = current_user.get("school_id")
    if school_id is None:
        raise HTTPException(status_code=403, detail="User has no school; cannot create project")
    p = create_project(db, school_id=school_id, name=data.name, academic_year=data.academic_year or "")
    return ProjectResponse.model_validate(p)


@router.post("/demo", response_model=ProjectResponse)
def create_demo_project_endpoint(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.services.demo_data import create_demo_project
    school_id = current_user.get("school_id")
    if school_id is None:
        raise HTTPException(status_code=403, detail="User has no school; cannot create demo project")
    p = create_demo_project(db, school_id)
    return ProjectResponse.model_validate(p)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get one project. Returns 404 if project does not belong to current school (access protection)."""
    school_id = current_user.get("school_id")
    if school_id is None:
        raise HTTPException(status_code=404, detail="Project not found")
    project = get_by_id_and_school(db, project_id=project_id, school_id=school_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.model_validate(project)
