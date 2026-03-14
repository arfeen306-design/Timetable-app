"""Introduction/landing wizard page."""
from __future__ import annotations
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFileDialog, QSpacerItem, QSizePolicy, QMenu,
)
from PySide6.QtCore import Qt

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class IntroPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.setSpacing(16)

        layout.addSpacerItem(QSpacerItem(0, 60, QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Expanding))

        title = QLabel("School Timetable Generator")
        title.setProperty("heading", True)
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("font-size: 28px; font-weight: bold; color: #2C3E50;")
        layout.addWidget(title)

        subtitle = QLabel("Create professional, clash-free timetables for your school")
        subtitle.setProperty("subheading", True)
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle.setStyleSheet("font-size: 14px; color: #7F8C8D; margin-bottom: 32px;")
        layout.addWidget(subtitle)

        # Buttons
        btn_layout = QVBoxLayout()
        btn_layout.setSpacing(12)
        btn_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        btn_new = QPushButton("  Create New Project")
        btn_new.setProperty("primary", True)
        btn_new.setFixedSize(280, 48)
        btn_new.clicked.connect(self._on_new)
        btn_layout.addWidget(btn_new, alignment=Qt.AlignmentFlag.AlignCenter)

        btn_open = QPushButton("  Open Existing Project")
        btn_open.setFixedSize(280, 48)
        btn_open.clicked.connect(self._on_open)
        btn_layout.addWidget(btn_open, alignment=Qt.AlignmentFlag.AlignCenter)

        btn_recent = QPushButton("  Open Recent Project")
        btn_recent.setFixedSize(280, 48)
        btn_recent.clicked.connect(self._on_open_recent)
        self._btn_recent = btn_recent
        btn_layout.addWidget(btn_recent, alignment=Qt.AlignmentFlag.AlignCenter)

        btn_duplicate = QPushButton("  Duplicate Project")
        btn_duplicate.setFixedSize(280, 48)
        btn_duplicate.setToolTip("Copy an existing project to a new file and open it")
        btn_duplicate.clicked.connect(self._on_duplicate)
        btn_layout.addWidget(btn_duplicate, alignment=Qt.AlignmentFlag.AlignCenter)

        btn_demo = QPushButton("  Load Demo Data")
        btn_demo.setFixedSize(280, 48)
        btn_demo.clicked.connect(self._on_demo)
        btn_layout.addWidget(btn_demo, alignment=Qt.AlignmentFlag.AlignCenter)

        layout.addLayout(btn_layout)
        layout.addSpacerItem(QSpacerItem(0, 60, QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Expanding))

        version = QLabel("Version 1.0.0")
        version.setAlignment(Qt.AlignmentFlag.AlignCenter)
        version.setStyleSheet("color: #BDC3C7; font-size: 11px;")
        layout.addWidget(version)

    def _on_new(self) -> None:
        self.main_window.new_project()

    def _on_open(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Open Project", "", "Timetable Project (*.ttb)"
        )
        if path:
            self.main_window.open_project(path)

    def _on_open_recent(self) -> None:
        recent = self.main_window.project_service.get_recent_list()
        if not recent:
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.information(
                self, "Open Recent",
                "No recent projects. Open or create a project first.",
            )
            return
        menu = QMenu(self)
        for path in recent:
            from pathlib import Path
            label = Path(path).name
            if len(path) > 50:
                label = "..." + path[-47:]
            act = menu.addAction(label)
            act.setData(path)
        chosen = menu.exec(self._btn_recent.mapToGlobal(self._btn_recent.rect().bottomLeft()))
        if chosen and chosen.data():
            self.main_window.open_project(chosen.data())

    def _on_duplicate(self) -> None:
        self.main_window.duplicate_project()

    def _on_demo(self) -> None:
        self.main_window.new_temp_project()
        from sample_data.demo_loader import load_demo_data
        load_demo_data(self.main_window.db)
        self.main_window.navigate_to(1)
