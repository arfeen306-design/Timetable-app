"""Timetable history / audit log model."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from backend.models.base import Base


class TimetableHistory(Base):
    __tablename__ = "timetable_history"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    project_id   = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    action       = Column(String(50), nullable=False)       # "generated", "amended", "uploaded", "demo_loaded"
    description  = Column(String(500), default="")
    created_by   = Column(String(255), default="")
    created_at   = Column(DateTime(timezone=True), default=datetime.utcnow)
    clash_count  = Column(Integer, default=0)
    teacher_count = Column(Integer, default=0)
    class_count  = Column(Integer, default=0)
    is_current   = Column(Boolean, default=False)
