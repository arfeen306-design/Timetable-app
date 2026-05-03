"""Export API — Excel / PDF / CSV. Streamed in-memory; project-scoped.

Replaces the previous SQLite-materialisation flow (export_adapter →
desktop exports/*_export.py) with backend.services.export_engine, which:
  - takes a TimetableDataProvider directly (no temp SQLite),
  - emits bytes via io.BytesIO (no /tmp files),
  - is returned as StreamingResponse so the browser starts downloading
    as soon as the buffer is ready.
"""
from __future__ import annotations
import io
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.core.postgres_data_provider import PostgresDataProvider
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.timetable_repo import (
    get_entries_with_joins,
    get_latest_run,
)
from backend.services.export_engine import build_csv, build_excel, build_pdf

router = APIRouter()


def _fetch_entries(db: Session, project_id: int, run_id: int) -> list[dict]:
    rows = get_entries_with_joins(db, project_id, run_id=run_id)
    return [
        {
            "lesson_id": r["lesson_id"],
            "day_index": r["day_index"],
            "period_index": r["period_index"],
            "room_id": r.get("room_id"),
            "locked": r.get("locked", False),
        }
        for r in rows
    ]


def _ensure_completed_run(db: Session, project_id: int) -> int:
    run = get_latest_run(db, project_id)
    if not run or run.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="No completed timetable run. Generate a timetable first.",
        )
    return run.id


def _content_disposition(filename: str) -> str:
    """RFC 5987 — quote non-ASCII filenames safely for Content-Disposition."""
    fallback = "".join(c if c.isalnum() or c in "._- " else "_" for c in filename) or "timetable"
    return f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(filename)}'


def _project_filename(project: Project, ext: str) -> str:
    base = (project.name or f"project_{project.id}").strip() or f"project_{project.id}"
    return f"timetable_{base}.{ext}"


@router.get("/excel")
def export_excel(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    run_id = _ensure_completed_run(db, project.id)
    entries = _fetch_entries(db, project.id, run_id)
    provider = PostgresDataProvider(db, project.id)
    payload = build_excel(provider, entries)
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": _content_disposition(_project_filename(project, "xlsx")),
            "Content-Length": str(len(payload)),
        },
    )


@router.get("/pdf")
def export_pdf(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    run_id = _ensure_completed_run(db, project.id)
    entries = _fetch_entries(db, project.id, run_id)
    provider = PostgresDataProvider(db, project.id)
    payload = build_pdf(provider, entries)
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="application/pdf",
        headers={
            "Content-Disposition": _content_disposition(_project_filename(project, "pdf")),
            "Content-Length": str(len(payload)),
        },
    )


@router.get("/csv")
def export_csv(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    run_id = _ensure_completed_run(db, project.id)
    entries = _fetch_entries(db, project.id, run_id)
    provider = PostgresDataProvider(db, project.id)
    payload = build_csv(provider, entries)
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": _content_disposition(_project_filename(project, "csv")),
            "Content-Length": str(len(payload)),
        },
    )


@router.get("")
def list_exports(project: Project = Depends(get_project_or_404)):
    """Placeholder — kept for API stability; export history is not persisted."""
    return {"exports": []}
