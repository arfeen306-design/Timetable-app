"""Tests for the timetable solver engine."""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import DatabaseConnection
from solver.engine import TimetableSolver


class TestSolver(unittest.TestCase):
    def _make_db(self) -> DatabaseConnection:
        db = DatabaseConnection(":memory:")
        db.open()
        db.initialize_schema()
        db.commit()
        return db

    def _seed_minimal(self, db: DatabaseConnection) -> None:
        db.execute(
            "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
            "VALUES (?,?,?,?,?)",
            ("Test School", "2025", 5, 7, "5,6"),
        )
        db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("Maths", "MAT"))
        db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("English", "ENG"))
        db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "A", "G9A"))
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?)",
            ("Ali", "Khan", "AK", 6, 30),
        )
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?)",
            ("Sara", "Ahmed", "SA", 6, 30),
        )
        db.execute(
            "INSERT INTO room (name, code, room_type, capacity) VALUES (?,?,?,?)",
            ("Room 1", "R1", "Classroom", 40),
        )
        # 3 Maths periods, 3 English periods
        db.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
            "VALUES (?,?,?,?,?)",
            (1, 1, 1, 3, 1),
        )
        db.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
            "VALUES (?,?,?,?,?)",
            (2, 2, 1, 3, 1),
        )
        db.commit()

    def test_simple_solve(self):
        db = self._make_db()
        self._seed_minimal(db)

        solver = TimetableSolver(db)
        success, entries, messages = solver.solve(time_limit_seconds=10)

        self.assertTrue(success)
        self.assertEqual(len(entries), 6)  # 3 + 3 occurrences

        # Check no teacher conflicts
        teacher_slots = set()
        for e in entries:
            lesson = db.fetchone("SELECT * FROM lesson WHERE id=?", (e.lesson_id,))
            key = (lesson["teacher_id"], e.day_index, e.period_index)
            self.assertNotIn(key, teacher_slots, "Teacher double-booked")
            teacher_slots.add(key)

        # Check no class conflicts
        class_slots = set()
        for e in entries:
            lesson = db.fetchone("SELECT * FROM lesson WHERE id=?", (e.lesson_id,))
            key = (lesson["class_id"], e.day_index, e.period_index)
            self.assertNotIn(key, class_slots, "Class double-booked")
            class_slots.add(key)

        db.close()

    def test_two_teachers_same_class(self):
        """Two teachers teaching different subjects to the same class."""
        db = self._make_db()
        self._seed_minimal(db)

        solver = TimetableSolver(db)
        success, entries, _ = solver.solve(time_limit_seconds=10)

        self.assertTrue(success)

        # Verify class is not double-booked
        class_slots = {}
        for e in entries:
            key = (e.day_index, e.period_index)
            lesson = db.fetchone("SELECT * FROM lesson WHERE id=?", (e.lesson_id,))
            cid = lesson["class_id"]
            if cid not in class_slots:
                class_slots[cid] = set()
            self.assertNotIn(key, class_slots[cid])
            class_slots[cid].add(key)

        db.close()


if __name__ == "__main__":
    unittest.main()
