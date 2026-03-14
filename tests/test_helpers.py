"""Tests for utils.helpers (period labels and times)."""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.helpers import (
    get_period_label,
    get_period_times,
)


class TestPeriodLabel(unittest.TestCase):
    def test_without_zero_period(self):
        self.assertEqual(get_period_label(0, False), "Period 1")
        self.assertEqual(get_period_label(1, False), "Period 2")

    def test_with_zero_period(self):
        self.assertEqual(get_period_label(0, True), "Zero Period")
        self.assertEqual(get_period_label(1, True), "Period 1")
        self.assertEqual(get_period_label(2, True), "Period 2")


class TestPeriodTimes(unittest.TestCase):
    def test_default_bell(self):
        start, end = get_period_times(None, 0, False)
        self.assertEqual(start, "08:00")
        self.assertEqual(end, "08:50")

    def test_bell_first_period(self):
        bell = {"period_minutes": 45, "first_start": "09:00", "zero_period": False}
        start, end = get_period_times(bell, 0, False)
        self.assertEqual(start, "09:00")
        self.assertEqual(end, "09:45")

    def test_bell_zero_period(self):
        bell = {"period_minutes": 40, "first_start": "08:00", "zero_period": True}
        start, end = get_period_times(bell, 0, True)
        self.assertEqual(end, "08:00")
        self.assertEqual(start, "07:20")


if __name__ == "__main__":
    unittest.main()
