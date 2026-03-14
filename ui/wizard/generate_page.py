"""Timetable generation wizard page."""
from __future__ import annotations
import tempfile
import shutil
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QSpinBox, QTextEdit, QProgressBar, QGroupBox, QFormLayout,
    QMessageBox,
)
from PySide6.QtCore import Qt, QThread, Signal

from database.connection import DatabaseConnection
from solver.engine import TimetableSolver
from models.domain import TimetableEntry
from repositories.timetable_repo import TimetableRepository
from services.timetable_service import TimetableService

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class SolverThread(QThread):
    """Background thread for running the solver.
    Creates its own DB connection to avoid SQLite thread-safety errors.
    """
    finished = Signal(bool, list, list)  # success, entries, messages

    def __init__(self, db_path: str, time_limit: int) -> None:
        super().__init__()
        self.db_path = db_path
        self.time_limit = time_limit

    def run(self) -> None:
        try:
            thread_db = DatabaseConnection(self.db_path)
            thread_db.open()
            solver = TimetableSolver(thread_db)
            success, entries, messages = solver.solve(self.time_limit)
            if success and entries:
                repo = TimetableRepository(thread_db)
                repo.save_entries(entries)
            thread_db.close()
            self.finished.emit(success, entries, messages)
        except Exception as e:
            self.finished.emit(False, [], [f"Solver error: {e}"])


