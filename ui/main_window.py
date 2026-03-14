"""Main application window with wizard-based navigation."""
from __future__ import annotations
import shutil
from typing import Optional

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QListWidget,
    QStackedWidget, QListWidgetItem, QMessageBox, QFileDialog,
)
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QColor, QCloseEvent

from database.connection import DatabaseConnection
from services.project_service import ProjectService
from ui.styles import MAIN_STYLESHEET, WIZARD_NAV_STYLE
from ui.wizard.wizard_controller import WizardController


class MainWindow(QMainWindow):
    """Application main window with sidebar navigation."""

    WIZARD_STEPS = [
        "Introduction",
        "School",
        "Subjects",
        "Classes",
        "Classrooms",
        "Teachers",
        "Lessons",
        "Constraints",
        "Generate",
        "Review & Export",
    ]

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("School Timetable Generator")
        self.setMinimumSize(1100, 700)
        self.resize(1280, 800)
        self.setStyleSheet(MAIN_STYLESHEET)

        self.project_service = ProjectService()
        self.db: Optional[DatabaseConnection] = None

        self._build_ui()

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar nav
        self.nav_list = QListWidget()
        self.nav_list.setFixedWidth(180)
        self.nav_list.setStyleSheet(WIZARD_NAV_STYLE)
        for i, step in enumerate(self.WIZARD_STEPS):
            item = QListWidgetItem(f"{i + 1}.  {step}")
            item.setSizeHint(QSize(180, 44))
            self.nav_list.addItem(item)
        self.nav_list.currentRowChanged.connect(self._on_nav_changed)
        layout.addWidget(self.nav_list)

        # Stacked pages
        self.page_stack = QStackedWidget()
        layout.addWidget(self.page_stack, 1)

        # Build wizard controller
        self.wizard = WizardController(self)
        self.wizard.build_pages(self.page_stack)

        # Start at intro
        self.nav_list.setCurrentRow(0)
        self._set_nav_enabled(False)

    def _on_nav_changed(self, index: int) -> None:
        if 0 <= index < self.page_stack.count():
            self.page_stack.setCurrentIndex(index)
            self.wizard.on_page_entered(index)
            self.update_nav_status()

    def _set_nav_enabled(self, enabled: bool) -> None:
        """Enable/disable navigation beyond the intro page."""
        for i in range(1, self.nav_list.count()):
            item = self.nav_list.item(i)
            if enabled:
                item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEnabled)
            else:
                item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEnabled)
        if enabled:
            self.update_nav_status()

    def update_nav_status(self) -> None:
        """Update sidebar nav items with data counts and status indicators."""
        statuses = self.wizard.get_step_statuses()
        for i, (step_name, (status, count)) in enumerate(zip(self.WIZARD_STEPS, statuses)):
            item = self.nav_list.item(i)
            if not item:
                continue
            # Build display text with step number
            num = f"{i + 1}."
            if status == "ok" and count > 0:
                label = f"{num}  {step_name} ({count})" if i not in (0, 1, 8, 9) else f"{num}  {step_name}"
                suffix = "  \u2713"  # checkmark
            elif status == "empty":
                label = f"{num}  {step_name}"
                suffix = "  \u25CB"  # empty circle
            else:
                label = f"{num}  {step_name}"
                suffix = ""

            item.setText(label + suffix)

            # Color the text based on status
            if status == "ok":
                item.setForeground(QColor("#2ECC71"))  # green
            elif status == "empty":
                item.setForeground(QColor("#E74C3C"))  # red
            else:
                item.setForeground(QColor("#BDC3C7"))  # default gray

    def navigate_to(self, index: int) -> None:
        self.nav_list.setCurrentRow(index)

    def open_project(self, path: str) -> None:
        try:
            self.db = self.project_service.open_project(path)
            self._set_nav_enabled(True)
            self.setWindowTitle(f"School Timetable Generator - {path}")
            self.navigate_to(1)
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to open project:\n{e}")

    def new_project(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self, "Create New Project", "", "Timetable Project (*.ttb)"
        )
        if path:
            try:
                self.db = self.project_service.new_project(path)
                self._set_nav_enabled(True)
                self.setWindowTitle(f"School Timetable Generator - {path}")
                self.navigate_to(1)
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Failed to create project:\n{e}")

    def duplicate_project(self) -> None:
        """Copy an existing .ttb to a new path and open it."""
        source, _ = QFileDialog.getOpenFileName(
            self, "Select Project to Duplicate", "", "Timetable Project (*.ttb)"
        )
        if not source:
            return
        dest, _ = QFileDialog.getSaveFileName(
            self, "Save Duplicate As", "", "Timetable Project (*.ttb)"
        )
        if not dest:
            return
        if source == dest:
            QMessageBox.warning(
                self, "Duplicate Project",
                "Source and destination are the same. Choose a different file name.",
            )
            return
        try:
            shutil.copy2(source, dest)
            self.open_project(dest)
        except Exception as e:
            QMessageBox.critical(
                self, "Error",
                f"Failed to duplicate project:\n{e}",
            )

    def new_temp_project(self) -> None:
        """Create an in-memory project (for demo data)."""
        self.db = self.project_service.new_temp_project()
        self._set_nav_enabled(True)
        self.setWindowTitle("School Timetable Generator - [Unsaved Project]")
        self.update_nav_status()

    def save_project(self) -> None:
        if not self.db:
            return
        if self.project_service.current_path:
            # Already saved to a file
            QMessageBox.information(self, "Saved", "Project saved successfully.")
        else:
            self.save_project_as()

    def save_project_as(self) -> None:
        if not self.db:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Save Project As", "", "Timetable Project (*.ttb)"
        )
        if path:
            try:
                self.project_service.save_as(path)
                self.setWindowTitle(f"School Timetable Generator - {path}")
                QMessageBox.information(self, "Saved", "Project saved successfully.")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Failed to save project:\n{e}")

    def closeEvent(self, event: QCloseEvent) -> None:
        self.project_service.close()
        event.accept()
