"""Review API — class/teacher/room/master timetable, workload, run summary; project-scoped."""
from __future__ import annotations
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.timetable_repo import get_latest_run, get_entries_with_joins
from backend.repositories.school_settings_repo import get_by_project

router = APIRouter()


def _get_run_id_or_404(db: Session, project_id: int) -> int:
    run = get_latest_run(db, project_id)
    if not run or run.status != "completed":
        raise HTTPException(
            status_code=404,
            detail="No completed timetable run found. Generate a timetable first.",
        )
    return run.id


def _slot_label(day_index: int, period_index: int, settings: object) -> str:
    """Simple slot label; can be extended with bell_schedule for start/end times."""
    return f"Day{day_index + 1}P{period_index + 1}"


@router.get("/run-summary")
def get_run_summary(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Latest run status, entries_count, finished_at."""
    run = get_latest_run(db, project.id)
    if not run:
        return {"run": None}
    return {
        "run": {
            "id": run.id,
            "status": run.status,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "message": run.message,
            "entries_count": run.entries_count,
        }
    }


@router.get("/class/{class_id}")
def get_class_timetable(
    class_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Timetable entries for a class; 404 if no completed run."""
    run_id = _get_run_id_or_404(db, project.id)
    entries = get_entries_with_joins(db, project.id, run_id=run_id, class_id=class_id)
    # Verify class belongs to project (entries are already scoped)
    settings = get_by_project(db, project.id)
    days = getattr(settings, "days_per_week", 5) if settings else 5
    periods = getattr(settings, "periods_per_day", 7) if settings else 7
    # Build grid: [day][period] -> entry
    grid = [[None] * periods for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p] = e
    return {"class_id": class_id, "entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/teacher/{teacher_id}")
def get_teacher_timetable(
    teacher_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Timetable entries for a teacher."""
    run_id = _get_run_id_or_404(db, project.id)
    entries = get_entries_with_joins(db, project.id, run_id=run_id, teacher_id=teacher_id)
    settings = get_by_project(db, project.id)
    days = getattr(settings, "days_per_week", 5) if settings else 5
    periods = getattr(settings, "periods_per_day", 7) if settings else 7
    grid = [[None] * periods for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p] = e
    return {"teacher_id": teacher_id, "entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/room/{room_id}")
def get_room_timetable(
    room_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Timetable entries for a room."""
    run_id = _get_run_id_or_404(db, project.id)
    entries = get_entries_with_joins(db, project.id, run_id=run_id, room_id=room_id)
    settings = get_by_project(db, project.id)
    days = getattr(settings, "days_per_week", 5) if settings else 5
    periods = getattr(settings, "periods_per_day", 7) if settings else 7
    grid = [[None] * periods for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p] = e
    return {"room_id": room_id, "entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/master")
def get_master_timetable(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """All entries for the latest run (flat list and optional grid by day/period)."""
    run_id = _get_run_id_or_404(db, project.id)
    entries = get_entries_with_joins(db, project.id, run_id=run_id)
    settings = get_by_project(db, project.id)
    days = getattr(settings, "days_per_week", 5) if settings else 5
    periods = getattr(settings, "periods_per_day", 7) if settings else 7
    grid = [[[] for _ in range(periods)] for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p].append(e)
    return {"entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/workload")
def get_workload(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Teacher workload: teacher_id, teacher_name, periods_scheduled (from latest run)."""
    run_id = _get_run_id_or_404(db, project.id)
    entries = get_entries_with_joins(db, project.id, run_id=run_id)
    by_teacher: dict[int, dict] = defaultdict(lambda: {"teacher_id": None, "teacher_name": "", "periods_scheduled": 0})
    for e in entries:
        tid = e["teacher_id"]
        by_teacher[tid]["teacher_id"] = tid
        by_teacher[tid]["teacher_name"] = e.get("teacher_name", "")
        by_teacher[tid]["periods_scheduled"] += 1
    return {"workload": list(by_teacher.values())}
