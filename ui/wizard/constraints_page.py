"""Constraints management wizard page."""
from __future__ import annotations
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QComboBox, QTableWidget, QTableWidgetItem, QHeaderView,
    QAbstractItemView, QCheckBox, QGroupBox, QGridLayout,
    QMessageBox, QSizePolicy,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QColor

from services.teacher_service import TeacherService
from services.class_service import ClassService
from services.room_service import RoomService
from services.school_service import SchoolService
from services.constraint_service import ConstraintService
from utils.helpers import get_day_short, get_period_label
from ui.widgets.searchable_combo import make_searchable
from utils.display_utils import class_display_label, teacher_display_label

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ConstraintsPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._grid_checks: list[list[QCheckBox]] = []
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Constraints & Availability")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Set availability for teachers, classes, and rooms.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        # Entity selector
        sel_layout = QHBoxLayout()
        sel_layout.addWidget(QLabel("Entity Type:"))
        self.type_combo = QComboBox()
        self.type_combo.addItems(["Teacher", "Class", "Room"])
        self.type_combo.currentIndexChanged.connect(self._on_type_changed)
        sel_layout.addWidget(self.type_combo)

        sel_layout.addWidget(QLabel("Select:"))
        self.entity_combo = QComboBox()
        self.entity_combo.setMinimumWidth(200)
        make_searchable(self.entity_combo)
        self.entity_combo.currentIndexChanged.connect(self._on_entity_changed)
        sel_layout.addWidget(self.entity_combo)

        sel_layout.addStretch()
        layout.addLayout(sel_layout)

        # Availability grid
        self.grid_group = QGroupBox("Availability Grid (uncheck to mark unavailable)")
        self.grid_layout = QGridLayout(self.grid_group)
        # Whole-day unavailability (one tick per day)
        self._whole_day_checks: list[QCheckBox] = []
        layout.addWidget(self.grid_group)

        # Save
        btn_layout = QHBoxLayout()
        save_btn = QPushButton("Save Constraints")
        save_btn.setProperty("primary", True)
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)
        btn_layout.addStretch()

        next_btn = QPushButton("Next: Generate")
        next_btn.clicked.connect(lambda: self.main_window.navigate_to(8))
        btn_layout.addWidget(next_btn)
        layout.addLayout(btn_layout)
        layout.addStretch()

    def on_enter(self) -> None:
        self._on_type_changed(self.type_combo.currentIndex())

    def _on_type_changed(self, index: int) -> None:
        if not self.main_window.db:
            return
        self.entity_combo.clear()
        entity_type = ["teacher", "class", "room"][index]

        if entity_type == "teacher":
            svc = TeacherService(self.main_window.db)
            items = svc.get_all()
            for t in items:
                self.entity_combo.addItem(teacher_display_label(t), t.id)
        elif entity_type == "class":
            svc = ClassService(self.main_window.db)
            items = svc.get_all()
            for c in items:
                self.entity_combo.addItem(class_display_label(c), c.id)
        else:
            svc = RoomService(self.main_window.db)
            items = svc.get_all()
            for r in items:
                self.entity_combo.addItem(r.name, r.id)

    def _on_entity_changed(self, index, *args) -> None:
        # Defensive: on macOS Qt may sometimes invoke this with delegate-style (option, index) args; ignore wrong calls
        if args and not isinstance(index, int):
            return
        if index < 0 or not self.main_window.db:
            return

        entity_id = self.entity_combo.currentData()
        if entity_id is None:
            return

        entity_type = ["teacher", "class", "room"][self.type_combo.currentIndex()]

        school_svc = SchoolService(self.main_window.db)
        school = school_svc.get_or_create()

        import json
        bell = {}
        if school.bell_schedule_json:
            try:
                raw = school.bell_schedule_json
                bell = json.loads(raw) if isinstance(raw, str) else raw
                if not isinstance(bell, dict):
                    bell = {}
            except (TypeError, ValueError):
                pass
        zero_period = bool(bell.get("zero_period", False))
        num_periods = school.periods_per_day + (1 if zero_period else 0)
        num_days = school.days_per_week
        while self.grid_layout.count():
            child = self.grid_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

        # Build grid
        # Headers
        for d in range(num_days):
            lbl = QLabel(get_day_short(d))
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lbl.setStyleSheet("font-weight: bold;")
            self.grid_layout.addWidget(lbl, 0, d + 1)

        # Whole-day unavailable row (one tick blocks entire day)
        self._whole_day_checks.clear()
        whole_lbl = QLabel("Unavailable whole day")
        whole_lbl.setStyleSheet("font-weight: bold; color:#666;")
        self.grid_layout.addWidget(whole_lbl, 1, 0)
        for d in range(num_days):
            cb = QCheckBox()
            cb.setChecked(False)
            cb.setProperty("day_index", d)
            cb.toggled.connect(self._on_whole_day_toggled_slot)
            self._whole_day_checks.append(cb)
            self.grid_layout.addWidget(cb, 1, d + 1, Qt.AlignmentFlag.AlignCenter)

        self._grid_checks = []
        for p in range(num_periods):
            lbl = QLabel(get_period_label(p, zero_period))
            lbl.setStyleSheet("font-weight: bold;")
            self.grid_layout.addWidget(lbl, p + 2, 0)
            row_checks = []
            for d in range(num_days):
                cb = QCheckBox()
                cb.setChecked(True)
                self.grid_layout.addWidget(cb, p + 2, d + 1, Qt.AlignmentFlag.AlignCenter)
                row_checks.append(cb)
            self._grid_checks.append(row_checks)

        # Load existing constraints
        con_svc = ConstraintService(self.main_window.db)
        constraints = con_svc.get_by_entity(entity_type, entity_id)
        for c in constraints:
            if c.constraint_type == "unavailable":
                d = c.day_index
                p = c.period_index
                if 0 <= p < num_periods and 0 <= d < num_days:
                    self._grid_checks[p][d].setChecked(False)
        # Sync whole-day: if all periods for a day are unavailable, check "Unavailable whole day"
        for d in range(num_days):
            if all(not self._grid_checks[p][d].isChecked() for p in range(num_periods)):
                self._whole_day_checks[d].setChecked(True)

    def _on_whole_day_toggled_slot(self, checked: bool) -> None:
        """Slot for whole-day checkbox: get day from sender and call handler."""
        sender = self.sender()
        if isinstance(sender, QCheckBox):
            day = sender.property("day_index")
            if day is not None:
                self._on_whole_day_toggled(int(day), checked)

    def _on_whole_day_toggled(self, day: int, checked: bool) -> None:
        """Set all period checkboxes for this day to unavailable (checked) or available (unchecked)."""
        for row in self._grid_checks:
            if day < len(row):
                row[day].setChecked(not checked)

    def _save(self) -> None:
        if not self.main_window.db:
            return

        entity_id = self.entity_combo.currentData()
        if entity_id is None:
            return

        entity_type = ["teacher", "class", "room"][self.type_combo.currentIndex()]

        unavailable = []
        for p, row in enumerate(self._grid_checks):
            for d, cb in enumerate(row):
                if not cb.isChecked():
                    unavailable.append((d, p))

        con_svc = ConstraintService(self.main_window.db)
        con_svc.save_availability_grid(entity_type, entity_id, unavailable)
        QMessageBox.information(self, "Saved", "Constraints saved successfully.")
