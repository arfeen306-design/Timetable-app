"""Add extended school settings columns. Run once: python -m backend.scripts.migrate_school_settings."""
from __future__ import annotations
import os
import sys

# Project root on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from backend.models.base import engine

COLUMNS = [
    ("campus_name", "VARCHAR(255) NOT NULL DEFAULT ''"),
    ("period_duration_minutes", "INTEGER NOT NULL DEFAULT 45"),
    ("assembly_duration_minutes", "INTEGER NOT NULL DEFAULT 0"),
    ("working_days", "VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5'"),
    ("school_start_time", "VARCHAR(10) NOT NULL DEFAULT '08:00'"),
    ("school_end_time", "VARCHAR(10) NOT NULL DEFAULT '15:00'"),
    ("friday_start_time", "VARCHAR(10)"),
    ("friday_end_time", "VARCHAR(10)"),
    ("saturday_start_time", "VARCHAR(10)"),
    ("saturday_end_time", "VARCHAR(10)"),
    ("breaks_json", "TEXT NOT NULL DEFAULT '[]'"),
]


def main() -> None:
    with engine.connect() as conn:
        for col_name, col_def in COLUMNS:
            try:
                conn.execute(text(
                    f"ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
                conn.commit()
                print(f"Added column: {col_name}")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"Column {col_name} already exists, skip")
                else:
                    raise
    print("Migration done.")


if __name__ == "__main__":
    main()
