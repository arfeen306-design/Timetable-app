"""DutyRoster, Committee, and CommitteeMember models."""
from __future__ import annotations
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey,
    UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class DutyRoster(Base):
    """One teacher ↔ one duty slot (day + period). Unique per slot enforced in service layer."""
    __tablename__ = "duty_roster"
    __table_args__ = (
        Index("ix_duty_roster_project_id", "project_id"),
        Index("ix_duty_roster_teacher_id", "teacher_id"),
        Index("ix_duty_roster_project_row", "project_id", "row_id"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    project_id   = Column(Integer, ForeignKey("projects.id",  ondelete="CASCADE"), nullable=False)
    teacher_id   = Column(Integer, ForeignKey("teachers.id",  ondelete="CASCADE"), nullable=False)
    duty_type    = Column(String(50),  nullable=False)          # "gate" | "hall" | "lunch" | …
    day_of_week  = Column(Integer,     nullable=False)          # 0 = Mon … 6 = Sun
    period_index = Column(Integer,     nullable=False)
    notes        = Column(String(500), nullable=True)
    row_id       = Column(Integer, ForeignKey("duty_roster_rows.id", ondelete="SET NULL"), nullable=True)
    column_index = Column(Integer, nullable=True, default=0)
    created_at   = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at   = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow,
                          onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="duty_roster_entries")
    teacher = relationship("Teacher")


class Committee(Base):
    __tablename__ = "committees"
    __table_args__ = (
        Index("ix_committees_project_id", "project_id"),
    )

    id          = Column(Integer, primary_key=True, autoincrement=True)
    project_id  = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    created_at  = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    project = relationship("Project", back_populates="committees")
    members = relationship("CommitteeMember", back_populates="committee",
                           cascade="all, delete-orphan")


class CommitteeMember(Base):
    __tablename__ = "committee_members"
    __table_args__ = (
        UniqueConstraint("committee_id", "teacher_id", name="uq_committee_teacher"),
        Index("ix_committee_members_committee_id", "committee_id"),
        Index("ix_committee_members_teacher_id",   "teacher_id"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    committee_id = Column(Integer, ForeignKey("committees.id", ondelete="CASCADE"), nullable=False)
    teacher_id   = Column(Integer, ForeignKey("teachers.id",  ondelete="CASCADE"), nullable=False)
    role         = Column(String(50), nullable=False, default="member")  # "chair" | "member"
    created_at   = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    committee = relationship("Committee", back_populates="members")
    teacher   = relationship("Teacher")
