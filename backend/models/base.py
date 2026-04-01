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
    # PostgreSQL connection pooling for production
    _pool_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 3600,
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


def init_db() -> None:
    """Create all tables. Use Alembic in production."""
    Base.metadata.create_all(bind=engine)
