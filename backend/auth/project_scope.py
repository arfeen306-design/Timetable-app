"""Project-scoping dependency: ensure project belongs to current user's school."""
from __future__ import annotations
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.project_repo import get_by_id_and_school


def get_project_or_404(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    """Load project by id and ensure it belongs to current user's school. Raises 404 otherwise."""
    school_id = current_user.get("school_id")
    if school_id is None:
        raise HTTPException(status_code=404, detail="Project not found")
    project = get_by_id_and_school(db, project_id=project_id, school_id=school_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
