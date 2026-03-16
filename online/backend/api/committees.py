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
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        raise HTTPException(501, "reportlab not installed on server.")

    def _draw_branding(canvas, doc):
        canvas.saveState()
        page_w = doc.pagesize[0]
        cx, cy = page_w / 2 - 50, 22
        canvas.setFillColor(colors.HexColor("#131E2E"))
        canvas.circle(cx, cy, 8, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawCentredString(cx, cy - 3, "Z")
        canvas.setFillColor(colors.HexColor("#131E2E"))
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(cx + 12, cy - 4, "Myzynca")
        canvas.setFillColor(colors.HexColor("#3B82F6"))
        canvas.setFont("Helvetica", 8)
        canvas.drawString(cx + 62, cy - 4, "myzynca.com")
        canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, 38, page_w - doc.rightMargin, 38)
        canvas.restoreState()

    committees = (
        db.query(Committee)
        .filter(Committee.project_id == project.id)
        .order_by(Committee.name)
        .all()
    )
    teach_map = {t.id: t for t in db.query(Teacher).filter(Teacher.project_id == project.id).all()}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    INDIGO = colors.HexColor("#4F46E5")
    SLATE  = colors.HexColor("#0F172A")
    MUTED  = colors.HexColor("#475569")
    LIGHT  = colors.HexColor("#EEF2FF")

    title_s = ParagraphStyle("T", parent=styles["Normal"], fontSize=16, fontName="Helvetica-Bold",
                              textColor=SLATE, spaceAfter=2)
    sub_s   = ParagraphStyle("S", parent=styles["Normal"], fontSize=9, fontName="Helvetica",
                              textColor=MUTED, spaceAfter=8)
    comm_s  = ParagraphStyle("C", parent=styles["Normal"], fontSize=11, fontName="Helvetica-Bold",
                              textColor=SLATE, spaceBefore=8, spaceAfter=3)
    body_s  = ParagraphStyle("B", parent=styles["Normal"], fontSize=9, fontName="Helvetica",
                              textColor=SLATE, leading=13)

    story = [
        Paragraph(f"{project.name}", title_s),
        Paragraph(f"School Committees  ·  {_dt.date.today().strftime('%d %B %Y')}", sub_s),
    ]

    if not committees:
        story.append(Paragraph("No committees found.", body_s))
    else:
        for committee in committees:
            story.append(Paragraph(committee.name, comm_s))
            if committee.description:
                story.append(Paragraph(committee.description, body_s))
                story.append(Spacer(1, 2*mm))

            if not committee.members:
                story.append(Paragraph("No members assigned.", body_s))
                story.append(Spacer(1, 3*mm))
                continue

            table_data = [["#", "Teacher", "Role"]]
            for i, member in enumerate(committee.members, 1):
                t = teach_map.get(member.teacher_id)
                tname = f"{t.first_name} {t.last_name}".strip() if t else f"Teacher #{member.teacher_id}"
                table_data.append([str(i), tname, member.role or "Member"])

            col_w = [12*mm, 110*mm, 50*mm]
            tbl = Table(table_data, colWidths=col_w, repeatRows=1)
            tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,0), INDIGO),
                ("TEXTCOLOR",     (0,0),(-1,0), colors.white),
                ("FONTNAME",      (0,0),(-1,0), "Helvetica-Bold"),
                ("FONTSIZE",      (0,0),(-1,-1), 9),
                ("ALIGN",         (0,0),(0,-1),  "CENTER"),
                ("TOPPADDING",    (0,0),(-1,-1), 5),
                ("BOTTOMPADDING", (0,0),(-1,-1), 5),
                ("LEFTPADDING",   (0,0),(-1,-1), 8),
                ("BACKGROUND",    (0,1),(0,-1),  LIGHT),
                ("GRID",          (0,0),(-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                *[("BACKGROUND",  (0,r),(-1,r), colors.HexColor("#F8FAFC"))
                  for r in range(2, len(table_data), 2)],
            ]))
            story.append(tbl)
            story.append(Spacer(1, 4*mm))

    doc.build(story, onFirstPage=_draw_branding, onLaterPages=_draw_branding)
    buf.seek(0)
    fname = f"committees_{project.name.replace(' ','_')}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})


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
