"""Auth API: login, register, verify-email, me, logout."""
from __future__ import annotations
import re, smtplib, logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.auth.jwt import create_access_token, verify_token
from backend.auth.password import get_password_hash, verify_password
from backend.config import get_settings
from backend.models.base import get_db
from backend.models.user import User
from backend.models.school import School, SchoolMembership
from backend.repositories.user_repo import get_by_email
from backend.repositories.membership_repo import get_first_school_id_for_user
from backend.auth.deps import get_current_user_optional

router = APIRouter()
log = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    school_name: str
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


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _send_verification_email(to_email: str, token: str):
    """Send verification email via SMTP. Fails silently if SMTP not configured."""
    settings = get_settings()
    if not settings.smtp_host:
        log.warning("SMTP not configured — skipping verification email for %s", to_email)
        return False

    verify_url = f"{settings.app_url}/verify-email?token={token}"
    subject = "Verify your SchoolScheduler account"
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px;
             background: linear-gradient(135deg, #3b82f6, #8b5cf6); font-size: 24px;
             line-height: 48px; text-align: center;">📅</div>
        <h2 style="margin: 0.5rem 0 0; color: #0f172a;">SchoolScheduler</h2>
      </div>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Welcome! Click the button below to verify your email and activate your account:
      </p>
      <div style="text-align: center; margin: 1.5rem 0;">
        <a href="{verify_url}" style="display: inline-block; padding: 12px 32px; border-radius: 8px;
           background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; text-decoration: none;
           font-weight: 700; font-size: 15px;">Verify My Email</a>
      </div>
      <p style="color: #94a3b8; font-size: 12px;">
        Or copy this link: <a href="{verify_url}" style="color: #3b82f6;">{verify_url}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;" />
      <p style="color: #94a3b8; font-size: 11px;">
        If you didn't create this account, ignore this email.
      </p>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from or settings.smtp_user
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
        log.info("Verification email sent to %s", to_email)
        return True
    except Exception as e:
        log.error("Failed to send verification email: %s", e)
        return False


# ─── REGISTER ────────────────────────────────────────────────────────────────

@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Register new user + school. Sends verification email if SMTP configured."""
    email = data.email.strip().lower()
    if not email or not data.password or not data.school_name.strip():
        raise HTTPException(400, "School name, email, and password are required")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        raise HTTPException(400, "Invalid email format")

    # Check if user already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    settings = get_settings()
    smtp_configured = bool(settings.smtp_host)

    # Create user (inactive if SMTP configured, active if not)
    user = User(
        email=email,
        password_hash=get_password_hash(data.password),
        name=data.school_name.strip(),
        role="school_admin",
        is_active=not smtp_configured,  # active immediately if no SMTP
        email_verified_at=None if smtp_configured else datetime.utcnow(),
    )
    db.add(user)
    db.flush()

    # Create school + membership
    slug = re.sub(r"[^a-z0-9]+", "-", data.school_name.strip().lower()).strip("-") or "school"
    # Ensure unique slug
    base_slug = slug
    counter = 1
    while db.query(School).filter(School.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    school = School(name=data.school_name.strip(), slug=slug)
    db.add(school)
    db.flush()

    membership = SchoolMembership(school_id=school.id, user_id=user.id, role="admin")
    db.add(membership)
    db.commit()

    # Send verification email
    if smtp_configured:
        token = create_access_token(subject=email, payload={"purpose": "verify_email", "user_id": user.id})
        email_sent = _send_verification_email(email, token)
        return {
            "ok": True,
            "email_sent": email_sent,
            "message": "Account created. Please check your email to verify your account." if email_sent
                       else "Account created but email could not be sent. Contact support.",
            "requires_verification": True,
        }
    else:
        # No SMTP — auto-activate and return login token
        school_id = school.id
        payload = {
            "id": user.id, "email": user.email,
            "name": user.name or "", "role": user.role,
            "school_id": school_id,
        }
        access_token = create_access_token(subject=user.email, payload=payload)
        return {
            "ok": True,
            "requires_verification": False,
            "access_token": access_token,
            "token_type": "bearer",
            "user": payload,
        }


# ─── VERIFY EMAIL ────────────────────────────────────────────────────────────

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    """Activate account from email verification link."""
    decoded = verify_token(token)
    if not decoded or decoded.get("purpose") != "verify_email":
        raise HTTPException(400, "Invalid or expired verification link")

    user_id = decoded.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.is_active and user.email_verified_at:
        return {"ok": True, "message": "Email already verified. You can sign in."}

    user.is_active = True
    user.email_verified_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "message": "Email verified successfully! You can now sign in."}


# ─── LOGIN ───────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    if not data.email or not data.password:
        raise HTTPException(400, "Email and password required")

    email = data.email.strip().lower()

    # Check if user exists but not active (pending verification)
    user_any = db.query(User).filter(User.email == email).first()
    if user_any and not user_any.is_active:
        raise HTTPException(403, "Please verify your email before signing in. Check your inbox.")

    user = get_by_email(db, email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    school_id = get_first_school_id_for_user(db, user.id)
    payload = {
        "id": user.id, "email": user.email,
        "name": user.name or "", "role": user.role,
        "school_id": school_id,
    }
    access_token = create_access_token(subject=user.email, payload=payload)
    return LoginResponse(access_token=access_token, user=payload)


# ─── ME / LOGOUT ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user_optional)):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return UserResponse(
        id=current_user.get("id") or 0,
        email=current_user.get("email") or "",
        name=current_user.get("name") or "",
        role=current_user.get("role") or "school_admin",
        school_id=current_user.get("school_id"),
    )


@router.post("/logout")
def logout():
    return {"message": "Logged out"}
