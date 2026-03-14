"""Teacher and TeacherSubject models."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False, default="")
    code = Column(String(50), nullable=False, default="")
    title = Column(String(20), nullable=False, default="Mr.")
    color = Column(String(20), nullable=False, default="#E8725A")
    max_periods_day = Column(Integer, nullable=False, default=6)
    max_periods_week = Column(Integer, nullable=False, default=30)
    email = Column(String(255), nullable=False, default="")
    whatsapp_number = Column(String(50), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="teachers")
    teacher_subjects = relationship("TeacherSubject", back_populates="teacher", cascade="all, delete-orphan")


class TeacherSubject(Base):
    __tablename__ = "teacher_subjects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    teacher = relationship("Teacher", back_populates="teacher_subjects")
    subject = relationship("Subject", back_populates="teacher_subjects")
