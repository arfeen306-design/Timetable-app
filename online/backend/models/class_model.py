"""SchoolClass model — project-scoped; class_teacher_id and home_room_id as plain Integer to avoid circular FKs."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class SchoolClass(Base):
    __tablename__ = "school_classes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    grade = Column(String(50), nullable=False)
    section = Column(String(50), nullable=False, default="")
    stream = Column(String(50), nullable=False, default="")
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, default="")
    color = Column(String(20), nullable=False, default="#50C878")
    class_teacher_id = Column(Integer, nullable=True)  # no FK to avoid circular dep with Teacher
    home_room_id = Column(Integer, nullable=True)     # no FK to avoid circular dep with Room
    strength = Column(Integer, nullable=False, default=30)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="school_classes")
