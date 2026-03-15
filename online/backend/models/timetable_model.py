"""TimetableRun and TimetableEntry — generation runs and scheduled entries."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class TimetableRun(Base):
    __tablename__ = "timetable_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="completed")  # running | completed | failed
    started_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)
    entries_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    project = relationship("Project", back_populates="timetable_runs")
    entries = relationship("TimetableEntry", back_populates="run", cascade="all, delete-orphan")


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(Integer, ForeignKey("timetable_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    day_index = Column(Integer, nullable=False)
    period_index = Column(Integer, nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    locked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    project = relationship("Project", back_populates="timetable_entries")
    run = relationship("TimetableRun", back_populates="entries")
    lesson = relationship("Lesson")
    room = relationship("Room")
