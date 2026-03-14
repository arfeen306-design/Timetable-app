"""School settings repository — one row per project."""
from __future__ import annotations
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.school_settings import SchoolSettings
from backend.models.project import Project


def get_by_project(db: Session, project_id: int) -> Optional[SchoolSettings]:
    return db.query(SchoolSettings).filter(SchoolSettings.project_id == project_id).first()


def get_or_create(db: Session, project_id: int) -> SchoolSettings:
    s = get_by_project(db, project_id)
    if s:
        return s
    s = SchoolSettings(project_id=project_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def update(
    db: Session,
    project_id: int,
    *,
    name: Optional[str] = None,
    campus_name: Optional[str] = None,
    academic_year: Optional[str] = None,
    days_per_week: Optional[int] = None,
    periods_per_day: Optional[int] = None,
    period_duration_minutes: Optional[int] = None,
    assembly_duration_minutes: Optional[int] = None,
    weekend_days: Optional[str] = None,
    working_days: Optional[str] = None,
    school_start_time: Optional[str] = None,
    school_end_time: Optional[str] = None,
    friday_start_time: Optional[str] = None,
    friday_end_time: Optional[str] = None,
    saturday_start_time: Optional[str] = None,
    saturday_end_time: Optional[str] = None,
    bell_schedule_json: Optional[str] = None,
    breaks_json: Optional[str] = None,
) -> SchoolSettings:
    s = get_or_create(db, project_id)
    if name is not None:
        s.name = name
    if campus_name is not None:
        s.campus_name = campus_name
    if academic_year is not None:
        s.academic_year = academic_year
    if days_per_week is not None:
        s.days_per_week = days_per_week
    if periods_per_day is not None:
        s.periods_per_day = periods_per_day
    if period_duration_minutes is not None:
        s.period_duration_minutes = period_duration_minutes
    if assembly_duration_minutes is not None:
        s.assembly_duration_minutes = assembly_duration_minutes
    if weekend_days is not None:
        s.weekend_days = weekend_days
    if working_days is not None:
        s.working_days = working_days
    if school_start_time is not None:
        s.school_start_time = school_start_time
    if school_end_time is not None:
        s.school_end_time = school_end_time
    if friday_start_time is not None:
        s.friday_start_time = friday_start_time
    if friday_end_time is not None:
        s.friday_end_time = friday_end_time
    if saturday_start_time is not None:
        s.saturday_start_time = saturday_start_time
    if saturday_end_time is not None:
        s.saturday_end_time = saturday_end_time
    if bell_schedule_json is not None:
        s.bell_schedule_json = bell_schedule_json
    if breaks_json is not None:
        s.breaks_json = breaks_json
    db.commit()
    db.refresh(s)
    return s
