"""Dashboard API — aggregated data for the project command center."""
from __future__ import annotations
from datetime import date, timedelta, datetime
from fastapi import APIRouter, Depends, Path, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.teacher_model import Teacher
from backend.models.lesson_model import Lesson
from backend.models.timetable_model import TimetableEntry
from backend.models.substitution_model import TeacherAbsence, Substitution
from backend.models.class_model import SchoolClass
from backend.services.workload_service import get_all_workloads

router = APIRouter()


@router.get("")
def get_dashboard(
    project_id: int = Path(...),
    dt: Optional[str] = Query(None, alias="date", description="YYYY-MM-DD, defaults to today"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Main dashboard data aggregation — single call for the project command center."""
    today = date.fromisoformat(dt) if dt else date.today()
    day_index = today.weekday()  # 0=Mon .. 4=Fri
    now = datetime.now()

    # ── School info ──
    from backend.repositories.school_settings_repo import get_by_project
    settings = get_by_project(db, project_id)
    school_name = settings.school_name if settings and hasattr(settings, 'school_name') and settings.school_name else project.name

    # Number of periods per day
    num_periods = settings.periods_per_day if settings and hasattr(settings, 'periods_per_day') else 8

    # ── Teachers ──
    total_teachers = db.query(func.count(Teacher.id)).filter(Teacher.project_id == project_id).scalar() or 0

    # ── Classes ──
    total_classes = db.query(func.count(SchoolClass.id)).filter(SchoolClass.project_id == project_id).scalar() or 0

    # ── Lessons per week ──
    total_lessons = db.query(func.count(TimetableEntry.id)).filter(TimetableEntry.project_id == project_id).scalar() or 0

    # ── Absences today ──
    absences = db.query(TeacherAbsence).filter(
        TeacherAbsence.project_id == project_id,
        TeacherAbsence.date == today,
    ).all()
    absent_ids = [a.teacher_id for a in absences]
    absent_count = len(set(absent_ids))
    present_count = total_teachers - absent_count

    # ── Substitutions today ──
    subs_today = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == today,
    ).all()

    # Build substitution details
    sub_details = []
    for s in subs_today:
        sub_teacher = db.query(Teacher).get(s.sub_teacher_id)
        absent_teacher = db.query(Teacher).get(s.absent_teacher_id)

        # Get lesson info
        lesson = db.query(Lesson).get(s.lesson_id) if s.lesson_id else None
        subject_name = ""
        class_name = ""
        if lesson:
            from backend.models.project import Subject
            subj = db.query(Subject).get(lesson.subject_id) if lesson.subject_id else None
            cls = db.query(SchoolClass).get(lesson.class_id) if lesson.class_id else None
            subject_name = subj.name if subj else ""
            class_name = cls.name if cls else ""

        sub_details.append({
            "id": s.id,
            "period_index": s.period_index,
            "sub_teacher_name": f"{sub_teacher.first_name or ''} {sub_teacher.last_name or ''}".strip() if sub_teacher else "",
            "sub_teacher_initials": "".join(w[0] for w in (f"{sub_teacher.first_name or ''} {sub_teacher.last_name or ''}".strip()).split() if w).upper()[:2] if sub_teacher else "",
            "absent_teacher_name": f"{absent_teacher.first_name or ''} {absent_teacher.last_name or ''}".strip() if absent_teacher else "",
            "subject_name": subject_name,
            "class_name": class_name,
            "is_override": getattr(s, 'is_override', False),
        })

    # ── Unassigned periods (absent teacher slots without substitutions) ──
    # Find all timetable entries for absent teachers on this day
    unassigned = []
    if absent_ids:
        absent_entries = (
            db.query(TimetableEntry, Lesson)
            .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
            .filter(
                TimetableEntry.project_id == project_id,
                TimetableEntry.day_index == day_index,
                Lesson.teacher_id.in_(absent_ids),
            )
            .all()
        )
        assigned_keys = {(s.absent_teacher_id, s.period_index) for s in subs_today}
        for entry, lesson in absent_entries:
            key = (lesson.teacher_id, entry.period_index)
            if key not in assigned_keys:
                teacher = db.query(Teacher).get(lesson.teacher_id)
                tname = f"{teacher.first_name or ''} {teacher.last_name or ''}".strip() if teacher else ""
                unassigned.append({
                    "teacher_name": tname,
                    "period_index": entry.period_index,
                })

    # ── Busy/free teachers right now ──
    # Determine current period (rough estimate based on time)
    current_hour = now.hour
    current_period = max(0, min(current_hour - 8, num_periods - 1))  # Period 0 starts at 8am

    busy_now = (
        db.query(func.count(func.distinct(Lesson.teacher_id)))
        .join(TimetableEntry, TimetableEntry.lesson_id == Lesson.id)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.day_index == day_index,
            TimetableEntry.period_index == current_period,
        )
        .scalar() or 0
    )

    # Teachers on sub duty right now
    on_sub_now = db.query(func.count(func.distinct(Substitution.sub_teacher_id))).filter(
        Substitution.project_id == project_id,
        Substitution.date == today,
        Substitution.period_index == current_period,
    ).scalar() or 0

    free_now = max(0, total_teachers - busy_now - on_sub_now - absent_count)

    # ── Workload overview ──
    workloads = get_all_workloads(db, project_id)
    avg_workload = round(sum(w.get("total", 0) for w in workloads) / len(workloads)) if workloads else 0
    over_max = sum(1 for w in workloads if w.get("utilization_pct", 0) > 100)

    # ── Academic Year / Week ──
    from backend.models.academic_week_model import AcademicWeek
    current_week = db.query(AcademicWeek).filter(
        AcademicWeek.project_id == project_id,
        AcademicWeek.is_current == True,
    ).first()

    academic_year_name = ""
    week_label = ""
    week_number = 0
    if current_week:
        week_number = current_week.week_number
        week_label = current_week.label or f"Week {week_number}"
        academic_year_name = current_week.academic_year or ""

    # ── Top workload bars (for the chart) ──
    workload_chart = []
    for w in sorted(workloads, key=lambda x: x.get("total", 0), reverse=True)[:10]:
        initials = "".join(word[0] for word in w.get("teacher_name", "").split() if word).upper()[:2]
        workload_chart.append({
            "teacher_name": w.get("teacher_name", ""),
            "teacher_code": w.get("teacher_code", ""),
            "initials": initials,
            "scheduled": w.get("scheduled", 0),
            "substitutions": w.get("substitutions", 0),
            "total": w.get("total", 0),
            "max": w.get("max", 30),
            "utilization_pct": w.get("utilization_pct", 0),
        })

    return {
        "school_name": school_name,
        "academic_year": academic_year_name,
        "week_label": week_label,
        "week_number": week_number,
        "date": today.isoformat(),
        "date_formatted": today.strftime("%A %d %B %Y"),
        "time": now.strftime("%I:%M %p"),
        "current_period": current_period,
        "num_periods": num_periods,
        "stats": {
            "total_teachers": total_teachers,
            "present_today": present_count,
            "absent_today": absent_count,
            "busy_now": busy_now,
            "on_sub_now": on_sub_now,
            "free_now": free_now,
            "avg_workload": avg_workload,
            "over_max": over_max,
            "total_classes": total_classes,
            "total_lessons": total_lessons,
            "attendance_pct": round((present_count / total_teachers * 100) if total_teachers else 0),
        },
        "unassigned": unassigned,
        "substitutions_today": sub_details,
        "workload_chart": workload_chart,
        "absent_teachers": [
            {
                "id": a.id,
                "teacher_id": a.teacher_id,
                "teacher_name": (lambda t: f"{t.first_name or ''} {t.last_name or ''}".strip() if t else "")(db.query(Teacher).get(a.teacher_id)),
                "reason": a.reason or "",
            }
            for a in absences
        ],
    }
