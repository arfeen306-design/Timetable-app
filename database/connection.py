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
