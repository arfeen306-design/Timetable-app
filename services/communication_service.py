"""Communication-ready layer for timetable delivery.

This module is separate from the solver and focuses on:
- Resolving contacts (teacher email, WhatsApp; class teacher for each class)
- Listing what can be sent: teacher timetable per teacher, class timetable per class teacher
- Report generation in a form suitable for email or future WhatsApp

No email or WhatsApp API dependency here; the core timetable engine stays stable.
Sending can be added later by plugging in email/WhatsApp providers that use
these deliverables and generated reports.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


@dataclass
class TeacherTimetableDelivery:
    """One teacher's timetable ready for delivery (email/WhatsApp)."""
    teacher_id: int
    teacher_name: str
    email: str
    whatsapp_number: str


@dataclass
class ClassTimetableDelivery:
    """One class timetable for the class teacher (email/WhatsApp)."""
    class_id: int
    class_name: str
    class_teacher_id: int
    class_teacher_name: str
    email: str
    whatsapp_number: str


class CommunicationService:
    """Provides contact resolution and delivery lists for timetable distribution."""

    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def get_teacher_timetable_deliverables(self) -> list[TeacherTimetableDelivery]:
        """All teachers with their contact info, for teacher-timetable distribution."""
        from repositories.teacher_repo import TeacherRepository
        repo = TeacherRepository(self.db)
        teachers = repo.get_all()
        return [
            TeacherTimetableDelivery(
                teacher_id=t.id,
                teacher_name=t.full_name,
                email=(t.email or "").strip(),
                whatsapp_number=(t.whatsapp_number or "").strip(),
            )
            for t in teachers
        ]

    def get_class_teacher_timetable_deliverables(self) -> list[ClassTimetableDelivery]:
        """Classes that have a class teacher set, with that teacher's contact info."""
        rows = self.db.fetchall("""
            SELECT c.id AS class_id, c.name AS class_name,
                   t.id AS class_teacher_id,
                   t.first_name || ' ' || t.last_name AS class_teacher_name,
                   t.email, t.whatsapp_number
            FROM school_class c
            JOIN teacher t ON c.class_teacher_id = t.id
            WHERE c.class_teacher_id IS NOT NULL
            ORDER BY c.name
        """)
        return [
            ClassTimetableDelivery(
                class_id=r["class_id"],
                class_name=r["class_name"],
                class_teacher_id=r["class_teacher_id"],
                class_teacher_name=r["class_teacher_name"],
                email=(r["email"] or "").strip(),
                whatsapp_number=(r["whatsapp_number"] or "").strip(),
            )
            for r in rows
        ]
