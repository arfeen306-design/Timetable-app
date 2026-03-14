"""Seed dev database: one school, one user, one membership. Run from project root: python -m backend.scripts.seed_dev"""
from __future__ import annotations
import sys
import os

# Ensure project root is on path so backend.* resolves
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from backend.models.base import init_db, SessionLocal
from backend.models.user import User
from backend.models.school import School, SchoolMembership
from backend.auth.password import get_password_hash


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@school.demo").first():
            print("Dev user already exists. Skipping seed.")
            print("You can log in with: admin@school.demo / demo123")
            return
        school = School(name="Demo School", slug="demo-school")
        db.add(school)
        db.commit()
        db.refresh(school)
        user = User(
            email="admin@school.demo",
            password_hash=get_password_hash("demo123"),
            name="Demo Admin",
            role="school_admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        m = SchoolMembership(school_id=school.id, user_id=user.id, role="admin")
        db.add(m)
        db.commit()
        print(f"Created school id={school.id}, user id={user.id}, membership. Login: admin@school.demo / demo123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
