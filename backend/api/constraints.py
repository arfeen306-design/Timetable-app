"""Constraints API — full CRUD for time constraints, project-scoped."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.constraint_repo import (
    list_by_project,
    get_by_id_and_project,
    create as create_constraint,
    update as update_constraint,
    delete as delete_constraint,
)

router = APIRouter()


class ConstraintCreate(BaseModel):
    entity_type: str  # teacher, class, room
    entity_id: int
    day_index: int
    period_index: int
    constraint_type: str = "unavailable"
    weight: int = 10
    is_hard: bool = True


class ConstraintUpdate(BaseModel):
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    day_index: Optional[int] = None
    period_index: Optional[int] = None
    constraint_type: Optional[str] = None
    weight: Optional[int] = None
    is_hard: Optional[bool] = None


class ConstraintResponse(BaseModel):
    id: int
    project_id: int
    entity_type: str
    entity_id: int
    day_index: int
    period_index: int
    constraint_type: str
    weight: int
    is_hard: bool

    class Config:
        from_attributes = True


@router.get("", response_model=list[ConstraintResponse])
def list_constraints(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    items = list_by_project(db, project.id)
    return [ConstraintResponse.model_validate(c) for c in items]


@router.get("/{constraint_id}", response_model=ConstraintResponse)
def get_constraint(
    constraint_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = get_by_id_and_project(db, constraint_id, project.id)
    if not c:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return ConstraintResponse.model_validate(c)


@router.post("", response_model=ConstraintResponse)
def create_constraint_endpoint(
    data: ConstraintCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = create_constraint(
        db,
        project_id=project.id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        day_index=data.day_index,
        period_index=data.period_index,
        constraint_type=data.constraint_type,
        weight=data.weight,
        is_hard=data.is_hard,
    )
    return ConstraintResponse.model_validate(c)


@router.patch("/{constraint_id}", response_model=ConstraintResponse)
def update_constraint_endpoint(
    constraint_id: int,
    data: ConstraintUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = update_constraint(db, constraint_id, project.id, **data.model_dump(exclude_unset=True))
    if not c:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return ConstraintResponse.model_validate(c)


@router.delete("/{constraint_id}", status_code=204)
def delete_constraint_endpoint(
    constraint_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not delete_constraint(db, constraint_id, project.id):
        raise HTTPException(status_code=404, detail="Constraint not found")
