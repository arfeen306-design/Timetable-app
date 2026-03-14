"""Tests for pre-generation validators."""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import DatabaseConnection
from core.validators import validate_for_generation


class TestValidators(unittest.TestCase):
    def _make_db(self) -> DatabaseConnection:
        db = DatabaseConnection(":memory:")
        db.open()
        db.initialize_schema()
        db.commit()
        return db

    def test_empty_db_fails(self):
        db = self._make_db()
        result = validate_for_generation(db)
        self.assertFalse(result.is_valid)
        self.assertTrue(any("School settings" in e for e in result.errors))
        db.close()

    def test_no_subjects_fails(self):
        db = self._make_db()
        db.execute(
            "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
            "VALUES (?,?,?,?,?)",
            ("Test", "2025", 5, 7, "5,6"),
        )
        db.commit()
        result = validate_for_generation(db)
        self.assertFalse(result.is_valid)
        self.assertTrue(any("No subjects" in e for e in result.errors))
        db.close()

    def test_valid_minimal(self):
        db = self._make_db()
        db.execute(
            "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
            "VALUES (?,?,?,?,?)",
            ("Test", "2025", 5, 7, "5,6"),
        )
        db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("Maths", "MAT"))
        db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "A", "G9A"))
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?)",
            ("Test", "Teacher", "TT", 6, 30),
        )
        db.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
            "VALUES (?,?,?,?,?)",
            (1, 1, 1, 3, 1),
        )
        db.commit()
        result = validate_for_generation(db)
        self.assertTrue(result.is_valid)
        db.close()

    def test_overloaded_class_fails(self):
        db = self._make_db()
        db.execute(
            "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
            "VALUES (?,?,?,?,?)",
            ("Test", "2025", 5, 7, "5,6"),
        )
        db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("Maths", "MAT"))
        db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "A", "G9A"))
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?)",
            ("Test", "Teacher", "TT", 6, 40),
        )
        # 36 periods > 35 slots
        db.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
            "VALUES (?,?,?,?,?)",
            (1, 1, 1, 36, 1),
        )
        db.commit()
        result = validate_for_generation(db)
        self.assertFalse(result.is_valid)
        self.assertTrue(any("requires" in e and "periods" in e for e in result.errors))
        db.close()


if __name__ == "__main__":
    unittest.main()
