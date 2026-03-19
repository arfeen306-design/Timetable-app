"""JWT creation and verification."""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any, Optional

from jose import JWTError, jwt
from backend.config import get_settings


def create_access_token(subject: str, payload: Optional[dict[str, Any]] = None) -> str:
    settings = get_settings()
    now = datetime.utcnow()
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": subject, "exp": expire, "iat": now}
    if payload:
        to_encode.update(payload)
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def verify_token(token: str) -> Optional[dict[str, Any]]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


def create_reset_token(user_id: int, email: str) -> str:
    """Create a short-lived (1 hour) token for password resets."""
    settings = get_settings()
    now = datetime.utcnow()
    expire = now + timedelta(hours=1)
    to_encode = {
        "sub": email,
        "user_id": user_id,
        "purpose": "reset_password",
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

