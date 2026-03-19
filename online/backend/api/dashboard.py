"""Dashboard API — aggregated data for the project command center."""
from __future__ import annotations
from datetime import date, timedelta, datetime, timezone
from fastapi import APIRouter, Depends, Path, Query, Request
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # Python 3.8 compat

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
    request: Request,
    project_id: int = Path(...),
    dt: Optional[str] = Query(None, alias="date", description="YYYY-MM-DD, defaults to today"),
    tz: Optional[str] = Query(None, description="Client timezone, e.g. Asia/Karachi"),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Main dashboard data aggregation — single call for the project command center."""
    # Use client timezone if provided, otherwise fall back to UTC
    try:
        user_tz = ZoneInfo(tz) if tz else None
    except (KeyError, Exception):
        user_tz = None

    if user_tz:
        now = datetime.now(user_tz)
    else:
        now = datetime.now()

    today = date.fromisoformat(dt) if dt else now.date()
    day_index = today.weekday()  # 0=Mon .. 4=Fri

    # ── School info ──
    from backend.repositories.school_settings_repo import get_by_project
    settings = get_by_project(db, project_id)
    school_name = settings.school_name if settings and hasattr(settings, 'school_name') and settings.school_name else project.name

    # Number of periods per day
    num_periods = settings.periods_per_day if settings and hasattr(settings, 'periods_per_day') else 8

    # ── Weekend / Holiday detection ──
    weekend_days_str = getattr(settings, 'weekend_days', '5,6') or '5,6'
    python_weekday = today.weekday()  # 0=Mon..6=Sun — matches weekend_days encoding
    weekend_set = set()
    for wd in weekend_days_str.split(','):
        try:
            weekend_set.add(int(wd.strip()))
        except ValueError:
            pass
    is_off_day = python_weekday in weekend_set

    # ── Generate real lesson slots from bell schedule ──
    from backend.services.time_engine import generate_period_slots_for_day
    lesson_slots = []
    current_lesson_index = -1
    current_lesson_start = ""
    current_lesson_end = ""

    # ── Determine exceptional day from bell_schedule_json ──
    import json as _json
    _bell = {}
    try:
        _bell_raw = getattr(settings, 'bell_schedule_json', '{}') or '{}'
        _bell = _json.loads(_bell_raw) if isinstance(_bell_raw, str) else (_bell_raw if isinstance(_bell_raw, dict) else {})
    except Exception:
        pass
    _exceptional_day_idx = _bell.get('friday_day_index', 4) if _bell.get('friday_different') else -1
    _is_exceptional_day = (python_weekday == _exceptional_day_idx)

    if not is_off_day:
        slots = generate_period_slots_for_day(
            day_index=python_weekday,
            school_start_time=getattr(settings, 'school_start_time', '08:00') or '08:00',
            school_end_time=getattr(settings, 'school_end_time', '15:00') or '15:00',
            period_duration_minutes=getattr(settings, 'period_duration_minutes', 45) or 45,
            breaks_json=getattr(settings, 'breaks_json', '[]') or '[]',
            periods_per_day=num_periods,
            bell_schedule_json=_bell_raw,
            friday_start_time=getattr(settings, 'friday_start_time', None),
            friday_end_time=getattr(settings, 'friday_end_time', None),
            is_friday=_is_exceptional_day,
            is_saturday=False,  # deprecated: exceptional day handled via is_friday
            saturday_start_time=getattr(settings, 'saturday_start_time', None),
            saturday_end_time=getattr(settings, 'saturday_end_time', None),
        )

        now_minutes = now.hour * 60 + now.minute
        lesson_num = 0
        for slot in slots:
            sh, sm = slot.start_time.split(':')
            eh, em = slot.end_time.split(':')
            start_min = int(sh) * 60 + int(sm)
            end_min = int(eh) * 60 + int(em)

            if slot.is_break:
                lesson_slots.append({
                    "type": "break",
                    "label": slot.break_name or "Break",
                    "start_time": slot.start_time,
                    "end_time": slot.end_time,
                    "is_current": start_min <= now_minutes < end_min,
                    "is_past": now_minutes >= end_min,
                })
            else:
                lesson_num += 1
                is_current = start_min <= now_minutes < end_min
                lesson_slots.append({
                    "type": "lesson",
                    "lesson_number": lesson_num,
                    "period_index": slot.period_index,
                    "label": f"Lesson {lesson_num}",
                    "start_time": slot.start_time,
                    "end_time": slot.end_time,
                    "is_current": is_current,
                    "is_past": now_minutes >= end_min,
                })
                if is_current:
                    current_lesson_index = slot.period_index
                    current_lesson_start = slot.start_time
                    current_lesson_end = slot.end_time

    # ── Teachers ──
    total_teachers = db.query(func.count(Teacher.id)).filter(Teacher.project_id == project_id).scalar() or 0

    # ── Classes — with grade breakdown ──
    total_classes = db.query(func.count(SchoolClass.id)).filter(SchoolClass.project_id == project_id).scalar() or 0

    # Grade breakdown: group by grade, count sections per grade
    grade_rows = (
        db.query(SchoolClass.grade, func.count(SchoolClass.id).label("section_count"))
        .filter(SchoolClass.project_id == project_id)
        .group_by(SchoolClass.grade)
        .order_by(SchoolClass.grade)
        .all()
    )
    class_breakdown = [
        {"grade": row.grade or "Ungraded", "sections": row.section_count}
        for row in grade_rows
    ]
    total_grades = len(class_breakdown)

    # ── Lessons per week ──
    total_lessons = db.query(func.count(TimetableEntry.id)).filter(TimetableEntry.project_id == project_id).scalar() or 0

    # ── Absences today ──
    absences = db.query(TeacherAbsence).filter(
        TeacherAbsence.project_id == project_id,
        TeacherAbsence.date == today,
    ).all()
    absent_ids = [a.teacher_id for a in absences]
    absent_count = len(set(absent_ids))

    # On off-days: present = 0, absent = 0 (nobody is at school)
    if is_off_day:
        present_count = 0
        absent_count = 0
    else:
        present_count = total_teachers - absent_count

    # ── Pre-load all teachers for this project (avoid N+1) ──
    all_teachers = db.query(Teacher).filter(Teacher.project_id == project_id).all()
    teachers_by_id = {t.id: t for t in all_teachers}

    def teacher_name(tid):
        t = teachers_by_id.get(tid)
        return f"{t.first_name or ''} {t.last_name or ''}".strip() if t else ""

    def teacher_initials(tid):
        name = teacher_name(tid)
        return "".join(w[0] for w in name.split() if w).upper()[:2]

    # ── Substitutions today ──
    subs_today = db.query(Substitution).filter(
        Substitution.project_id == project_id,
        Substitution.date == today,
    ).all()

    # Batch-load lessons, subjects, classes for subs
    from backend.models.project import Subject
    lesson_ids = [s.lesson_id for s in subs_today if s.lesson_id]
    lessons_map = {}
    subjects_map = {}
    classes_map = {}
    if lesson_ids:
        lessons = db.query(Lesson).filter(Lesson.id.in_(lesson_ids)).all()
        lessons_map = {l.id: l for l in lessons}
        subj_ids = [l.subject_id for l in lessons if l.subject_id]
        cls_ids = [l.class_id for l in lessons if l.class_id]
        if subj_ids:
            subjects_map = {s.id: s for s in db.query(Subject).filter(Subject.id.in_(subj_ids)).all()}
        if cls_ids:
            classes_map = {c.id: c for c in db.query(SchoolClass).filter(SchoolClass.id.in_(cls_ids)).all()}

    sub_details = []
    for s in subs_today:
        lesson = lessons_map.get(s.lesson_id) if s.lesson_id else None
        subject_name = subjects_map.get(lesson.subject_id, None).name if lesson and lesson.subject_id and lesson.subject_id in subjects_map else ""
        class_name = classes_map.get(lesson.class_id, None).name if lesson and lesson.class_id and lesson.class_id in classes_map else ""

        sub_details.append({
            "id": s.id,
            "period_index": s.period_index,
            "sub_teacher_name": teacher_name(s.sub_teacher_id),
            "sub_teacher_initials": teacher_initials(s.sub_teacher_id),
            "absent_teacher_name": teacher_name(s.absent_teacher_id),
            "subject_name": subject_name,
            "class_name": class_name,
            "is_override": getattr(s, 'is_override', False),
        })

    # ── Unassigned periods ──
    unassigned = []
    if absent_ids and not is_off_day:
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

        # Batch-load subject/class names for unassigned entries
        unassigned_subject_ids = set()
        unassigned_class_ids = set()
        for entry, lesson in absent_entries:
            key = (lesson.teacher_id, entry.period_index)
            if key not in assigned_keys:
                if lesson.subject_id:
                    unassigned_subject_ids.add(lesson.subject_id)
                if lesson.class_id:
                    unassigned_class_ids.add(lesson.class_id)

        ua_subjects = {}
        ua_classes = {}
        if unassigned_subject_ids:
            from backend.models.project import Subject as SubjectModel
            ua_subjects = {s.id: s.name for s in db.query(SubjectModel).filter(SubjectModel.id.in_(unassigned_subject_ids)).all()}
        if unassigned_class_ids:
            ua_classes = {c.id: c.name for c in db.query(SchoolClass).filter(SchoolClass.id.in_(unassigned_class_ids)).all()}

        for entry, lesson in absent_entries:
            key = (lesson.teacher_id, entry.period_index)
            if key not in assigned_keys:
                unassigned.append({
                    "teacher_id": lesson.teacher_id,
                    "teacher_name": teacher_name(lesson.teacher_id),
                    "period_index": entry.period_index,
                    "lesson_id": lesson.id,
                    "subject_name": ua_subjects.get(lesson.subject_id, ""),
                    "class_name": ua_classes.get(lesson.class_id, ""),
                    "room_id": entry.room_id,
                    "room_name": "",
                })

    # ── Busy/free teachers right now ──
    if is_off_day:
        busy_now = 0
        on_sub_now = 0
        free_now = 0
    else:
        current_period = current_lesson_index if current_lesson_index >= 0 else 0
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
        on_sub_now = db.query(func.count(func.distinct(Substitution.sub_teacher_id))).filter(
            Substitution.project_id == project_id,
            Substitution.date == today,
            Substitution.period_index == current_period,
        ).scalar() or 0
        free_now = max(0, total_teachers - busy_now - on_sub_now - absent_count)

    # ── Live teacher cards (for Live Now panel) ──
    live_teachers = []
    if not is_off_day and current_lesson_index >= 0:
        current_period = current_lesson_index if current_lesson_index >= 0 else 0
        # Teachers teaching right now
        busy_entries = (
            db.query(TimetableEntry, Lesson)
            .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
            .filter(
                TimetableEntry.project_id == project_id,
                TimetableEntry.day_index == day_index,
                TimetableEntry.period_index == current_period,
            )
            .all()
        )
    # Pre-load all classes for this project (avoid N+1 in live_teachers loop)
        all_classes = db.query(SchoolClass).filter(SchoolClass.project_id == project_id).all()
        classes_by_id = {c.id: c for c in all_classes}

        busy_teacher_ids = set()
        for entry, lesson in busy_entries:
            tid = lesson.teacher_id
            if tid in absent_ids:
                continue  # absent, skip
            busy_teacher_ids.add(tid)
            t = teachers_by_id.get(tid)
            cls = classes_by_id.get(lesson.class_id)
            subj_name = ""
            if lesson.subject_id:
                subj = subjects_map.get(lesson.subject_id)
                if not subj:
                    from backend.models.project import Subject as Subj2
                    subj = db.query(Subj2).get(lesson.subject_id)
                subj_name = subj.name if subj else ""
            live_teachers.append({
                "teacher_id": tid,
                "name": teacher_name(tid),
                "initials": teacher_initials(tid),
                "status": "busy",
                "class_name": cls.name if cls else "",
                "subject_name": subj_name,
                "color": f"hsl({(tid * 67) % 360}, 55%, 45%)",
            })

        # Teachers on substitution right now
        sub_teacher_ids = set()
        for s in subs_today:
            if s.period_index == current_period:
                sid = s.sub_teacher_id
                sub_teacher_ids.add(sid)
                if sid not in busy_teacher_ids:
                    absent_t_name = teacher_name(s.absent_teacher_id)
                    live_teachers.append({
                        "teacher_id": sid,
                        "name": teacher_name(sid),
                        "initials": teacher_initials(sid),
                        "status": "sub",
                        "class_name": "",
                        "subject_name": f"↔ {absent_t_name}",
                        "color": "#F06830",
                    })

        # Free teachers (not busy, not on sub, not absent)
        all_teacher_ids = set(teachers_by_id.keys())
        free_ids = all_teacher_ids - busy_teacher_ids - sub_teacher_ids - set(absent_ids)
        for tid in free_ids:  # show ALL free teachers
            live_teachers.append({
                "teacher_id": tid,
                "name": teacher_name(tid),
                "initials": teacher_initials(tid),
                "status": "free",
                "class_name": "",
                "subject_name": "",
                "color": "#0EA875",
                "today_lessons": 0,
            })

        # Attach today_lessons count from workloads (computed below)
        # We'll compute per-teacher lesson count for today's day
        today_entry_counts = {}
        all_entries_today = (
            db.query(TimetableEntry.lesson_id)
            .filter(
                TimetableEntry.project_id == project_id,
                TimetableEntry.day_index == day_index,
            )
            .all()
        )
        lesson_teacher_map = {l.id: l.teacher_id for l in db.query(Lesson).filter(Lesson.project_id == project_id).all()}
        for (lid,) in all_entries_today:
            tid = lesson_teacher_map.get(lid)
            if tid:
                today_entry_counts[tid] = today_entry_counts.get(tid, 0) + 1

        for lt in live_teachers:
            lt["today_lessons"] = today_entry_counts.get(lt["teacher_id"], 0)

        # Sort: busy first, then sub, then free (free sorted by today_lessons ascending)
        def sort_key(x):
            order_val = {"busy": 0, "sub": 1, "free": 2}.get(x["status"], 3)
            return (order_val, x.get("today_lessons", 0))
        live_teachers.sort(key=sort_key)
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

    # ── Weekly workload chart (all teachers, weekly totals) ──
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

    # ── Substitution history (last 30 days) ──
    history_start = today - timedelta(days=30)
    history_subs = (
        db.query(
            Substitution.date,
            func.count(Substitution.id).label("count"),
        )
        .filter(
            Substitution.project_id == project_id,
            Substitution.date >= history_start,
            Substitution.date <= today,
        )
        .group_by(Substitution.date)
        .order_by(Substitution.date.desc())
        .all()
    )
    history_absences = (
        db.query(
            TeacherAbsence.date,
            func.count(TeacherAbsence.id).label("count"),
        )
        .filter(
            TeacherAbsence.project_id == project_id,
            TeacherAbsence.date >= history_start,
            TeacherAbsence.date <= today,
        )
        .group_by(TeacherAbsence.date)
        .order_by(TeacherAbsence.date.desc())
        .all()
    )

    sub_history = {}
    for row in history_subs:
        sub_history[row.date.isoformat()] = {"subs": row.count, "absences": 0}
    for row in history_absences:
        key = row.date.isoformat()
        if key not in sub_history:
            sub_history[key] = {"subs": 0, "absences": row.count}
        else:
            sub_history[key]["absences"] = row.count

    substitution_history = [
        {"date": k, "subs": v["subs"], "absences": v["absences"]}
        for k, v in sorted(sub_history.items(), reverse=True)
    ]

    # Day name for display
    day_name = today.strftime("%A")

    # ── Attendance percentage ──
    if is_off_day:
        attendance_pct = 0
    else:
        attendance_pct = round((present_count / total_teachers * 100) if total_teachers else 0)

    return {
        "school_name": school_name,
        "academic_year": academic_year_name,
        "week_label": week_label,
        "week_number": week_number,
        "date": today.isoformat(),
        "date_formatted": today.strftime("%A %d %B %Y"),
        "day_name": day_name,
        "time": now.strftime("%I:%M %p"),
        "is_off_day": is_off_day,
        "current_period": current_lesson_index if current_lesson_index >= 0 else 0,
        "current_lesson_start": current_lesson_start,
        "current_lesson_end": current_lesson_end,
        "num_periods": num_periods,
        "lesson_slots": lesson_slots,
        "stats": {
            "total_teachers": total_teachers,
            "present_today": present_count,
            "absent_today": absent_count,
            "busy_now": busy_now,
            "on_sub_now": on_sub_now if not is_off_day else 0,
            "free_now": free_now,
            "avg_workload": avg_workload,
            "over_max": over_max,
            "total_classes": total_classes,
            "total_grades": total_grades,
            "total_lessons": total_lessons,
            "attendance_pct": attendance_pct,
        },
        "class_breakdown": class_breakdown,
        "unassigned": unassigned,
        "substitutions_today": sub_details,
        "workload_chart": workload_chart,
        "substitution_history": substitution_history,
        "absent_teachers": [
            {
                "id": a.id,
                "teacher_id": a.teacher_id,
                "teacher_name": teacher_name(a.teacher_id),
                "reason": a.reason or "",
            }
            for a in absences
        ],
        "live_teachers": live_teachers,
    }


@router.get("/stats")
def get_dashboard_stats(
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Lightweight stats endpoint for dashboard widgets."""
    total_teachers = db.query(func.count(Teacher.id)).filter(Teacher.project_id == project_id).scalar() or 0
    total_classes = db.query(func.count(SchoolClass.id)).filter(SchoolClass.project_id == project_id).scalar() or 0
    total_lessons = db.query(func.count(Lesson.id)).filter(Lesson.project_id == project_id).scalar() or 0

    today = date.today()
    absent_today = (
        db.query(func.count(TeacherAbsence.id))
        .filter(TeacherAbsence.project_id == project_id, TeacherAbsence.date == today)
        .scalar() or 0
    )
    present_today = max(total_teachers - absent_today, 0)

    subs_today = (
        db.query(func.count(Substitution.id))
        .filter(Substitution.project_id == project_id, Substitution.date == today)
        .scalar() or 0
    )

    return {
        "total_teachers": total_teachers,
        "present_today": present_today,
        "absent_today": absent_today,
        "total_classes": total_classes,
        "total_lessons": total_lessons,
        "substitutions_today": subs_today,
    }
