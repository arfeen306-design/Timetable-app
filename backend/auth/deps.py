"""Auth dependencies: get current user from JWT."""
from __future__ import annotations
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy.orm import Session

from backend.auth.jwt import verify_token
from backend.models.base import get_db
from backend.models.school import School

_security = HTTPBearer(auto_error=False)
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> Optional[dict]:
    """Return decoded JWT payload if valid token present, else None."""
    if not credentials or not credentials.credentials:
        return None
    payload = verify_token(credentials.credentials)
    if not payload:
        return None
    return {
        "id": payload.get("id"),
        "email": payload.get("email") or payload.get("sub"),
        "name": payload.get("name", ""),
        "role": payload.get("role", "school_admin"),
        "school_id": payload.get("school_id"),
    }


def get_current_user(
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> dict:
    """Require authenticated user. Raises 401 if missing."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def get_school_by_api_key(
    api_key: str = Depends(_api_key_header), db: Session = Depends(get_db)
) -> School:
    """Require valid X-API-Key header. Returns School object."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key",
        )
    school = db.query(School).filter(School.api_key == api_key).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
    return school
