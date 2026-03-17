"""Admin API — protected data management endpoints.

All endpoints require the logged-in user to have role='super_admin',
OR the request must include the X-Admin-Key header matching the ADMIN_KEY env var.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import Optional
from pydantic import BaseModel

from backend.models.base import get_db
from backend.models.user import User
from backend.models.school import School, SchoolMembership
from backend.models.project import Project
from backend.auth.deps import get_current_user_optional
from backend.config import get_settings

router = APIRouter()


# ── Auth guard ───────────────────────────────────────────────────────────────

def _require_admin(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    x_admin_key: Optional[str] = Header(None),
) -> None:
    """Allow access if user is super_admin OR if X-Admin-Key matches env ADMIN_KEY."""
    import os
    admin_key = os.environ.get("ADMIN_KEY", "")

    # Check header key first
    if admin_key and x_admin_key and x_admin_key == admin_key:
        return

    # Check user role
    if current_user and current_user.get("role") == "super_admin":
        return

    raise HTTPException(403, "Admin access required. Provide X-Admin-Key header or log in as super_admin.")


# ── List all schools ─────────────────────────────────────────────────────────

@router.get("/schools", dependencies=[Depends(_require_admin)])
def list_all_schools(db: Session = Depends(get_db)):
    """List all registered schools with user counts and project counts."""
    schools = db.query(School).order_by(School.id).all()
    result = []
    for s in schools:
        members = db.query(SchoolMembership).filter(SchoolMembership.school_id == s.id).count()
        projects = db.query(Project).filter(Project.school_id == s.id).count()
        emails = [
            r[0] for r in
            db.query(User.email)
            .join(SchoolMembership, SchoolMembership.user_id == User.id)
            .filter(SchoolMembership.school_id == s.id)
            .all()
        ]
        result.append({
            "id": s.id,
            "name": s.name,
            "slug": s.slug,
            "created_at": s.created_at.isoformat() if hasattr(s, "created_at") and s.created_at else None,
            "members": members,
            "member_emails": emails,
            "projects": projects,
        })
    return {"schools": result, "total": len(result)}


# ── List all users ───────────────────────────────────────────────────────────

@router.get("/users", dependencies=[Depends(_require_admin)])
def list_all_users(db: Session = Depends(get_db)):
    """List all registered users."""
    users = db.query(User).order_by(User.id).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if hasattr(u, "created_at") and u.created_at else None,
            }
            for u in users
        ],
        "total": len(users),
    }


# ── Delete a specific school ────────────────────────────────────────────────

@router.delete("/schools/{school_id}", dependencies=[Depends(_require_admin)])
def delete_school(school_id: int, db: Session = Depends(get_db)):
    """Delete a school and ALL its data (projects, teachers, classes, lessons, timetables, settings).
    Also deletes the school's memberships and users who belong ONLY to this school."""
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(404, f"School {school_id} not found")

    name = school.name

    # Find users who only belong to this school (will be orphaned)
    orphan_user_ids = []
    memberships = db.query(SchoolMembership).filter(SchoolMembership.school_id == school_id).all()
    for m in memberships:
        other_schools = db.query(SchoolMembership).filter(
            SchoolMembership.user_id == m.user_id,
            SchoolMembership.school_id != school_id,
        ).count()
        if other_schools == 0:
            orphan_user_ids.append(m.user_id)

    # Delete projects (CASCADE will handle children: lessons, entries, settings, etc.)
    projects_deleted = db.query(Project).filter(Project.school_id == school_id).delete()

    # Delete memberships
    db.query(SchoolMembership).filter(SchoolMembership.school_id == school_id).delete()

    # Delete the school
    db.delete(school)

    # Delete orphaned users
    users_deleted = 0
    if orphan_user_ids:
        users_deleted = db.query(User).filter(User.id.in_(orphan_user_ids)).delete(synchronize_session=False)

    db.commit()

    return {
        "ok": True,
        "message": f"School '{name}' deleted.",
        "projects_deleted": projects_deleted,
        "users_deleted": users_deleted,
    }


# ── Delete a specific user ──────────────────────────────────────────────────

@router.delete("/users/{user_id}", dependencies=[Depends(_require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user and their memberships. Does NOT delete their schools."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, f"User {user_id} not found")

    email = user.email
    db.query(SchoolMembership).filter(SchoolMembership.user_id == user_id).delete()
    db.delete(user)
    db.commit()

    return {"ok": True, "message": f"User '{email}' deleted."}


# ── Nuclear: clear ALL data ──────────────────────────────────────────────────

class ClearAllRequest(BaseModel):
    confirm: str  # Must be "DELETE_EVERYTHING" to proceed


@router.post("/clear-all", dependencies=[Depends(_require_admin)])
def clear_all_data(data: ClearAllRequest, db: Session = Depends(get_db)):
    """⚠️ NUCLEAR: Delete ALL users, schools, projects, and data.
    Requires confirm='DELETE_EVERYTHING' in the request body."""
    if data.confirm != "DELETE_EVERYTHING":
        raise HTTPException(400, "Set confirm to 'DELETE_EVERYTHING' to proceed.")

    # Count before delete
    counts = {
        "users": db.query(User).count(),
        "schools": db.query(School).count(),
        "projects": db.query(Project).count(),
    }

    # Delete in dependency order
    tables = [
        "timetable_entries", "timetable_runs", "timetable_history",
        "lessons", "lesson_allowed_rooms", "time_constraints",
        "teachers", "teacher_subjects", "school_classes", "rooms", "subjects",
        "school_settings", "projects",
        "school_memberships", "users", "schools",
    ]
    for table in tables:
        try:
            db.execute(text(f"DELETE FROM {table}"))
        except Exception:
            pass  # Table might not exist

    db.commit()

    return {
        "ok": True,
        "message": "All data cleared.",
        "deleted": counts,
    }


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(_require_admin)])
def admin_stats(db: Session = Depends(get_db)):
    """Quick overview of database contents."""
    return {
        "users": db.query(User).count(),
        "schools": db.query(School).count(),
        "projects": db.query(Project).count(),
        "memberships": db.query(SchoolMembership).count(),
    }
