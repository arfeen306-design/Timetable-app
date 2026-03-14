"""Wizard controller that manages all wizard page instances."""
from __future__ import annotations
from typing import TYPE_CHECKING

from PySide6.QtWidgets import QStackedWidget

from ui.wizard.intro_page import IntroPage
from ui.wizard.school_page import SchoolPage
from ui.wizard.subjects_page import SubjectsPage
from ui.wizard.classes_page import ClassesPage
from ui.wizard.classrooms_page import ClassroomsPage
from ui.wizard.teachers_page import TeachersPage
from ui.wizard.lessons_page import LessonsPage
from ui.wizard.constraints_page import ConstraintsPage
from ui.wizard.generate_page import GeneratePage
from ui.wizard.review_page import ReviewPage

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class WizardController:
    """Manages wizard page lifecycle and data flow."""

    def __init__(self, main_window: MainWindow) -> None:
        self.main_window = main_window
        self.pages: list = []

    def build_pages(self, stack: QStackedWidget) -> None:
        self.pages = [
            IntroPage(self.main_window),       # 0
            SchoolPage(self.main_window),       # 1
            SubjectsPage(self.main_window),     # 2
            ClassesPage(self.main_window),      # 3
            ClassroomsPage(self.main_window),   # 4
            TeachersPage(self.main_window),     # 5
            LessonsPage(self.main_window),      # 6
            ConstraintsPage(self.main_window),  # 7
            GeneratePage(self.main_window),     # 8
            ReviewPage(self.main_window),       # 9
        ]

        for page in self.pages:
            stack.addWidget(page)

    def on_page_entered(self, index: int) -> None:
        if 0 <= index < len(self.pages):
            page = self.pages[index]
            if hasattr(page, "on_enter"):
                page.on_enter()

    def get_step_statuses(self) -> list[tuple[str, int]]:
        """Return (status, count) for each wizard step.

        status: 'ok' if data exists, 'empty' if no data, 'na' if not applicable.
        count: number of records (-1 if not applicable).
        """
        db = self.main_window.db
        if not db:
            return [("na", -1)] * 10

        statuses = []
        # 0: Intro — always n/a
        statuses.append(("na", -1))

        # 1: School
        row = db.fetchone("SELECT COUNT(*) AS c FROM school")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "empty", n))

        # 2: Subjects
        row = db.fetchone("SELECT COUNT(*) AS c FROM subject")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "empty", n))

        # 3: Classes
        row = db.fetchone("SELECT COUNT(*) AS c FROM school_class")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "empty", n))

        # 4: Classrooms
        row = db.fetchone("SELECT COUNT(*) AS c FROM room")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "empty", n))

        # 5: Teachers
        row = db.fetchone("SELECT COUNT(*) AS c FROM teacher")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "empty", n))

        # 6: Lessons
        row = db.fetchone("SELECT COUNT(*) AS c FROM lesson")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "empty", n))

        # 7: Constraints — optional, so 'na' instead of 'empty'
        row = db.fetchone("SELECT COUNT(*) AS c FROM time_constraint")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "na", n))

        # 8: Generate — check if timetable entries exist
        row = db.fetchone("SELECT COUNT(*) AS c FROM timetable_entry")
        n = row["c"] if row else 0
        statuses.append(("ok" if n > 0 else "na", n))

        # 9: Review — same as generate
        statuses.append(("ok" if n > 0 else "na", n))

        return statuses
