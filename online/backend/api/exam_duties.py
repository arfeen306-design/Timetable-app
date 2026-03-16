"""Exam Duties API — exam sessions, config, slot assignments, auto-assign, PDF export."""
from __future__ import annotations
import io
import json
import datetime as _dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional as _Opt
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.models.exam_duties_model import ExamSession, ExamDutyConfig, ExamDutySlot
from backend.models.teacher_model import Teacher, TeacherSubject
from backend.models.room_model import Room

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# Pydantic schemas
# ══════════════════════════════════════════════════════════════════════════════

class ExamSessionCreate(BaseModel):
    subject_id: int
    date:       str        # ISO: YYYY-MM-DD
    start_time: str        # HH:MM
    end_time:   str        # HH:MM
    room_ids:   List[int] = []


class ExamSessionResponse(BaseModel):
    id:         int
    project_id: int
    subject_id: int
    date:       str
    start_time: str
    end_time:   str
    room_ids:   List[int]

    class Config:
        from_attributes = True


class ExamDutyConfigIn(BaseModel):
    total_exam_rooms:       int = 10
    duty_duration_minutes:  int = 90
    invigilators_per_room:  int = 1
    exempt_teacher_ids:     List[int] = []


class ExamDutyConfigResponse(BaseModel):
    id:                    int
    project_id:            int
    total_exam_rooms:      int
    duty_duration_minutes: int
    invigilators_per_room: int
    exempt_teacher_ids:    List[int]

    class Config:
        from_attributes = True


class SlotCreate(BaseModel):
    teacher_id:  int
    room_id:     Optional[int] = None
    is_override: bool = False


class SlotResponse(BaseModel):
    id:          int
    session_id:  int
    teacher_id:  int
    room_id:     Optional[int]
    duty_start:  str
    duty_end:    str
    is_override: bool
    teacher_name: str = ""
    room_name:    str = ""

    class Config:
        from_attributes = True


# ── helpers ───────────────────────────────────────────────────────────────────

def _session_to_resp(s: ExamSession) -> dict:
    return {
        "id":         s.id,
        "project_id": s.project_id,
        "subject_id": s.subject_id,
        "date":       str(s.date),
        "start_time": str(s.start_time)[:5],
        "end_time":   str(s.end_time)[:5],
        "room_ids":   json.loads(s.room_ids_json or "[]"),
    }


def _slot_to_resp(slot: ExamDutySlot, db: Session) -> dict:
    t = db.get(Teacher, slot.teacher_id)
    r = db.get(Room, slot.room_id) if slot.room_id else None
    return {
        "id":          slot.id,
        "session_id":  slot.session_id,
        "teacher_id":  slot.teacher_id,
        "room_id":     slot.room_id,
        "duty_start":  str(slot.duty_start)[:5],
        "duty_end":    str(slot.duty_end)[:5],
        "is_override": slot.is_override,
        "teacher_name": f"{t.first_name} {t.last_name}".strip() if t else "",
        "room_name":    r.name if r else "",
    }


