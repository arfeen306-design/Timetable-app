"""Application bootstrap and lifecycle management."""
from __future__ import annotations
import sys
import platform
from typing import Optional

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

from database.connection import DatabaseConnection
from ui.main_window import MainWindow


class Application:
    """Top-level application controller."""

    def __init__(self, argv: list[str]) -> None:
        self.qt_app = QApplication(argv)
        self.qt_app.setApplicationName("School Timetable Generator")
        self.qt_app.setOrganizationName("TimetableApp")
        self.qt_app.setApplicationVersion("1.0.0")

        # Use platform-appropriate font
        if platform.system() == "Darwin":
            font = QFont(".AppleSystemUIFont", 13)
        elif platform.system() == "Windows":
            font = QFont("Segoe UI", 10)
        else:
            font = QFont("Sans Serif", 10)
        self.qt_app.setFont(font)

        self.db: Optional[DatabaseConnection] = None
        self.main_window: Optional[MainWindow] = None

    def run(self) -> int:
        self.main_window = MainWindow()
        self.main_window.show()
        return self.qt_app.exec()
