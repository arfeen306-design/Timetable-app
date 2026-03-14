"""CSV export for raw timetable data."""
from __future__ import annotations
import csv
from typing import TYPE_CHECKING

from repositories.timetable_repo import TimetableRepository
from utils.helpers import get_day_name, get_period_label

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


def export_csv(db: DatabaseConnection, path: str) -> None:
    """Export timetable entries as a flat CSV file."""
    repo = TimetableRepository(db)
    entries = repo.get_all()

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Day", "Period", "Day Index", "Period Index",
            "Class", "Subject", "Subject Code", "Teacher", "Room", "Locked"
        ])

        for e in entries:
            writer.writerow([
                get_day_name(e.day_index),
                get_period_label(e.period_index),
                e.day_index,
                e.period_index,
                e.class_name,
                e.subject_name,
                e.subject_code,
                e.teacher_name,
                e.room_name or "",
                "Yes" if e.locked else "No",
            ])
