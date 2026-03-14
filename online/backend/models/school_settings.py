"""School settings — one row per project (days, periods, bell schedule, breaks)."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class SchoolSettings(Base):
    __tablename__ = "school_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False, default="")
    campus_name = Column(String(255), nullable=False, default="")
    academic_year = Column(String(50), nullable=False, default="")
    days_per_week = Column(Integer, nullable=False, default=5)
    periods_per_day = Column(Integer, nullable=False, default=7)
    period_duration_minutes = Column(Integer, nullable=False, default=45)
    assembly_duration_minutes = Column(Integer, nullable=False, default=0)
    weekend_days = Column(String(50), nullable=False, default="5,6")
    working_days = Column(String(50), nullable=False, default="1,2,3,4,5")  # 0=Sun, 1=Mon, ...
    school_start_time = Column(String(10), nullable=False, default="08:00")
    school_end_time = Column(String(10), nullable=False, default="15:00")
    friday_start_time = Column(String(10), nullable=True)
    friday_end_time = Column(String(10), nullable=True)
    saturday_start_time = Column(String(10), nullable=True)
    saturday_end_time = Column(String(10), nullable=True)
    bell_schedule_json = Column(Text, nullable=False, default="[]")
    breaks_json = Column(Text, nullable=False, default="[]")  # [{name, after_period, duration_minutes, days[], friday_override}]
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="school_settings", uselist=False)
