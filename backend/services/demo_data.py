"""Create a demo project with sample school, teachers, classes, subjects, rooms, and lessons."""
from __future__ import annotations
from sqlalchemy.orm import Session

from backend.models.project import Project, Subject
from backend.models.school_settings import SchoolSettings
from backend.models.teacher_model import Teacher
from backend.models.class_model import SchoolClass
from backend.models.room_model import Room
from backend.models.lesson_model import Lesson
from backend.repositories.school_settings_repo import get_or_create, update as update_settings


def create_demo_project(db: Session, school_id: int) -> Project:
    """Create one project 'Demo School' with full sample data. Returns the project."""
    p = Project(school_id=school_id, name="Demo School", academic_year="2024-25")
    db.add(p)
    db.flush()

    # School settings
    s = get_or_create(db, p.id)
    update_settings(
        db, p.id,
        name="Demo School",
        campus_name="Main Campus",
        academic_year="2024-25",
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

    # Subjects
    subjects_data = [
        ("Mathematics", "MATH"), ("English", "ENG"), ("Science", "SCI"), ("History", "HIS"),
        ("Geography", "GEO"), ("Arabic", "AR"), ("Physical Education", "PE"), ("Art", "ART"),
        ("Computer Science", "CS"), ("Music", "MUS"),
    ]
    subjects = []
    for name, code in subjects_data:
        sub = Subject(project_id=p.id, name=name, code=code)
        db.add(sub)
        db.flush()
        subjects.append(sub)

    # Classes: 6 classes
    classes_data = [
        ("10", "A", "", "Grade 10-A"), ("10", "B", "", "Grade 10-B"), ("9", "A", "", "Grade 9-A"),
        ("9", "B", "", "Grade 9-B"), ("8", "A", "", "Grade 8-A"), ("8", "B", "", "Grade 8-B"),
    ]
    classes = []
    for grade, section, stream, name in classes_data:
        c = SchoolClass(project_id=p.id, grade=grade, section=section, stream=stream or "", name=name, code=grade + section, strength=30)
        db.add(c)
        db.flush()
        classes.append(c)

    # Teachers: 15
    teachers_data = [
        ("Ahmed", "Ali", "AHA"), ("Sara", "Khan", "SKK"), ("Omar", "Hassan", "OMH"),
        ("Layla", "Mohamed", "LAM"), ("Youssef", "Ibrahim", "YOI"), ("Fatima", "Ahmed", "FAA"),
        ("Khalid", "Rashid", "KHR"), ("Nadia", "Salem", "NAS"), ("Tariq", "Farouk", "TRF"),
        ("Hana", "Mahmoud", "HAM"), ("Rami", "Naser", "RAN"), ("Dina", "Sayed", "DIS"),
        ("Karim", "Walid", "KWW"), ("Lina", "Fadi", "LIF"), ("Jaber", "Hamza", "JAH"),
    ]
    teachers = []
    for first, last, code in teachers_data:
        t = Teacher(project_id=p.id, first_name=first, last_name=last, code=code, title="Mr." if first in ("Ahmed","Omar","Youssef","Khalid","Tariq","Rami","Karim","Jaber") else "Ms.", max_periods_day=6, max_periods_week=28)
        db.add(t)
        db.flush()
        teachers.append(t)

    # Rooms: 8
    rooms_data = [("Room 101", "R101"), ("Room 102", "R102"), ("Lab 1", "L1"), ("Lab 2", "L2"), ("Hall A", "HA"), ("Room 201", "R201"), ("Room 202", "R202"), ("Art Room", "AR1")]
    rooms = []
    for name, code in rooms_data:
        r = Room(project_id=p.id, name=name, code=code, room_type="Classroom" if "Room" in name else ("Lab" if "Lab" in name else "Hall"), capacity=35)
        db.add(r)
        db.flush()
        rooms.append(r)

    # Sample lessons: each teacher 2-3 lessons, spread across subjects and classes
    for i, t in enumerate(teachers):
        sub = subjects[i % len(subjects)]
        cl = classes[i % len(classes)]
        lesson = Lesson(project_id=p.id, teacher_id=t.id, subject_id=sub.id, class_id=cl.id, periods_per_week=4)
        db.add(lesson)
    for i, t in enumerate(teachers[:8]):
        sub = subjects[(i + 2) % len(subjects)]
        cl = classes[(i + 1) % len(classes)]
        lesson = Lesson(project_id=p.id, teacher_id=t.id, subject_id=sub.id, class_id=cl.id, periods_per_week=3)
        db.add(lesson)

    db.commit()
    db.refresh(p)
    return p
