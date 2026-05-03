"""Phase-3 SQLite schema-integrity tests.

Covers:
  - UNIQUE indexes reject duplicate INSERTs at the DB layer.
  - INSERT triggers backfill timetable_entry.teacher_id / class_id from the
    parent lesson, so writers that don't know about the denormalised columns
    still produce DB-consistent rows.
  - Slot-uniqueness per resource (teacher / class / room) is enforced.
  - The migration helper (_ensure_phase3_integrity) dedupes existing rows
    before the UNIQUE indexes are applied — required for upgrading old .ttb
    files that may already contain duplicates.
"""
from __future__ import annotations
import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import DatabaseConnection
from database.schema import SCHEMA_SQL


def _seed_minimal(db: DatabaseConnection) -> None:
    db.execute(
        "INSERT INTO school (name, academic_year, days_per_week, periods_per_day, weekend_days) "
        "VALUES (?,?,?,?,?)",
        ("Test", "2025", 5, 7, "5,6"),
    )
    db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("Math", "MAT"))
    db.execute("INSERT INTO subject (name, code) VALUES (?,?)", ("English", "ENG"))
    db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "A", "9A"))
    db.execute("INSERT INTO school_class (grade, section, name) VALUES (?,?,?)", ("9", "B", "9B"))
    db.execute(
        "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
        "VALUES (?,?,?,?,?)",
        ("Ali", "Khan", "AK", 6, 30),
    )
    db.execute("INSERT INTO room (name, code) VALUES (?,?)", ("R1", "R1"))
    db.execute(
        "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
        "VALUES (?,?,?,?,?)",
        (1, 1, 1, 3, 1),
    )
    db.execute(
        "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
        "VALUES (?,?,?,?,?)",
        (1, 2, 2, 1, 1),
    )
    db.commit()


def _make_db() -> DatabaseConnection:
    db = DatabaseConnection(":memory:")
    db.open()
    db.initialize_schema()
    db.commit()
    return db


class UniqueIndexes(unittest.TestCase):

    def test_duplicate_teacher_subject_pair_rejected(self):
        db = _make_db()
        _seed_minimal(db)
        db.execute("INSERT INTO teacher_subject (teacher_id, subject_id) VALUES (?,?)", (1, 1))
        db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO teacher_subject (teacher_id, subject_id) VALUES (?,?)", (1, 1))
            db.commit()
        db.close()

    def test_duplicate_lesson_allowed_room_rejected(self):
        db = _make_db()
        _seed_minimal(db)
        db.execute("INSERT INTO lesson_allowed_room (lesson_id, room_id) VALUES (?,?)", (1, 1))
        db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO lesson_allowed_room (lesson_id, room_id) VALUES (?,?)", (1, 1))
            db.commit()
        db.close()

    def test_duplicate_time_constraint_rejected(self):
        db = _make_db()
        _seed_minimal(db)
        db.execute(
            "INSERT INTO time_constraint (entity_type, entity_id, day_index, period_index, "
            "constraint_type, weight, is_hard) VALUES (?,?,?,?,?,?,?)",
            ("teacher", 1, 0, 0, "unavailable", 10, 1),
        )
        db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO time_constraint (entity_type, entity_id, day_index, period_index, "
                "constraint_type, weight, is_hard) VALUES (?,?,?,?,?,?,?)",
                ("teacher", 1, 0, 0, "unavailable", 10, 1),
            )
            db.commit()
        db.close()


class TriggersBackfillDenormalisedColumns(unittest.TestCase):
    """Writers that only set lesson_id should still produce rows with
    teacher_id / class_id populated, because the AFTER-INSERT trigger fills
    them from the parent lesson row."""

    def test_insert_with_only_lesson_id_fills_teacher_and_class(self):
        db = _make_db()
        _seed_minimal(db)
        db.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index, locked) "
            "VALUES (?,?,?,?)",
            (1, 0, 0, 0),
        )
        db.commit()
        row = db.fetchone(
            "SELECT lesson_id, teacher_id, class_id FROM timetable_entry WHERE id = (SELECT MAX(id) FROM timetable_entry)"
        )
        # lesson 1 was seeded as (teacher_id=1, class_id=1).
        self.assertEqual(row["lesson_id"], 1)
        self.assertEqual(row["teacher_id"], 1)
        self.assertEqual(row["class_id"], 1)
        db.close()

    def test_update_lesson_id_resyncs_denormalised_columns(self):
        db = _make_db()
        _seed_minimal(db)
        db.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index, locked) "
            "VALUES (?,?,?,?)",
            (1, 0, 0, 0),
        )
        db.commit()
        eid = db.fetchone("SELECT MAX(id) AS id FROM timetable_entry")["id"]
        # Repoint to lesson 2 (teacher_id=1, class_id=2). teacher stays the same, class moves.
        db.execute("UPDATE timetable_entry SET lesson_id=? WHERE id=?", (2, eid))
        db.commit()
        row = db.fetchone(
            "SELECT lesson_id, teacher_id, class_id FROM timetable_entry WHERE id=?",
            (eid,),
        )
        self.assertEqual(row["lesson_id"], 2)
        self.assertEqual(row["teacher_id"], 1)
        self.assertEqual(row["class_id"], 2)
        db.close()


