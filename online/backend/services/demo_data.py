"""Create a demo project with sample school, teachers, classes, subjects, rooms, and lessons."""
from __future__ import annotations
from sqlalchemy.orm import Session

from backend.models.project import Project, Subject
from backend.models.school_settings import SchoolSettings
from backend.models.teacher_model import Teacher
from backend.models.class_model import SchoolClass
from backend.models.room_model import Room
from backend.models.lesson_model import Lesson
from backend.models.timetable_history import TimetableHistory
from backend.repositories.school_settings_repo import get_or_create, update as update_settings


# ── Rich Pakistani O-Level dataset ─────────────────────────────────────────

DEMO_SUBJECTS_O_LEVEL = [
    "Mathematics",
    "English Language",
    "English Literature",
    "Physics",
    "Chemistry",
    "Biology",
    "Computer Science",
    "Pakistan Studies",
    "Islamiyat",
    "Urdu",
    "Economics",
    "Accounting",
    "Business Studies",
    "History",
    "Geography",
]

DEMO_CLASSES = [
    {"name": "Grade 9-A", "grade": "9", "section": "A"},
    {"name": "Grade 9-B", "grade": "9", "section": "B"},
    {"name": "Grade 9-C", "grade": "9", "section": "C"},
    {"name": "Grade 9-D", "grade": "9", "section": "D"},
    {"name": "Grade 10-A", "grade": "10", "section": "A"},
    {"name": "Grade 10-B", "grade": "10", "section": "B"},
    {"name": "Grade 10-C", "grade": "10", "section": "C"},
    {"name": "Grade 10-D", "grade": "10", "section": "D"},
    {"name": "Grade 11-A", "grade": "11", "section": "A"},
    {"name": "Grade 11-B", "grade": "11", "section": "B"},
    {"name": "Grade 11-C", "grade": "11", "section": "C"},
    {"name": "Grade 11-D", "grade": "11", "section": "D"},
]

