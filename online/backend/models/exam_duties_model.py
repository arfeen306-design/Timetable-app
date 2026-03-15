"""Exam Duties models — ExamSession, ExamDutyConfig, ExamDutySlot."""
from __future__ import annotations
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Time, Text,
    ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class ExamSession(Base):
    """One paper = one exam session (subject + date + time window + rooms)."""
    __tablename__ = "exam_sessions"
    __table_args__ = (
        Index("ix_exam_sessions_project_id", "project_id"),
        Index("ix_exam_sessions_date",       "date"),
    )

    id         = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    date       = Column(Date,   nullable=False)
    start_time = Column(Time,   nullable=False)
    end_time   = Column(Time,   nullable=False)
    # Stored as JSON array of room IDs e.g. "[1, 2, 3]"
    room_ids_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    project    = relationship("Project",  back_populates="exam_sessions")
    subject    = relationship("Subject")
    duty_slots = relationship("ExamDutySlot", back_populates="session", cascade="all, delete-orphan")


class ExamDutyConfig(Base):
    """Per-project exam duty rules (one row per project)."""
    __tablename__ = "exam_duty_configs"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    project_id             = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_exam_rooms       = Column(Integer, nullable=False, default=10)
    duty_duration_minutes  = Column(Integer, nullable=False, default=90)
    invigilators_per_room  = Column(Integer, nullable=False, default=1)
    # JSON array of exempt teacher IDs e.g. "[3, 7]"
    exempt_teacher_ids_json = Column(Text, nullable=False, default="[]")
    created_at              = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at              = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="exam_duty_config", uselist=False)


class ExamDutySlot(Base):
    """One invigilator assignment: teacher → room for a specific exam session."""
    __tablename__ = "exam_duty_slots"
    __table_args__ = (
        UniqueConstraint("session_id", "teacher_id", "room_id", name="uq_exam_duty_slot"),
        Index("ix_exam_duty_slots_session_id", "session_id"),
        Index("ix_exam_duty_slots_teacher_id", "teacher_id"),
    )

    id          = Column(Integer, primary_key=True, autoincrement=True)
    session_id  = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False)
    teacher_id  = Column(Integer, ForeignKey("teachers.id",      ondelete="CASCADE"), nullable=False)
    room_id     = Column(Integer, ForeignKey("rooms.id",         ondelete="SET NULL"), nullable=True)
    duty_start  = Column(Time,    nullable=False)
    duty_end    = Column(Time,    nullable=False)
    is_override = Column(Boolean, nullable=False, default=False)
    created_at  = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    session = relationship("ExamSession", back_populates="duty_slots")
    teacher = relationship("Teacher")
    room    = relationship("Room")
