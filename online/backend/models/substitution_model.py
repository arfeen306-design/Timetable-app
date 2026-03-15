"""Substitution, TeacherAbsence, and TeacherWeekSub models."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class TeacherAbsence(Base):
    __tablename__ = "teacher_absences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    week_number = Column(Integer, nullable=True, index=True)
    academic_week_id = Column(Integer, ForeignKey("academic_weeks.id", ondelete="SET NULL"), nullable=True)
    reason = Column(String(500), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    teacher = relationship("Teacher")


class Substitution(Base):
    __tablename__ = "substitutions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    week_number = Column(Integer, nullable=True, index=True)
    academic_week_id = Column(Integer, ForeignKey("academic_weeks.id", ondelete="SET NULL"), nullable=True)
    day_index = Column(Integer, nullable=False)
    period_index = Column(Integer, nullable=False)
    absent_teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    sub_teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    is_override = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    absent_teacher = relationship("Teacher", foreign_keys=[absent_teacher_id])
    sub_teacher = relationship("Teacher", foreign_keys=[sub_teacher_id])
    lesson = relationship("Lesson")
    room = relationship("Room")


class TeacherWeekSub(Base):
    """Tracks substitution count per teacher per week. Max 2 normal subs."""
    __tablename__ = "teacher_week_subs"
    __table_args__ = (
        UniqueConstraint("teacher_id", "academic_week_id", name="uq_teacher_week"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_week_id = Column(Integer, ForeignKey("academic_weeks.id", ondelete="CASCADE"), nullable=False, index=True)
    sub_count = Column(Integer, nullable=False, default=0)       # normal assignments (max 2)
    override_count = Column(Integer, nullable=False, default=0)  # forced past limit

    teacher = relationship("Teacher")
    academic_week = relationship("AcademicWeek")