DEMO_TEACHERS = [
    # Mathematics
    {"name": "Ahmed Ali",        "title": "Mr.",  "subject": "Mathematics"},
    {"name": "Bilal Hassan",     "title": "Mr.",  "subject": "Mathematics"},
    {"name": "Nadia Khan",       "title": "Ms.",  "subject": "Mathematics"},
    {"name": "Tariq Mahmood",    "title": "Mr.",  "subject": "Mathematics"},
    # Physics
    {"name": "Kamran Siddiqui",  "title": "Mr.",  "subject": "Physics"},
    {"name": "Sara Ahmed",       "title": "Ms.",  "subject": "Physics"},
    {"name": "Omar Farooq",      "title": "Mr.",  "subject": "Physics"},
    # Chemistry
    {"name": "Fatima Zahra",     "title": "Ms.",  "subject": "Chemistry"},
    {"name": "Hasan Raza",       "title": "Mr.",  "subject": "Chemistry"},
    {"name": "Zara Malik",       "title": "Ms.",  "subject": "Chemistry"},
    # Biology
    {"name": "Rania Sheikh",     "title": "Ms.",  "subject": "Biology"},
    {"name": "Imran Yusuf",      "title": "Mr.",  "subject": "Biology"},
    {"name": "Hina Baig",        "title": "Ms.",  "subject": "Biology"},
    # English Language
    {"name": "Maria Joseph",     "title": "Ms.",  "subject": "English Language"},
    {"name": "Daniel Qureshi",   "title": "Mr.",  "subject": "English Language"},
    {"name": "Ayesha Noor",      "title": "Ms.",  "subject": "English Language"},
    # English Literature
    {"name": "Sana Iqbal",       "title": "Ms.",  "subject": "English Literature"},
    {"name": "Faraz Hashmi",     "title": "Mr.",  "subject": "English Literature"},
    # Computer Science
    {"name": "Waqas Anwar",      "title": "Mr.",  "subject": "Computer Science"},
    {"name": "Amna Tauseef",     "title": "Ms.",  "subject": "Computer Science"},
    {"name": "Zain Mirza",       "title": "Mr.",  "subject": "Computer Science"},
    # Urdu
    {"name": "Khalid Mehmood",   "title": "Mr.",  "subject": "Urdu"},
    {"name": "Rukhsana Perveen", "title": "Ms.",  "subject": "Urdu"},
    {"name": "Javed Akhtar",     "title": "Mr.",  "subject": "Urdu"},
    # Pakistan Studies
    {"name": "Asim Nawaz",       "title": "Mr.",  "subject": "Pakistan Studies"},
    {"name": "Bushra Sadiq",     "title": "Ms.",  "subject": "Pakistan Studies"},
    # Islamiyat
    {"name": "Hafiz Usman",      "title": "Mr.",  "subject": "Islamiyat"},
    {"name": "Rabia Bibi",       "title": "Ms.",  "subject": "Islamiyat"},
    {"name": "Mufti Salman",     "title": "Mr.",  "subject": "Islamiyat"},
    # Economics
    {"name": "Samina Waheed",    "title": "Ms.",  "subject": "Economics"},
    {"name": "Aamir Liaqat",     "title": "Mr.",  "subject": "Economics"},
    {"name": "Noreen Arif",      "title": "Ms.",  "subject": "Economics"},
    # Accounting
    {"name": "Shahzad Hussain",  "title": "Mr.",  "subject": "Accounting"},
    {"name": "Maryam Tahir",     "title": "Ms.",  "subject": "Accounting"},
    # Business Studies
    {"name": "Faisal Cheema",    "title": "Mr.",  "subject": "Business Studies"},
    {"name": "Lubna Karim",      "title": "Ms.",  "subject": "Business Studies"},
    # History
    {"name": "Rehan Aziz",       "title": "Mr.",  "subject": "History"},
    {"name": "Naila Zafar",      "title": "Ms.",  "subject": "History"},
    # Geography
    {"name": "Salman Ghazi",     "title": "Mr.",  "subject": "Geography"},
    {"name": "Tayyaba Nisar",    "title": "Ms.",  "subject": "Geography"},
    # Additional staff
    {"name": "Rizwan Butt",      "title": "Mr.",  "subject": "Mathematics"},
    {"name": "Saba Rashid",      "title": "Ms.",  "subject": "Physics"},
    {"name": "Farhan Qazi",      "title": "Mr.",  "subject": "English Language"},
    {"name": "Ume Kulsoom",      "title": "Ms.",  "subject": "Biology"},
    {"name": "Adnan Saeed",      "title": "Mr.",  "subject": "Mathematics"},
    {"name": "Zahida Khatoon",   "title": "Ms.",  "subject": "Chemistry"},
    {"name": "Mohsin Ali",       "title": "Mr.",  "subject": "Physics"},
    {"name": "Farzana Begum",    "title": "Ms.",  "subject": "Biology"},
    {"name": "Usman Ghani",      "title": "Mr.",  "subject": "Computer Science"},
    {"name": "Nargis Sultana",   "title": "Ms.",  "subject": "English Language"},
]

DEMO_CLASSROOMS = [
    {"name": "Room 101", "capacity": 35},
    {"name": "Room 102", "capacity": 35},
    {"name": "Room 103", "capacity": 35},
    {"name": "Room 104", "capacity": 35},
    {"name": "Room 201", "capacity": 35},
    {"name": "Room 202", "capacity": 35},
    {"name": "Room 203", "capacity": 35},
    {"name": "Room 204", "capacity": 35},
    {"name": "Computer Lab 1", "capacity": 30},
    {"name": "Computer Lab 2", "capacity": 30},
    {"name": "Science Lab", "capacity": 28},
    {"name": "Library", "capacity": 40},
]

COLOR_PALETTE = [
    '#4F46E5', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#7C3AED',
    '#0F766E', '#B45309', '#9333EA', '#0369A1', '#15803D', '#C2410C',
    '#1D4ED8', '#047857', '#92400E', '#6D28D9', '#0E7490', '#065F46',
]


