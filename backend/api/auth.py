"""Auth API: login, me, logout."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user_optional
from backend.auth.jwt import create_access_token
from backend.auth.password import verify_password
from backend.models.base import get_db
from backend.repositories.user_repo import get_by_email
from backend.repositories.membership_repo import get_first_school_id_for_user

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    school_id: Optional[int] = None


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with email and password. Returns JWT."""
    if not data.email or not data.password:
        raise HTTPException(status_code=400, detail="Email and password required")
    user = get_by_email(db, data.email.strip().lower())
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    school_id = get_first_school_id_for_user(db, user.id)
    payload = {
        "id": user.id,
        "email": user.email,
        "name": user.name or "",
        "role": user.role,
        "school_id": school_id,
    }
    access_token = create_access_token(subject=user.email, payload=payload)
    return LoginResponse(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name or "",
            "role": user.role,
            "school_id": school_id,
        },
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user_optional)):
    """Return current user. Requires Authorization header."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(
        id=current_user.get("id") or 0,
        email=current_user.get("email") or "",
        name=current_user.get("name") or "",
        role=current_user.get("role") or "school_admin",
        school_id=current_user.get("school_id"),
    )


@router.post("/logout")
def logout():
    """Client should discard the token. No server-side session for JWT."""
    return {"message": "Logged out"}
