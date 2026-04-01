"""Auth API: register, login, me, logout — with rate limiting."""
from __future__ import annotations
import re
import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user_optional
from backend.auth.jwt import create_access_token
from backend.auth.password import get_password_hash, verify_password
from backend.models.base import get_db
from backend.models.user import User
from backend.models.school import School, SchoolMembership
from backend.repositories.user_repo import get_by_email
from backend.repositories.membership_repo import get_first_school_id_for_user

router = APIRouter()

# --- Rate limiter: 5 attempts per 60s per IP ---
_rate_store: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 5
_RATE_WINDOW = 60  # seconds


def _check_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = _rate_store[ip]
    # Prune old entries
    _rate_store[ip] = [t for t in attempts if now - t < _RATE_WINDOW]
    if len(_rate_store[ip]) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait a minute and try again.",
        )
    _rate_store[ip].append(now)


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


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


def _make_slug(name: str) -> str:
    """Turn 'My Great School' into 'my-great-school'."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "my-school"


@router.post("/register", response_model=LoginResponse)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Create a new user + school + membership, return JWT."""
    _check_rate_limit(request)
    email = data.email.strip().lower()
    if not email or not data.password or not data.name.strip():
        raise HTTPException(status_code=400, detail="All fields are required")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = get_by_email(db, email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=email,
        password_hash=get_password_hash(data.password),
        name=data.name.strip(),
        role="school_admin",
    )
    db.add(user)
    db.flush()  # get user.id

    school_name = f"{data.name.strip()}'s School"
    base_slug = _make_slug(data.name.strip())
    # Ensure slug uniqueness
    slug = base_slug
    counter = 1
    while db.query(School).filter(School.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    school = School(name=school_name, slug=slug)
    db.add(school)
    db.flush()  # get school.id

    membership = SchoolMembership(school_id=school.id, user_id=user.id, role="admin")
    db.add(membership)
    db.commit()
    db.refresh(user)

    payload = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "school_id": school.id,
    }
    access_token = create_access_token(subject=user.email, payload=payload)
    return LoginResponse(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "school_id": school.id,
        },
    )


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate with email and password. Returns JWT."""
    _check_rate_limit(request)
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
