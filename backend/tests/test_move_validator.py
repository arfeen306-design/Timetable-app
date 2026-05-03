"""Pure-Python tests for backend.services.move_validator.validate_move.

These tests build MoveContext instances by hand — no DB — so they run fast
and verify every conflict family exhaustively. The DB-side build_move_context
is exercised separately by integration tests against the live API.
"""
from __future__ import annotations
import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.move_validator import (
    Conflict,
    MoveContext,
    has_non_overridable,
    validate_move,
)


def _ctx(
    *,
    entry_day: int = 0,
    entry_period: int = 0,
    entry_room_id: int | None = 1,
    entry_locked: bool = False,
    lesson_duration: int = 1,
    teacher_id: int = 1,
    subject_id: int = 1,
    class_id: int = 1,
    days_per_week: int = 5,
    periods_per_day: int = 7,
    subject_max_per_day: int = 2,
    teacher_max_periods_day: int = 6,
    teacher_unavail: set[tuple[int, int]] | None = None,
    class_unavail: set[tuple[int, int]] | None = None,
    room_unavail: set[tuple[int, int]] | None = None,
    other_entries: list[dict] | None = None,
) -> MoveContext:
    return MoveContext(
        entry_id=42,
        entry_day=entry_day,
        entry_period=entry_period,
        entry_room_id=entry_room_id,
        entry_locked=entry_locked,
        lesson_id=10,
        lesson_duration=lesson_duration,
        teacher_id=teacher_id,
        subject_id=subject_id,
        class_id=class_id,
        teacher_name="Ali Khan",
        subject_name="Math",
        class_name="9A",
        subject_max_per_day=subject_max_per_day,
        teacher_max_periods_day=teacher_max_periods_day,
        days_per_week=days_per_week,
        periods_per_day=periods_per_day,
        teacher_unavail=teacher_unavail or set(),
        class_unavail=class_unavail or set(),
        room_unavail=room_unavail or set(),
        other_entries=other_entries or [],
    )


def _types(conflicts: list[Conflict]) -> list[str]:
    return [c.type for c in conflicts]


