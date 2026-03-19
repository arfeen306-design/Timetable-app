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

from backend.auth.jwt import create_access_token, verify_token, create_reset_token
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
    phone: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    school_id: Optional[int] = None


class UpdatePhoneRequest(BaseModel):
    phone: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


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
    phone = re.sub(r"[^\d+]", "", data.phone.strip())  # keep digits and +
    if not email or not data.password or not data.school_name.strip():
        raise HTTPException(400, "School name, email, and password are required")
    if not phone or len(phone) < 7:
        raise HTTPException(400, "A valid mobile number is required")
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

    # Create user — is_approved=False means admin must approve before login works
    user = User(
        email=email,
        password_hash=get_password_hash(data.password),
        name=data.school_name.strip(),
        role="school_admin",
        phone=phone,
        is_active=True,
        is_approved=False,  # Requires admin approval
        email_verified_at=datetime.utcnow(),
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

    return {
        "ok": True,
        "requires_approval": True,
        "message": "Registration successful! Your account is pending admin approval. You will be able to sign in once approved.",
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

    # Check if user exists
    user_any = db.query(User).filter(User.email == email).first()
    if user_any and not user_any.is_active:
        raise HTTPException(403, "Please verify your email before signing in. Check your inbox.")
    if user_any and not getattr(user_any, 'is_approved', True):
        raise HTTPException(403, "Your account is pending admin approval. Please wait for the admin to approve your registration.")

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
def me(current_user: dict = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    # Fetch phone from DB (not stored in JWT)
    phone = None
    uid = current_user.get("id")
    if uid:
        u = db.query(User).filter(User.id == uid).first()
        phone = u.phone if u else None
    return UserResponse(
        id=uid or 0,
        email=current_user.get("email") or "",
        name=current_user.get("name") or "",
        role=current_user.get("role") or "school_admin",
        phone=phone,
        school_id=current_user.get("school_id"),
    )


@router.post("/update-phone")
def update_phone(data: UpdatePhoneRequest, current_user: dict = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    """Set mobile number for OAuth users (or anyone missing phone)."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    phone = re.sub(r"[^\d+]", "", data.phone.strip())
    if not phone or len(phone) < 7:
        raise HTTPException(400, "A valid mobile number is required")
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.phone = phone
    db.commit()
    return {"ok": True, "phone": phone}


@router.post("/logout")
def logout():
    return {"message": "Logged out"}


# ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────

def _send_reset_email(to_email: str, token: str):
    """Send password reset email via SMTP."""
    settings = get_settings()
    if not settings.smtp_host:
        log.warning("SMTP not configured — cannot send reset email for %s", to_email)
        return False

    reset_url = f"{settings.app_url}/reset-password?token={token}"
    subject = "Reset your Myzynca password"
    html = f"""
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="display: inline-block; width: 52px; height: 52px; border-radius: 14px;
             background: linear-gradient(135deg, #0d9488, #00CEC8); font-size: 26px;
             line-height: 52px; text-align: center; color: white;">🔐</div>
        <h2 style="margin: 0.5rem 0 0; color: #0f172a; font-weight: 700;">Password Reset</h2>
      </div>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        You requested a password reset for your Myzynca account. Click the button below
        to set a new password:
      </p>
      <div style="text-align: center; margin: 1.5rem 0;">
        <a href="{reset_url}" style="display: inline-block; padding: 14px 36px; border-radius: 10px;
           background: linear-gradient(135deg, #0d9488, #00CEC8); color: #fff; text-decoration: none;
           font-weight: 700; font-size: 15px; letter-spacing: 0.01em;">Reset My Password</a>
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
        This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 0.5rem;">
        Or copy this link: <a href="{reset_url}" style="color: #0d9488;">{reset_url}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">
        Myzynca · Precision School Scheduling
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
        log.info("Password reset email sent to %s", to_email)
        return True
    except Exception as e:
        log.error("Failed to send reset email: %s", e)
        return False


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate password reset token and send email."""
    email = data.email.strip().lower()
    if not email:
        raise HTTPException(400, "Email is required")

    user = db.query(User).filter(User.email == email).first()
    # Always return success to prevent email enumeration
    if not user:
        return {"ok": True, "message": "If an account exists with this email, a reset link has been sent."}

    token = create_reset_token(user.id, user.email)
    sent = _send_reset_email(user.email, token)

    if not sent:
        raise HTTPException(500, "Unable to send email. Please contact support.")

    return {"ok": True, "message": "If an account exists with this email, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validate reset token and update password."""
    if not data.token or not data.password:
        raise HTTPException(400, "Token and password are required")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    decoded = verify_token(data.token)
    if not decoded or decoded.get("purpose") != "reset_password":
        raise HTTPException(400, "Invalid or expired reset link. Please request a new one.")

    user_id = decoded.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Single-use: check if password was changed after token was issued
    token_iat = decoded.get("iat", 0)
    if user.updated_at and user.updated_at.timestamp() > token_iat:
        raise HTTPException(400, "This reset link has already been used. Please request a new one.")

    user.password_hash = get_password_hash(data.password)
    user.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "message": "Password updated successfully. You can now sign in."}
