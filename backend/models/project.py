"""Project model — belongs to a school, holds timetable project metadata."""
from __future__ import annotations
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, default="")
    academic_year = Column(String(50), nullable=False, default="")
    archived = Column(Boolean, nullable=False, default=False)
    last_generated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    school = relationship("School", back_populates="projects")
    school_settings = relationship("SchoolSettings", back_populates="project", uselist=False, cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="project", cascade="all, delete-orphan")
    school_classes = relationship("SchoolClass", back_populates="project", cascade="all, delete-orphan")
    teachers = relationship("Teacher", back_populates="project", cascade="all, delete-orphan")
    rooms = relationship("Room", back_populates="project", cascade="all, delete-orphan")
    lessons = relationship("Lesson", back_populates="project", cascade="all, delete-orphan")
    time_constraints = relationship("TimeConstraint", back_populates="project", cascade="all, delete-orphan")
    timetable_runs = relationship("TimetableRun", back_populates="project", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="project", cascade="all, delete-orphan")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, default="")
    color = Column(String(20), nullable=False, default="#4A90D9")
    category = Column(String(50), nullable=False, default="Core")
    max_per_day = Column(Integer, nullable=False, default=2)
    double_allowed = Column(Boolean, nullable=False, default=False)
    preferred_room_type = Column(String(50), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="subjects")
    teacher_subjects = relationship("TeacherSubject", back_populates="subject", cascade="all, delete-orphan")
