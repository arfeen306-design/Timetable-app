"""Test database session creation."""
from __future__ import annotations
import pytest
from sqlalchemy.orm import Session
from backend.models.base import Base
from backend.models.user import User
from backend.models.school import School
from backend.auth.password import get_password_hash


def test_db_session_creates_tables(db: Session):
    """Session can create and use tables."""
    u = User(email="t@t.com", password_hash=get_password_hash("x"), name="T", role="school_admin")
    db.add(u)
    db.commit()
    db.refresh(u)
    assert u.id is not None
    assert u.email == "t@t.com"


def test_db_session_school_and_project(db: Session):
    s = School(name="S", slug="s")
    db.add(s)
    db.commit()
    db.refresh(s)
    from backend.models.project import Project
    p = Project(school_id=s.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    assert p.id is not None
    assert p.school_id == s.id
