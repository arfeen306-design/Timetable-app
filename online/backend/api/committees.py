"""Committees API — CRUD for school committees and their members."""
from __future__ import annotations
import io
import datetime as _dt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.models.duty_roster_model import Committee, CommitteeMember
from backend.models.teacher_model import Teacher

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CommitteeCreate(BaseModel):
    name:        str
    description: Optional[str] = None


class CommitteeUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None


class MemberOut(BaseModel):
    id:         int
    teacher_id: int
    role:       str

    class Config:
        from_attributes = True


class CommitteeResponse(BaseModel):
    id:          int
    project_id:  int
    name:        str
    description: Optional[str]
    members:     List[MemberOut] = []

    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    teacher_id: int
    role:       str = "member"   # "chair" | "member"


class UpdateMemberRequest(BaseModel):
    role: str


# ── Committee CRUD ────────────────────────────────────────────────────────────

@router.get("", response_model=List[CommitteeResponse])
def list_committees(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    return (
        db.query(Committee)
        .filter(Committee.project_id == project.id)
        .order_by(Committee.name)
        .all()
    )


@router.post("", response_model=CommitteeResponse)
def create_committee(
    data: CommitteeCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = Committee(
        project_id=project.id,
        name=data.name.strip(),
        description=data.description,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/export-pdf")
def export_committees_pdf(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer
    from utils.pdf_engine import PDFEngine

    engine = PDFEngine(db, project)

    committees = (
        db.query(Committee)
        .filter(Committee.project_id == project.id)
        .order_by(Committee.name)
        .all()
    )
    teach_map = {t.id: t for t in db.query(Teacher).filter(Teacher.project_id == project.id).all()}

    story = engine.header("School Committees")

    if not committees:
        story.append(Paragraph("No committees found.", engine.body_style))
    else:
        for committee in committees:
            story.append(Paragraph(committee.name, engine.section_style))
            if committee.description:
                story.append(Paragraph(committee.description, engine.body_style))
                story.append(Spacer(1, 2 * mm))

            if not committee.members:
                story.append(Paragraph("No members assigned.", engine.body_style))
                story.append(Spacer(1, 3 * mm))
                continue

            table_data = [["#", "Teacher", "Role"]]
            for i, member in enumerate(committee.members, 1):
                t = teach_map.get(member.teacher_id)
                tname = f"{t.first_name} {t.last_name}".strip() if t else f"Teacher #{member.teacher_id}"
                table_data.append([str(i), tname, member.role or "Member"])

            col_w = [12 * mm, 110 * mm, 50 * mm]
            tbl = engine.table(table_data, col_w)
            story.append(tbl)
            story.append(Spacer(1, 4 * mm))

    story += engine.signature_block()
    story += engine.footer()

    fname = f"committees_{project.name.replace(' ', '_')}.pdf"
    return engine.build(story, filename=fname)


@router.get("/{committee_id}", response_model=CommitteeResponse)
def get_committee(
    committee_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = (
        db.query(Committee)
        .filter(Committee.id == committee_id, Committee.project_id == project.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Committee not found")
    return c


@router.patch("/{committee_id}", response_model=CommitteeResponse)
def update_committee(
    committee_id: int,
    data: CommitteeUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = (
        db.query(Committee)
        .filter(Committee.id == committee_id, Committee.project_id == project.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Committee not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(c, key, val)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{committee_id}", status_code=204)
def delete_committee(
    committee_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = (
        db.query(Committee)
        .filter(Committee.id == committee_id, Committee.project_id == project.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Committee not found")
    db.delete(c)
    db.commit()


# ── Member sub-routes ─────────────────────────────────────────────────────────

@router.post("/{committee_id}/members", response_model=MemberOut, status_code=201)
def add_member(
    committee_id: int,
    data: AddMemberRequest,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    # Verify committee belongs to this project
    c = (
        db.query(Committee)
        .filter(Committee.id == committee_id, Committee.project_id == project.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Committee not found")

    # Enforce uniqueness (DB also has UNIQUE constraint as a safety net)
    existing = (
        db.query(CommitteeMember)
        .filter(
            CommitteeMember.committee_id == committee_id,
            CommitteeMember.teacher_id   == data.teacher_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Teacher is already a member of this committee")

    m = CommitteeMember(
        committee_id=committee_id,
        teacher_id=data.teacher_id,
        role=data.role,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.patch("/{committee_id}/members/{member_id}", response_model=MemberOut)
def update_member_role(
    committee_id: int,
    member_id: int,
    data: UpdateMemberRequest,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    # Verify committee is in this project
    c = (
        db.query(Committee)
        .filter(Committee.id == committee_id, Committee.project_id == project.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Committee not found")

    m = (
        db.query(CommitteeMember)
        .filter(CommitteeMember.id == member_id, CommitteeMember.committee_id == committee_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")

    m.role = data.role
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{committee_id}/members/{member_id}", status_code=204)
def remove_member(
    committee_id: int,
    member_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = (
        db.query(Committee)
        .filter(Committee.id == committee_id, Committee.project_id == project.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Committee not found")

    m = (
        db.query(CommitteeMember)
        .filter(CommitteeMember.id == member_id, CommitteeMember.committee_id == committee_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(m)
    db.commit()
