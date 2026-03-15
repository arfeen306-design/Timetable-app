"""AcademicYear model — one-time setup per school year."""
from __future__ import annotations
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from backend.models.base import Base


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(30), nullable=False, default="2025-26")          # e.g. "2025-26"
    week_1_start_date = Column(Date, nullable=False)                       # Monday of week 1
    week_1_label = Column(String(100), nullable=True, default="Week 1")    # e.g. "Week 1 · Orientation"
    total_weeks = Column(Integer, nullable=False, default=40)
    is_active = Column(Boolean, nullable=False, default=True)

    project = relationship("Project")
    weeks = relationship("AcademicWeek", back_populates="academic_year_rel", cascade="all, delete-orphan")
