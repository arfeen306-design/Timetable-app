"""Solver tests — provider-only.

Pre-Phase-4 these tests used the desktop SQLite stack (DatabaseConnection +
SqliteDataProvider). With the desktop tree gone they use a tiny in-memory
fake provider that satisfies the TimetableDataProvider contract the solver
actually exercises (the same six get_* methods that PostgresDataProvider
implements). Keeping the suite alive locks in the C1/C4 invariants
(multi-period NoOverlap; explicit-failure on infeasible unavailability)
without depending on any SQLite layer.
"""
from __future__ import annotations
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from solver.engine import TimetableSolver


# ---------------------------------------------------------------- Fake provider ----


class FakeProvider:
    """Mutable, in-memory provider that mirrors PostgresDataProvider's shape."""

    def __init__(self) -> None:
        self.school: dict | None = None
        self.subjects: list[dict] = []
        self.classes: list[dict] = []
        self.teachers: list[dict] = []
        self.rooms: list[dict] = []
        self.lessons: list[dict] = []
        self.constraints: list[dict] = []
        self.locked_entries: list[dict] = []
        self.lesson_allowed_rooms: list[dict] = []

    def get_school(self) -> dict | None:
        return self.school

    def get_subjects(self) -> list[dict]:
        return list(self.subjects)

    def get_classes(self) -> list[dict]:
        return list(self.classes)

    def get_teachers(self) -> list[dict]:
        return list(self.teachers)

    def get_rooms(self) -> list[dict]:
        return list(self.rooms)

    def get_lessons(self) -> list[dict]:
        return list(self.lessons)

    def get_constraints(self) -> list[dict]:
        return list(self.constraints)

    def get_locked_entries(self) -> list[dict]:
        return list(self.locked_entries)

    def get_lesson_allowed_rooms(self) -> list[dict]:
        return list(self.lesson_allowed_rooms)


# ---------------------------------------------------------------- Test helpers ----


def _make_provider(*, days: int = 5, periods: int = 7) -> FakeProvider:
    p = FakeProvider()
    p.school = {
        "id": 1,
        "name": "Test School",
        "academic_year": "2025",
        "days_per_week": days,
        "periods_per_day": periods,
        "weekend_days": "5,6",
        "bell_schedule_json": "[]",
    }
    return p


def _add_subject(p: FakeProvider, *, sid: int, name: str, code: str = "", category: str = "Core", max_per_day: int = 2) -> None:
    p.subjects.append({
        "id": sid, "name": name, "code": code or name[:3].upper(),
        "color": "#4A90D9", "category": category, "max_per_day": max_per_day,
        "double_allowed": 0, "preferred_room_type": "",
    })


def _add_teacher(p: FakeProvider, *, tid: int, first: str, last: str = "", max_day: int = 6, max_week: int = 30) -> None:
    p.teachers.append({
        "id": tid, "first_name": first, "last_name": last, "code": (first[:1] + (last[:1] if last else "")).upper(),
        "title": "Mr.", "color": "#E8725A", "max_periods_day": max_day, "max_periods_week": max_week,
        "email": "", "whatsapp_number": "",
    })


def _add_class(p: FakeProvider, *, cid: int, name: str, grade: str = "9", section: str = "A") -> None:
    p.classes.append({
        "id": cid, "grade": grade, "section": section, "stream": "", "name": name, "code": "",
        "color": "#50C878", "class_teacher_id": None, "home_room_id": None, "strength": 30,
    })


def _add_lesson(p: FakeProvider, *, lid: int, teacher_id: int, subject_id: int, class_id: int, ppw: int = 1, duration: int = 1) -> None:
    p.lessons.append({
        "id": lid, "teacher_id": teacher_id, "subject_id": subject_id, "class_id": class_id,
        "group_id": None, "periods_per_week": ppw, "duration": duration, "priority": 5,
        "locked": 0, "preferred_room_id": None, "notes": "",
    })


def _add_unavailability(p: FakeProvider, *, entity_type: str, entity_id: int, day: int, period: int) -> None:
    p.constraints.append({
        "id": len(p.constraints) + 1,
        "entity_type": entity_type, "entity_id": entity_id,
        "day_index": day, "period_index": period,
        "constraint_type": "unavailable", "weight": 10, "is_hard": 1,
    })


# ------------------------------------------------------------------------ Tests ----


