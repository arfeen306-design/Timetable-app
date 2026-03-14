"""Lesson and LessonAllowedRoom models."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Integer, ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, nullable=True)  # optional; class_groups table can be added later
    periods_per_week = Column(Integer, nullable=False, default=1)
    duration = Column(Integer, nullable=False, default=1)
    priority = Column(Integer, nullable=False, default=5)
    locked = Column(Boolean, nullable=False, default=False)
    preferred_room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="lessons")
    allowed_rooms = relationship("LessonAllowedRoom", back_populates="lesson", cascade="all, delete-orphan")


class LessonAllowedRoom(Base):
    __tablename__ = "lesson_allowed_rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    lesson = relationship("Lesson", back_populates="allowed_rooms")
    room = relationship("Room")