class SlotUniquenessPerResource(unittest.TestCase):
    """Three partial UNIQUE indexes guard the (day, period, resource) tuple
    for teacher / class / room."""

    def test_two_lessons_for_same_teacher_at_same_slot_blocked(self):
        db = _make_db()
        _seed_minimal(db)
        # Both lessons share teacher_id=1. Insert at the same slot — the second
        # must fail the ux_te_teacher partial unique index.
        db.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (?,?,?)",
            (1, 0, 0),
        )
        db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (?,?,?)",
                (2, 0, 0),
            )
            db.commit()
        db.close()

    def test_two_lessons_for_same_class_at_same_slot_blocked(self):
        db = _make_db()
        _seed_minimal(db)
        # Add a second teacher so the rejection can't be attributed to teacher uniqueness.
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?)",
            ("Sara", "Ahmed", "SA", 6, 30),
        )
        db.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
            "VALUES (?,?,?,?,?)",
            (2, 1, 1, 1, 1),  # teacher 2, same class 1 as lesson 1
        )
        db.commit()
        db.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (?,?,?)",
            (1, 1, 1),
        )
        db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (?,?,?)",
                (3, 1, 1),  # different teacher, same class, same slot
            )
            db.commit()
        db.close()

    def test_two_entries_in_same_room_at_same_slot_blocked(self):
        db = _make_db()
        _seed_minimal(db)
        db.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index, room_id) VALUES (?,?,?,?)",
            (1, 2, 2, 1),
        )
        db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO timetable_entry (lesson_id, day_index, period_index, room_id) VALUES (?,?,?,?)",
                (2, 2, 2, 1),  # different lesson, same room, same slot
            )
            db.commit()
        db.close()

    def test_null_room_does_not_block_other_null_rooms(self):
        """The ux_te_room index is partial (WHERE room_id IS NOT NULL) — two
        roomless entries at the same slot should be accepted."""
        db = _make_db()
        _seed_minimal(db)
        # Both entries leave room_id NULL, but use different teachers and classes
        # (lesson 1 = T1/C1, lesson 2 = T1/C2). Same teacher would also block,
        # so add a second teacher + lesson.
        db.execute(
            "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
            "VALUES (?,?,?,?,?)",
            ("Sara", "Ahmed", "SA", 6, 30),
        )
        db.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
            "VALUES (?,?,?,?,?)",
            (2, 2, 2, 1, 1),  # teacher 2, class 2
        )
        db.commit()
        db.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (?,?,?)",
            (1, 3, 3),
        )
        db.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (?,?,?)",
            (3, 3, 3),
        )
        db.commit()  # must NOT raise
        rows = db.fetchall(
            "SELECT id FROM timetable_entry WHERE day_index=3 AND period_index=3"
        )
        self.assertEqual(len(rows), 2)
        db.close()


