"""Project API: list, create, get, delete, export/import."""
from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import io

from backend.auth.deps import get_current_user
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.project_repo import list_by_school, get_by_id_and_school, create as create_project

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str = "New Project"
    academic_year: str = ""


class ProjectResponse(BaseModel):
    id: int
    school_id: int
    name: str
    academic_year: str
    archived: bool
    last_generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── LIST ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectResponse])
def list_projects(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school_id = current_user.get("school_id")
    if school_id is None:
        return []
    return [ProjectResponse.model_validate(p) for p in list_by_school(db, school_id)]


# ─── CREATE ──────────────────────────────────────────────────────────────────

@router.post("", response_model=ProjectResponse)
def create_project_endpoint(
    data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school_id = current_user.get("school_id")
    if school_id is None:
        raise HTTPException(403, "No school")
    p = create_project(db, school_id=school_id, name=data.name, academic_year=data.academic_year or "")
    return ProjectResponse.model_validate(p)


# ─── DEMO ────────────────────────────────────────────────────────────────────

@router.post("/demo", response_model=ProjectResponse)
def create_demo_project_endpoint(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.services.demo_data import create_demo_project
    school_id = current_user.get("school_id")
    if school_id is None:
        raise HTTPException(403, "No school")
    p = create_demo_project(db, school_id)
    return ProjectResponse.model_validate(p)


# ─── GET ONE ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school_id = current_user.get("school_id")
    project = get_by_id_and_school(db, project_id, school_id) if school_id else None
    if not project:
        raise HTTPException(404, "Project not found")
    return ProjectResponse.model_validate(project)


# ─── COUNTS (lightweight progress check) ────────────────────────────────────

@router.get("/{project_id}/counts")
def get_project_counts(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return entity counts for a project — single fast query instead of 5 list calls."""
    school_id = current_user.get("school_id")
    project = get_by_id_and_school(db, project_id, school_id) if school_id else None
    if not project:
        raise HTTPException(404, "Project not found")

    from backend.models.teacher_model import Teacher
    from backend.models.class_model import SchoolClass
    from backend.models.lesson_model import Lesson
    from backend.models.timetable_model import TimetableRun

    # Subject is in project.py itself
    teachers = db.query(Teacher).filter(Teacher.project_id == project_id).count()
    subjects = db.query(Subject).filter(Subject.project_id == project_id).count()
    classes = db.query(SchoolClass).filter(SchoolClass.project_id == project_id).count()
    lessons = db.query(Lesson).filter(Lesson.project_id == project_id).count()
    has_generated = db.query(TimetableRun).filter(TimetableRun.project_id == project_id).count() > 0

    return {
        "teachers": teachers,
        "subjects": subjects,
        "classes": classes,
        "lessons": lessons,
        "has_generated": has_generated,
    }

@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school_id = current_user.get("school_id")
    project = get_by_id_and_school(db, project_id, school_id) if school_id else None
    if not project:
        raise HTTPException(404, "Project not found")

    name = project.name

    # Fast: single CASCADE delete — all child tables have ondelete=CASCADE FKs
    db.execute(text("DELETE FROM projects WHERE id = :pid AND school_id = :sid"), {"pid": project_id, "sid": school_id})
    db.commit()

    # Free memory
    db.expire_all()
    import gc; gc.collect()

    return {"ok": True, "message": f"Project '{name}' deleted."}


# ─── EXPORT (download as .timetable.json) ───────────────────────────────────

def _serialize(obj):
    d = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


@router.get("/{project_id}/export")
def export_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school_id = current_user.get("school_id")
    project = get_by_id_and_school(db, project_id, school_id) if school_id else None
    if not project:
        raise HTTPException(404, "Project not found")

    from backend.repositories.school_settings_repo import get_by_project
    from backend.repositories.class_repo import list_by_project
    from backend.repositories.teacher_repo import list_by_project as list_teachers
    from backend.repositories.room_repo import list_by_project as list_rooms
    from backend.repositories.subject_repo import list_by_project as list_subjects
    from backend.repositories.lesson_repo import list_by_project as list_lessons
    from backend.repositories.constraint_repo import list_by_project as list_constraints

    settings = get_by_project(db, project_id)
    data = {
        "format_version": 1,
        "app": "SchoolTimetableGenerator",
        "exported_at": datetime.utcnow().isoformat(),
        "project": {"name": project.name, "academic_year": project.academic_year},
        "settings": _serialize(settings) if settings else None,
        "classes": [_serialize(c) for c in list_by_project(db, project_id)],
        "teachers": [_serialize(t) for t in list_teachers(db, project_id)],
        "rooms": [_serialize(r) for r in list_rooms(db, project_id)],
        "subjects": [_serialize(s) for s in list_subjects(db, project_id)],
        "lessons": [_serialize(l) for l in list_lessons(db, project_id)],
        "constraints": [_serialize(c) for c in list_constraints(db, project_id)],
    }

    # Strip internal IDs
    if data["settings"]:
        for k in ("id", "project_id", "school_id"):
            data["settings"].pop(k, None)
    for key in ("classes", "teachers", "rooms", "subjects", "lessons", "constraints"):
        for item in data[key]:
            item.pop("project_id", None)

    content = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
    fname = f"{project.name.replace(' ', '_')}_{project.academic_year}.timetable.json"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ─── IMPORT (upload .timetable.json) ────────────────────────────────────────

@router.post("/import", response_model=ProjectResponse)
async def import_project(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school_id = current_user.get("school_id")
    if school_id is None:
        raise HTTPException(403, "No school")

    try:
        content = await file.read()
        data = json.loads(content)
    except Exception:
        raise HTTPException(400, "Invalid JSON file")

    if data.get("app") != "SchoolTimetableGenerator":
        raise HTTPException(400, "Not a valid timetable project file")

    proj_info = data.get("project", {})
    project = create_project(
        db, school_id=school_id,
        name=f"{proj_info.get('name', 'Imported')} (imported)",
        academic_year=proj_info.get("academic_year", ""),
    )
    pid = project.id

    # Settings
    if data.get("settings"):
        from backend.repositories.school_settings_repo import create_or_update
        s = data["settings"]
        s.pop("id", None)
        s["project_id"] = pid
        create_or_update(db, pid, s)

    # ID maps for relinking
    old_class = {}
    old_teacher = {}
    old_room = {}
    old_subject = {}

    from backend.repositories.class_repo import create as create_class
    for c in data.get("classes", []):
        old_id = c.pop("id", None)
        c.pop("class_teacher_id", None)
        new = create_class(db, pid, c.get("name", ""), c.get("code", ""), c.get("grade_level", ""))
        if old_id:
            old_class[old_id] = new.id

    from backend.repositories.teacher_repo import create as create_teacher
    for t in data.get("teachers", []):
        old_id = t.pop("id", None)
        new = create_teacher(
            db, pid, t.get("first_name", ""), t.get("last_name", ""),
            code=t.get("code", ""), title=t.get("title", ""),
            email=t.get("email"), max_periods=t.get("max_periods_per_day"),
        )
        if old_id:
            old_teacher[old_id] = new.id

    from backend.repositories.room_repo import create as create_room
    for r in data.get("rooms", []):
        old_id = r.pop("id", None)
        new = create_room(db, pid, r.get("name", ""), r.get("code", ""), r.get("capacity"))
        if old_id:
            old_room[old_id] = new.id

    from backend.repositories.subject_repo import create as create_subject
    for s in data.get("subjects", []):
        old_id = s.pop("id", None)
        new = create_subject(db, pid, s.get("name", ""), s.get("code", ""), s.get("color"))
        if old_id:
            old_subject[old_id] = new.id

    from backend.repositories.lesson_repo import create as create_lesson
    for l in data.get("lessons", []):
        l.pop("id", None)
        nc = old_class.get(l.get("class_id"))
        nt = old_teacher.get(l.get("teacher_id"))
        ns = old_subject.get(l.get("subject_id"))
        nr = old_room.get(l.get("room_id"))
        if nc and nt and ns:
            create_lesson(db, pid, nc, nt, ns, periods_per_week=l.get("periods_per_week", 1), room_id=nr)

    from backend.repositories.constraint_repo import create as create_constraint
    for c in data.get("constraints", []):
        c.pop("id", None)
        et = c.get("entity_type", "")
        oid = c.get("entity_id")
        nid = old_class.get(oid) if et == "class" else old_teacher.get(oid) if et == "teacher" else old_room.get(oid)
        if nid:
            create_constraint(db, pid, et, nid, c.get("day_index", 0), c.get("period_index", 0), c.get("is_hard", True))

    db.commit()
    db.refresh(project)
    return ProjectResponse.model_validate(project)
