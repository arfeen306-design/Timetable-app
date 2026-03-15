"""Substitution and TeacherAbsence models for substitute teacher management."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class TeacherAbsence(Base):
    __tablename__ = "teacher_absences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    reason = Column(String(500), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    teacher = relationship("Teacher")


class Substitution(Base):
    __tablename__ = "substitutions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    day_index = Column(Integer, nullable=False)  # 0=Mon .. 6=Sun
    period_index = Column(Integer, nullable=False)
    absent_teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    sub_teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    absent_teacher = relationship("Teacher", foreign_keys=[absent_teacher_id])
    sub_teacher = relationship("Teacher", foreign_keys=[sub_teacher_id])
    lesson = relationship("Lesson")
    room = relationship("Room")
