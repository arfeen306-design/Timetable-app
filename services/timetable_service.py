"""Service layer for timetable generation and management."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import TimetableEntry
from repositories.timetable_repo import TimetableRepository
from core.validators import validate_for_generation, ValidationResult
from solver.engine import TimetableSolver
from database.data_provider_sqlite import SqliteDataProvider

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class TimetableService:
    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db
        self.repo = TimetableRepository(db)

    def validate(self) -> ValidationResult:
        return validate_for_generation(SqliteDataProvider(self.db))

    def generate(self, time_limit_seconds: int = 30) -> tuple[bool, list[TimetableEntry], list[str]]:
        """Generate timetable. Returns (success, entries, messages)."""
        solver = TimetableSolver(self.db)
        success, entries, messages = solver.solve(time_limit_seconds)
        if success and entries:
            self.repo.save_entries(entries)
        return success, entries, messages

    def get_all_entries(self) -> list[TimetableEntry]:
        return self.repo.get_all()

    def get_class_timetable(self, class_id: int) -> list[TimetableEntry]:
        return self.repo.get_by_class(class_id)

    def get_teacher_timetable(self, teacher_id: int) -> list[TimetableEntry]:
        return self.repo.get_by_teacher(teacher_id)

    def get_room_timetable(self, room_id: int) -> list[TimetableEntry]:
        return self.repo.get_by_room(room_id)

    def lock_entry(self, entry_id: int) -> None:
        self.repo.lock_entry(entry_id)

    def unlock_entry(self, entry_id: int) -> None:
        self.repo.unlock_entry(entry_id)

    def clear_timetable(self) -> None:
        self.repo.clear_all()

    def get_unscheduled_lessons(self) -> list[dict]:
        """Return lessons with fewer scheduled slots than periods_per_week.
        Each item: lesson_id, teacher_name, subject_name, class_name, periods_per_week, scheduled_count.
        """
        return self.repo.get_unscheduled_lessons()

    def get_conflicts(self) -> list[str]:
        """Check for conflicts in the current timetable."""
        entries = self.repo.get_all()
        conflicts = []
        slot_map: dict[tuple[int, int], list[TimetableEntry]] = {}

        for e in entries:
            key = (e.day_index, e.period_index)
            slot_map.setdefault(key, []).append(e)

        for (day, period), slot_entries in slot_map.items():
            # Check teacher conflicts
            teacher_slots: dict[int, list[TimetableEntry]] = {}
            for e in slot_entries:
                if e.teacher_id:
                    teacher_slots.setdefault(e.teacher_id, []).append(e)
            for tid, t_entries in teacher_slots.items():
                if len(t_entries) > 1:
                    names = [e.class_name for e in t_entries]
                    conflicts.append(
                        f"Teacher {t_entries[0].teacher_name} is double-booked "
                        f"on Day {day+1} Period {period+1}: {', '.join(names)}"
                    )

            # Check class conflicts
            class_slots: dict[int, list[TimetableEntry]] = {}
            for e in slot_entries:
                if e.class_id:
                    class_slots.setdefault(e.class_id, []).append(e)
            for cid, c_entries in class_slots.items():
                if len(c_entries) > 1:
                    subjects = [e.subject_name for e in c_entries]
                    conflicts.append(
                        f"Class {c_entries[0].class_name} has multiple lessons "
                        f"on Day {day+1} Period {period+1}: {', '.join(subjects)}"
                    )

            # Check room conflicts
            room_slots: dict[int, list[TimetableEntry]] = {}
            for e in slot_entries:
                if e.room_id:
                    room_slots.setdefault(e.room_id, []).append(e)
            for rid, r_entries in room_slots.items():
                if len(r_entries) > 1:
                    classes = [e.class_name for e in r_entries]
                    conflicts.append(
                        f"Room {r_entries[0].room_name} is double-booked "
                        f"on Day {day+1} Period {period+1}: {', '.join(classes)}"
                    )

        return conflicts
