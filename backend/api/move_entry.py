"""Move / swap timetable entries with full constraint re-validation.

All conflict-checking work lives in backend.services.move_validator. This
module is now a thin HTTP layer that:
  - resolves the project and current run,
  - builds a MoveContext once per request,
  - either commits the move (200) or returns structured conflicts (400).
"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.models.timetable_model import TimetableEntry
from backend.repositories.timetable_repo import get_latest_run
from backend.services.move_validator import (
    Conflict,
    build_move_context,
    has_non_overridable,
    validate_move,
)

router = APIRouter()


class MoveEntryRequest(BaseModel):
    entry_id: int
    new_day_index: int
    new_period_index: int
    force: bool = False  # True overrides ordinary conflicts (not bounds / locked_target).


def _conflict_payload(conflicts: list[Conflict]) -> list[dict]:
    return [c.to_dict() for c in conflicts]


@router.post("/move-entry")
def move_entry(
    body: MoveEntryRequest,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Move a timetable entry to (new_day, new_period).

    Returns:
        200 with `{success: true, conflicts: [...overridden]}` on commit.
        400 with `{detail: {success: false, conflicts: [...]}}` when the move is
            rejected because the validator found conflicts that aren't being
            overridden (either force=false, or the conflicts are non-overridable
            like 'bounds' / 'locked_target').
        404 if no completed run exists or the entry is not in this project/run.
    """
    run = get_latest_run(db, project.id)
    if not run or run.status != "completed":
        raise HTTPException(status_code=404, detail="No completed timetable run.")

    ctx = build_move_context(db, project.id, run.id, body.entry_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Entry not found.")

    # Source-locked: existing semantics — overridable with force=true.
    if ctx.entry_locked and not body.force:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "conflicts": [{
                    "type": "locked",
                    "message": "This entry is locked. Unlock it or pass force=true.",
                }],
            },
        )

    # No-op: already on the target slot.
    if (ctx.entry_day, ctx.entry_period) == (body.new_day_index, body.new_period_index):
        return {"success": True, "conflicts": [], "message": "Already at this slot."}

    conflicts = validate_move(ctx, body.new_day_index, body.new_period_index)

    # Hard rejection: bounds or locked_target — never overridable, even with force.
    if has_non_overridable(conflicts):
        raise HTTPException(
            status_code=400,
            detail={"success": False, "conflicts": _conflict_payload(conflicts)},
        )

    # Soft rejection: ordinary conflicts, force=false.
    if conflicts and not body.force:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "conflicts": _conflict_payload(conflicts)},
        )

    # Commit.
    entry = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.id == body.entry_id,
            TimetableEntry.project_id == project.id,
            TimetableEntry.run_id == run.id,
        )
        .first()
    )
    if entry is None:
        # Race: entry vanished between context build and commit.
        raise HTTPException(status_code=404, detail="Entry not found.")

    entry.day_index = body.new_day_index
    entry.period_index = body.new_period_index
    db.commit()

    return {
        "success": True,
        "conflicts": _conflict_payload(conflicts),  # may be non-empty if force=True
        "message": f"Moved to Day {body.new_day_index + 1}, Period {body.new_period_index + 1}.",
    }


@router.get("/valid-slots/{entry_id}")
def get_valid_slots(
    entry_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """For each (day, period), tell the frontend whether the entry can move there.

    Reuses the shared validator. Query budget is O(1) — context is built once
    and the per-cell check is pure Python.
    """
    run = get_latest_run(db, project.id)
    if not run or run.status != "completed":
        raise HTTPException(status_code=404, detail="No completed timetable run.")

    ctx = build_move_context(db, project.id, run.id, entry_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Entry not found.")

    grid = []
    for d in range(ctx.days_per_week):
        row = []
        for p in range(ctx.periods_per_day):
            if d == ctx.entry_day and p == ctx.entry_period:
                row.append({"valid": True, "current": True, "conflicts": []})
                continue
            conflicts = validate_move(ctx, d, p)
            row.append({
                "valid": len(conflicts) == 0,
                "current": False,
                "conflicts": [c.message for c in conflicts],
            })
        grid.append(row)

    return {
        "entry_id": entry_id,
        "days": ctx.days_per_week,
        "periods": ctx.periods_per_day,
        "slots": grid,
    }
