"""Workload service — single source of truth for teacher load computation.

Workload = scheduled lessons (from timetable) + substitutions taken (from substitutions table).
All functions are reusable by both API endpoints and PDF export.
"""
from __future__ import annotations
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from backend.models.timetable_model import TimetableEntry
from backend.models.lesson_model import Lesson
from backend.models.teacher_model import Teacher
from backend.models.substitution_model import Substitution, TeacherAbsence


def _week_range(week_str: Optional[str] = None) -> tuple[date, date]:
    """Parse ISO week string '2025-W12' → (monday, sunday). Defaults to current week."""
    if week_str:
        parts = week_str.split("-W")
        if len(parts) == 2:
            year, week = int(parts[0]), int(parts[1])
            monday = date.fromisocalendar(year, week, 1)
            return monday, monday + timedelta(days=6)
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


def get_teacher_workload(
    db: Session,
    project_id: int,
    teacher_id: int,
    week_str: Optional[str] = None,
) -> dict:
    """Compute workload for a single teacher.

    Returns: {teacher_id, teacher_name, scheduled, substitutions, total, max, utilization_pct}
    """
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id, Teacher.project_id == project_id).first()
    if not teacher:
        return {}

    # Scheduled lessons = count of TimetableEntries where lesson.teacher_id = this teacher
    scheduled = (
        db.query(func.count(TimetableEntry.id))
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .filter(TimetableEntry.project_id == project_id, Lesson.teacher_id == teacher_id)
        .scalar() or 0
    )

    # Substitutions taken this week
    week_start, week_end = _week_range(week_str)
    subs_taken = (
        db.query(func.count(Substitution.id))
        .filter(
            Substitution.project_id == project_id,
            Substitution.sub_teacher_id == teacher_id,
            Substitution.date >= week_start,
            Substitution.date <= week_end,
        )
        .scalar() or 0
    )

    total = scheduled + subs_taken
    max_pw = teacher.max_periods_week or 30

    return {
        "teacher_id": teacher.id,
        "teacher_name": f"{teacher.first_name or ''} {teacher.last_name or ''}".strip(),
        "teacher_code": teacher.code or "",
        "scheduled": scheduled,
        "substitutions": subs_taken,
        "total": total,
        "max": max_pw,
        "utilization_pct": round((total / max_pw * 100) if max_pw else 0, 1),
    }


def get_all_workloads(
    db: Session,
    project_id: int,
    week_str: Optional[str] = None,
) -> List[dict]:
    """Compute workload for ALL teachers in a project."""
    teachers = db.query(Teacher).filter(Teacher.project_id == project_id).order_by(Teacher.first_name).all()

    # Batch: scheduled count per teacher
    scheduled_q = (
        db.query(Lesson.teacher_id, func.count(TimetableEntry.id).label("cnt"))
        .join(TimetableEntry, TimetableEntry.lesson_id == Lesson.id)
        .filter(TimetableEntry.project_id == project_id)
        .group_by(Lesson.teacher_id)
        .all()
    )
    scheduled_map = {r.teacher_id: r.cnt for r in scheduled_q}

    # Batch: substitutions per teacher this week
    week_start, week_end = _week_range(week_str)
    subs_q = (
        db.query(Substitution.sub_teacher_id, func.count(Substitution.id).label("cnt"))
        .filter(
            Substitution.project_id == project_id,
            Substitution.date >= week_start,
            Substitution.date <= week_end,
        )
        .group_by(Substitution.sub_teacher_id)
        .all()
    )
    subs_map = {r.sub_teacher_id: r.cnt for r in subs_q}

    result = []
    for t in teachers:
        s = scheduled_map.get(t.id, 0)
        sub = subs_map.get(t.id, 0)
        total = s + sub
        max_pw = t.max_periods_week or 30
        result.append({
            "teacher_id": t.id,
            "teacher_name": f"{t.first_name or ''} {t.last_name or ''}".strip(),
            "teacher_code": t.code or "",
            "scheduled": s,
            "substitutions": sub,
            "total": total,
            "max": max_pw,
            "utilization_pct": round((total / max_pw * 100) if max_pw else 0, 1),
        })
    return result


