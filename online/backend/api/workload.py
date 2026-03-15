"""Workload API — teacher load overview, individual, and yearly breakdown."""
from __future__ import annotations
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.teacher_model import Teacher
from backend.models.lesson_model import Lesson
from backend.models.timetable_model import TimetableEntry
from backend.models.substitution_model import Substitution
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


@router.get("/{teacher_id}/yearly")
def workload_yearly(
    project_id: int = Path(...),
    teacher_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Yearly workload breakdown — 40 rows (one per school week).

    Returns: [{week_number, start_date, scheduled, substitutions, total, max}]
    Used by the frontend stacked bar chart (indigo=scheduled, coral=subs).
    """
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id, Teacher.project_id == project_id
    ).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")

    max_pw = teacher.max_periods_week or 30

    # Scheduled = fixed count (same every week since it's a generated timetable)
    scheduled = (
        db.query(func.count(TimetableEntry.id))
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .filter(TimetableEntry.project_id == project_id, Lesson.teacher_id == teacher_id)
        .scalar() or 0
    )

    # Substitutions grouped by week_number
    subs_by_week = dict(
        db.query(Substitution.week_number, func.count(Substitution.id))
        .filter(
            Substitution.project_id == project_id,
            Substitution.sub_teacher_id == teacher_id,
            Substitution.week_number.isnot(None),
        )
        .group_by(Substitution.week_number)
        .all()
    )

    # Academic year: Aug 1 → ~40 weeks
    today = date.today()
    year_start = date(today.year, 8, 1) if today.month >= 8 else date(today.year - 1, 8, 1)
    monday_of_start = year_start - timedelta(days=year_start.weekday())

    weeks = []
    for wn in range(1, 41):
        monday = monday_of_start + timedelta(weeks=wn - 1)
        sub_count = subs_by_week.get(wn, 0)
        weeks.append({
            "week_number": wn,
            "start_date": monday.isoformat(),
            "scheduled": scheduled,
            "substitutions": sub_count,
            "total": scheduled + sub_count,
            "max": max_pw,
        })

    return {
        "teacher_id": teacher.id,
        "teacher_name": f"{teacher.first_name or ''} {teacher.last_name or ''}".strip(),
        "max": max_pw,
        "weeks": weeks,
    }