def _make_code(name: str, existing_codes: set) -> str:
    parts = name.split()
    base = ''.join(p[0] for p in parts if p).upper()[:3]
    code = base
    i = 2
    while code in existing_codes:
        code = f"{base}{i}"
        i += 1
    return code


def seed_demo_data(project_id: int, db: Session) -> dict:
    """Seed demo data into an EXISTING project. Returns summary counts."""
    existing_codes: set = set()

    # Subjects
    subject_map: dict[str, int] = {}
    for name in DEMO_SUBJECTS_O_LEVEL:
        code = name[:3].upper()
        subj = Subject(project_id=project_id, name=name, code=code)
        db.add(subj)
        db.flush()
        subject_map[name] = subj.id

    # Classes
    for cls in DEMO_CLASSES:
        db.add(SchoolClass(
            project_id=project_id,
            name=cls["name"],
            grade=cls["grade"],
            section=cls["section"],
            stream="",
            code=cls["grade"] + cls["section"],
            strength=35,
        ))

    # Classrooms
    for room in DEMO_CLASSROOMS:
        rtype = "Classroom"
        if "Lab" in room["name"]:
            rtype = "Lab"
        elif "Library" in room["name"]:
            rtype = "Library"
        db.add(Room(
            project_id=project_id,
            name=room["name"],
            code=room["name"].replace(" ", "")[:4].upper(),
            room_type=rtype,
            capacity=room["capacity"],
        ))

    # Teachers
    for i, t in enumerate(DEMO_TEACHERS):
        code = _make_code(t["name"], existing_codes)
        existing_codes.add(code)
        color = COLOR_PALETTE[i % len(COLOR_PALETTE)]
        parts = t["name"].split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        subj_id = subject_map.get(t["subject"])
        teacher = Teacher(
            project_id=project_id,
            first_name=first_name,
            last_name=last_name,
            title=t["title"],
            code=code,
            color=color,
            max_periods_day=6,
            max_periods_week=30,
        )
        db.add(teacher)
        db.flush()
        # Link teacher to their subject via TeacherSubject if subject exists
        if subj_id:
            from backend.models.teacher_model import TeacherSubject
            db.add(TeacherSubject(teacher_id=teacher.id, subject_id=subj_id))

    db.flush()

    # Write history
    db.add(TimetableHistory(
        project_id=project_id,
        action="demo_loaded",
        description=f"Demo data loaded: {len(DEMO_CLASSES)} classes, {len(DEMO_TEACHERS)} teachers, {len(DEMO_SUBJECTS_O_LEVEL)} subjects",
        teacher_count=len(DEMO_TEACHERS),
        class_count=len(DEMO_CLASSES),
    ))

    db.commit()
    return {
        "teachers": len(DEMO_TEACHERS),
        "classes": len(DEMO_CLASSES),
        "subjects": len(DEMO_SUBJECTS_O_LEVEL),
        "classrooms": len(DEMO_CLASSROOMS),
    }


def create_demo_project(db: Session, school_id: int) -> Project:
    """Create one project 'Demo School' with full sample data. Returns the project."""
    p = Project(school_id=school_id, name="Demo School", academic_year="2025-26")
    db.add(p)
    db.flush()

    # School settings
    s = get_or_create(db, p.id)
    update_settings(
        db, p.id,
        name="Demo School",
        campus_name="Main Campus",
        academic_year="2025-26",
        days_per_week=5,
        periods_per_day=7,
        period_duration_minutes=45,
        assembly_duration_minutes=15,
        working_days="1,2,3,4,5",
        school_start_time="08:00",
        school_end_time="15:00",
        friday_start_time="08:00",
        friday_end_time="14:00",
        breaks_json='[{"name":"Short Break","after_period":2,"duration_minutes":15,"days":[1,2,3,4,5]},{"name":"Lunch","after_period":4,"duration_minutes":45,"days":[1,2,3,4,5]}]',
    )

    seed_demo_data(p.id, db)

    db.refresh(p)
    return p
