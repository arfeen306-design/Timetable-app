"""Reset the dev user password to demo123. Run: python -m backend.scripts.reset_dev_password"""
from __future__ import annotations
import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from backend.models.base import SessionLocal
from backend.models.user import User
from backend.auth.password import get_password_hash


def main() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@school.demo").first()
        if not user:
            print("No user admin@school.demo found. Run: python -m backend.scripts.seed_dev")
            return
        user.password_hash = get_password_hash("demo123")
        db.commit()
        print("Password reset. Login with admin@school.demo / demo123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
