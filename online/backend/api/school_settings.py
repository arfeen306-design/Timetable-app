"""School settings API — GET/PUT for project's school config (bell schedule, days, periods)."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.school_settings_repo import get_or_create, update as update_settings

router = APIRouter()


class SchoolSettingsResponse(BaseModel):
    id: int
    project_id: int
    name: str
    campus_name: str = ""
    academic_year: str
    days_per_week: int
    periods_per_day: int
    period_duration_minutes: int = 45
    assembly_duration_minutes: int = 0
    weekend_days: str
    working_days: str = "1,2,3,4,5"
    school_start_time: str = "08:00"
    school_end_time: str = "15:00"
    friday_start_time: Optional[str] = None
    friday_end_time: Optional[str] = None
    saturday_start_time: Optional[str] = None
    saturday_end_time: Optional[str] = None
    bell_schedule_json: str
    breaks_json: str = "[]"

    class Config:
        from_attributes = True


class SchoolSettingsUpdate(BaseModel):
    name: Optional[str] = None
    campus_name: Optional[str] = None
    academic_year: Optional[str] = None
    days_per_week: Optional[int] = None
    periods_per_day: Optional[int] = None
    period_duration_minutes: Optional[int] = None
    assembly_duration_minutes: Optional[int] = None
    weekend_days: Optional[str] = None
    working_days: Optional[str] = None
    school_start_time: Optional[str] = None
    school_end_time: Optional[str] = None
    friday_start_time: Optional[str] = None
    friday_end_time: Optional[str] = None
    saturday_start_time: Optional[str] = None
    saturday_end_time: Optional[str] = None
    bell_schedule_json: Optional[str] = None
    breaks_json: Optional[str] = None


@router.get("", response_model=SchoolSettingsResponse)
def get_school_settings(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    s = get_or_create(db, project.id)
    return SchoolSettingsResponse(
        id=s.id,
        project_id=s.project_id,
        name=s.name,
        campus_name=getattr(s, "campus_name", ""),
        academic_year=s.academic_year,
        days_per_week=s.days_per_week,
        periods_per_day=s.periods_per_day,
        period_duration_minutes=getattr(s, "period_duration_minutes", 45),
        assembly_duration_minutes=getattr(s, "assembly_duration_minutes", 0),
        weekend_days=s.weekend_days,
        working_days=getattr(s, "working_days", "1,2,3,4,5"),
        school_start_time=getattr(s, "school_start_time", "08:00"),
        school_end_time=getattr(s, "school_end_time", "15:00"),
        friday_start_time=getattr(s, "friday_start_time", None),
        friday_end_time=getattr(s, "friday_end_time", None),
        saturday_start_time=getattr(s, "saturday_start_time", None),
        saturday_end_time=getattr(s, "saturday_end_time", None),
        bell_schedule_json=s.bell_schedule_json,
        breaks_json=getattr(s, "breaks_json", "[]"),
    )


@router.put("", response_model=SchoolSettingsResponse)
def update_school_settings(
    data: SchoolSettingsUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Update school settings. Partial update supported."""
    s = update_settings(
        db,
        project.id,
        name=data.name,
        campus_name=data.campus_name,
        academic_year=data.academic_year,
        days_per_week=data.days_per_week,
        periods_per_day=data.periods_per_day,
        period_duration_minutes=data.period_duration_minutes,
        assembly_duration_minutes=data.assembly_duration_minutes,
        weekend_days=data.weekend_days,
        working_days=data.working_days,
        school_start_time=data.school_start_time,
        school_end_time=data.school_end_time,
        friday_start_time=data.friday_start_time,
        friday_end_time=data.friday_end_time,
        saturday_start_time=data.saturday_start_time,
        saturday_end_time=data.saturday_end_time,
        bell_schedule_json=data.bell_schedule_json,
        breaks_json=data.breaks_json,
    )
    return SchoolSettingsResponse.model_validate(s)


@router.get("/period-slots")
def get_period_slots(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate period slots (with breaks) from current school settings for the week."""
    from backend.services.time_engine import generate_week_slots
    s = get_or_create(db, project.id)
    settings_dict = {
        "school_start_time": getattr(s, "school_start_time", "08:00"),
        "school_end_time": getattr(s, "school_end_time", "15:00"),
        "period_duration_minutes": getattr(s, "period_duration_minutes", 45),
        "periods_per_day": getattr(s, "periods_per_day", 0),
        "breaks_json": getattr(s, "breaks_json", "[]"),
        "bell_schedule_json": getattr(s, "bell_schedule_json", "{}"),
        "friday_start_time": getattr(s, "friday_start_time", None),
        "friday_end_time": getattr(s, "friday_end_time", None),
        "saturday_start_time": getattr(s, "saturday_start_time", None),
        "saturday_end_time": getattr(s, "saturday_end_time", None),
        "working_days": getattr(s, "working_days", "1,2,3,4,5"),
    }
    return generate_week_slots(settings_dict)
