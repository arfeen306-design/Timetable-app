"""PublishedSnapshot — versioned archive of module data (exam duties, rosters, committees)."""
from __future__ import annotations
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class PublishedSnapshot(Base):
    """Point-in-time snapshot of a module's data, saved when user clicks 'Publish'.

    module_type: 'exam_duties' | 'duty_roster' | 'committees'
    snapshot_json: full JSON dump of the module data at publish time
    title: user-friendly label (e.g. "Exam Duties — March 2026")
    """
    __tablename__ = "published_snapshots"
    __table_args__ = (
        Index("ix_snapshots_project_module", "project_id", "module_type"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    project_id   = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    module_type  = Column(String(50), nullable=False)   # exam_duties | duty_roster | committees
    title        = Column(String(255), nullable=False)
    snapshot_json = Column(Text, nullable=False)         # full JSON of the data
    published_by = Column(String(255), nullable=True)    # user name/email
    published_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    created_at   = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    project = relationship("Project")
