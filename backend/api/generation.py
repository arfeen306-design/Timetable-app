"""Generation API — validate and generate timetable; project-scoped."""
from __future__ import annotations
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db, SessionLocal
from backend.models.project import Project
from backend.core.postgres_data_provider import PostgresDataProvider
from backend.services.timetable_engine_service import validate_project_data, generate_timetable
from backend.repositories.timetable_repo import (
    create_run,
    finish_run,
    get_latest_run,
    delete_entries_for_run,
    save_entries,
    get_unscheduled_lessons,
)

router = APIRouter()


def _run_solver_in_background(project_id: int, run_id: int) -> None:
    """Execute solver in a background thread with its own DB session."""
    db = SessionLocal()
    try:
        provider = PostgresDataProvider(db, project_id)
        result = generate_timetable(provider, time_limit_seconds=120)
        if not result["success"]:
            finish_run(db, run_id, status="failed", entries_count=0,
                       message="; ".join(result.get("messages", [])))
            return

        entries = result.get("entries", [])
        delete_entries_for_run(db, project_id, run_id=None)
        save_entries(db, project_id, run_id, entries)
        finish_run(db, run_id, status="completed", entries_count=len(entries), message=None)
    except Exception as e:
        finish_run(db, run_id, status="failed", entries_count=0, message=str(e))
    finally:
        db.close()


@router.post("/validate")
def validate_project(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Run core engine validation; return is_valid, errors, warnings, grouped_errors, readiness_summary."""
    provider = PostgresDataProvider(db, project.id)
    return validate_project_data(provider)


@router.post("/generate")
def generate_timetable_endpoint(
    background_tasks: BackgroundTasks,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """
    Validate, then kick off solver in background. Returns immediately with run_id.
    Poll GET /runs/latest to check status.
    """
    provider = PostgresDataProvider(db, project.id)
    validation = validate_project_data(provider)
    if not validation.get("is_valid", True):
        return {
            "success": False,
            "message": "Validation failed. Fix errors before generating.",
            "validation": validation,
            "run_id": None,
        }

    run = create_run(db, project.id, status="running", message=None)
    background_tasks.add_task(_run_solver_in_background, project.id, run.id)
    return {
        "success": True,
        "message": "Generation started. Poll /runs/latest for progress.",
        "run_id": run.id,
    }


@router.get("/runs/latest")
def get_latest_generation_run(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Get latest timetable run for the project."""
    run = get_latest_run(db, project.id)
    if not run:
        return {"run": None}
    return {
        "run": {
            "id": run.id,
            "project_id": run.project_id,
            "status": run.status,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "message": run.message,
            "entries_count": run.entries_count,
        }
    }


@router.get("/unscheduled-lessons")
def list_unscheduled_lessons(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Lessons where scheduled count < periods_per_week (for latest run context)."""
    items = get_unscheduled_lessons(db, project.id)
    return {"unscheduled_lessons": items}
