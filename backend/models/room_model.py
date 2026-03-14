"""Room model — project-scoped; home_class_id as plain Integer to avoid circular FK."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, default="")
    room_type = Column(String(50), nullable=False, default="Classroom")
    capacity = Column(Integer, nullable=False, default=40)
    color = Column(String(20), nullable=False, default="#9B59B6")
    home_class_id = Column(Integer, nullable=True)  # no FK to avoid circular dep with SchoolClass
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="rooms")
