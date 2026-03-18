"""Archive / Publish API — snapshot + retrieve historical records for all modules."""
from __future__ import annotations
import json
import datetime as _dt
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project, Subject
from backend.models.published_snapshot_model import PublishedSnapshot
from backend.models.exam_duties_model import ExamSession, ExamDutySlot
from backend.models.duty_roster_model import DutyRoster, Committee, CommitteeMember
from backend.models.teacher_model import Teacher
from backend.models.room_model import Room

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class PublishRequest(BaseModel):
    title: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _teacher_name(t: Teacher | None) -> str:
    return f"{t.first_name} {t.last_name}".strip() if t else "?"


def _snapshot_exam_duties(db: Session, project_id: int) -> list[dict]:
    """Build a JSON-serializable snapshot of current exam duty data."""
    sessions = (
        db.query(ExamSession)
        .filter(ExamSession.project_id == project_id)
        .order_by(ExamSession.date, ExamSession.start_time)
        .all()
    )
    result = []
    for sess in sessions:
        slots = []
        for sl in sorted(sess.duty_slots, key=lambda s: (s.room_id or 0)):
            t = db.query(Teacher).filter(Teacher.id == sl.teacher_id).first()
            r = db.query(Room).filter(Room.id == sl.room_id).first() if sl.room_id else None
            slots.append({
                "teacher_name": _teacher_name(t),
                "room_name": r.name if r else "—",
                "duty_start": str(sl.duty_start)[:5] if sl.duty_start else "",
                "duty_end": str(sl.duty_end)[:5] if sl.duty_end else "",
            })
        subj = db.query(Subject).filter(Subject.id == sess.subject_id).first()
        result.append({
            "date": str(sess.date),
            "subject": subj.name if subj else "?",
            "start_time": str(sess.start_time)[:5],
            "end_time": str(sess.end_time)[:5],
            "slots": slots,
        })
    return result


def _snapshot_duty_roster(db: Session, project_id: int) -> list[dict]:
    """Build a JSON-serializable snapshot of current duty roster."""
    entries = (
        db.query(DutyRoster)
        .filter(DutyRoster.project_id == project_id)
        .order_by(DutyRoster.day_of_week, DutyRoster.period_index)
        .all()
    )
    result = []
    for e in entries:
        t = db.query(Teacher).filter(Teacher.id == e.teacher_id).first()
        result.append({
            "day_of_week": e.day_of_week,
            "period_index": e.period_index,
            "teacher_name": _teacher_name(t),
            "duty_type": e.duty_type,
            "notes": e.notes or "",
        })
    return result


def _snapshot_committees(db: Session, project_id: int) -> list[dict]:
    """Build a JSON-serializable snapshot of current committees."""
    committees = (
        db.query(Committee)
        .filter(Committee.project_id == project_id)
        .order_by(Committee.name)
        .all()
    )
    result = []
    for c in committees:
        members = []
        for m in c.members:
            t = db.query(Teacher).filter(Teacher.id == m.teacher_id).first()
            members.append({
                "teacher_name": _teacher_name(t),
                "role": m.role or "member",
            })
        result.append({
            "name": c.name,
            "description": c.description or "",
            "members": members,
        })
    return result


_SNAPSHOT_FN = {
    "exam_duties": _snapshot_exam_duties,
    "duty_roster": _snapshot_duty_roster,
    "committees": _snapshot_committees,
}

_DEFAULT_TITLES = {
    "exam_duties": "Exam Duties",
    "duty_roster": "Duty Roster",
    "committees": "School Committees",
}


# ─── Publish (create snapshot) ────────────────────────────────────────────────

