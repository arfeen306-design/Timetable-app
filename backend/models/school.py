"""School and membership models for multi-tenant scoping."""
from __future__ import annotations
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, default="")
    slug = Column(String(100), unique=True, nullable=False, index=True)
    api_key = Column(String(100), unique=True, nullable=True, index=True)
    settings_json = Column(String(2048), nullable=False, default="{}")  # simple JSON string for Phase 1
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = relationship("SchoolMembership", back_populates="school", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="school", cascade="all, delete-orphan")


class SchoolMembership(Base):
    __tablename__ = "school_memberships"
    __table_args__ = (UniqueConstraint("school_id", "user_id", name="uq_school_memberships_school_user"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False, default="admin")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    school = relationship("School", back_populates="memberships")
    user = relationship("User", back_populates="memberships")
