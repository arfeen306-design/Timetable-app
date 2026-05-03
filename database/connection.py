"""SQLite database connection management."""
from __future__ import annotations
import sqlite3
from pathlib import Path
from typing import Optional

from database.schema import SCHEMA_SQL


def _ensure_teacher_contact_columns(conn: sqlite3.Connection) -> None:
    """Add email and whatsapp_number to teacher table if missing (existing DBs)."""
    cur = conn.execute("PRAGMA table_info(teacher)")
    names = [row[1] for row in cur.fetchall()]
    if "email" not in names:
        conn.execute("ALTER TABLE teacher ADD COLUMN email TEXT NOT NULL DEFAULT ''")
    if "whatsapp_number" not in names:
        conn.execute("ALTER TABLE teacher ADD COLUMN whatsapp_number TEXT NOT NULL DEFAULT ''")


def _table_has_column(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def _ensure_phase3_integrity(conn: sqlite3.Connection) -> None:
    """Idempotent migration for Phase-3 integrity (Postgres-side mirror lives in
    backend/scripts/migrate_dedupe_indexes.py).

    Order matters:
      1. Add denormalised teacher_id/class_id columns to timetable_entry.
      2. Backfill them from the parent lesson row.
      3. Dedupe every table that's about to receive a UNIQUE index — UNIQUE
         creation fails on existing duplicates, so cleanup must come first.
      4. Re-apply SCHEMA_SQL: every CREATE … IF NOT EXISTS is a no-op when the
         object exists, but the new indexes/triggers will land here.
    """
    # 1. Denormalised columns on existing DBs.
    if not _table_has_column(conn, "timetable_entry", "teacher_id"):
        conn.execute("ALTER TABLE timetable_entry ADD COLUMN teacher_id INTEGER")
    if not _table_has_column(conn, "timetable_entry", "class_id"):
        conn.execute("ALTER TABLE timetable_entry ADD COLUMN class_id INTEGER")

    # 2. Backfill anything still NULL.
    conn.execute(
        """UPDATE timetable_entry
              SET teacher_id = (SELECT teacher_id FROM lesson WHERE lesson.id = timetable_entry.lesson_id)
            WHERE teacher_id IS NULL"""
    )
    conn.execute(
        """UPDATE timetable_entry
              SET class_id = (SELECT class_id FROM lesson WHERE lesson.id = timetable_entry.lesson_id)
            WHERE class_id IS NULL"""
    )

    # 3a. Dedupe teacher_subject. Keep the lowest id per pair.
    conn.execute(
        """DELETE FROM teacher_subject
            WHERE id NOT IN (
                SELECT MIN(id) FROM teacher_subject GROUP BY teacher_id, subject_id
            )"""
    )
    # 3b. Dedupe lesson_allowed_room.
    conn.execute(
        """DELETE FROM lesson_allowed_room
            WHERE id NOT IN (
                SELECT MIN(id) FROM lesson_allowed_room GROUP BY lesson_id, room_id
            )"""
    )
    # 3c. Dedupe time_constraint.
    conn.execute(
        """DELETE FROM time_constraint
            WHERE id NOT IN (
                SELECT MIN(id) FROM time_constraint
                 GROUP BY entity_type, entity_id, day_index, period_index
            )"""
    )
    # 3d. Dedupe timetable_entry per (slot, teacher) — keep the lowest id.
    conn.execute(
        """DELETE FROM timetable_entry
            WHERE id NOT IN (
                SELECT MIN(id) FROM timetable_entry
                 WHERE teacher_id IS NOT NULL
                 GROUP BY day_index, period_index, teacher_id
            )
              AND teacher_id IS NOT NULL"""
    )
    # 3e. Dedupe per (slot, class) — keep the lowest id remaining.
    conn.execute(
        """DELETE FROM timetable_entry
            WHERE id NOT IN (
                SELECT MIN(id) FROM timetable_entry
                 WHERE class_id IS NOT NULL
                 GROUP BY day_index, period_index, class_id
            )
              AND class_id IS NOT NULL"""
    )
    # 3f. Dedupe per (slot, room).
    conn.execute(
        """DELETE FROM timetable_entry
            WHERE id NOT IN (
                SELECT MIN(id) FROM timetable_entry
                 WHERE room_id IS NOT NULL
                 GROUP BY day_index, period_index, room_id
            )
              AND room_id IS NOT NULL"""
    )


class DatabaseConnection:
    """Manages a single SQLite project database."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        self._db_path = db_path or ":memory:"
        self._conn: Optional[sqlite3.Connection] = None

    @property
    def path(self) -> str:
        return self._db_path

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            raise RuntimeError("Database not connected. Call open() first.")
        return self._conn

    def open(self) -> None:
        if self._db_path != ":memory:":
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        if self._db_path != ":memory:":
            _ensure_teacher_contact_columns(self._conn)
            # Phase-3 migration: only run on existing DBs that have the lesson
            # table (i.e. were initialised by a prior version). Brand-new DBs
            # (initialize_schema not yet called) skip this — the schema's CREATE
            # … IF NOT EXISTS will lay everything down on first use.
            cur = self._conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='lesson'"
            )
            if cur.fetchone() is not None:
                _ensure_phase3_integrity(self._conn)
                # Re-run the schema script so the new indexes + triggers land.
                self._conn.executescript(SCHEMA_SQL)
                self._conn.commit()

    def clone_for_thread(self) -> "DatabaseConnection":
        """Create a new connection to the same DB file, safe for use in another thread."""
        if self._db_path == ":memory:":
            raise RuntimeError(
                "Cannot clone an in-memory database for another thread. "
                "Save the project to a file first."
            )
        db = DatabaseConnection(self._db_path)
        db.open()
        return db

    def initialize_schema(self) -> None:
        self.conn.executescript(SCHEMA_SQL)

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        return self.conn.execute(sql, params)

    def executemany(self, sql: str, params_list: list[tuple]) -> sqlite3.Cursor:
        return self.conn.executemany(sql, params_list)

    def commit(self) -> None:
        self.conn.commit()

    def fetchone(self, sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchone()

    def fetchall(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()

    def last_insert_id(self) -> int:
        row = self.fetchone("SELECT last_insert_rowid()")
        return row[0] if row else 0

    @classmethod
    def create_new(cls, db_path: str) -> "DatabaseConnection":
        db = cls(db_path)
        db.open()
        db.initialize_schema()
        db.commit()
        return db

    @classmethod
    def open_existing(cls, db_path: str) -> "DatabaseConnection":
        if not Path(db_path).exists():
            raise FileNotFoundError(f"Database not found: {db_path}")
        db = cls(db_path)
        db.open()
        return db
