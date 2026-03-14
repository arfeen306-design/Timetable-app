"""TimeConstraint model — teacher/class/room unavailability."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class TimeConstraint(Base):
    __tablename__ = "time_constraints"

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