class ValidateMove(unittest.TestCase):

    # ---------- bounds ---------------------------------------------------------

    def test_clean_move_has_no_conflicts(self):
        self.assertEqual(validate_move(_ctx(), 1, 2), [])

    def test_day_below_zero(self):
        c = validate_move(_ctx(), -1, 0)
        self.assertEqual(_types(c), ["bounds"])

    def test_day_above_range(self):
        c = validate_move(_ctx(), 5, 0)
        self.assertEqual(_types(c), ["bounds"])

    def test_period_below_zero(self):
        c = validate_move(_ctx(), 0, -1)
        self.assertEqual(_types(c), ["bounds"])

    def test_duration_2_at_last_period_overflows(self):
        # periods_per_day=7, duration=2, start=6 → would need period 7. Reject.
        c = validate_move(_ctx(lesson_duration=2), 0, 6)
        self.assertEqual(_types(c), ["bounds"])

    def test_duration_2_at_second_to_last_period_fits(self):
        c = validate_move(_ctx(lesson_duration=2), 0, 5)  # uses periods 5,6
        self.assertEqual(c, [])

    # ---------- unavailability ------------------------------------------------

    def test_teacher_unavailable_at_start_period(self):
        c = validate_move(_ctx(teacher_unavail={(1, 3)}), 1, 3)
        self.assertEqual(_types(c), ["teacher_unavailable"])

    def test_teacher_unavailable_at_trailing_period_of_duration_2(self):
        # Duration 2 starting at period 2 covers (2,3). Teacher blocked at (1,3).
        c = validate_move(_ctx(lesson_duration=2, teacher_unavail={(1, 3)}), 1, 2)
        self.assertEqual(_types(c), ["teacher_unavailable"])

    def test_class_unavailable(self):
        c = validate_move(_ctx(class_unavail={(0, 0)}), 0, 0)
        self.assertEqual(_types(c), ["class_unavailable"])

    def test_room_unavailable_only_if_entry_has_room(self):
        # Entry has a room → room_unavailable conflict.
        c = validate_move(_ctx(entry_room_id=1, room_unavail={(2, 4)}), 2, 4)
        self.assertIn("room_unavailable", _types(c))
        # Entry has no room → not flagged even if room_unavail is in context.
        c = validate_move(_ctx(entry_room_id=None, room_unavail={(2, 4)}), 2, 4)
        self.assertNotIn("room_unavailable", _types(c))

    # ---------- multi-period overlap ------------------------------------------

    def _other(self, **kw) -> dict:
        base = {
            "id": 99, "day_index": 0, "period_index": 0, "room_id": None,
            "locked": False, "lesson_id": 11, "duration": 1,
            "teacher_id": 1, "subject_id": 1, "class_id": 1,
        }
        base.update(kw)
        return base

    def test_teacher_clash_on_trailing_period(self):
        """Pre-C1, this overlap would have been missed: a duration-2 lesson
        starting at period 2 must clash with another teacher lesson at period 3."""
        ctx = _ctx(
            lesson_duration=2,
            other_entries=[self._other(period_index=3, duration=1, teacher_id=1, class_id=2)],
        )
        c = validate_move(ctx, 0, 2)
        self.assertIn("teacher_clash", _types(c))

    def test_class_clash_on_trailing_period(self):
        ctx = _ctx(
            lesson_duration=2,
            other_entries=[self._other(period_index=3, duration=1, teacher_id=2, class_id=1)],
        )
        c = validate_move(ctx, 0, 2)
        self.assertIn("class_clash", _types(c))

    def test_other_lesson_with_duration_blocks_its_trailing_period(self):
        """Symmetric: a 1-period lesson cannot land on the trailing period of an
        existing duration-2 lesson for the same teacher."""
        ctx = _ctx(
            lesson_duration=1,
            other_entries=[self._other(period_index=2, duration=2, teacher_id=1, class_id=2)],
        )
        c = validate_move(ctx, 0, 3)
        self.assertIn("teacher_clash", _types(c))

    def test_room_clash_only_when_rooms_match(self):
        ctx_match = _ctx(
            entry_room_id=5,
            other_entries=[self._other(period_index=0, duration=1, room_id=5, teacher_id=2, class_id=2)],
        )
        self.assertIn("room_clash", _types(validate_move(ctx_match, 0, 0)))
        ctx_diff = _ctx(
            entry_room_id=5,
            other_entries=[self._other(period_index=0, duration=1, room_id=6, teacher_id=2, class_id=2)],
        )
        self.assertNotIn("room_clash", _types(validate_move(ctx_diff, 0, 0)))

    def test_locked_target_is_non_overridable(self):
        ctx = _ctx(other_entries=[self._other(period_index=0, locked=True, teacher_id=2, class_id=2)])
        conflicts = validate_move(ctx, 0, 0)
        self.assertIn("locked_target", _types(conflicts))
        self.assertTrue(has_non_overridable(conflicts))

    # ---------- daily caps ----------------------------------------------------

    def test_subject_max_per_day_blocks_third_lesson(self):
        ctx = _ctx(
            subject_max_per_day=2,
            other_entries=[
                self._other(period_index=0, duration=1, subject_id=1, class_id=1, teacher_id=2),
                self._other(period_index=2, duration=1, subject_id=1, class_id=1, teacher_id=2),
            ],
        )
        c = validate_move(ctx, 0, 4)  # would be the 3rd math lesson today
        self.assertIn("subject_max_per_day", _types(c))

    def test_subject_max_per_day_zero_means_unlimited(self):
        ctx = _ctx(
            subject_max_per_day=0,
            other_entries=[
                self._other(period_index=0, subject_id=1, class_id=1, teacher_id=2),
                self._other(period_index=2, subject_id=1, class_id=1, teacher_id=2),
                self._other(period_index=3, subject_id=1, class_id=1, teacher_id=2),
            ],
        )
        c = validate_move(ctx, 0, 4)
        self.assertNotIn("subject_max_per_day", _types(c))

    def test_teacher_max_per_day_blocks_when_exceeded(self):
        ctx = _ctx(
            teacher_max_periods_day=2,
            other_entries=[
                self._other(period_index=0, teacher_id=1, class_id=2),
                self._other(period_index=2, teacher_id=1, class_id=3),
            ],
        )
        c = validate_move(ctx, 0, 4)
        self.assertIn("teacher_max_per_day", _types(c))

    # ---------- non-overridable classification --------------------------------

    def test_bounds_is_non_overridable(self):
        c = validate_move(_ctx(lesson_duration=2), 0, 6)  # bounds overrun
        self.assertTrue(has_non_overridable(c))

    def test_ordinary_conflicts_are_overridable(self):
        c = validate_move(_ctx(teacher_unavail={(0, 0)}), 0, 0)
        self.assertEqual(_types(c), ["teacher_unavailable"])
        self.assertFalse(has_non_overridable(c))


if __name__ == "__main__":
    unittest.main()