# ══════════════════════════════════════════════════════════════════════════════
# ExamDutyConfig
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/config")
def get_exam_duty_config(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    cfg = db.query(ExamDutyConfig).filter(ExamDutyConfig.project_id == project.id).first()
    if not cfg:
        return {
            "id": None, "project_id": project.id,
            "total_exam_rooms": 10, "duty_duration_minutes": 90,
            "invigilators_per_room": 1, "exempt_teacher_ids": [],
        }
    return {
        "id":                    cfg.id,
        "project_id":            cfg.project_id,
        "total_exam_rooms":      cfg.total_exam_rooms,
        "duty_duration_minutes": cfg.duty_duration_minutes,
        "invigilators_per_room": cfg.invigilators_per_room,
        "exempt_teacher_ids":    json.loads(cfg.exempt_teacher_ids_json or "[]"),
    }


@router.post("/config")
def save_exam_duty_config(
    data: ExamDutyConfigIn,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    cfg = db.query(ExamDutyConfig).filter(ExamDutyConfig.project_id == project.id).first()
    if cfg:
        cfg.total_exam_rooms       = data.total_exam_rooms
        cfg.duty_duration_minutes  = data.duty_duration_minutes
        cfg.invigilators_per_room  = data.invigilators_per_room
        cfg.exempt_teacher_ids_json = json.dumps(data.exempt_teacher_ids)
    else:
        cfg = ExamDutyConfig(
            project_id              = project.id,
            total_exam_rooms        = data.total_exam_rooms,
            duty_duration_minutes   = data.duty_duration_minutes,
            invigilators_per_room   = data.invigilators_per_room,
            exempt_teacher_ids_json = json.dumps(data.exempt_teacher_ids),
        )
        db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return {
        "id":                    cfg.id,
        "project_id":            cfg.project_id,
        "total_exam_rooms":      cfg.total_exam_rooms,
        "duty_duration_minutes": cfg.duty_duration_minutes,
        "invigilators_per_room": cfg.invigilators_per_room,
        "exempt_teacher_ids":    json.loads(cfg.exempt_teacher_ids_json or "[]"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ExamSessions (date sheet)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sessions")
def list_exam_sessions(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ExamSession)
        .filter(ExamSession.project_id == project.id)
        .order_by(ExamSession.date, ExamSession.start_time)
        .all()
    )
    # Enrich with subject name and slot count
    from backend.models.project import Subject
    subjects = {s.id: s for s in db.query(Subject).filter(Subject.project_id == project.id).all()}
    result = []
    for s in sessions:
        r = _session_to_resp(s)
        subj = subjects.get(s.subject_id)
        r["subject_name"]  = subj.name if subj else ""
        r["subject_color"] = subj.color if subj else ""
        r["slot_count"]    = len(s.duty_slots)
        r["slots_needed"]  = len(r["room_ids"])
        result.append(r)
    return result


@router.post("/sessions", status_code=201)
def create_exam_session(
    data: ExamSessionCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    try:
        date_obj  = _dt.date.fromisoformat(data.date)
        start_obj = _dt.time.fromisoformat(data.start_time)
        end_obj   = _dt.time.fromisoformat(data.end_time)
    except ValueError as exc:
        raise HTTPException(422, f"Invalid date/time format: {exc}")

    if end_obj <= start_obj:
        raise HTTPException(422, "end_time must be after start_time")

    session = ExamSession(
        project_id    = project.id,
        subject_id    = data.subject_id,
        date          = date_obj,
        start_time    = start_obj,
        end_time      = end_obj,
        room_ids_json = json.dumps(data.room_ids),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_resp(session)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_exam_session(
    session_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ExamSession)
        .filter(ExamSession.id == session_id, ExamSession.project_id == project.id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Exam session not found")
    db.delete(session)
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# ExamDutySlots (manual assignment)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sessions/{session_id}/slots")
def list_slots(
    session_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ExamSession)
        .filter(ExamSession.id == session_id, ExamSession.project_id == project.id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Exam session not found")
    return [_slot_to_resp(sl, db) for sl in session.duty_slots]


@router.post("/sessions/{session_id}/slots", status_code=201)
def assign_slot(
    session_id: int,
    data: SlotCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ExamSession)
        .filter(ExamSession.id == session_id, ExamSession.project_id == project.id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Exam session not found")

    # Load config for exemption rules
    cfg = db.query(ExamDutyConfig).filter(ExamDutyConfig.project_id == project.id).first()
    if cfg:
        exempt = set(json.loads(cfg.exempt_teacher_ids_json or "[]"))
        if data.teacher_id in exempt and not data.is_override:
            raise HTTPException(409, "Teacher is exempt from exam duty.")

    # Check subject-teacher exclusion
    is_subj_teacher = db.query(TeacherSubject).filter(
        TeacherSubject.teacher_id == data.teacher_id,
        TeacherSubject.subject_id == session.subject_id,
    ).first()
    if is_subj_teacher and not data.is_override:
        raise HTTPException(409, "Subject teacher cannot invigilate their own paper.")

    # Check time conflict with other slots on same date
    overlapping = (
        db.query(ExamDutySlot)
        .join(ExamSession, ExamDutySlot.session_id == ExamSession.id)
        .filter(
            ExamDutySlot.teacher_id == data.teacher_id,
            ExamSession.date        == session.date,
            ExamSession.id          != session.id,
            ExamDutySlot.duty_start < session.end_time,
            ExamDutySlot.duty_end   > session.start_time,
        )
        .first()
    )
    if overlapping and not data.is_override:
        raise HTTPException(409, "Time conflict — teacher already has a duty during this session.")

    # Check duplicate assignment in same session
    existing = db.query(ExamDutySlot).filter(
        ExamDutySlot.session_id == session_id,
        ExamDutySlot.teacher_id == data.teacher_id,
    ).first()
    if existing:
        raise HTTPException(409, "Teacher is already assigned to this session.")

    slot = ExamDutySlot(
        session_id  = session_id,
        teacher_id  = data.teacher_id,
        room_id     = data.room_id,
        duty_start  = session.start_time,
        duty_end    = session.end_time,
        is_override = data.is_override,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _slot_to_resp(slot, db)


@router.delete("/sessions/{session_id}/slots/{slot_id}", status_code=204)
def remove_slot(
    session_id: int,
    slot_id:    int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    slot = (
        db.query(ExamDutySlot)
        .join(ExamSession)
        .filter(
            ExamDutySlot.id       == slot_id,
            ExamSession.id        == session_id,
            ExamSession.project_id == project.id,
        )
        .first()
    )
    if not slot:
        raise HTTPException(404, "Slot not found")
    db.delete(slot)
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Auto-assign
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/sessions/{session_id}/auto-assign")
def auto_assign(
    session_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ExamSession)
        .filter(ExamSession.id == session_id, ExamSession.project_id == project.id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Exam session not found")

    cfg = db.query(ExamDutyConfig).filter(ExamDutyConfig.project_id == project.id).first()
    exempt_ids = set(json.loads(cfg.exempt_teacher_ids_json or "[]")) if cfg else set()

    room_ids = json.loads(session.room_ids_json or "[]")
    assigned_room_ids = {sl.room_id for sl in session.duty_slots}
    unassigned_rooms  = [r for r in room_ids if r not in assigned_room_ids]

    if not unassigned_rooms:
        return {"assigned": [], "unassigned_rooms": [], "warnings": ["All rooms already assigned."]}

    # Get subject teacher IDs
    subj_teacher_ids = {
        ts.teacher_id
        for ts in db.query(TeacherSubject).filter(TeacherSubject.subject_id == session.subject_id).all()
    }

    excluded_ids = exempt_ids | subj_teacher_ids

    # Already-assigned teachers in this session
    session_teacher_ids = {sl.teacher_id for sl in session.duty_slots}

    # Find time-conflicted teachers
    busy_teacher_ids: set[int] = set()
    conflicting_slots = (
        db.query(ExamDutySlot)
        .join(ExamSession, ExamDutySlot.session_id == ExamSession.id)
        .filter(
            ExamSession.date        == session.date,
            ExamSession.id          != session.id,
            ExamDutySlot.duty_start < session.end_time,
            ExamDutySlot.duty_end   > session.start_time,
        )
        .all()
    )
    busy_teacher_ids = {sl.teacher_id for sl in conflicting_slots}

    all_excluded = excluded_ids | session_teacher_ids | busy_teacher_ids

    all_teachers = db.query(Teacher).filter(Teacher.project_id == project.id).all()
    eligible     = [t for t in all_teachers if t.id not in all_excluded]

    # Sort by existing exam duty count (fairness)
    duty_counts: dict[int, int] = {}
    for t in eligible:
        duty_counts[t.id] = db.query(func.count(ExamDutySlot.id)).filter(
            ExamDutySlot.teacher_id == t.id
        ).scalar() or 0
    eligible.sort(key=lambda t: duty_counts[t.id])

    assigned    = []
    not_filled  = []
    warnings: list[str] = []

    for i, room_id in enumerate(unassigned_rooms):
        if i < len(eligible):
            t = eligible[i]
            slot = ExamDutySlot(
                session_id  = session.id,
                teacher_id  = t.id,
                room_id     = room_id,
                duty_start  = session.start_time,
                duty_end    = session.end_time,
                is_override = False,
            )
            db.add(slot)
            assigned.append({
                "room_id":      room_id,
                "teacher_id":   t.id,
                "teacher_name": f"{t.first_name} {t.last_name}".strip(),
            })
        else:
            not_filled.append(room_id)
            warnings.append(f"Room {room_id}: no eligible teacher available.")

    if not_filled:
        warnings.insert(0, f"{len(not_filled)} room(s) could not be filled.")

    db.commit()
    return {"assigned": assigned, "unassigned_rooms": not_filled, "warnings": warnings}


# ══════════════════════════════════════════════════════════════════════════════
# Teacher exam-duty summary
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/teacher-summary/{teacher_id}")
def teacher_exam_summary(
    teacher_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id, Teacher.project_id == project.id
    ).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")

    cfg = db.query(ExamDutyConfig).filter(ExamDutyConfig.project_id == project.id).first()
    exempt_ids = set(json.loads(cfg.exempt_teacher_ids_json or "[]")) if cfg else set()

    sessions_assigned = db.query(func.count(ExamDutySlot.id)).filter(
        ExamDutySlot.teacher_id == teacher_id
    ).scalar() or 0

    duty_slots = db.query(ExamDutySlot).filter(ExamDutySlot.teacher_id == teacher_id).all()
    duty_minutes = 0
    for sl in duty_slots:
        start = _dt.datetime.combine(_dt.date.today(), sl.duty_start)
        end   = _dt.datetime.combine(_dt.date.today(), sl.duty_end)
        duty_minutes += max(0, int((end - start).total_seconds() / 60))

    subj_links = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_id).all()
    from backend.models.project import Subject
    excluded_subjects = []
    for ts in subj_links:
        s = db.get(Subject, ts.subject_id)
        if s and s.project_id == project.id:
            excluded_subjects.append({"id": s.id, "name": s.name})

    return {
        "teacher_id":         teacher_id,
        "teacher_name":       f"{teacher.first_name} {teacher.last_name}".strip(),
        "sessions_assigned":  sessions_assigned,
        "duty_minutes_total": duty_minutes,
        "exempt":             teacher_id in exempt_ids,
        "excluded_subjects":  excluded_subjects,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Teacher duty summary (all teachers in project)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/teacher-duty-summary")
def get_teacher_duty_summary(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    from backend.models.duty_roster_model import DutyRoster
    from backend.models.project import Subject

    cfg = db.query(ExamDutyConfig).filter(ExamDutyConfig.project_id == project.id).first()
    exempt_ids = set(json.loads(cfg.exempt_teacher_ids_json or "[]")) if cfg else set()

    teachers = db.query(Teacher).filter(Teacher.project_id == project.id).all()

    # Exam slots for this project
    exam_slots = (
        db.query(ExamDutySlot)
        .join(ExamSession, ExamDutySlot.session_id == ExamSession.id)
        .filter(ExamSession.project_id == project.id)
        .all()
    )

    exam_count_map: dict = {}
    exam_minutes_map: dict = {}
    for sl in exam_slots:
        tid = sl.teacher_id
        exam_count_map[tid] = exam_count_map.get(tid, 0) + 1
        start = _dt.datetime.combine(_dt.date.today(), sl.duty_start)
        end   = _dt.datetime.combine(_dt.date.today(), sl.duty_end)
        mins  = max(0, int((end - start).total_seconds() / 60))
        exam_minutes_map[tid] = exam_minutes_map.get(tid, 0) + mins

    # Duty roster entries per teacher
    roster_entries = (
        db.query(DutyRoster)
        .filter(DutyRoster.project_id == project.id, DutyRoster.teacher_id != None)
        .all()
    )
    roster_count_map: dict = {}
    for r in roster_entries:
        if r.teacher_id:
            roster_count_map[r.teacher_id] = roster_count_map.get(r.teacher_id, 0) + 1

    # Subject names for teachers
    all_subjects = {s.id: s for s in db.query(Subject).filter(Subject.project_id == project.id).all()}
    subj_map: dict = {}
    for ts in db.query(TeacherSubject).all():
        subj = all_subjects.get(ts.subject_id)
        if subj and ts.teacher_id not in subj_map:
            subj_map[ts.teacher_id] = subj.name

    result = []
    for t in teachers:
        ec = exam_count_map.get(t.id, 0)
        em = exam_minutes_map.get(t.id, 0)
        rc = roster_count_map.get(t.id, 0)
        result.append({
            "teacher_id":        t.id,
            "teacher_name":      f"{t.first_name} {t.last_name}".strip(),
            "subject":           subj_map.get(t.id, ""),
            "initials":          t.code or "",
            "exam_duty_count":   ec,
            "exam_duty_minutes": em,
            "roster_duty_count": rc,
            "total_duty_events": ec + rc,
            "is_exempt":         t.id in exempt_ids,
        })
    return result


# ══════════════════════════════════════════════════════════════════════════════
# PDF export (all sessions or single date)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/export-pdf")
def export_exam_duties_pdf(
    date: _Opt[str] = Query(None, description="ISO date YYYY-MM-DD — omit to export all"),
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    date_obj = None
    if date:
        try:
            date_obj = _dt.date.fromisoformat(date)
        except ValueError:
            raise HTTPException(422, "date must be YYYY-MM-DD")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        raise HTTPException(501, "reportlab not installed on server.")

    q = db.query(ExamSession).filter(ExamSession.project_id == project.id)
    if date_obj:
        q = q.filter(ExamSession.date == date_obj)
    sessions = q.order_by(ExamSession.date, ExamSession.start_time).all()

    from backend.models.project import Subject
    subj_map = {s.id: s for s in db.query(Subject).filter(Subject.project_id == project.id).all()}
    room_map = {r.id: r for r in db.query(Room).filter(Room.project_id == project.id).all()}
    teach_map = {t.id: t for t in db.query(Teacher).filter(Teacher.project_id == project.id).all()}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    title_s = ParagraphStyle("T", parent=styles["Heading1"], fontSize=14, spaceAfter=2)
    sub_s   = ParagraphStyle("S", parent=styles["Normal"],   fontSize=9,  spaceAfter=8, textColor=colors.grey)
    date_label = date_obj.strftime('%A, %d %B %Y') if date_obj else "All Sessions"
    story   = [
        Paragraph(f"{project.name} — Exam Duty Roster", title_s),
        Paragraph(date_label, sub_s),
    ]

    if not sessions:
        story.append(Paragraph("No exam sessions found.", styles["Normal"]))
    else:
        header = ["Paper", "Room", "Teacher", "Time"]
        rows   = [header]
        for sess in sessions:
            subj = subj_map.get(sess.subject_id)
            subj_name = subj.name if subj else f"Subject #{sess.subject_id}"
            slots = sorted(sess.duty_slots, key=lambda s: (s.room_id or 0))
            time_label = f"{str(sess.start_time)[:5]}–{str(sess.end_time)[:5]}"
            if not slots:
                rows.append([subj_name, "—", "—", time_label])
            else:
                for i, sl in enumerate(slots):
                    t = teach_map.get(sl.teacher_id)
                    r = room_map.get(sl.room_id) if sl.room_id else None
                    t_name = f"{t.title} {t.first_name[0]}. {t.last_name}".strip() if t else "—"
                    r_name = r.name if r else "—"
                    rows.append([
                        subj_name if i == 0 else "",
                        r_name,
                        t_name,
                        time_label if i == 0 else "",
                    ])

        col_w = [55*mm, 40*mm, 60*mm, 30*mm]
        tbl = Table(rows, colWidths=col_w, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0),  colors.HexColor("#4f46e5")),
            ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, -1), 9),
            ("ALIGN",       (0, 0), (-1, -1), "LEFT"),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("ROWPADDING",  (0, 0), (-1, -1), 5),
            ("GRID",        (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.extend([Spacer(1, 4*mm), tbl, Spacer(1, 12*mm)])
        story.append(Paragraph(
            f"Signature: _________________ &nbsp;&nbsp; (Principal) &nbsp;&nbsp;&nbsp;&nbsp;"
            f"Generated: {_dt.datetime.utcnow().strftime('%d %b %Y %H:%M')} UTC",
            styles["Normal"]
        ))

    doc.build(story)
    buf.seek(0)
    fname = f"exam_duties_{date}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})
