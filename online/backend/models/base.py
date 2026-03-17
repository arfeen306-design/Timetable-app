"""Database base and session."""
from __future__ import annotations
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from backend.config import get_settings

settings = get_settings()
_url = settings.database_url
_connect_args = {}
_pool_kwargs = {}
if _url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
else:
    # PostgreSQL pool tuning for multi-user
    _pool_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 300,
    }
engine = create_engine(
    _url,
    pool_pre_ping=True,
    echo=settings.debug,
    connect_args=_connect_args,
    **_pool_kwargs,
)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_migrations() -> None:
    """Add new columns to existing tables. Safe to re-run."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)

    migrations: list[tuple[str, str, str]] = [
        # Substitutions
        ("substitutions", "week_number", "INTEGER"),
        ("substitutions", "is_override", "BOOLEAN DEFAULT FALSE"),
        ("substitutions", "academic_week_id", "INTEGER"),
        # Teacher absences
        ("teacher_absences", "week_number", "INTEGER"),
        ("teacher_absences", "academic_week_id", "INTEGER"),
        # Academic weeks
        ("academic_weeks", "academic_year_id", "INTEGER"),
        ("academic_weeks", "label", "VARCHAR(100)"),
        ("academic_weeks", "is_current", "BOOLEAN DEFAULT FALSE"),
        # Duty roster v2 columns
        ("duty_roster", "row_id", "INTEGER"),
        ("duty_roster", "column_index", "INTEGER DEFAULT 0"),
    ]

    with engine.begin() as conn:
        for table, column, col_type in migrations:
            if table in insp.get_table_names():
                existing = [c["name"] for c in insp.get_columns(table)]
                if column not in existing:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {col_type}'))


def init_db() -> None:
    """Create all tables and run lightweight migrations."""
    Base.metadata.create_all(bind=engine)
    _run_migrations()
