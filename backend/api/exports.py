"""Exports API — Excel, PDF, CSV download; project-scoped, uses temp SQLite + core export engine."""
from __future__ import annotations
import os
import tempfile
import atexit
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.core.postgres_data_provider import PostgresDataProvider
from backend.repositories.timetable_repo import get_latest_run, get_entries_with_joins
from backend.services.export_adapter import build_sqlite_from_provider

router = APIRouter()


def _get_entries_for_run(db: Session, project_id: int, run_id: int) -> list[dict]:
    """Raw entries for adapter: lesson_id, day_index, period_index, room_id, locked."""
    rows = get_entries_with_joins(db, project_id, run_id=run_id)
    return [
        {
            "lesson_id": e["lesson_id"],
            "day_index": e["day_index"],
            "period_index": e["period_index"],
            "room_id": e.get("room_id"),
            "locked": e.get("locked", False),
        }
        for e in rows
    ]


def _ensure_completed_run(db: Session, project_id: int) -> int:
    run = get_latest_run(db, project_id)
    if not run or run.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="No completed timetable run. Generate a timetable first.",
        )
    return run.id


@router.get("/excel")
def export_excel(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate and download Excel timetable. Requires a completed generation run."""
    run_id = _ensure_completed_run(db, project.id)
    entries = _get_entries_for_run(db, project.id, run_id)
    provider = PostgresDataProvider(db, project.id)
    try:
        sqlite_db, sqlite_path = build_sqlite_from_provider(provider, entries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export setup failed: {e}")
    try:
        from exports.excel_export import export_excel as core_export_excel
    except ImportError:
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass
        raise HTTPException(status_code=501, detail="Excel export not available (PYTHONPATH).")
    _fd, out_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(_fd)
    atexit.register(lambda p=out_path: os.path.exists(p) and os.unlink(p))
    try:
        core_export_excel(sqlite_db, out_path)
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass
        return FileResponse(
            out_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"timetable_{project.name or project.id}.xlsx",
        )
    except Exception as e:
        if os.path.exists(out_path):
            try:
                os.unlink(out_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=f"Excel export failed: {e}")
    finally:
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass


@router.get("/pdf")
def export_pdf(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate and download PDF timetable."""
    run_id = _ensure_completed_run(db, project.id)
    entries = _get_entries_for_run(db, project.id, run_id)
    provider = PostgresDataProvider(db, project.id)
    try:
        sqlite_db, sqlite_path = build_sqlite_from_provider(provider, entries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export setup failed: {e}")
    try:
        from exports.pdf_export import export_pdf as core_export_pdf
    except ImportError:
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass
        raise HTTPException(status_code=501, detail="PDF export not available (PYTHONPATH).")
    _fd, out_path = tempfile.mkstemp(suffix=".pdf")
    os.close(_fd)
    atexit.register(lambda p=out_path: os.path.exists(p) and os.unlink(p))
    try:
        core_export_pdf(sqlite_db, out_path)
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass
        return FileResponse(
            out_path,
            media_type="application/pdf",
            filename=f"timetable_{project.name or project.id}.pdf",
        )
    except Exception as e:
        if os.path.exists(out_path):
            try:
                os.unlink(out_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=f"PDF export failed: {e}")
    finally:
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass


@router.get("/csv")
def export_csv(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate and download CSV timetable."""
    run_id = _ensure_completed_run(db, project.id)
    entries = _get_entries_for_run(db, project.id, run_id)
    provider = PostgresDataProvider(db, project.id)
    try:
        sqlite_db, sqlite_path = build_sqlite_from_provider(provider, entries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export setup failed: {e}")
    try:
        from exports.csv_export import export_csv as core_export_csv
    except ImportError:
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass
        raise HTTPException(status_code=501, detail="CSV export not available (PYTHONPATH).")
    _fd, out_path = tempfile.mkstemp(suffix=".csv")
    os.close(_fd)
    atexit.register(lambda p=out_path: os.path.exists(p) and os.unlink(p))
    try:
        core_export_csv(sqlite_db, out_path)
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass
        return FileResponse(
            out_path,
            media_type="text/csv",
            filename=f"timetable_{project.name or project.id}.csv",
        )
    except Exception as e:
        if os.path.exists(out_path):
            try:
                os.unlink(out_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=f"CSV export failed: {e}")
    finally:
        sqlite_db.close()
        if os.path.exists(sqlite_path):
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass


@router.get("")
def list_exports(
    project: Project = Depends(get_project_or_404),
):
    """Placeholder: list recent exports (metadata if stored)."""
    return {"exports": []}
