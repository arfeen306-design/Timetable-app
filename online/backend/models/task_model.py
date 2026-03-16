"""Task model — to-do items for the dashboard."""
from __future__ import annotations
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from backend.models.base import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    due_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    priority = Column(String(10), nullable=False, default="medium")  # high, medium, low
    completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), nullable=False, unique=True, index=True)
    filename = Column(String(500), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
