"""Pytest configuration and fixtures for backend tests."""
from __future__ import annotations
import sys
import os

# When run from project root (e.g. PYTHONPATH=. python3 -m pytest backend/tests/),
# backend is the package. When run from backend dir, add parent to path so backend.* works.
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from backend.models.base import Base, get_db
from backend.models.user import User
from backend.models.school import School, SchoolMembership
from backend.models.project import Project
from backend.auth.password import get_password_hash


# In-memory SQLite for tests (no PostgreSQL required)
TEST_ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(scope="function")
def db() -> Session:
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=TEST_ENGINE)


def override_get_db() -> Session:
    Base.metadata.create_all(bind=TEST_ENGINE)
    return TestSessionLocal()


@pytest.fixture(scope="function")
def client(db: Session):
    from backend.main import app
    def _get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def school(db: Session) -> School:
    s = School(name="Test School", slug="test-school")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def user_with_school(db: Session, school: School) -> User:
    u = User(
        email="user@test.school",
        password_hash=get_password_hash("pass123"),
        name="Test User",
        role="school_admin",
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    m = SchoolMembership(school_id=school.id, user_id=u.id, role="admin")
    db.add(m)
    db.commit()
    return u


@pytest.fixture
def other_school_and_user(db: Session) -> tuple[School, User]:
    s = School(name="Other School", slug="other-school")
    db.add(s)
    db.commit()
    db.refresh(s)
    u = User(
        email="other@other.school",
        password_hash=get_password_hash("other123"),
        name="Other User",
        role="school_admin",
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    m = SchoolMembership(school_id=s.id, user_id=u.id, role="admin")
    db.add(m)
    db.commit()
    return s, u
