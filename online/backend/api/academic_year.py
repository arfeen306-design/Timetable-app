"""Academic Year API — setup and week management."""
from __future__ import annotations
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.academic_year_model import AcademicYear
from backend.models.academic_week_model import AcademicWeek


router = APIRouter()


class CreateAcademicYearRequest(BaseModel):
    name: str = "2025-26"
    week_1_start_date: str  # YYYY-MM-DD (should be a Monday)
    week_1_label: Optional[str] = "Week 1"
    total_weeks: int = 40


@router.post("")
def create_academic_year(
    data: CreateAcademicYearRequest,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Create an academic year and generate all week rows."""
    start = date.fromisoformat(data.week_1_start_date)
    # Snap to Monday
    start = start - timedelta(days=start.weekday())

    # Deactivate any existing years for this project
    db.query(AcademicYear).filter(
        AcademicYear.project_id == project_id,
        AcademicYear.is_active == True,
    ).update({"is_active": False})

    year = AcademicYear(
        project_id=project_id,
        name=data.name,
        week_1_start_date=start,
        week_1_label=data.week_1_label or "Week 1",
        total_weeks=data.total_weeks,
        is_active=True,
    )
    db.add(year)
    db.flush()

    # Generate all week rows
    today = date.today()
    today_monday = today - timedelta(days=today.weekday())

    for wn in range(1, data.total_weeks + 1):
        monday = start + timedelta(weeks=wn - 1)
        friday = monday + timedelta(days=4)
        label = data.week_1_label if wn == 1 and data.week_1_label else f"Week {wn}"
        is_current = monday == today_monday

        # Check if week already exists
        existing = db.query(AcademicWeek).filter(
            AcademicWeek.project_id == project_id,
            AcademicWeek.week_number == wn,
            AcademicWeek.academic_year == data.name,
        ).first()

        if existing:
            existing.academic_year_id = year.id
            existing.label = label
            existing.start_date = monday
            existing.end_date = friday
            existing.is_current = is_current
        else:
            week = AcademicWeek(
                project_id=project_id,
                academic_year_id=year.id,
                week_number=wn,
                label=label,
                start_date=monday,
                end_date=friday,
                academic_year=data.name,
                is_current=is_current,
            )
            db.add(week)

    db.commit()
    db.refresh(year)

    return {
        "ok": True,
        "id": year.id,
        "name": year.name,
        "weeks_created": data.total_weeks,
    }


@router.get("")
def get_academic_year(
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Get the active academic year with all weeks."""
    year = db.query(AcademicYear).filter(
        AcademicYear.project_id == project_id,
        AcademicYear.is_active == True,
    ).first()

    if not year:
        return {"active": False, "year": None, "weeks": []}

    weeks = db.query(AcademicWeek).filter(
        AcademicWeek.academic_year_id == year.id,
    ).order_by(AcademicWeek.week_number).all()

    # Auto-detect current week
    today = date.today()
    today_monday = today - timedelta(days=today.weekday())

    return {
        "active": True,
        "year": {
            "id": year.id,
            "name": year.name,
            "week_1_start_date": year.week_1_start_date.isoformat(),
            "week_1_label": year.week_1_label,
            "total_weeks": year.total_weeks,
        },
        "weeks": [
            {
                "id": w.id,
                "week_number": w.week_number,
                "label": w.label or f"Week {w.week_number}",
                "start_date": w.start_date.isoformat(),
                "end_date": w.end_date.isoformat(),
                "is_current": w.start_date == today_monday,
                "status": "Current" if w.start_date == today_monday
                    else ("Past" if w.end_date < today else "Upcoming"),
            }
            for w in weeks
        ],
    }


@router.get("/weeks")
def list_academic_weeks(
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """List all academic weeks for the active year (used in week dropdown)."""
    year = db.query(AcademicYear).filter(
        AcademicYear.project_id == project_id,
        AcademicYear.is_active == True,
    ).first()

    if not year:
        return []

    weeks = db.query(AcademicWeek).filter(
        AcademicWeek.academic_year_id == year.id,
    ).order_by(AcademicWeek.week_number).all()

    today = date.today()
    today_monday = today - timedelta(days=today.weekday())

    return [
        {
            "id": w.id,
            "week_number": w.week_number,
            "label": w.label or f"Week {w.week_number}",
            "start_date": w.start_date.isoformat(),
            "end_date": w.end_date.isoformat(),
            "is_current": w.start_date == today_monday,
        }
        for w in weeks
    ]