class MigrationDedupesExistingDuplicates(unittest.TestCase):
    """Existing .ttb files predate the UNIQUE indexes and may contain
    duplicates. The migration helper must dedupe before applying them, or
    the upgrade fails."""

    def _make_legacy_db(self, path: str) -> None:
        """Build a .ttb-style file with the *old* schema (no unique indexes,
        no denormalised columns) so we can simulate the upgrade."""
        old_schema = """
        CREATE TABLE school (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '',
            academic_year TEXT NOT NULL DEFAULT '', days_per_week INTEGER NOT NULL DEFAULT 5,
            periods_per_day INTEGER NOT NULL DEFAULT 7, weekend_days TEXT NOT NULL DEFAULT '5,6',
            bell_schedule_json TEXT NOT NULL DEFAULT '[]');
        CREATE TABLE subject (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            code TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#4A90D9',
            category TEXT NOT NULL DEFAULT 'Core', max_per_day INTEGER NOT NULL DEFAULT 2,
            double_allowed INTEGER NOT NULL DEFAULT 0, preferred_room_type TEXT NOT NULL DEFAULT '');
        CREATE TABLE school_class (id INTEGER PRIMARY KEY AUTOINCREMENT, grade TEXT NOT NULL,
            section TEXT NOT NULL DEFAULT '', stream TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL, code TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '#50C878', class_teacher_id INTEGER, home_room_id INTEGER,
            strength INTEGER NOT NULL DEFAULT 30);
        CREATE TABLE teacher (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL,
            last_name TEXT NOT NULL DEFAULT '', code TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL DEFAULT 'Mr.', color TEXT NOT NULL DEFAULT '#E8725A',
            max_periods_day INTEGER NOT NULL DEFAULT 6, max_periods_week INTEGER NOT NULL DEFAULT 30,
            email TEXT NOT NULL DEFAULT '', whatsapp_number TEXT NOT NULL DEFAULT '');
        CREATE TABLE teacher_subject (id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL, subject_id INTEGER NOT NULL);
        CREATE TABLE room (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            code TEXT NOT NULL DEFAULT '', room_type TEXT NOT NULL DEFAULT 'Classroom',
            capacity INTEGER NOT NULL DEFAULT 40, color TEXT NOT NULL DEFAULT '#9B59B6',
            home_class_id INTEGER);
        CREATE TABLE lesson (id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL, class_id INTEGER NOT NULL, group_id INTEGER,
            periods_per_week INTEGER NOT NULL DEFAULT 1, duration INTEGER NOT NULL DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 5, locked INTEGER NOT NULL DEFAULT 0,
            preferred_room_id INTEGER, notes TEXT NOT NULL DEFAULT '');
        CREATE TABLE lesson_allowed_room (id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL, room_id INTEGER NOT NULL);
        CREATE TABLE time_constraint (id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL,
            day_index INTEGER NOT NULL, period_index INTEGER NOT NULL,
            constraint_type TEXT NOT NULL DEFAULT 'unavailable',
            weight INTEGER NOT NULL DEFAULT 10, is_hard INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE timetable_entry (id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL, day_index INTEGER NOT NULL,
            period_index INTEGER NOT NULL, room_id INTEGER, locked INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE project_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
        """
        conn = sqlite3.connect(path)
        conn.executescript(old_schema)
        # Seed minimum referential data.
        conn.execute("INSERT INTO subject (name, code) VALUES ('Math', 'MAT')")
        conn.execute("INSERT INTO school_class (grade, section, name) VALUES ('9', 'A', '9A')")
        conn.execute(
            "INSERT INTO teacher (first_name, last_name, code, max_periods_day, max_periods_week) "
            "VALUES ('Ali', 'Khan', 'AK', 6, 30)"
        )
        conn.execute(
            "INSERT INTO lesson (teacher_id, subject_id, class_id, periods_per_week, duration) "
            "VALUES (1, 1, 1, 1, 1)"
        )
        # Seed three duplicate teacher_subject rows.
        for _ in range(3):
            conn.execute("INSERT INTO teacher_subject (teacher_id, subject_id) VALUES (1, 1)")
        # Two duplicate timetable_entries at the same slot.
        conn.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (1, 0, 0)"
        )
        conn.execute(
            "INSERT INTO timetable_entry (lesson_id, day_index, period_index) VALUES (1, 0, 0)"
        )
        conn.commit()
        conn.close()

    def test_open_existing_legacy_db_dedupes_and_indexes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "legacy.ttb")
            self._make_legacy_db(path)

            db = DatabaseConnection(path)
            db.open()  # triggers _ensure_phase3_integrity + re-applies SCHEMA_SQL

            ts_count = db.fetchone("SELECT COUNT(*) AS c FROM teacher_subject")["c"]
            self.assertEqual(ts_count, 1, "duplicate teacher_subject rows should have been pruned")

            te_count = db.fetchone("SELECT COUNT(*) AS c FROM timetable_entry")["c"]
            self.assertEqual(te_count, 1, "duplicate timetable_entry rows should have been pruned")

            row = db.fetchone(
                "SELECT teacher_id, class_id FROM timetable_entry WHERE day_index=0 AND period_index=0"
            )
            self.assertEqual(row["teacher_id"], 1, "denormalised teacher_id must be backfilled")
            self.assertEqual(row["class_id"], 1, "denormalised class_id must be backfilled")

            # Index must now exist — try inserting a new duplicate teacher_subject.
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO teacher_subject (teacher_id, subject_id) VALUES (1, 1)")
                db.commit()

            db.close()


if __name__ == "__main__":
    unittest.main()
