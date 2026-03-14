"""User repository — get by email for login."""
from __future__ import annotations
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.user import User


def get_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email, User.is_active.is_(True)).first()


def get_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()
