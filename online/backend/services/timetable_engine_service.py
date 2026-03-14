"""Service layer that calls the timetable core engine (validate, generate, exports).

Requires PYTHONPATH to include the project root (parent of backend/) so that
core.validators and solver.engine can be imported.
"""
from __future__ import annotations
from typing import Any, List

# Core engine lives in project root; backend imports when PYTHONPATH includes project root.
try:
    from core.validators import validate_for_generation, ValidationResult
    from solver.engine import TimetableSolver
    _CORE_AVAILABLE = True
except ImportError as e:
    _CORE_AVAILABLE = False
    _import_error = str(e)


def _check_core() -> None:
    if not _CORE_AVAILABLE:
        raise RuntimeError(
            "Core timetable engine not available. Set PYTHONPATH to project root (parent of backend/). "
            f"Import error: {_import_error}"
        )


def validate_project_data(provider: Any) -> dict[str, Any]:
    """
    Run core engine validation. Returns dict with is_valid, errors, warnings, grouped_errors, readiness_summary.
    """
    _check_core()
    result: ValidationResult = validate_for_generation(provider)
    # Build a simple readiness summary
    school = provider.get_school() if provider else None
    readiness = {}
    if school:
        readiness["days_per_week"] = school.get("days_per_week")
        readiness["periods_per_day"] = school.get("periods_per_day")
    readiness["errors_count"] = len(result.errors)
    readiness["warnings_count"] = len(result.warnings)
    return {
        "is_valid": result.is_valid,
        "errors": result.errors,
        "warnings": result.warnings,
        "grouped_errors": result.grouped_errors,
        "readiness_summary": readiness,
    }


def generate_timetable(provider: Any, time_limit_seconds: int = 30) -> dict[str, Any]:
    """
    Run core engine solver. Returns success, entries (list of dicts with lesson_id, day_index, period_index, room_id, locked), messages.
    """
    _check_core()
    solver = TimetableSolver(provider)
    success, entries, messages = solver.solve(time_limit_seconds=time_limit_seconds)
    # Convert domain TimetableEntry to dicts for DB persistence
    out_entries: List[dict] = []
    for e in entries:
        out_entries.append({
            "lesson_id": e.lesson_id,
            "day_index": e.day_index,
            "period_index": e.period_index,
            "room_id": e.room_id,
            "locked": getattr(e, "locked", False),
        })
    return {
        "success": success,
        "entries": out_entries,
        "messages": messages,
    }


def build_excel_export(provider: Any, path: str) -> None:
    """Generate Excel export to path. Uses temp SQLite from export_adapter + core export_excel."""
    _check_core()
    raise NotImplementedError(
        "Use export_adapter.build_sqlite_from_provider(provider, entries) and then "
        "exports.excel_export.export_excel(db, path) from the API layer."
    )


def build_pdf_export(provider: Any, path: str) -> None:
    """Generate PDF export to path."""
    _check_core()
    raise NotImplementedError(
        "Use export_adapter.build_sqlite_from_provider + exports.pdf_export.export_pdf from API."
    )


def build_csv_export(provider: Any, path: str) -> None:
    """Generate CSV export to path."""
    _check_core()
    raise NotImplementedError(
        "Use export_adapter.build_sqlite_from_provider + exports.csv_export.export_csv from API."
    )
