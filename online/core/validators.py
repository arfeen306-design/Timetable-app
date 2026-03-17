"""Pre-generation validation rules for timetable data."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.data_provider import TimetableDataProvider


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    # Grouped errors for display: category -> list of messages
    grouped_errors: dict[str, list[str]] = field(default_factory=dict)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def add_error(self, msg: str, category: str = "Other") -> None:
        self.errors.append(msg)
        self.grouped_errors.setdefault(category, []).append(msg)

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)


def validate_for_generation(data: TimetableDataProvider) -> ValidationResult:
    """Run all pre-generation validation checks."""
    result = ValidationResult()

    # Check school settings
    school = data.get_school()
    if not school:
        result.add_error("School settings have not been configured.", "Missing data")
        return result

    days = school["days_per_week"]
    periods = school["periods_per_day"]

    # Compute actual working day indices from weekend_days (Off Days)
    import json as _json
    weekend_str = school.get("weekend_days", "5,6") or "5,6"
    off_days = set()
    for x in str(weekend_str).split(","):
        x = x.strip()
        if x:
            try: off_days.add(int(x))
            except ValueError: pass
    working_days = sorted(d for d in range(7) if d not in off_days)
    num_working_days = len(working_days)

    # Check for exceptional day with different period count
    bell = {}
    try:
        raw = school.get("bell_schedule_json") or "{}"
        bell = _json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError):
        pass
    friday_different = bool(bell.get("friday_different", False))
    friday_day_index = int(bell.get("friday_day_index", 4))
    friday_periods = int(bell.get("friday_periods_per_day", periods) or periods)

    # Calculate actual available slots
    if friday_different and friday_day_index in working_days:
        # Exceptional day has different number of periods
        num_standard_days = num_working_days - 1
        total_slots = (num_standard_days * periods) + friday_periods
    else:
        total_slots = num_working_days * periods

    # Check entities exist
    subjects = data.get_subjects()
    if not subjects:
        result.add_error("No subjects have been added.", "Missing data")

    classes = data.get_classes()
    if not classes:
        result.add_error("No classes have been added.", "Missing data")

    teachers = data.get_teachers()
    if not teachers:
        result.add_error("No teachers have been added.", "Missing data")

    lessons = data.get_lessons()
    if not lessons:
        result.add_error("No lessons have been assigned.", "Missing data")

    if not result.is_valid:
        return result

    # Validate lesson references
    subject_ids = {s["id"] for s in subjects}
    class_ids = {c["id"] for c in classes}
    teacher_ids = {t["id"] for t in teachers}
    room_ids = {r["id"] for r in data.get_rooms()}

    for lesson in lessons:
        lid = lesson["id"]
        if lesson["teacher_id"] not in teacher_ids:
            result.add_error(f"Lesson #{lid} references non-existent teacher.", "Missing data")
        if lesson["subject_id"] not in subject_ids:
            result.add_error(f"Lesson #{lid} references non-existent subject.", "Missing data")
        if lesson["class_id"] not in class_ids:
            result.add_error(f"Lesson #{lid} references non-existent class.", "Missing data")
        if lesson["preferred_room_id"] and lesson["preferred_room_id"] not in room_ids:
            result.add_warning(f"Lesson #{lid} preferred room does not exist.")

    # Check class load capacity
    class_map = {c["id"]: c["name"] for c in classes}
    for cls in classes:
        cls_lessons = [l for l in lessons if l["class_id"] == cls["id"]]
        total_needed = sum(l["periods_per_week"] for l in cls_lessons)
        if total_needed > total_slots:
            result.add_error(
                f"{cls['name']} requires {total_needed} periods/week but "
                f"only {total_slots} slots are available.",
                "Class overload",
            )
        elif total_needed > total_slots * 0.9:
            result.add_warning(
                f"{cls['name']} is using {total_needed}/{total_slots} slots "
                f"({total_needed*100//total_slots}% capacity). Generation may be tight."
            )

    # Check teacher load
    teacher_map = {t["id"]: f"{t['first_name']} {t['last_name']}" for t in teachers}
    for teacher in teachers:
        t_lessons = [l for l in lessons if l["teacher_id"] == teacher["id"]]
        total_needed = sum(l["periods_per_week"] for l in t_lessons)
        max_week = teacher["max_periods_week"]
        max_day = teacher["max_periods_day"]

        if total_needed > max_week:
            result.add_error(
                f"Teacher {teacher_map[teacher['id']]} is assigned {total_needed} "
                f"periods/week but max is {max_week}.",
                "Teacher overload",
            )
        if total_needed > total_slots:
            result.add_error(
                f"Teacher {teacher_map[teacher['id']]} has {total_needed} periods "
                f"but only {total_slots} slots exist.",
                "Teacher overload",
            )

        # Check if daily max is feasible
        min_days_needed = -(-total_needed // max_day)  # ceiling division
        if min_days_needed > num_working_days:
            result.add_error(
                f"Teacher {teacher_map[teacher['id']]} needs at least {min_days_needed} "
                f"days for {total_needed} periods (max {max_day}/day) but only {num_working_days} days available.",
                "Teacher overload",
            )

    rooms_exist = len(room_ids) > 0
    if not rooms_exist:
        result.add_warning("No rooms defined. Rooms will not be assigned in timetable.")

    return result
