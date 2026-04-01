"""Review API — class/teacher/room/master timetable, workload, run summary; project-scoped."""
from __future__ import annotations
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.timetable_repo import (
    get_latest_run, get_run_by_id, list_runs, get_entries_with_joins,
)
from backend.repositories.school_settings_repo import get_by_project

router = APIRouter()


def _resolve_run_id(db: Session, project_id: int, run_id: Optional[int] = None) -> int:
    """Resolve an explicit run_id or fall back to the latest completed run."""
    if run_id is not None:
        run = get_run_by_id(db, run_id, project_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")
        return run.id
    run = get_latest_run(db, project_id)
    if not run or run.status != "completed":
        raise HTTPException(
            status_code=404,
            detail="No completed timetable run found. Generate a timetable first.",
        )
    return run.id


def _grid_settings(db: Session, project_id: int):
    settings = get_by_project(db, project_id)
    days = getattr(settings, "days_per_week", 5) if settings else 5
    periods = getattr(settings, "periods_per_day", 7) if settings else 7
    return days, periods


# ── Run listing ──────────────────────────────────────────────────────────────

@router.get("/runs")
def get_all_runs(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """List all timetable runs for the project, newest first."""
    runs = list_runs(db, project.id)
    return {
        "runs": [
            {
                "id": r.id,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "message": r.message,
                "entries_count": r.entries_count,
            }
            for r in runs
        ]
    }


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


# ── View endpoints (all accept optional ?run_id=) ───────────────────────────

@router.get("/class/{class_id}")
def get_class_timetable(
    class_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
    run_id: Optional[int] = Query(None, description="Specific run to view"),
):
    """Timetable entries for a class; defaults to latest completed run."""
    rid = _resolve_run_id(db, project.id, run_id)
    entries = get_entries_with_joins(db, project.id, run_id=rid, class_id=class_id)
    days, periods = _grid_settings(db, project.id)
    grid = [[None] * periods for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p] = e
    return {"class_id": class_id, "run_id": rid, "entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/teacher/{teacher_id}")
def get_teacher_timetable(
    teacher_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
    run_id: Optional[int] = Query(None, description="Specific run to view"),
):
    """Timetable entries for a teacher."""
    rid = _resolve_run_id(db, project.id, run_id)
    entries = get_entries_with_joins(db, project.id, run_id=rid, teacher_id=teacher_id)
    days, periods = _grid_settings(db, project.id)
    grid = [[None] * periods for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p] = e
    return {"teacher_id": teacher_id, "run_id": rid, "entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/room/{room_id}")
def get_room_timetable(
    room_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
    run_id: Optional[int] = Query(None, description="Specific run to view"),
):
    """Timetable entries for a room."""
    rid = _resolve_run_id(db, project.id, run_id)
    entries = get_entries_with_joins(db, project.id, run_id=rid, room_id=room_id)
    days, periods = _grid_settings(db, project.id)
    grid = [[None] * periods for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p] = e
    return {"room_id": room_id, "run_id": rid, "entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/master")
def get_master_timetable(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
    run_id: Optional[int] = Query(None, description="Specific run to view"),
):
    """All entries for a run (flat list + grid by day/period)."""
    rid = _resolve_run_id(db, project.id, run_id)
    entries = get_entries_with_joins(db, project.id, run_id=rid)
    days, periods = _grid_settings(db, project.id)
    grid = [[[] for _ in range(periods)] for _ in range(days)]
    for e in entries:
        d, p = e["day_index"], e["period_index"]
        if 0 <= d < days and 0 <= p < periods:
            grid[d][p].append(e)
    return {"run_id": rid, "entries": entries, "grid": grid, "days": days, "periods": periods}


@router.get("/workload")
def get_workload(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
    run_id: Optional[int] = Query(None, description="Specific run to view"),
):
    """Teacher workload from a specific or latest run."""
    rid = _resolve_run_id(db, project.id, run_id)
    entries = get_entries_with_joins(db, project.id, run_id=rid)
    by_teacher: dict[int, dict] = defaultdict(lambda: {"teacher_id": None, "teacher_name": "", "periods_scheduled": 0})
    for e in entries:
        tid = e["teacher_id"]
        by_teacher[tid]["teacher_id"] = tid
        by_teacher[tid]["teacher_name"] = e.get("teacher_name", "")
        by_teacher[tid]["periods_scheduled"] += 1
    return {"run_id": rid, "workload": list(by_teacher.values())}
