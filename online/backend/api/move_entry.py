"""Move / swap timetable entries with conflict checking."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.models.timetable_model import TimetableEntry
from backend.models.lesson_model import Lesson
from backend.models.teacher_model import Teacher
from backend.models.project import Subject
from backend.models.class_model import SchoolClass
from backend.models.room_model import Room
from backend.repositories.timetable_repo import get_latest_run, get_entries_with_joins
from backend.repositories.school_settings_repo import get_by_project

router = APIRouter()


class MoveEntryRequest(BaseModel):
    entry_id: int
    new_day_index: int
    new_period_index: int
    force: bool = False  # If true, move even with conflicts


def _find_conflicts(
    db: Session,
    project_id: int,
    run_id: int,
    entry: TimetableEntry,
    new_day: int,
    new_period: int,
) -> list[dict]:
    """Check for teacher/class/room clashes at (new_day, new_period)."""
    lesson = db.query(Lesson).filter(Lesson.id == entry.lesson_id).first()
    if not lesson:
        return [{"type": "error", "message": "Lesson not found"}]

    conflicts = []

    # Get all entries at the target slot (excluding the entry being moved)
    entries_at_slot = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.run_id == run_id,
            TimetableEntry.day_index == new_day,
            TimetableEntry.period_index == new_period,
            TimetableEntry.id != entry.id,
        )
        .all()
    )

    for other_entry in entries_at_slot:
        other_lesson = db.query(Lesson).filter(Lesson.id == other_entry.lesson_id).first()
        if not other_lesson:
            continue

        # Teacher clash
        if other_lesson.teacher_id == lesson.teacher_id:
            teacher = db.query(Teacher).filter(Teacher.id == lesson.teacher_id).first()
            other_class = db.query(SchoolClass).filter(SchoolClass.id == other_lesson.class_id).first()
            other_subj = db.query(Subject).filter(Subject.id == other_lesson.subject_id).first()
            tname = f"{teacher.first_name} {teacher.last_name}".strip() if teacher else "Unknown"
            conflicts.append({
                "type": "teacher_clash",
                "message": f"{tname} is already teaching {other_subj.name if other_subj else '?'} in {other_class.name if other_class else '?'} at this slot",
                "clashing_entry_id": other_entry.id,
            })

        # Class clash
        if other_lesson.class_id == lesson.class_id:
            cls = db.query(SchoolClass).filter(SchoolClass.id == lesson.class_id).first()
            other_subj = db.query(Subject).filter(Subject.id == other_lesson.subject_id).first()
            other_teacher = db.query(Teacher).filter(Teacher.id == other_lesson.teacher_id).first()
            conflicts.append({
                "type": "class_clash",
                "message": f"{cls.name if cls else '?'} already has {other_subj.name if other_subj else '?'} with {other_teacher.first_name if other_teacher else '?'} at this slot",
                "clashing_entry_id": other_entry.id,
            })

        # Room clash
        if (
            entry.room_id
            and other_entry.room_id
            and other_entry.room_id == entry.room_id
        ):
            room = db.query(Room).filter(Room.id == entry.room_id).first()
            conflicts.append({
                "type": "room_clash",
                "message": f"Room {room.name if room else '?'} is already occupied at this slot",
                "clashing_entry_id": other_entry.id,
            })

    return conflicts


@router.post("/move-entry")
def move_entry(
    body: MoveEntryRequest,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Move a timetable entry to a new (day, period). Returns conflicts if any."""
    run = get_latest_run(db, project.id)
    if not run or run.status != "completed":
        raise HTTPException(status_code=404, detail="No completed timetable run.")

    entry = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.id == body.entry_id,
            TimetableEntry.project_id == project.id,
            TimetableEntry.run_id == run.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    if entry.locked and not body.force:
        return {
            "success": False,
            "conflicts": [{"type": "locked", "message": "This entry is locked and cannot be moved."}],
        }

    # Validate slot bounds
    settings = get_by_project(db, project.id)
    periods = settings.periods_per_day if settings else 7
    # Compute working day indices from weekend_days
    wd_str = getattr(settings, 'weekend_days', '5,6') or '5,6'
    off = set()
    for x in str(wd_str).split(','):
        x = x.strip()
        if x:
            try: off.add(int(x))
            except ValueError: pass
    work_days = sorted(d for d in range(7) if d not in off)
    if body.new_day_index not in work_days:
        raise HTTPException(status_code=400, detail=f"day_index {body.new_day_index} is an off day")
    if body.new_period_index < 0 or body.new_period_index >= periods:
        raise HTTPException(status_code=400, detail=f"period_index must be 0-{periods - 1}")

    # Same slot — no-op
    if entry.day_index == body.new_day_index and entry.period_index == body.new_period_index:
        return {"success": True, "conflicts": [], "message": "Already at this slot."}

    # Check conflicts
    conflicts = _find_conflicts(db, project.id, run.id, entry, body.new_day_index, body.new_period_index)

    if conflicts and not body.force:
        return {"success": False, "conflicts": conflicts}

    # Move the entry
    entry.day_index = body.new_day_index
    entry.period_index = body.new_period_index
    db.commit()

    return {
        "success": True,
        "conflicts": conflicts,  # may be non-empty if force=True
        "message": f"Moved to Day {body.new_day_index + 1}, Period {body.new_period_index + 1}.",
    }


@router.get("/valid-slots/{entry_id}")
def get_valid_slots(
    entry_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """
    Returns a grid of valid/conflict status for every (day, period) slot
    for a specific entry. Used by frontend to highlight green/red while dragging.
    """
    run = get_latest_run(db, project.id)
    if not run or run.status != "completed":
        raise HTTPException(status_code=404, detail="No completed timetable run.")

    entry = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.id == entry_id,
            TimetableEntry.project_id == project.id,
            TimetableEntry.run_id == run.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    settings = get_by_project(db, project.id)
    periods = settings.periods_per_day if settings else 7
    # Compute working day indices
    wd_str = getattr(settings, 'weekend_days', '5,6') or '5,6'
    off = set()
    for x in str(wd_str).split(','):
        x = x.strip()
        if x:
            try: off.add(int(x))
            except ValueError: pass
    work_days = sorted(d for d in range(7) if d not in off)

    # Build grid: for each working day + period, check conflicts
    grid = []
    for d in work_days:
        row = []
        for p in range(periods):
            if d == entry.day_index and p == entry.period_index:
                row.append({"valid": True, "current": True, "conflicts": [], "day_index": d})
            else:
                conflicts = _find_conflicts(db, project.id, run.id, entry, d, p)
                row.append({
                    "valid": len(conflicts) == 0,
                    "current": False,
                    "conflicts": [c["message"] for c in conflicts],
                    "day_index": d,
                })
        grid.append(row)

    return {"entry_id": entry_id, "days": len(work_days), "periods": periods, "slots": grid, "working_day_indices": work_days}
