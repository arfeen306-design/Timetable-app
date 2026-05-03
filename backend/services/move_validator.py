"""Manual-move validator — mirrors the solver's hard constraints.

Two functions:
  - build_move_context: O(1) queries against Postgres; loads everything needed
    to validate any number of target slots for one entry. Used by both
    /move-entry (single check) and /valid-slots (D x P checks).
  - validate_move: pure function over MoveContext. No DB. Returns a list of
    structured conflicts the caller can surface to the UI.

Constraint families covered (matches solver/engine.py post-Phase-1):
  bounds                — day index, day end, lesson duration overrun
  teacher_unavailable   — any period in the lesson's window is blocked
  class_unavailable     — same, for the class
  room_unavailable      — same, for the entry's room (if any)
  teacher_clash         — overlaps another lesson of the same teacher (incl. trailing periods)
  class_clash           — overlaps another lesson of the same class (incl. trailing periods)
  room_clash            — overlaps another lesson in the same room (incl. trailing periods)
  subject_max_per_day   — would exceed subject.max_per_day for this class on the day
  teacher_max_per_day   — would exceed teacher.max_periods_day on the day
  locked_target         — target slot is held by a locked entry (non-overridable)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional, TYPE_CHECKING

# Heavy ORM imports are deferred to build_move_context() so that
# validate_move() and the dataclasses below can be imported and unit-tested
# without SQLAlchemy installed.

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


# ---------------------------------------------------------------- Conflict ----

@dataclass
class Conflict:
    type: str
    message: str
    clashing_entry_id: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type, "message": self.message}
        if self.clashing_entry_id is not None:
            d["clashing_entry_id"] = self.clashing_entry_id
        return d


# Conflict types that NEVER yield to force=true. Source-locked is overridable
# (existing behaviour); locked_target and bounds are not.
NON_OVERRIDABLE_TYPES = frozenset({"bounds", "locked_target"})


def has_non_overridable(conflicts: list[Conflict]) -> bool:
    return any(c.type in NON_OVERRIDABLE_TYPES for c in conflicts)


# ------------------------------------------------------------- MoveContext ----

@dataclass
class MoveContext:
    """Snapshot of every fact required to validate a move for one entry.

    Build it once per drag-start (or per /move-entry call) and reuse the same
    context across many slot checks — the validator itself does no I/O.
    """
    # Source entry
    entry_id: int
    entry_day: int
    entry_period: int
    entry_room_id: Optional[int]
    entry_locked: bool

    # Lesson + denormalised refs
    lesson_id: int
    lesson_duration: int
    teacher_id: int
    subject_id: int
    class_id: int

    # Display names (for human-readable conflicts)
    teacher_name: str
    subject_name: str
    class_name: str

    # Caps (0 = unenforced — matches solver behaviour)
    subject_max_per_day: int
    teacher_max_periods_day: int

    # School geometry
    days_per_week: int
    periods_per_day: int

    # Hard unavailability windows relevant to this lesson
    teacher_unavail: set[tuple[int, int]] = field(default_factory=set)
    class_unavail: set[tuple[int, int]] = field(default_factory=set)
    room_unavail: set[tuple[int, int]] = field(default_factory=set)

    # Other entries on the same run (excluding the moving entry itself)
    # Each dict: id, day_index, period_index, room_id, locked, lesson_id,
    # duration, teacher_id, subject_id, class_id
    other_entries: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------- Context construction ----

def build_move_context(
    db: "Session",
    project_id: int,
    run_id: int,
    entry_id: int,
) -> Optional[MoveContext]:
    # Deferred ORM imports — keep validate_move pure-Python importable.
    from backend.models.timetable_model import TimetableEntry
    from backend.models.lesson_model import Lesson
    from backend.models.teacher_model import Teacher
    from backend.models.project import Subject
    from backend.models.class_model import SchoolClass
    from backend.models.constraint_model import TimeConstraint
    from backend.models.school_settings import SchoolSettings

    """Fetch the entry + its lesson context + relevant constraints + all
    other entries in the run. Returns None if the entry is not found in this
    project/run.

    Query budget:
      1. Single eager-loaded join for the moving entry (entry + lesson + subject
         + teacher + class).
      2. School settings.
      3. Hard unavailability rows for the project (filtered by entity types).
      4. All other entries in the run with their lesson durations.
    """
    moving = (
        db.query(
            TimetableEntry.id,
            TimetableEntry.day_index,
            TimetableEntry.period_index,
            TimetableEntry.room_id,
            TimetableEntry.locked,
            Lesson.id.label("lesson_id"),
            Lesson.duration,
            Lesson.teacher_id,
            Lesson.subject_id,
            Lesson.class_id,
            Subject.name.label("subject_name"),
            Subject.max_per_day,
            Teacher.first_name,
            Teacher.last_name,
            Teacher.max_periods_day,
            SchoolClass.name.label("class_name"),
        )
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .join(Subject, Lesson.subject_id == Subject.id)
        .join(Teacher, Lesson.teacher_id == Teacher.id)
        .join(SchoolClass, Lesson.class_id == SchoolClass.id)
        .filter(
            TimetableEntry.id == entry_id,
            TimetableEntry.project_id == project_id,
            TimetableEntry.run_id == run_id,
        )
        .first()
    )
    if moving is None:
        return None

    settings = (
        db.query(SchoolSettings.days_per_week, SchoolSettings.periods_per_day)
        .filter(SchoolSettings.project_id == project_id)
        .first()
    )
    days = int(settings.days_per_week) if settings else 5
    periods = int(settings.periods_per_day) if settings else 7

    teacher_unavail: set[tuple[int, int]] = set()
    class_unavail: set[tuple[int, int]] = set()
    room_unavail: set[tuple[int, int]] = set()

    # Hard unavailability only — soft "preferred" / "avoid" are not checked here.
    constraint_rows = (
        db.query(
            TimeConstraint.entity_type,
            TimeConstraint.entity_id,
            TimeConstraint.day_index,
            TimeConstraint.period_index,
        )
        .filter(
            TimeConstraint.project_id == project_id,
            TimeConstraint.constraint_type == "unavailable",
            TimeConstraint.is_hard.is_(True),
        )
        .all()
    )
    for c in constraint_rows:
        slot = (c.day_index, c.period_index)
        if c.entity_type == "teacher" and c.entity_id == moving.teacher_id:
            teacher_unavail.add(slot)
        elif c.entity_type == "class" and c.entity_id == moving.class_id:
            class_unavail.add(slot)
        elif (
            c.entity_type == "room"
            and moving.room_id is not None
            and c.entity_id == moving.room_id
        ):
            room_unavail.add(slot)

    other_rows = (
        db.query(
            TimetableEntry.id,
            TimetableEntry.day_index,
            TimetableEntry.period_index,
            TimetableEntry.room_id,
            TimetableEntry.locked,
            Lesson.id.label("lesson_id"),
            Lesson.duration,
            Lesson.teacher_id,
            Lesson.subject_id,
            Lesson.class_id,
        )
        .join(Lesson, TimetableEntry.lesson_id == Lesson.id)
        .filter(
            TimetableEntry.project_id == project_id,
            TimetableEntry.run_id == run_id,
            TimetableEntry.id != entry_id,
        )
        .all()
    )
    other_entries = [
        {
            "id": r.id,
            "day_index": r.day_index,
            "period_index": r.period_index,
            "room_id": r.room_id,
            "locked": bool(r.locked),
            "lesson_id": r.lesson_id,
            "duration": int(r.duration),
            "teacher_id": r.teacher_id,
            "subject_id": r.subject_id,
            "class_id": r.class_id,
        }
        for r in other_rows
    ]

    teacher_name = (
        f"{(moving.first_name or '').strip()} {(moving.last_name or '').strip()}".strip()
        or "Teacher"
    )

    return MoveContext(
        entry_id=int(moving.id),
        entry_day=int(moving.day_index),
        entry_period=int(moving.period_index),
        entry_room_id=moving.room_id,
        entry_locked=bool(moving.locked),
        lesson_id=int(moving.lesson_id),
        lesson_duration=int(moving.duration),
        teacher_id=int(moving.teacher_id),
        subject_id=int(moving.subject_id),
        class_id=int(moving.class_id),
        teacher_name=teacher_name,
        subject_name=moving.subject_name or "Subject",
        class_name=moving.class_name or "Class",
        subject_max_per_day=int(moving.max_per_day or 0),
        teacher_max_periods_day=int(moving.max_periods_day or 0),
        days_per_week=days,
        periods_per_day=periods,
        teacher_unavail=teacher_unavail,
        class_unavail=class_unavail,
        room_unavail=room_unavail,
        other_entries=other_entries,
    )


# ------------------------------------------------------------ validate_move ----

def validate_move(ctx: MoveContext, new_day: int, new_period: int) -> list[Conflict]:
    """Return every conflict produced by moving the context's entry to
    (new_day, new_period). Empty list = the move is safe.

    Pure function; safe to call thousands of times against the same context.
    """
    conflicts: list[Conflict] = []

    # ------------- Bounds (always non-overridable; short-circuit) -------------
    if new_day < 0 or new_day >= ctx.days_per_week:
        return [Conflict(
            "bounds",
            f"day_index must be 0–{ctx.days_per_week - 1}, got {new_day}.",
        )]
    if new_period < 0:
        return [Conflict("bounds", f"period_index must be ≥ 0, got {new_period}.")]
    if new_period + ctx.lesson_duration > ctx.periods_per_day:
        return [Conflict(
            "bounds",
            f"Lesson (duration {ctx.lesson_duration}) does not fit before end "
            f"of day: start period {new_period + 1} + duration {ctx.lesson_duration} "
            f"exceeds periods_per_day {ctx.periods_per_day}.",
        )]

    occupied = set(range(new_period, new_period + ctx.lesson_duration))

    # ------------- Unavailability ----------------------------------------------
    # Report the FIRST blocked period for each entity (one conflict per family
    # is enough to make the slot invalid; the UI doesn't need every period).
    for p in sorted(occupied):
        if (new_day, p) in ctx.teacher_unavail:
            conflicts.append(Conflict(
                "teacher_unavailable",
                f"{ctx.teacher_name} is unavailable on day {new_day + 1}, period {p + 1}.",
            ))
            break
    for p in sorted(occupied):
        if (new_day, p) in ctx.class_unavail:
            conflicts.append(Conflict(
                "class_unavailable",
                f"{ctx.class_name} is unavailable on day {new_day + 1}, period {p + 1}.",
            ))
            break
    if ctx.entry_room_id is not None:
        for p in sorted(occupied):
            if (new_day, p) in ctx.room_unavail:
                conflicts.append(Conflict(
                    "room_unavailable",
                    f"Assigned room is unavailable on day {new_day + 1}, period {p + 1}.",
                ))
                break

    # ------------- Overlaps with other entries (multi-period aware) -----------
    teacher_clash_seen = False
    class_clash_seen = False
    room_clash_seen = False
    locked_target_seen: Optional[int] = None

    for o in ctx.other_entries:
        if o["day_index"] != new_day:
            continue
        other_window = set(range(o["period_index"], o["period_index"] + o["duration"]))
        if occupied.isdisjoint(other_window):
            continue

        if not teacher_clash_seen and o["teacher_id"] == ctx.teacher_id:
            teacher_clash_seen = True
            conflicts.append(Conflict(
                "teacher_clash",
                f"{ctx.teacher_name} already has a lesson covering this slot.",
                clashing_entry_id=o["id"],
            ))
        if not class_clash_seen and o["class_id"] == ctx.class_id:
            class_clash_seen = True
            conflicts.append(Conflict(
                "class_clash",
                f"{ctx.class_name} already has a lesson covering this slot.",
                clashing_entry_id=o["id"],
            ))
        if (
            not room_clash_seen
            and ctx.entry_room_id is not None
            and o["room_id"] is not None
            and o["room_id"] == ctx.entry_room_id
        ):
            room_clash_seen = True
            conflicts.append(Conflict(
                "room_clash",
                "Assigned room is already occupied at this slot.",
                clashing_entry_id=o["id"],
            ))
        # A locked entry occupying any overlapping period is non-overridable.
        if locked_target_seen is None and o["locked"]:
            locked_target_seen = o["id"]
            conflicts.append(Conflict(
                "locked_target",
                "Target slot is occupied by a locked entry. Unlock it before moving here.",
                clashing_entry_id=o["id"],
            ))

    # ------------- subject.max_per_day per class ------------------------------
    if ctx.subject_max_per_day > 0:
        same_subject_today = sum(
            1 for o in ctx.other_entries
            if o["day_index"] == new_day
            and o["class_id"] == ctx.class_id
            and o["subject_id"] == ctx.subject_id
        )
        if same_subject_today + 1 > ctx.subject_max_per_day:
            conflicts.append(Conflict(
                "subject_max_per_day",
                f"{ctx.class_name} would have more than {ctx.subject_max_per_day} "
                f"{ctx.subject_name} lesson(s) on day {new_day + 1}.",
            ))

    # ------------- teacher.max_periods_day ------------------------------------
    if ctx.teacher_max_periods_day > 0:
        teacher_today = sum(
            1 for o in ctx.other_entries
            if o["day_index"] == new_day and o["teacher_id"] == ctx.teacher_id
        )
        if teacher_today + 1 > ctx.teacher_max_periods_day:
            conflicts.append(Conflict(
                "teacher_max_per_day",
                f"{ctx.teacher_name} would exceed max_periods_day "
                f"({ctx.teacher_max_periods_day}) on day {new_day + 1}.",
            ))

    return conflicts
