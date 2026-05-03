"""TimeConstraint model — teacher/class/room unavailability."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class TimeConstraint(Base):
    __tablename__ = "time_constraints"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "entity_type", "entity_id", "day_index", "period_index",
            name="ux_time_constraints",
        ),
        # Hot path: solver and move validator both group by (entity_type, entity_id).
        Index("ix_time_constraints_entity", "entity_type", "entity_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)  # teacher, class, room
    entity_id = Column(Integer, nullable=False)
    day_index = Column(Integer, nullable=False)
    period_index = Column(Integer, nullable=False)
    constraint_type = Column(String(50), nullable=False, default="unavailable")
    weight = Column(Integer, nullable=False, default=10)
    is_hard = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="time_constraints")
