"""Tests for domain models."""
import unittest
from models.domain import School, Subject, Teacher, SchoolClass, Lesson, TimetableEntry


class TestSchool(unittest.TestCase):
    def test_working_days(self):
        school = School(days_per_week=5, weekend_days="5,6")
        self.assertEqual(school.working_days, [0, 1, 2, 3, 4])

    def test_total_slots(self):
        school = School(days_per_week=5, periods_per_day=7)
        self.assertEqual(school.total_slots, 35)

    def test_weekend_parsing(self):
        school = School(days_per_week=6, weekend_days="6")
        self.assertEqual(school.working_days, [0, 1, 2, 3, 4, 5])


class TestTeacher(unittest.TestCase):
    def test_full_name(self):
        t = Teacher(first_name="Zain", last_name="Ahmed", title="Mr.")
        self.assertEqual(t.full_name, "Mr. Zain Ahmed")

    def test_display_name(self):
        t = Teacher(first_name="Zain", last_name="Ahmed")
        self.assertEqual(t.display_name, "Zain Ahmed")


class TestSubject(unittest.TestCase):
    def test_defaults(self):
        s = Subject(name="Maths", code="MAT")
        self.assertEqual(s.max_per_day, 2)
        self.assertFalse(s.double_allowed)
        self.assertEqual(s.category, "Core")


class TestLesson(unittest.TestCase):
    def test_defaults(self):
        l = Lesson(teacher_id=1, subject_id=1, class_id=1)
        self.assertEqual(l.periods_per_week, 1)
        self.assertEqual(l.duration, 1)
        self.assertFalse(l.locked)
        self.assertEqual(l.priority, 5)


if __name__ == "__main__":
    unittest.main()
