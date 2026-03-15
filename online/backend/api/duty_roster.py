"""Duty Roster API — CRUD for teacher duty assignments (gate / hall / lunch / …)."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.models.duty_roster_model import DutyRoster

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class DutyRosterCreate(BaseModel):
    teacher_id:   int
    duty_type:    str
    day_of_week:  int   # 0–6
    period_index: int
    notes:        Optional[str] = None


class DutyRosterUpdate(BaseModel):
    teacher_id:   Optional[int] = None
    duty_type:    Optional[str] = None
    day_of_week:  Optional[int] = None
    period_index: Optional[int] = None
    notes:        Optional[str] = None


class DutyRosterResponse(BaseModel):
    id:           int
    project_id:   int
    teacher_id:   int
    duty_type:    str
    day_of_week:  int
    period_index: int
    notes:        Optional[str]

    class Config:
        from_attributes = True


# ── Service: conflict check ───────────────────────────────────────────────────

def check_duty_conflict(
    db: Session,
    project_id: int,
    teacher_id: int,
    day_of_week: int,
    period_index: int,
    exclude_id: Optional[int] = None,
) -> None:
    """
    Raise HTTP 409 if the teacher already has a duty assignment in
    (day_of_week, period_index) for this project.
    Pass exclude_id on update to ignore the record being edited.
    """
    q = (
        db.query(DutyRoster)
        .filter(
            DutyRoster.project_id   == project_id,
            DutyRoster.teacher_id   == teacher_id,
            DutyRoster.day_of_week  == day_of_week,
            DutyRoster.period_index == period_index,
        )
    )
    if exclude_id is not None:
        q = q.filter(DutyRoster.id != exclude_id)
    if q.first():
        raise HTTPException(
            status_code=409,
            detail="This teacher already has a duty assignment in that slot.",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[DutyRosterResponse])
def list_duty_roster(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    return (
        db.query(DutyRoster)
        .filter(DutyRoster.project_id == project.id)
        .order_by(DutyRoster.day_of_week, DutyRoster.period_index)
        .all()
    )


@router.post("", response_model=DutyRosterResponse)
def create_duty_entry(
    data: DutyRosterCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    check_duty_conflict(
        db, project.id, data.teacher_id, data.day_of_week, data.period_index
    )
    entry = DutyRoster(
        project_id=project.id,
        teacher_id=data.teacher_id,
        duty_type=data.duty_type,
        day_of_week=data.day_of_week,
        period_index=data.period_index,
        notes=data.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=DutyRosterResponse)
def get_duty_entry(
    entry_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DutyRoster)
        .filter(DutyRoster.id == entry_id, DutyRoster.project_id == project.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")
    return entry


@router.patch("/{entry_id}", response_model=DutyRosterResponse)
def update_duty_entry(
    entry_id: int,
    data: DutyRosterUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DutyRoster)
        .filter(DutyRoster.id == entry_id, DutyRoster.project_id == project.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")

    patch = data.model_dump(exclude_unset=True)

    # Recompute conflict with the merged values
    check_duty_conflict(
        db,
        project.id,
        patch.get("teacher_id",   entry.teacher_id),
        patch.get("day_of_week",  entry.day_of_week),
        patch.get("period_index", entry.period_index),
        exclude_id=entry_id,
    )

    for key, val in patch.items():
        setattr(entry, key, val)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_duty_entry(
    entry_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DutyRoster)
        .filter(DutyRoster.id == entry_id, DutyRoster.project_id == project.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")
    db.delete(entry)
    db.commit()
