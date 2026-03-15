"""Week utilities — resolve dates to academic week numbers and manage TeacherWeekSub.

The academic year starts on a configurable date (typically early August/September).
Week 1 begins on the Monday of that start date's week.
All substitution + workload queries use week_number instead of raw date ranges.
"""
from __future__ import annotations
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.models.academic_week_model import AcademicWeek
from backend.models.substitution_model import TeacherWeekSub


def _monday_of(d: date) -> date:
    """Return the Monday of the week containing date d."""
    return d - timedelta(days=d.weekday())


def _academic_year_label(d: date) -> str:
    """Return academic year like '2025-26'. Year starts Aug 1."""
    if d.month >= 8:
        return f"{d.year}-{str(d.year + 1)[-2:]}"
    return f"{d.year - 1}-{str(d.year)[-2:]}"


def _academic_year_start(d: date) -> date:
    """Return Aug 1 of the academic year containing date d."""
    if d.month >= 8:
        return date(d.year, 8, 1)
    return date(d.year - 1, 8, 1)


def resolve_week_number(target_date: date) -> int:
    """Compute the school week number (1-based) from the academic year start."""
    year_start = _academic_year_start(target_date)
    monday_of_start = _monday_of(year_start)
    monday_of_target = _monday_of(target_date)
    diff_days = (monday_of_target - monday_of_start).days
    return max(1, (diff_days // 7) + 1)


def get_or_create_week(
    db: Session,
    project_id: int,
    target_date: date,
) -> AcademicWeek:
    """Get or create the AcademicWeek row for the given date and project."""
    week_number = resolve_week_number(target_date)
    academic_year = _academic_year_label(target_date)
    monday = _monday_of(target_date)
    friday = monday + timedelta(days=4)

    existing = db.query(AcademicWeek).filter(
        and_(
            AcademicWeek.project_id == project_id,
            AcademicWeek.week_number == week_number,
            AcademicWeek.academic_year == academic_year,
        )
    ).first()

    if existing:
        return existing

    week = AcademicWeek(
        project_id=project_id,
        week_number=week_number,
        start_date=monday,
        end_date=friday,
        academic_year=academic_year,
    )
    db.add(week)
    db.flush()
    return week


def get_week_range(week_number: int, target_date: Optional[date] = None) -> tuple[date, date]:
    """Given a week_number, return (monday, friday) for that academic week."""
    base = target_date or date.today()
    year_start = _academic_year_start(base)
    monday_of_start = _monday_of(year_start)
    monday = monday_of_start + timedelta(weeks=week_number - 1)
    friday = monday + timedelta(days=4)
    return monday, friday


def get_or_create_teacher_week_sub(
    db: Session,
    project_id: int,
    teacher_id: int,
    academic_week_id: int,
) -> TeacherWeekSub:
    """Get or create the TeacherWeekSub row for this teacher+week.

    Fresh rows start with sub_count=0, override_count=0.
    No cron needed — new weeks just get new rows on first use.
    """
    existing = db.query(TeacherWeekSub).filter(
        TeacherWeekSub.teacher_id == teacher_id,
        TeacherWeekSub.academic_week_id == academic_week_id,
    ).first()

    if existing:
        return existing

    tws = TeacherWeekSub(
        project_id=project_id,
        teacher_id=teacher_id,
        academic_week_id=academic_week_id,
        sub_count=0,
        override_count=0,
    )
    db.add(tws)
    db.flush()
    return tws
