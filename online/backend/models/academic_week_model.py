"""AcademicWeek model — maps calendar dates to school week numbers."""
from __future__ import annotations
from sqlalchemy import Column, Integer, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.models.base import Base


class AcademicWeek(Base):
    __tablename__ = "academic_weeks"
    __table_args__ = (
        UniqueConstraint("project_id", "week_number", "academic_year", name="uq_project_week"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    week_number = Column(Integer, nullable=False, index=True)   # 1, 2, 3 … ~40
    start_date = Column(Date, nullable=False)                    # Monday of this week
    end_date = Column(Date, nullable=False)                      # Friday/Saturday of this week
    academic_year = Column(String(20), nullable=False, default="2025-26")  # e.g. "2025-26"

    project = relationship("Project")
