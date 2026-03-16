"""Timetable history API — read-only log of timetable actions."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from backend.models.base import get_db
from backend.models.timetable_history import TimetableHistory
from backend.auth.project_scope import get_project_or_404

router = APIRouter()


@router.get("")
def get_timetable_history(
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(TimetableHistory)
        .filter(TimetableHistory.project_id == project.id)
        .order_by(TimetableHistory.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": r.id,
            "action": r.action,
            "description": r.description,
            "created_by": r.created_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "clash_count": r.clash_count,
            "teacher_count": r.teacher_count,
            "class_count": r.class_count,
            "is_current": r.is_current,
        }
        for r in rows
    ]
