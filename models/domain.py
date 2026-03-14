"""Domain model dataclasses for the timetable system."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class School:
    id: Optional[int] = None
    name: str = ""
    academic_year: str = ""
    days_per_week: int = 5
    periods_per_day: int = 7
    weekend_days: str = "5,6"  # comma-separated day indices (0=Mon)
    bell_schedule_json: str = "[]"

    @property
    def working_days(self) -> list[int]:
        weekend = set(int(d.strip()) for d in self.weekend_days.split(",") if d.strip())
        return [d for d in range(7) if d not in weekend][:self.days_per_week]

    @property
    def total_slots(self) -> int:
        return self.days_per_week * self.periods_per_day


@dataclass
class Subject:
    id: Optional[int] = None
    name: str = ""
    code: str = ""
    color: str = "#4A90D9"
    category: str = "Core"
    max_per_day: int = 2
    double_allowed: bool = False
    preferred_room_type: str = ""


@dataclass
class SchoolClass:
    id: Optional[int] = None
    grade: str = ""
    section: str = ""
    stream: str = ""
    name: str = ""
    code: str = ""
    color: str = "#50C878"
    class_teacher_id: Optional[int] = None
    home_room_id: Optional[int] = None
    strength: int = 30


@dataclass
class ClassGroupDivision:
    id: Optional[int] = None
    class_id: Optional[int] = None
    name: str = ""


@dataclass
class ClassGroup:
    id: Optional[int] = None
    division_id: Optional[int] = None
    name: str = ""
    code: str = ""


@dataclass
class Teacher:
    id: Optional[int] = None
    first_name: str = ""
    last_name: str = ""
    code: str = ""
    title: str = "Mr."
    color: str = "#E8725A"
    max_periods_day: int = 6
    max_periods_week: int = 30
    email: str = ""
    whatsapp_number: str = ""

    @property
    def full_name(self) -> str:
        return f"{self.title} {self.first_name} {self.last_name}".strip()

    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


@dataclass
class TeacherSubject:
    id: Optional[int] = None
    teacher_id: Optional[int] = None
    subject_id: Optional[int] = None


@dataclass
class Room:
    id: Optional[int] = None
    name: str = ""
    code: str = ""
    room_type: str = "Classroom"
    capacity: int = 40
    color: str = "#9B59B6"
    home_class_id: Optional[int] = None


@dataclass
class Lesson:
    id: Optional[int] = None
    teacher_id: Optional[int] = None
    subject_id: Optional[int] = None
    class_id: Optional[int] = None
    group_id: Optional[int] = None
    periods_per_week: int = 1
    duration: int = 1
    priority: int = 5
    locked: bool = False
    preferred_room_id: Optional[int] = None
    notes: str = ""

    # Transient display fields (not stored)
    teacher_name: str = field(default="", repr=False)
    subject_name: str = field(default="", repr=False)
    class_name: str = field(default="", repr=False)


@dataclass
class LessonAllowedRoom:
    id: Optional[int] = None
    lesson_id: Optional[int] = None
    room_id: Optional[int] = None


@dataclass
class TimeConstraint:
    id: Optional[int] = None
    entity_type: str = ""  # "teacher", "class", "room"
    entity_id: Optional[int] = None
    day_index: int = 0
    period_index: int = 0
    constraint_type: str = "unavailable"  # "unavailable", "preferred", "avoid"
    weight: int = 10
    is_hard: bool = True


@dataclass
class TimetableEntry:
    id: Optional[int] = None
    lesson_id: Optional[int] = None
    day_index: int = 0
    period_index: int = 0
    room_id: Optional[int] = None
    locked: bool = False

    # Transient display fields
    teacher_name: str = field(default="", repr=False)
    subject_name: str = field(default="", repr=False)
    subject_code: str = field(default="", repr=False)
    subject_color: str = field(default="", repr=False)
    class_name: str = field(default="", repr=False)
    room_name: str = field(default="", repr=False)
    teacher_id: Optional[int] = field(default=None, repr=False)
    subject_id: Optional[int] = field(default=None, repr=False)
    class_id: Optional[int] = field(default=None, repr=False)
