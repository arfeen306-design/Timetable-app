"""Tests for session_state (remembered filters and recent selections)."""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import after path is set; use a fresh module to avoid cross-test state
import utils.session_state as ss


class TestSessionStateFilters(unittest.TestCase):
    def setUp(self):
        ss.set_filter("bulk_class_filter", "")
        ss.set_filter("copy_target_filter", "")

    def test_get_set_filter(self):
        self.assertEqual(ss.get_filter("bulk_class_filter"), "")
        ss.set_filter("bulk_class_filter", "Grade 9")
        self.assertEqual(ss.get_filter("bulk_class_filter"), "Grade 9")
        ss.set_filter("bulk_class_filter", "  White  ")
        self.assertEqual(ss.get_filter("bulk_class_filter"), "White")

    def test_filter_keys_independent(self):
        ss.set_filter("bulk_class_filter", "9")
        ss.set_filter("copy_target_filter", "10")
        self.assertEqual(ss.get_filter("bulk_class_filter"), "9")
        self.assertEqual(ss.get_filter("copy_target_filter"), "10")


class TestSessionStateRecent(unittest.TestCase):
    def setUp(self):
        while ss.get_recent_teachers():
            pass  # clear by pushing beyond max
        for _ in range(12):
            ss.push_recent_teacher(99)
        ss.push_recent_teacher(1)
        ss.push_recent_teacher(2)

    def test_recent_teachers_order(self):
        recent = ss.get_recent_teachers()
        self.assertIn(1, recent)
        self.assertIn(2, recent)
        self.assertEqual(recent[0], 2)
        self.assertEqual(recent[1], 1)

    def test_recent_teachers_max(self):
        for i in range(15):
            ss.push_recent_teacher(100 + i)
        recent = ss.get_recent_teachers()
        self.assertLessEqual(len(recent), 10)


if __name__ == "__main__":
    unittest.main()
