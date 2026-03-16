"""DutyArea and DutyRosterRow models for the enhanced duty roster."""
from __future__ import annotations
import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Date, UniqueConstraint, Index
from backend.models.base import Base


class DutyArea(Base):
    """A named duty location (Gate, Canteen, Library…) — forms a grid column."""
    __tablename__ = "duty_areas"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_duty_area_project_name"),
        Index("ix_duty_areas_project_id", "project_id"),
    )

    id         = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(100), nullable=False)
    color      = Column(String(7), default="#4F46E5")
    position   = Column(Integer, default=0)


class DutyRosterRow(Base):
    """A date-range row in the duty roster (replaces fixed P1/P2 labels)."""
    __tablename__ = "duty_roster_rows"
    __table_args__ = (
        Index("ix_duty_roster_rows_project_id", "project_id"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    project_id   = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    row_order    = Column(Integer, nullable=False, default=0)
    label        = Column(String(50), nullable=True, default="")
    date_start   = Column(Date, nullable=True)
    date_end     = Column(Date, nullable=True)
