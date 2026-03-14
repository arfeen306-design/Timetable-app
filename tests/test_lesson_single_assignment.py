"""Tests for single-lesson assignment flow: prevent crash on invalid/combo selection."""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import DatabaseConnection
from models.domain import Lesson
from repositories.lesson_repo import LessonRepository


class TestLessonSingleAssignmentNoCrash(unittest.TestCase):
    """Ensure lesson create with missing required IDs fails safely (DB or validation), not with a crash."""

    def _make_db(self):
        db = DatabaseConnection(":memory:")
        db.open()
        db.initialize_schema()
        db.commit()
        return db

    def test_create_lesson_with_none_teacher_id_raises_not_crash(self):
        """Repository must not crash when given None teacher_id; DB constraint or explicit check."""
        db = self._make_db()
        db.execute(
            "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
            "VALUES (?,?,?,?,?)",
            ("Test", "2025", 5, 7, "5,6"),
        )
        db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("Math", "MAT"))
        db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "A", "9A"))
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, title, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?,?)",
            ("Ali", "Khan", "AK", "Mr.", 6, 30),
        )
        db.commit()
        repo = LessonRepository(db)
        lesson = Lesson(
            teacher_id=None,
            subject_id=1,
            class_id=1,
            periods_per_week=3,
            duration=1,
            priority=5,
        )
        with self.assertRaises((Exception,)):
            repo.create(lesson)
        db.close()

    def test_create_lesson_with_none_subject_id_raises_not_crash(self):
        db = self._make_db()
        db.execute(
            "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
            "VALUES (?,?,?,?,?)",
            ("Test", "2025", 5, 7, "5,6"),
        )
        db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("Math", "MAT"))
        db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "A", "9A"))
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, title, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?,?)",
            ("Ali", "Khan", "AK", "Mr.", 6, 30),
        )
        db.commit()
        repo = LessonRepository(db)
        lesson = Lesson(teacher_id=1, subject_id=None, class_id=1, periods_per_week=3, duration=1, priority=5)
        with self.assertRaises((Exception,)):
            repo.create(lesson)
        db.close()

    def test_create_lesson_with_valid_ids_succeeds(self):
        db = self._make_db()
        db.execute(
            "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
            "VALUES (?,?,?,?,?)",
            ("Test", "2025", 5, 7, "5,6"),
        )
        db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("Math", "MAT"))
        db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "A", "9A"))
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, title, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?,?)",
            ("Ali", "Khan", "AK", "Mr.", 6, 30),
        )
        db.commit()
        repo = LessonRepository(db)
        lesson = Lesson(teacher_id=1, subject_id=1, class_id=1, periods_per_week=3, duration=1, priority=5)
        created = repo.create(lesson)
        self.assertIsNotNone(created.id)
        db.close()


if __name__ == "__main__":
    unittest.main()
