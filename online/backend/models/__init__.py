"""SQLAlchemy models."""
from backend.models.base import Base, get_db, init_db
from backend.models.user import User
from backend.models.school import School, SchoolMembership
from backend.models.project import Project, Subject
from backend.models.school_settings import SchoolSettings
from backend.models.class_model import SchoolClass
from backend.models.teacher_model import Teacher, TeacherSubject
from backend.models.room_model import Room
from backend.models.lesson_model import Lesson, LessonAllowedRoom
from backend.models.constraint_model import TimeConstraint
from backend.models.timetable_model import TimetableRun, TimetableEntry
from backend.models.academic_year_model import AcademicYear
from backend.models.academic_week_model import AcademicWeek
from backend.models.substitution_model import TeacherAbsence, Substitution, TeacherWeekSub

__all__ = [
    "Base", "get_db", "init_db",
    "User", "School", "SchoolMembership",
    "Project", "Subject", "SchoolSettings",
    "SchoolClass", "Teacher", "TeacherSubject",
    "Room", "Lesson", "LessonAllowedRoom",
    "TimeConstraint", "TimetableRun", "TimetableEntry",
    "AcademicYear", "AcademicWeek",
    "TeacherAbsence", "Substitution", "TeacherWeekSub",
]