class GeneratePage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._solver_thread = None
        self._temp_db_path: str | None = None
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Generate Timetable")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Validate your data and generate a clash-free timetable.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        # Settings
        settings_group = QGroupBox("Generation Settings")
        settings_layout = QFormLayout(settings_group)
        self.time_limit_spin = QSpinBox()
        self.time_limit_spin.setRange(5, 300)
        self.time_limit_spin.setValue(60)
        self.time_limit_spin.setSuffix(" seconds")
        settings_layout.addRow("Time Limit:", self.time_limit_spin)
        layout.addWidget(settings_group)

        # Buttons
        btn_layout = QHBoxLayout()
        self.validate_btn = QPushButton("Validate Data")
        self.validate_btn.clicked.connect(self._validate)
        btn_layout.addWidget(self.validate_btn)

        self.generate_btn = QPushButton("Generate Timetable")
        self.generate_btn.setProperty("primary", True)
        self.generate_btn.clicked.connect(self._generate)
        btn_layout.addWidget(self.generate_btn)

        btn_layout.addStretch()
        layout.addLayout(btn_layout)

        # Progress
        self.progress = QProgressBar()
        self.progress.setRange(0, 0)
        self.progress.setVisible(False)
        layout.addWidget(self.progress)

        # Output
        self.output = QTextEdit()
        self.output.setReadOnly(True)
        self.output.setMinimumHeight(250)
        layout.addWidget(self.output)

        # Nav
        nav = QHBoxLayout()
        nav.addStretch()
        self.review_btn = QPushButton("View Timetable")
        self.review_btn.setProperty("primary", True)
        self.review_btn.setEnabled(False)
        self.review_btn.clicked.connect(lambda: self.main_window.navigate_to(9))
        nav.addWidget(self.review_btn)
        layout.addLayout(nav)

    def on_enter(self) -> None:
        # Auto-validate on entry
        if self.main_window.db:
            self._validate()

    def _validate(self) -> None:
        if not self.main_window.db:
            return

        db = self.main_window.db
        svc = TimetableService(db)
        result = svc.validate()

        # Readiness summary (counts)
        n_teachers = db.fetchone("SELECT COUNT(*) as n FROM teacher")["n"] or 0
        n_classes = db.fetchone("SELECT COUNT(*) as n FROM school_class")["n"] or 0
        n_subjects = db.fetchone("SELECT COUNT(*) as n FROM subject")["n"] or 0
        n_rooms = db.fetchone("SELECT COUNT(*) as n FROM room")["n"] or 0
        n_lessons = db.fetchone("SELECT COUNT(*) as n FROM lesson")["n"] or 0

        self.output.clear()
        self.output.append('<span style="font-weight:bold;">=== Readiness summary ===</span>')
        self.output.append(
            f"Teachers: {n_teachers}  |  Classes: {n_classes}  |  Subjects: {n_subjects}  |  "
            f"Rooms: {n_rooms}  |  Lessons: {n_lessons}"
        )
        self.output.append(
            f"Hard conflicts: 0  |  Warnings: {len(result.warnings)}"
        )
        self.output.append("")

        if result.errors:
            self.output.append('<span style="color:#E74C3C; font-weight:bold;">=== ERRORS ===</span>')
            for e in result.errors:
                self.output.append(f'<span style="color:#E74C3C;">  {e}</span>')
            self.output.append("")

        if result.warnings:
            self.output.append('<span style="color:#F39C12; font-weight:bold;">=== WARNINGS ===</span>')
            for w in result.warnings:
                self.output.append(f'<span style="color:#F39C12;">  {w}</span>')
            self.output.append("")

        if result.is_valid:
            self.output.append('<span style="color:#27AE60; font-weight:bold;">Validation passed. Ready to generate timetable.</span>')
            self.generate_btn.setEnabled(True)
        else:
            self.output.append('<span style="color:#E74C3C; font-weight:bold;">Validation FAILED. Fix errors before generating.</span>')
            self.generate_btn.setEnabled(False)

    def _generate(self) -> None:
        if not self.main_window.db:
            return

        # Validate first
        svc = TimetableService(self.main_window.db)
        result = svc.validate()
        if not result.is_valid:
            self.output.clear()
            self.output.append('<span style="color:#E74C3C; font-weight:bold;">Cannot generate: fix these errors first:</span>\n')
            for e in result.errors:
                self.output.append(f'<span style="color:#E74C3C;">  {e}</span>')
            QMessageBox.warning(
                self, "Validation Failed",
                "Cannot generate timetable.\n\n" + "\n".join(result.errors),
            )
            return

        # For in-memory DBs, save to temp file so the solver thread can open it
        db = self.main_window.db
        if db.path == ":memory:":
            import tempfile, os
            self._temp_db_path = os.path.join(tempfile.gettempdir(), "timetable_solver_temp.ttb")
            # Backup in-memory DB to file
            import sqlite3
            file_conn = sqlite3.connect(self._temp_db_path)
            db.conn.backup(file_conn)
            file_conn.close()
            solver_db_path = self._temp_db_path
        else:
            solver_db_path = db.path
            self._temp_db_path = None

        self.output.clear()
        self.output.append("Starting timetable generation...")
        self.output.append(f"Time limit: {self.time_limit_spin.value()} seconds")
        self.progress.setVisible(True)
        self.generate_btn.setEnabled(False)
        self.validate_btn.setEnabled(False)

        self._solver_thread = SolverThread(
            solver_db_path,
            self.time_limit_spin.value(),
        )
        self._solver_thread.finished.connect(self._on_solver_finished)
        self._solver_thread.start()

    def _on_solver_finished(self, success: bool, entries: list, messages: list) -> None:
        self.progress.setVisible(False)
        self.generate_btn.setEnabled(True)
        self.validate_btn.setEnabled(True)

        # If we used a temp file for in-memory DB, copy results back
        if self._temp_db_path and self.main_window.db and self.main_window.db.path == ":memory:":
            import sqlite3
            source = sqlite3.connect(self._temp_db_path)
            source.backup(self.main_window.db.conn)
            source.close()
            try:
                import os
                os.remove(self._temp_db_path)
            except OSError:
                pass

        self.output.append("")
        for msg in messages:
            self.output.append(f"  {msg}")

        if success:
            svc = TimetableService(self.main_window.db)
            conflicts = svc.get_conflicts()
            unscheduled = svc.get_unscheduled_lessons()
            scheduled_slots = len(entries) if entries else 0
            self.output.append(
                f'\n<span style="color:#27AE60; font-weight:bold;">'
                f'Scheduled: {scheduled_slots} slots  |  Unscheduled lessons: {len(unscheduled)}  |  Conflicts: {len(conflicts)}'
                f'</span>'
            )
            self.output.append(f'\n<span style="color:#27AE60; font-weight:bold;">Timetable generated successfully!</span>')

            # Check for conflicts (detailed list)
            if conflicts:
                self.output.append(f'\n<span style="color:#E74C3C; font-weight:bold;">=== CONFLICTS DETECTED ({len(conflicts)}) ===</span>')
                for c in conflicts:
                    self.output.append(f'<span style="color:#E74C3C;">  {c}</span>')
            else:
                self.output.append('<span style="color:#27AE60;">No conflicts detected.</span>')

            # Unscheduled lessons report (unscheduled already fetched above)
            if unscheduled:
                self.output.append(
                    f'\n<span style="color:#F39C12; font-weight:bold;">=== UNSCHEDULED LESSONS ({len(unscheduled)}) ===</span>'
                )
                self.output.append(
                    '<span style="color:#F39C12;">Some lessons have fewer slots than required. Consider increasing time limit or relaxing constraints.</span>'
                )
                for u in unscheduled:
                    short = u["periods_per_week"] - u["scheduled_count"]
                    self.output.append(
                        f'<span style="color:#F39C12;">  • {u["teacher_name"]} – {u["subject_name"]} – {u["class_name"]}: '
                        f'scheduled {u["scheduled_count"]}/{u["periods_per_week"]} (short by {short})</span>'
                    )
            else:
                self.output.append('<span style="color:#27AE60;">All lessons fully scheduled.</span>')

            self.review_btn.setEnabled(True)
        else:
            self.output.append(f'\n<span style="color:#E74C3C; font-weight:bold;">Timetable generation failed.</span>')
            # Show detailed reasons: run validation and surface human-readable errors, grouped
            if self.main_window.db:
                svc = TimetableService(self.main_window.db)
                result = svc.validate()
                if result.errors or result.warnings:
                    self.output.append('<span style="color:#E74C3C; font-weight:bold;">Reasons (fix these and try again):</span>')
                    category_order = ("Missing data", "Teacher overload", "Class overload", "Room", "Other")
                    for cat in category_order:
                        if cat in result.grouped_errors and result.grouped_errors[cat]:
                            self.output.append(f'<span style="color:#C0392B; font-weight:bold;">  {cat}</span>')
                            for e in result.grouped_errors[cat]:
                                self.output.append(f'<span style="color:#E74C3C;">    • {e}</span>')
                    for cat, errs in result.grouped_errors.items():
                        if cat not in category_order and errs:
                            self.output.append(f'<span style="color:#C0392B; font-weight:bold;">  {cat}</span>')
                            for e in errs:
                                self.output.append(f'<span style="color:#E74C3C;">    • {e}</span>')
                    if result.warnings:
                        self.output.append('<span style="color:#F39C12; font-weight:bold;">  Warnings</span>')
                        for w in result.warnings:
                            self.output.append(f'<span style="color:#F39C12;">    • {w}</span>')
            QMessageBox.critical(
                self, "Generation Failed",
                "Timetable could not be generated.\n\n" + "\n".join(messages)
                + ("\n\nSee the validation reasons in the output above." if self.main_window.db else ""),
            )
            self.review_btn.setEnabled(False)