class TestSolver(unittest.TestCase):

    def test_simple_solve(self):
        p = _make_provider(days=5, periods=7)
        _add_subject(p, sid=1, name="Maths", code="MAT")
        _add_subject(p, sid=2, name="English", code="ENG")
        _add_teacher(p, tid=1, first="Ali", last="Khan")
        _add_teacher(p, tid=2, first="Sara", last="Ahmed")
        _add_class(p, cid=1, name="G9A")
        _add_lesson(p, lid=1, teacher_id=1, subject_id=1, class_id=1, ppw=3, duration=1)
        _add_lesson(p, lid=2, teacher_id=2, subject_id=2, class_id=1, ppw=3, duration=1)

        success, entries, _ = TimetableSolver(p).solve(time_limit_seconds=10)

        self.assertTrue(success)
        self.assertEqual(len(entries), 6)

        teacher_slots: set[tuple[int, int, int]] = set()
        class_slots: set[tuple[int, int, int]] = set()
        lesson_by_id = {l["id"]: l for l in p.lessons}
        for e in entries:
            l = lesson_by_id[e.lesson_id]
            t_key = (l["teacher_id"], e.day_index, e.period_index)
            c_key = (l["class_id"], e.day_index, e.period_index)
            self.assertNotIn(t_key, teacher_slots, "Teacher double-booked")
            self.assertNotIn(c_key, class_slots, "Class double-booked")
            teacher_slots.add(t_key)
            class_slots.add(c_key)

    def test_two_teachers_same_class(self):
        # Same setup as test_simple_solve — kept for explicit class-clash coverage.
        p = _make_provider()
        _add_subject(p, sid=1, name="Maths")
        _add_subject(p, sid=2, name="English")
        _add_teacher(p, tid=1, first="Ali", last="Khan")
        _add_teacher(p, tid=2, first="Sara", last="Ahmed")
        _add_class(p, cid=1, name="G9A")
        _add_lesson(p, lid=1, teacher_id=1, subject_id=1, class_id=1, ppw=3)
        _add_lesson(p, lid=2, teacher_id=2, subject_id=2, class_id=1, ppw=3)

        success, entries, _ = TimetableSolver(p).solve(time_limit_seconds=10)
        self.assertTrue(success)

        seen: set[tuple[int, int, int]] = set()
        for e in entries:
            cid = next(l["class_id"] for l in p.lessons if l["id"] == e.lesson_id)
            key = (cid, e.day_index, e.period_index)
            self.assertNotIn(key, seen)
            seen.add(key)

    def test_duration_2_no_trailing_overlap(self):
        """C1 regression: a duration-2 lesson must block its trailing period
        for the same teacher / class, not just the start slot."""
        p = _make_provider(days=1, periods=3)
        _add_subject(p, sid=1, name="Maths")
        _add_subject(p, sid=2, name="English")
        _add_teacher(p, tid=1, first="Ali", last="Khan")
        _add_class(p, cid=1, name="G9A")
        _add_lesson(p, lid=1, teacher_id=1, subject_id=1, class_id=1, ppw=1, duration=2)
        _add_lesson(p, lid=2, teacher_id=1, subject_id=2, class_id=1, ppw=1, duration=1)

        success, entries, msgs = TimetableSolver(p).solve(time_limit_seconds=10)
        self.assertTrue(success, msg=f"Solver failed: {msgs}")
        self.assertEqual(len(entries), 2)

        lesson_by_id = {l["id"]: l for l in p.lessons}
        teacher_cells: list[tuple[int, int, int]] = []
        class_cells: list[tuple[int, int, int]] = []
        for e in entries:
            l = lesson_by_id[e.lesson_id]
            for off in range(int(l["duration"])):
                teacher_cells.append((l["teacher_id"], e.day_index, e.period_index + off))
                class_cells.append((l["class_id"], e.day_index, e.period_index + off))

        self.assertEqual(len(teacher_cells), len(set(teacher_cells)),
                         f"Teacher overlap on trailing period: {teacher_cells}")
        self.assertEqual(len(class_cells), len(set(class_cells)),
                         f"Class overlap on trailing period: {class_cells}")
        self.assertEqual(len(teacher_cells), 3)

    def test_infeasible_unavailability_returns_explicit_failure(self):
        """C4 regression: when teacher unavailability eliminates every feasible
        start slot for a duration-2 lesson, the solver must report infeasibility
        with a human-readable message."""
        p = _make_provider(days=1, periods=3)
        _add_subject(p, sid=1, name="Maths")
        _add_teacher(p, tid=1, first="Ali", last="Khan")
        _add_class(p, cid=1, name="G9A")
        _add_lesson(p, lid=1, teacher_id=1, subject_id=1, class_id=1, ppw=1, duration=2)
        # Block both possible duration-2 starts (period 0 covers (0); period 1 covers (1,2)).
        _add_unavailability(p, entity_type="teacher", entity_id=1, day=0, period=0)
        _add_unavailability(p, entity_type="teacher", entity_id=1, day=0, period=2)

        success, entries, messages = TimetableSolver(p).solve(time_limit_seconds=5)
        self.assertFalse(success)
        self.assertEqual(entries, [])
        joined = " ".join(messages).lower()
        self.assertIn("unavailab", joined)
        self.assertIn("duration 2", joined)


if __name__ == "__main__":
    unittest.main()