@router.post("/{module_type}/publish")
def publish_snapshot(
    module_type: str = Path(..., description="exam_duties | duty_roster | committees"),
    data: PublishRequest = PublishRequest(),
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Take a point-in-time snapshot and save it as a published archive."""
    if module_type not in _SNAPSHOT_FN:
        raise HTTPException(400, f"Invalid module_type: {module_type}")

    snapshot_data = _SNAPSHOT_FN[module_type](db, project.id)
    now = _dt.datetime.utcnow()
    title = data.title or f"{_DEFAULT_TITLES[module_type]} — {now.strftime('%d %b %Y')}"

    record = PublishedSnapshot(
        project_id=project.id,
        module_type=module_type,
        title=title,
        snapshot_json=json.dumps(snapshot_data, default=str),
        published_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "ok": True,
        "id": record.id,
        "title": record.title,
        "published_at": record.published_at.isoformat(),
        "record_count": len(snapshot_data),
    }


# ─── List Archives ───────────────────────────────────────────────────────────

@router.get("/{module_type}/list")
def list_archives(
    module_type: str = Path(...),
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """List all published snapshots for a module."""
    if module_type not in _SNAPSHOT_FN:
        raise HTTPException(400, f"Invalid module_type: {module_type}")

    records = (
        db.query(PublishedSnapshot)
        .filter(
            PublishedSnapshot.project_id == project.id,
            PublishedSnapshot.module_type == module_type,
        )
        .order_by(PublishedSnapshot.published_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "title": r.title,
            "published_at": r.published_at.isoformat() if r.published_at else "",
            "record_count": len(json.loads(r.snapshot_json)) if r.snapshot_json else 0,
        }
        for r in records
    ]


# ─── Get Single Archive ──────────────────────────────────────────────────────

@router.get("/{module_type}/{archive_id}")
def get_archive(
    module_type: str = Path(...),
    archive_id: int = Path(...),
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Get a single published snapshot's full data."""
    record = (
        db.query(PublishedSnapshot)
        .filter(
            PublishedSnapshot.id == archive_id,
            PublishedSnapshot.project_id == project.id,
            PublishedSnapshot.module_type == module_type,
        )
        .first()
    )
    if not record:
        raise HTTPException(404, "Archive not found.")

    return {
        "id": record.id,
        "title": record.title,
        "published_at": record.published_at.isoformat() if record.published_at else "",
        "data": json.loads(record.snapshot_json),
    }


# ─── Export Archive as PDF ────────────────────────────────────────────────────

@router.get("/{module_type}/{archive_id}/export-pdf")
def export_archive_pdf(
    module_type: str = Path(...),
    archive_id: int = Path(...),
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Generate a PDF from a stored archive snapshot."""
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer
    from utils.pdf_engine import PDFEngine

    record = (
        db.query(PublishedSnapshot)
        .filter(
            PublishedSnapshot.id == archive_id,
            PublishedSnapshot.project_id == project.id,
            PublishedSnapshot.module_type == module_type,
        )
        .first()
    )
    if not record:
        raise HTTPException(404, "Archive not found.")

    engine = PDFEngine(db, project)
    data = json.loads(record.snapshot_json)
    pub_date = record.published_at.strftime('%d %B %Y') if record.published_at else ""

    story = engine.header(record.title, date_str=pub_date)

    if module_type == "exam_duties":
        header = ["Date", "Paper", "Room", "Teacher", "Time"]
        rows = [header]
        for sess in data:
            if not sess.get("slots"):
                rows.append([sess["date"], sess["subject"], "—", "—", f"{sess['start_time']}–{sess['end_time']}"])
            else:
                for i, sl in enumerate(sess["slots"]):
                    rows.append([
                        sess["date"] if i == 0 else "",
                        sess["subject"] if i == 0 else "",
                        sl["room_name"],
                        sl["teacher_name"],
                        f"{sess['start_time']}–{sess['end_time']}" if i == 0 else "",
                    ])
        col_w = [22 * mm, 35 * mm, 35 * mm, 45 * mm, 28 * mm]
        tbl = engine.smart_fit_table(rows, col_w)
        story.extend([Spacer(1, 4 * mm), tbl])

    elif module_type == "duty_roster":
        DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        header = ["Day", "Lesson", "Teacher", "Duty"]
        rows = [header]
        for e in data:
            rows.append([
                DAY_NAMES[e["day_of_week"]] if e["day_of_week"] < 7 else "?",
                f"Lesson {e['period_index'] + 1}",
                e["teacher_name"],
                e["duty_type"],
            ])
        col_w = [20 * mm, 18 * mm, 60 * mm, 40 * mm]
        tbl = engine.smart_fit_table(rows, col_w)
        story.extend([Spacer(1, 4 * mm), tbl])

    elif module_type == "committees":
        for comm in data:
            story.append(Paragraph(comm["name"], engine.section_style))
            if comm.get("description"):
                story.append(Paragraph(comm["description"], engine.body_style))
                story.append(Spacer(1, 2 * mm))
            if comm.get("members"):
                rows = [["#", "Teacher", "Role"]]
                for i, m in enumerate(comm["members"], 1):
                    rows.append([str(i), m["teacher_name"], m["role"]])
                col_w = [12 * mm, 110 * mm, 50 * mm]
                tbl = engine.table(rows, col_w)
                story.append(tbl)
                story.append(Spacer(1, 4 * mm))
            else:
                story.append(Paragraph("No members.", engine.body_style))
                story.append(Spacer(1, 3 * mm))

    story += engine.signature_block()
    story += engine.footer()

    fname = f"archive_{module_type}_{archive_id}.pdf"
    return engine.build(story, filename=fname)


# ─── Latest per module (for dashboard shortcuts) ─────────────────────────────

@router.get("/latest")
def latest_archives(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Return the latest published snapshot for each module."""
    result = {}
    for mod in ["exam_duties", "duty_roster", "committees"]:
        record = (
            db.query(PublishedSnapshot)
            .filter(
                PublishedSnapshot.project_id == project.id,
                PublishedSnapshot.module_type == mod,
            )
            .order_by(PublishedSnapshot.published_at.desc())
            .first()
        )
        if record:
            result[mod] = {
                "id": record.id,
                "title": record.title,
                "published_at": record.published_at.isoformat() if record.published_at else "",
            }
        else:
            result[mod] = None
    return result
