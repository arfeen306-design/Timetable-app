"""Workload API — teacher load overview and individual workload."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from typing import Optional
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.services.workload_service import get_teacher_workload, get_all_workloads

router = APIRouter()


@router.get("/overview")
def workload_overview(
    project_id: int = Path(...),
    week: Optional[str] = Query(None, description="ISO week e.g. 2025-W12"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """All teachers' workload for a project."""
    return get_all_workloads(db, project_id, week)


@router.get("/{teacher_id}")
def workload_detail(
    project_id: int = Path(...),
    teacher_id: int = Path(...),
    week: Optional[str] = Query(None, description="ISO week e.g. 2025-W12"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Single teacher workload."""
    data = get_teacher_workload(db, project_id, teacher_id, week)
    if not data:
        raise HTTPException(404, "Teacher not found")
    return data