def get_free_teachers(
    db: Session,
    project_id: int,
    target_date: date,
    period_index: int,
    absent_ids: List[int],
    week_str: Optional[str] = None,
) -> List[dict]:
    """Find teachers who are NOT scheduled at a given day+period and not absent.

    Filters:
      1. NOT scheduled in TimetableEntry for this exact day_index + period_index
      2. NOT already covering a substitution for this date + period_index
      3. NOT in the absent list

    Ranked by fairness:
      1. periods_today ASC   — lightest day first
      2. subs_this_week ASC  — fewest subs taken first
      3. total ASC           — lightest overall first

    First result gets best_fit: true.
    """
    day_index = target_date.weekday()  # 0=Mon .. 4=Fri
    DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_name = DAY_NAMES[day_index] if day_index < len(DAY_NAMES) else ""

    # Teachers already scheduled at this slot
    busy_sub = (
        db.query(Lesson.teacher_id)
        .join(TimetableEntry, TimetableEntry.lesson_id == Lesson.id)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.day_index == day_index,
            TimetableEntry.period_index == period_index,
        )
    )

    # Teachers who are already covering a substitution at this slot
    sub_busy = (
        db.query(Substitution.sub_teacher_id)
        .filter(
            Substitution.project_id == project_id,
            Substitution.date == target_date,
            Substitution.period_index == period_index,
        )
    )

    # All teachers NOT in busy set, NOT absent
    free = (
        db.query(Teacher)
        .filter(
            Teacher.project_id == project_id,
            Teacher.id.notin_(busy_sub),
            Teacher.id.notin_(sub_busy),
            Teacher.id.notin_(absent_ids) if absent_ids else True,
        )
        .all()
    )

    # ── Teacher subject lookup ──
    from backend.models.teacher_model import TeacherSubject
    from backend.models.project import Subject
    subject_q = (
        db.query(TeacherSubject.teacher_id, Subject.name)
        .join(Subject, TeacherSubject.subject_id == Subject.id)
        .filter(TeacherSubject.teacher_id.in_([t.id for t in free]))
        .all()
    )
    # First subject per teacher (primary subject)
    subject_map: dict[int, str] = {}
    for tid, sname in subject_q:
        if tid not in subject_map:
            subject_map[tid] = sname

    # ── Annotation queries ──

    # 1. periods_today: count of each teacher's timetable slots for THIS day
    periods_today_q = (
        db.query(Lesson.teacher_id, func.count(TimetableEntry.id).label("cnt"))
        .join(TimetableEntry, TimetableEntry.lesson_id == Lesson.id)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.day_index == day_index,
        )
        .group_by(Lesson.teacher_id)
        .all()
    )
    periods_today_map = {r.teacher_id: r.cnt for r in periods_today_q}

    # 2. Weekly workload: scheduled lessons (full week)
    scheduled_q = (
        db.query(Lesson.teacher_id, func.count(TimetableEntry.id).label("cnt"))
        .join(TimetableEntry, TimetableEntry.lesson_id == Lesson.id)
        .filter(TimetableEntry.project_id == project_id)
        .group_by(Lesson.teacher_id)
        .all()
    )
    scheduled_map = {r.teacher_id: r.cnt for r in scheduled_q}

    # 3. subs_this_week
    week_start, week_end = _week_range(week_str)
    subs_q = (
        db.query(Substitution.sub_teacher_id, func.count(Substitution.id).label("cnt"))
        .filter(
            Substitution.project_id == project_id,
            Substitution.date >= week_start,
            Substitution.date <= week_end,
        )
        .group_by(Substitution.sub_teacher_id)
        .all()
    )
    subs_map = {r.sub_teacher_id: r.cnt for r in subs_q}

    # ── Build result with annotations ──
    period_label = f"P{period_index + 1}"
    free_label = f"Free {period_label} {day_name}"

    result = []
    for t in free:
        s = scheduled_map.get(t.id, 0)
        sub = subs_map.get(t.id, 0)
        total = s + sub
        max_pw = t.max_periods_week or 30
        pt = periods_today_map.get(t.id, 0)
        initials = ""
        name = f"{t.first_name or ''} {t.last_name or ''}".strip()
        if name:
            initials = "".join(w[0] for w in name.split() if w).upper()[:2]

        result.append({
            "teacher_id": t.id,
            "teacher_name": name,
            "teacher_code": t.code or "",
            "initials": initials,
            "subject": subject_map.get(t.id, ""),
            "scheduled": s,
            "substitutions": sub,
            "total": total,
            "max": max_pw,
            "utilization_pct": round((total / max_pw * 100) if max_pw else 0, 1),
            "periods_today": pt,
            "subs_this_week": sub,
            "best_fit": False,
            "free_in_period": True,
            "free_period_label": free_label,
            "sub_limit_reached": sub >= 2,
        })

    # ── Fairness sort ──
    result.sort(key=lambda x: (x["periods_today"], x["subs_this_week"], x["total"]))

    # Mark first as best fit
    if result:
        result[0]["best_fit"] = True

    return result


