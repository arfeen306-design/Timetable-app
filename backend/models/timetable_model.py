"""TimetableRun and TimetableEntry — generation runs and scheduled entries."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Index, UniqueConstraint
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
    __table_args__ = (
        # Slot-uniqueness per resource. Catches *start-slot* collisions; multi-period
        # overlaps on trailing periods are still defended by the solver
        # (NoOverlap intervals) and the move validator. teacher_id and class_id
        # are denormalised from Lesson by the writer (save_entries) so the DB
        # can enforce these unique constraints without joining at insert time.
        UniqueConstraint(
            "project_id", "run_id", "day_index", "period_index", "teacher_id",
            name="ux_timetable_entries_teacher_slot",
        ),
        UniqueConstraint(
            "project_id", "run_id", "day_index", "period_index", "class_id",
            name="ux_timetable_entries_class_slot",
        ),
        UniqueConstraint(
            "project_id", "run_id", "day_index", "period_index", "room_id",
            name="ux_timetable_entries_room_slot",
        ),
        Index("ix_timetable_entries_lesson", "lesson_id"),
        Index("ix_timetable_entries_room", "room_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(Integer, ForeignKey("timetable_runs.id", ondelete="SET NULL"), nullable=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    day_index = Column(Integer, nullable=False)
    period_index = Column(Integer, nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    locked = Column(Boolean, nullable=False, default=False)
    # Denormalised from Lesson — populated by save_entries(). Required for the
    # slot-uniqueness constraints above.
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    class_id = Column(Integer, ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    project = relationship("Project", back_populates="timetable_entries")
    run = relationship("TimetableRun", back_populates="entries")
    lesson = relationship("Lesson")
    room = relationship("Room")
