"""Pre-generation validator tests, provider-only.

`core.validators.validate_for_generation` consumes a TimetableDataProvider
(it calls `data.get_school()`, `data.get_subjects()`, etc.). The legacy
version of this file passed a raw `DatabaseConnection`, which has never
satisfied that contract — those tests have been silently broken. This
rewrite uses the same in-memory FakeProvider as `tests/test_solver.py` so
the validator's logic is actually exercised.
"""
from __future__ import annotations
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.validators import validate_for_generation
from tests.test_solver import (
    FakeProvider,
    _add_class,
    _add_lesson,
    _add_subject,
    _add_teacher,
    _make_provider,
)


class TestValidators(unittest.TestCase):

    def test_empty_provider_fails(self):
        p = FakeProvider()  # no school configured
        result = validate_for_generation(p)
        self.assertFalse(result.is_valid)
        self.assertTrue(any("School settings" in e for e in result.errors))

    def test_no_subjects_fails(self):
        p = _make_provider()
        result = validate_for_generation(p)
        self.assertFalse(result.is_valid)
        self.assertTrue(any("No subjects" in e for e in result.errors))

    def test_valid_minimal(self):
        p = _make_provider()
        _add_subject(p, sid=1, name="Maths")
        _add_class(p, cid=1, name="G9A")
        _add_teacher(p, tid=1, first="Test", last="Teacher")
        _add_lesson(p, lid=1, teacher_id=1, subject_id=1, class_id=1, ppw=3, duration=1)
        result = validate_for_generation(p)
        self.assertTrue(result.is_valid, msg=f"unexpected errors: {result.errors}")

    def test_overloaded_class_fails(self):
        p = _make_provider(days=5, periods=7)  # 35 slots/week
        _add_subject(p, sid=1, name="Maths")
        _add_class(p, cid=1, name="G9A")
        _add_teacher(p, tid=1, first="Test", last="Teacher", max_week=40)
        _add_lesson(p, lid=1, teacher_id=1, subject_id=1, class_id=1, ppw=36, duration=1)  # 36 > 35
        result = validate_for_generation(p)
        self.assertFalse(result.is_valid)
        self.assertTrue(any("requires" in e and "periods" in e for e in result.errors))


if __name__ == "__main__":
    unittest.main()
