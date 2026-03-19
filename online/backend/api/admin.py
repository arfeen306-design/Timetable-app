"""Admin API: user management (platform_admin only)."""
from __future__ import annotations
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user
from backend.auth.password import get_password_hash
from backend.models.base import get_db
from backend.models.user import User
from backend.models.school import SchoolMembership, School

router = APIRouter()
log = logging.getLogger(__name__)


# ─── Guard ───────────────────────────────────────────────────────────────────

def _require_platform_admin(current_user: dict):
    if current_user.get("role") != "platform_admin":
        raise HTTPException(403, "Access denied: platform admin required")


# ─── Models ──────────────────────────────────────────────────────────────────

class AdminResetPassword(BaseModel):
    new_password: str


class AdminToggleStatus(BaseModel):
    action: str  # "approve" | "deactivate"


# ─── LIST USERS ──────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all registered users with school info — single JOIN query."""
    _require_platform_admin(current_user)

    from sqlalchemy import func

    # Single query with JOIN instead of N+1
    rows = (
        db.query(User, func.coalesce(School.name, "").label("school_name"))
        .outerjoin(SchoolMembership, SchoolMembership.user_id == User.id)
        .outerjoin(School, School.id == SchoolMembership.school_id)
        .order_by(User.created_at.desc())
        .all()
    )

    result = []
    for u, school_name in rows:
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "school_name": school_name,
            "role": u.role,
            "is_active": u.is_active,
            "is_approved": u.is_approved,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {"users": result, "total": len(result)}


# ─── RESET PASSWORD (admin) ─────────────────────────────────────────────────

@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    data: AdminResetPassword,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually reset a user's password."""
    _require_platform_admin(current_user)

    if len(data.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.password_hash = get_password_hash(data.new_password)
    user.is_active = True
    user.is_approved = True
    user.updated_at = datetime.utcnow()
    db.commit()

    log.info("Admin %s reset password for user %s (%s)", current_user["email"], user_id, user.email)
    return {"ok": True, "message": f"Password reset for {user.email}"}


# ─── APPROVE / DEACTIVATE ───────────────────────────────────────────────────

@router.post("/users/{user_id}/toggle-status")
def toggle_user_status(
    user_id: int,
    data: AdminToggleStatus,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve or deactivate a user account."""
    _require_platform_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if data.action == "approve":
        user.is_approved = True
        user.is_active = True
        msg = f"{user.email} approved"
    elif data.action == "deactivate":
        user.is_approved = False
        user.is_active = False
        msg = f"{user.email} deactivated"
    else:
        raise HTTPException(400, "Action must be 'approve' or 'deactivate'")

    user.updated_at = datetime.utcnow()
    db.commit()

    log.info("Admin %s %sd user %s", current_user["email"], data.action, user.email)
    return {"ok": True, "message": msg}


# ─── DELETE USER (permanent) ────────────────────────────────────────────────

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete a user and all their data (school, projects, etc.)."""
    _require_platform_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Prevent self-deletion
    if user.email == current_user.get("email"):
        raise HTTPException(400, "Cannot delete your own admin account")

    email = user.email

    # Get schools owned by this user
    memberships = db.query(SchoolMembership).filter(SchoolMembership.user_id == user_id).all()
    school_ids_to_delete = []
    for m in memberships:
        # Check if sole member
        count = db.query(SchoolMembership).filter(SchoolMembership.school_id == m.school_id).count()
        if count <= 1:
            school_ids_to_delete.append(m.school_id)

    # Delete memberships
    db.query(SchoolMembership).filter(SchoolMembership.user_id == user_id).delete()

    # Delete schools (CASCADE will remove projects and all child data)
    from sqlalchemy import text
    for sid in school_ids_to_delete:
        db.execute(text("DELETE FROM schools WHERE id = :sid"), {"sid": sid})

    # Delete user
    db.delete(user)
    db.commit()

    # Free memory
    db.expire_all()
    import gc; gc.collect()

    log.info("Admin %s permanently deleted user %s (%s)", current_user["email"], user_id, email)
    return {"ok": True, "message": f"User {email} permanently deleted"}
