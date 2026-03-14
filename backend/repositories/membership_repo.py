"""School membership — resolve user's school for scoping."""
from __future__ import annotations
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.school import SchoolMembership


def get_first_school_id_for_user(db: Session, user_id: int) -> Optional[int]:
    m = db.query(SchoolMembership).filter(SchoolMembership.user_id == user_id).first()
    return m.school_id if m else None
