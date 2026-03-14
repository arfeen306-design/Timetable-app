"""Tests for utils.display_utils (class/teacher/subject display and sort for large-school selection)."""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.domain import SchoolClass, Teacher, Subject
from utils.display_utils import (
    class_display_label,
    class_sort_key,
    class_search_text,
    teacher_display_label,
    teacher_sort_key,
    teacher_search_text,
    subject_display_label,
    subject_sort_key,
    subject_search_text,
)


class TestClassSortKey(unittest.TestCase):
    """Class sort: numeric grade first, then section, then stream."""

    def test_numeric_grade_order(self):
        c9 = SchoolClass(grade="9", section="A", stream="", name="Grade 9 A")
        c10 = SchoolClass(grade="10", section="A", stream="", name="Grade 10 A")
        c11 = SchoolClass(grade="11", section="A", stream="", name="Grade 11 A")
        keys = [class_sort_key(c9), class_sort_key(c10), class_sort_key(c11)]
        self.assertEqual(keys, sorted(keys))
        self.assertLess(class_sort_key(c9), class_sort_key(c10))
        self.assertLess(class_sort_key(c10), class_sort_key(c11))

    def test_same_grade_section_order(self):
        c1 = SchoolClass(grade="10", section="A", stream="", name="10 A")
        c2 = SchoolClass(grade="10", section="B", stream="", name="10 B")
        self.assertLess(class_sort_key(c1), class_sort_key(c2))

    def test_grade_text_with_number_parsed(self):
        c = SchoolClass(grade="Grade 9", section="Silver", stream="", name="Grade 9 Silver")
        self.assertEqual(class_sort_key(c)[0], 9)


class TestClassDisplayLabel(unittest.TestCase):
    def test_uses_name_when_present(self):
        c = SchoolClass(name="Grade 9 Silver", grade="9", section="Silver", code="9-S")
        self.assertIn("Grade 9 Silver", class_display_label(c))

    def test_appends_code_when_present(self):
        c = SchoolClass(name="Grade 9 Silver", grade="9", section="Silver", code="9-S")
        label = class_display_label(c)
        self.assertIn("9-S", label)


class TestClassSearchText(unittest.TestCase):
    def test_contains_grade_section_stream_code_name(self):
        c = SchoolClass(grade="10", section="White", stream="Business", code="10WB", name="Grade 10 White")
        text = class_search_text(c)
        self.assertIn("10", text)
        self.assertIn("white", text)
        self.assertIn("business", text)
        self.assertIn("10wb", text)

    def test_filter_matches_grade(self):
        c = SchoolClass(grade="9", section="Blue", stream="", name="Grade 9 Blue")
        self.assertIn("9", class_search_text(c))

    def test_filter_matches_section(self):
        c = SchoolClass(grade="10", section="White", stream="", name="Grade 10 White")
        self.assertIn("white", class_search_text(c))


class TestTeacherDisplayLabel(unittest.TestCase):
    def test_includes_code_when_present(self):
        t = Teacher(first_name="Aisha", last_name="Khan", title="Ms.", code="AKH")
        label = teacher_display_label(t)
        self.assertIn("Aisha", label)
        self.assertIn("Khan", label)
        self.assertIn("AKH", label)

    def test_no_code_omits_parentheses(self):
        t = Teacher(first_name="John", last_name="Smith", code="")
        label = teacher_display_label(t, include_code=True)
        self.assertNotIn("()", label)


class TestTeacherSearchText(unittest.TestCase):
    def test_contains_first_last_code(self):
        t = Teacher(first_name="Aisha", last_name="Khan", code="AKH")
        text = teacher_search_text(t)
        self.assertIn("aisha", text)
        self.assertIn("khan", text)
        self.assertIn("akh", text)


class TestTeacherSortKey(unittest.TestCase):
    def test_last_name_then_first(self):
        t1 = Teacher(first_name="John", last_name="Smith")
        t2 = Teacher(first_name="Jane", last_name="Doe")
        self.assertLess(teacher_sort_key(t2), teacher_sort_key(t1))


class TestSubjectDisplayLabel(unittest.TestCase):
    def test_includes_code_when_present(self):
        s = Subject(name="Mathematics", code="MAT")
        label = subject_display_label(s)
        self.assertIn("Mathematics", label)
        self.assertIn("MAT", label)

    def test_filter_matches_abbreviation(self):
        s = Subject(name="Mathematics", code="MAT")
        text = subject_search_text(s)
        self.assertIn("mat", text)
        self.assertIn("mathematics", text)


class TestSubjectSortKey(unittest.TestCase):
    def test_category_then_name(self):
        s1 = Subject(name="Biology", category="Core")
        s2 = Subject(name="Arts", category="Activity")
        ordered = sorted([s1, s2], key=subject_sort_key)
        self.assertEqual(ordered[0].category, "Activity")
        self.assertEqual(ordered[1].category, "Core")


if __name__ == "__main__":
    unittest.main()
