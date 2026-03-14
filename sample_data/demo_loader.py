"""Load realistic demo school data into the database."""
from __future__ import annotations
from typing import TYPE_CHECKING

from models.domain import School, Subject, SchoolClass, Teacher, Room, Lesson
from services.school_service import SchoolService
from services.subject_service import SubjectService
from services.class_service import ClassService
from services.teacher_service import TeacherService
from services.room_service import RoomService
from services.lesson_service import LessonService

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


def load_demo_data(db: DatabaseConnection) -> None:
    """Populate database with realistic school demo data."""
    school_svc = SchoolService(db)
    subject_svc = SubjectService(db)
    class_svc = ClassService(db)
    teacher_svc = TeacherService(db)
    room_svc = RoomService(db)
    lesson_svc = LessonService(db)

    # --- School ---
    school = School(
        name="Islamabad Model School",
        academic_year="2025-2026",
        days_per_week=5,
        periods_per_day=7,
        weekend_days="5,6",
    )
    school_svc.save_school(school)

    # --- Subjects ---
    subjects_data = [
        ("Mathematics", "MAT", "#E74C3C", "Core", 2, False, ""),
        ("Physics", "PHY", "#3498DB", "Core", 2, True, "Laboratory"),
        ("Chemistry", "CHM", "#2ECC71", "Core", 2, True, "Laboratory"),
        ("Biology", "BIO", "#27AE60", "Core", 2, True, "Laboratory"),
        ("Computer Science", "CS", "#9B59B6", "Core", 2, True, "Computer Lab"),
        ("English", "ENG", "#F39C12", "Core", 2, False, ""),
        ("Urdu", "URD", "#E67E22", "Core", 2, False, ""),
        ("Islamiat", "ISL", "#1ABC9C", "Core", 1, False, ""),
        ("Pakistan Studies", "PST", "#16A085", "Core", 1, False, ""),
        ("Business Studies", "BUS", "#D35400", "Elective", 2, False, ""),
        ("Physical Education", "PE", "#7F8C8D", "Activity", 1, False, "Sports Hall"),
    ]

    subject_map = {}
    for name, code, color, cat, mpd, double, pref_room in subjects_data:
        s = Subject(
            name=name, code=code, color=color, category=cat,
            max_per_day=mpd, double_allowed=double, preferred_room_type=pref_room,
        )
        s = subject_svc.create(s)
        subject_map[code] = s.id

    # --- Teachers ---
    teachers_data = [
        ("Mr.", "Zain", "Ahmed", "ZAI", "#E74C3C", 6, 28),
        ("Ms.", "Ayesha", "Khan", "AKH", "#3498DB", 6, 28),
        ("Mr.", "Bilal", "Hassan", "BHA", "#2ECC71", 6, 25),
        ("Ms.", "Fatima", "Ali", "FAL", "#9B59B6", 6, 28),
        ("Mr.", "Omar", "Sheikh", "OSH", "#F39C12", 6, 28),
        ("Ms.", "Sara", "Malik", "SMA", "#E67E22", 6, 25),
        ("Mr.", "Usman", "Raza", "URA", "#1ABC9C", 5, 22),
        ("Ms.", "Hira", "Nawaz", "HNA", "#16A085", 5, 22),
        ("Mr.", "Kamran", "Iqbal", "KIQ", "#D35400", 6, 28),
        ("Ms.", "Nadia", "Butt", "NBU", "#7F8C8D", 5, 20),
        ("Mr.", "Tariq", "Mehmood", "TME", "#C0392B", 6, 25),
        ("Ms.", "Zara", "Siddiqui", "ZSI", "#8E44AD", 6, 28),
    ]

    teacher_map = {}
    for title, first, last, code, color, mpd, mpw in teachers_data:
        t = Teacher(
            title=title, first_name=first, last_name=last,
            code=code, color=color, max_periods_day=mpd, max_periods_week=mpw,
        )
        t = teacher_svc.create(t)
        teacher_map[code] = t.id

    # --- Rooms ---
    rooms_data = [
        ("Room 101", "R101", "Classroom", 40, "#3498DB"),
        ("Room 102", "R102", "Classroom", 40, "#2ECC71"),
        ("Room 103", "R103", "Classroom", 35, "#E74C3C"),
        ("Room 104", "R104", "Classroom", 35, "#F39C12"),
        ("Room 105", "R105", "Classroom", 40, "#9B59B6"),
        ("Room 201", "R201", "Classroom", 40, "#1ABC9C"),
        ("Room 202", "R202", "Classroom", 35, "#E67E22"),
        ("Physics Lab", "PLAB", "Laboratory", 30, "#3498DB"),
        ("Chemistry Lab", "CLAB", "Laboratory", 30, "#2ECC71"),
        ("Biology Lab", "BLAB", "Laboratory", 30, "#27AE60"),
        ("Computer Lab", "COMP", "Computer Lab", 35, "#9B59B6"),
        ("Sports Hall", "SPRT", "Sports Hall", 100, "#7F8C8D"),
    ]

    room_map = {}
    for name, code, rtype, cap, color in rooms_data:
        r = Room(name=name, code=code, room_type=rtype, capacity=cap, color=color)
        r = room_svc.create(r)
        room_map[code] = r.id

    # --- Classes ---
    # Grade 9: Science, Computer Science, Biology
    # Grade 10: Science, Computer Science, Business
    # Grade 11: Science, Computer Science
    classes_data = [
        ("9", "Science", "Science", "Grade 9 Science", "9-SCI", "#E74C3C", 35),
        ("9", "Computer Science", "CS", "Grade 9 CS", "9-CS", "#9B59B6", 30),
        ("9", "Biology", "Bio", "Grade 9 Biology", "9-BIO", "#27AE60", 30),
        ("10", "Science", "Science", "Grade 10 Science", "10-SCI", "#3498DB", 35),
        ("10", "Computer Science", "CS", "Grade 10 CS", "10-CS", "#F39C12", 30),
        ("10", "Business", "Business", "Grade 10 Business", "10-BUS", "#D35400", 30),
        ("11", "Science", "Science", "Grade 11 Science", "11-SCI", "#2ECC71", 30),
        ("11", "Computer Science", "CS", "Grade 11 CS", "11-CS", "#1ABC9C", 28),
    ]

    class_map = {}
    for grade, section, stream, name, code, color, strength in classes_data:
        c = SchoolClass(
            grade=grade, section=section, stream=stream,
            name=name, code=code, color=color, strength=strength,
        )
        c = class_svc.create(c)
        class_map[code] = c.id

    # --- Lessons ---
    # Teacher Zain teaches Maths to: 9-SCI, 9-CS, 10-SCI, 10-BUS, 11-SCI
    # Teacher Kamran teaches Maths to: 9-BIO, 10-CS, 11-CS
    lessons_data = [
        # (teacher_code, subject_code, class_code, periods_per_week)

        # Mathematics - split between Zain and Kamran
        ("ZAI", "MAT", "9-SCI", 5),
        ("ZAI", "MAT", "9-CS", 4),
        ("ZAI", "MAT", "10-SCI", 5),
        ("ZAI", "MAT", "10-BUS", 4),
        ("ZAI", "MAT", "11-SCI", 5),
        ("KIQ", "MAT", "9-BIO", 5),
        ("KIQ", "MAT", "10-CS", 4),
        ("KIQ", "MAT", "11-CS", 5),

        # Physics - Bilal
        ("BHA", "PHY", "9-SCI", 3),
        ("BHA", "PHY", "10-SCI", 3),
        ("BHA", "PHY", "11-SCI", 4),
        ("BHA", "PHY", "9-CS", 2),
        ("BHA", "PHY", "10-CS", 2),

        # Chemistry - Ayesha
        ("AKH", "CHM", "9-SCI", 3),
        ("AKH", "CHM", "10-SCI", 3),
        ("AKH", "CHM", "11-SCI", 4),
        ("AKH", "CHM", "9-BIO", 3),
        ("AKH", "CHM", "10-CS", 2),

        # Biology - Fatima
        ("FAL", "BIO", "9-BIO", 4),
        ("FAL", "BIO", "9-SCI", 2),
        ("FAL", "BIO", "10-SCI", 2),
        ("FAL", "BIO", "11-SCI", 3),

        # Computer Science - Zara
        ("ZSI", "CS", "9-CS", 4),
        ("ZSI", "CS", "10-CS", 4),
        ("ZSI", "CS", "11-CS", 5),
        ("ZSI", "CS", "9-SCI", 1),

        # English - Omar
        ("OSH", "ENG", "9-SCI", 4),
        ("OSH", "ENG", "9-CS", 4),
        ("OSH", "ENG", "9-BIO", 4),
        ("OSH", "ENG", "10-SCI", 3),
        ("OSH", "ENG", "10-CS", 3),
        ("OSH", "ENG", "10-BUS", 3),

        # English continued - Tariq for Grade 11
        ("TME", "ENG", "11-SCI", 4),
        ("TME", "ENG", "11-CS", 4),

        # Urdu - Sara
        ("SMA", "URD", "9-SCI", 3),
        ("SMA", "URD", "9-CS", 3),
        ("SMA", "URD", "9-BIO", 3),
        ("SMA", "URD", "10-SCI", 3),
        ("SMA", "URD", "10-CS", 3),
        ("SMA", "URD", "10-BUS", 3),

        # Urdu - Hira for Grade 11
        ("HNA", "URD", "11-SCI", 3),
        ("HNA", "URD", "11-CS", 3),

        # Islamiat - Usman
        ("URA", "ISL", "9-SCI", 2),
        ("URA", "ISL", "9-CS", 2),
        ("URA", "ISL", "9-BIO", 2),
        ("URA", "ISL", "10-SCI", 2),
        ("URA", "ISL", "10-CS", 2),
        ("URA", "ISL", "10-BUS", 2),
        ("URA", "ISL", "11-SCI", 2),
        ("URA", "ISL", "11-CS", 2),

        # Pakistan Studies - Hira
        ("HNA", "PST", "9-SCI", 2),
        ("HNA", "PST", "9-CS", 2),
        ("HNA", "PST", "9-BIO", 2),
        ("HNA", "PST", "10-SCI", 2),
        ("HNA", "PST", "10-CS", 2),
        ("HNA", "PST", "10-BUS", 2),

        # Business Studies - Tariq
        ("TME", "BUS", "10-BUS", 4),

        # PE - Nadia
        ("NBU", "PE", "9-SCI", 2),
        ("NBU", "PE", "9-CS", 2),
        ("NBU", "PE", "9-BIO", 2),
        ("NBU", "PE", "10-SCI", 2),
        ("NBU", "PE", "10-CS", 2),
        ("NBU", "PE", "10-BUS", 2),
        ("NBU", "PE", "11-SCI", 1),
        ("NBU", "PE", "11-CS", 1),
    ]

    for t_code, s_code, c_code, ppw in lessons_data:
        lesson = Lesson(
            teacher_id=teacher_map[t_code],
            subject_id=subject_map[s_code],
            class_id=class_map[c_code],
            periods_per_week=ppw,
            duration=1,
            priority=5,
        )
        lesson_svc.create(lesson)
