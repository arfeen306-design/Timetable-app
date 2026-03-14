"""School settings wizard page."""
from __future__ import annotations
import json
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QSpinBox, QGroupBox, QFormLayout, QPushButton, QCheckBox,
    QMessageBox, QSizePolicy, QScrollArea, QFrame, QTabWidget,
    QTimeEdit,
)
from PySide6.QtCore import Qt, QTime

from models.domain import School
from services.school_service import SchoolService

if TYPE_CHECKING:
    from ui.main_window import MainWindow


def _parse_time_to_qtime(s: str) -> QTime:
    """Parse 'HH:MM' or 'H:MM' to QTime. Default 08:00 if invalid."""
    if not s or not isinstance(s, str):
        return QTime(8, 0)
    s = s.strip().replace(".", ":")
    parts = s.split(":")
    try:
        h = int(parts[0]) if parts else 0
        m = int(parts[1]) if len(parts) > 1 else 0
        return QTime(max(0, min(23, h)), max(0, min(59, m)))
    except (ValueError, IndexError):
        return QTime(8, 0)


class SchoolPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setMinimumWidth(400)
        content = QWidget()
        layout = QVBoxLayout(content)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("School Settings")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Configure your school's basic information and schedule structure.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        # Basic info
        info_group = QGroupBox("School Information")
        info_layout = QFormLayout(info_group)
        info_layout.setVerticalSpacing(10)
        info_layout.setContentsMargins(16, 20, 16, 20)

        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("Enter school name")
        name_label = QLabel('School Name <span style="color:#E74C3C;">*</span>')
        name_label.setTextFormat(Qt.TextFormat.RichText)
        info_layout.addRow(name_label, self.name_edit)

        self.year_edit = QLineEdit()
        self.year_edit.setPlaceholderText("e.g., 2025-2026")
        info_layout.addRow("Academic Year:", self.year_edit)

        layout.addWidget(info_group)

        # Schedule
        schedule_group = QGroupBox("Schedule Structure")
        sched_layout = QFormLayout(schedule_group)
        sched_layout.setVerticalSpacing(10)
        sched_layout.setContentsMargins(16, 20, 16, 20)

        self.days_spin = QSpinBox()
        self.days_spin.setRange(1, 7)
        self.days_spin.setValue(5)
        sched_layout.addRow("Working Days per Week:", self.days_spin)

        self.periods_spin = QSpinBox()
        self.periods_spin.setRange(1, 15)
        self.periods_spin.setValue(7)
        sched_layout.addRow("Periods per Day:", self.periods_spin)

        layout.addWidget(schedule_group)

        bell_group = QGroupBox("Bell Schedule — Period Timing")
        bell_group.setMinimumHeight(220)
        bell_layout = QFormLayout(bell_group)
        bell_layout.setVerticalSpacing(14)
        bell_layout.setContentsMargins(16, 20, 16, 20)
        bell_layout.setSpacing(10)

        self.period_minutes_spin = QSpinBox()
        self.period_minutes_spin.setRange(30, 90)
        self.period_minutes_spin.setValue(50)
        self.period_minutes_spin.setSuffix(" minutes")
        self.period_minutes_spin.setMinimumHeight(28)
        self.period_minutes_spin.setSizePolicy(
            self.period_minutes_spin.sizePolicy().horizontalPolicy(),
            QSizePolicy.Policy.Fixed,
        )
        bell_layout.addRow("Period duration (minutes):", self.period_minutes_spin)

        self.school_start_edit = QLineEdit()
        self.school_start_edit.setPlaceholderText("e.g. 08:00")
        self.school_start_edit.setMaxLength(5)
        self.school_start_edit.setMinimumHeight(28)
        bell_layout.addRow("School start time:", self.school_start_edit)

        self.first_period_edit = QLineEdit()
        self.first_period_edit.setPlaceholderText("e.g. 08:30")
        self.first_period_edit.setMaxLength(5)
        self.first_period_edit.setMinimumHeight(28)
        self.first_period_edit.setSizePolicy(
            self.first_period_edit.sizePolicy().horizontalPolicy(),
            QSizePolicy.Policy.Fixed,
        )
        bell_layout.addRow("First period start time:", self.first_period_edit)

        # Spacer so checkbox does not overlap the time field
        spacer = QWidget()
        spacer.setFixedHeight(12)
        spacer.setSizePolicy(spacer.sizePolicy().horizontalPolicy(), QSizePolicy.Policy.Fixed)
        bell_layout.addRow("", spacer)
        self.zero_period_check = QCheckBox(
            "Include zero period (class teacher time only: from school start to first period start)"
        )
        self.zero_period_check.setToolTip(
            "Zero period is not for regular subject teaching. It runs from school start time until first period start."
        )
        bell_layout.addRow("", self.zero_period_check)

        self.breaks_spin = QSpinBox()
        self.breaks_spin.setRange(0, 3)
        self.breaks_spin.setValue(0)
        self.breaks_spin.setMinimumHeight(28)
        self.breaks_spin.valueChanged.connect(self._update_breaks_ui)
        bell_layout.addRow("Number of breaks (0–3):", self.breaks_spin)
        self._break_edits: list[tuple] = []
        self._breaks_container = QWidget()
        self._breaks_layout = QFormLayout(self._breaks_container)
        bell_layout.addRow(self._breaks_container)

        bell_note = QLabel(
            "Lesson length in periods (single, double, etc.) is set per lesson in the Lessons tab."
        )
        bell_note.setWordWrap(True)
        bell_note.setStyleSheet("color:#666; font-size:11px; margin-top:8px;")
        bell_note.setMinimumHeight(bell_note.sizeHint().height() + 8)
        bell_layout.addRow(bell_note)
        layout.addWidget(bell_group)

        friday_group = QGroupBox("Friday — Different Schedule (Optional)")
        friday_layout = QFormLayout(friday_group)
        self.friday_different_check = QCheckBox("Friday has different timing")
        friday_layout.addRow("", self.friday_different_check)
        self.friday_first_edit = QLineEdit()
        self.friday_first_edit.setPlaceholderText("e.g. 08:30")
        self.friday_first_edit.setMaxLength(5)
        friday_layout.addRow("Friday first period start:", self.friday_first_edit)
        self.friday_period_minutes_spin = QSpinBox()
        self.friday_period_minutes_spin.setRange(30, 90)
        self.friday_period_minutes_spin.setValue(40)
        self.friday_period_minutes_spin.setSuffix(" minutes")
        friday_layout.addRow("Friday period duration:", self.friday_period_minutes_spin)
        self.friday_breaks_spin = QSpinBox()
        self.friday_breaks_spin.setRange(0, 3)
        self.friday_breaks_spin.setValue(0)
        self.friday_breaks_spin.valueChanged.connect(self._update_friday_breaks_ui)
        friday_layout.addRow("Friday breaks (0–3):", self.friday_breaks_spin)
        self._friday_break_edits = []
        self._friday_breaks_container = QWidget()
        self._friday_breaks_layout = QFormLayout(self._friday_breaks_container)
        friday_layout.addRow(self._friday_breaks_container)
        layout.addWidget(friday_group)

        # Weekend days
        weekend_group = QGroupBox("Weekend Days")
        weekend_layout = QHBoxLayout(weekend_group)
        weekend_layout.setSpacing(16)
        weekend_layout.setContentsMargins(16, 20, 16, 20)
        self.day_checks: list[QCheckBox] = []
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for i, name in enumerate(day_names):
            cb = QCheckBox(name)
            if i >= 5:
                cb.setChecked(True)
            self.day_checks.append(cb)
            weekend_layout.addWidget(cb)
        layout.addWidget(weekend_group)

        # Save button
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        save_btn = QPushButton("Save Settings")
        save_btn.setProperty("primary", True)
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)

        next_btn = QPushButton("Next: Subjects")
        next_btn.clicked.connect(lambda: self.main_window.navigate_to(2))
        btn_layout.addWidget(next_btn)
        layout.addLayout(btn_layout)
        layout.addStretch()

        scroll.setWidget(content)
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.addWidget(scroll)

    def on_enter(self) -> None:
        if not self.main_window.db:
            return
        svc = SchoolService(self.main_window.db)
        school = svc.get_or_create()
        self.name_edit.setText(school.name)
        self.year_edit.setText(school.academic_year)
        self.days_spin.setValue(school.days_per_week)
        self.periods_spin.setValue(school.periods_per_day)

        try:
            bell = json.loads(school.bell_schedule_json or "{}")
            if isinstance(bell, dict):
                self.period_minutes_spin.setValue(bell.get("period_minutes", 50))
                self.school_start_edit.setText(bell.get("school_start", "08:00"))
                self.first_period_edit.setText(bell.get("first_start", "08:30"))
                self.zero_period_check.setChecked(bell.get("zero_period", False))
                bl = bell.get("breaks")
                if isinstance(bl, list) and len(bl) <= 3:
                    self.breaks_spin.setValue(len(bl))
                    self._update_breaks_ui()
                    for i, b in enumerate(bl):
                        if isinstance(b, dict) and i < len(self._break_edits):
                            self._break_edits[i][0].setText(b.get("name", "Break"))
                            self._break_edits[i][1].setTime(_parse_time_to_qtime(b.get("start", "11:00")))
                            self._break_edits[i][2].setTime(_parse_time_to_qtime(b.get("end", "11:30")))
                            ap = b.get("after_period", 3)
                            self._break_edits[i][3].setValue(min(max(1, ap), max(1, self.periods_spin.value() - 1)))
                else:
                    self.breaks_spin.setValue(0)
                    self._update_breaks_ui()
                fr = bell.get("friday")
                if isinstance(fr, dict):
                    self.friday_different_check.setChecked(True)
                    self.friday_first_edit.setText(fr.get("first_start", "08:30"))
                    self.friday_period_minutes_spin.setValue(int(fr.get("period_minutes", 40)))
                    fbl = fr.get("breaks")
                    if isinstance(fbl, list) and len(fbl) <= 3:
                        self.friday_breaks_spin.setValue(len(fbl))
                        self._update_friday_breaks_ui()
                        for i, b in enumerate(fbl):
                            if isinstance(b, dict) and i < len(self._friday_break_edits):
                                self._friday_break_edits[i][0].setText(b.get("name", "Break"))
                                self._friday_break_edits[i][1].setTime(_parse_time_to_qtime(b.get("start", "11:00")))
                                self._friday_break_edits[i][2].setTime(_parse_time_to_qtime(b.get("end", "11:30")))
                                self._friday_break_edits[i][3].setValue(min(max(1, b.get("after_period", 3)), max(1, self.periods_spin.value() - 1)))
                    else:
                        self.friday_breaks_spin.setValue(0)
                        self._update_friday_breaks_ui()
                else:
                    self.friday_different_check.setChecked(False)
                    self.friday_first_edit.setText("08:30")
                    self.friday_period_minutes_spin.setValue(40)
                    self.friday_breaks_spin.setValue(0)
                    self._update_friday_breaks_ui()
            else:
                self.period_minutes_spin.setValue(50)
                self.school_start_edit.setText("08:00")
                self.first_period_edit.setText("08:30")
                self.zero_period_check.setChecked(False)
                self.breaks_spin.setValue(0)
                self._update_breaks_ui()
                self.friday_different_check.setChecked(False)
                self.friday_first_edit.setText("08:30")
                self.friday_period_minutes_spin.setValue(40)
                self.friday_breaks_spin.setValue(0)
                self._update_friday_breaks_ui()
        except (json.JSONDecodeError, TypeError):
            self.period_minutes_spin.setValue(50)
            self.school_start_edit.setText("08:00")
            self.first_period_edit.setText("08:30")
            self.zero_period_check.setChecked(False)
            self.breaks_spin.setValue(0)
            self._update_breaks_ui()
            self.friday_different_check.setChecked(False)
            self.friday_first_edit.setText("08:30")
            self.friday_period_minutes_spin.setValue(40)
            self.friday_breaks_spin.setValue(0)
            self._update_friday_breaks_ui()

        weekend = set()
        if school.weekend_days:
            weekend = {int(d.strip()) for d in school.weekend_days.split(",") if d.strip()}
        for i, cb in enumerate(self.day_checks):
            cb.setChecked(i in weekend)

    def _update_breaks_ui(self) -> None:
        n = self.breaks_spin.value()
        while self._breaks_layout.count():
            child = self._breaks_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()
        self._break_edits.clear()
        for i in range(n):
            name_ed = QLineEdit()
            name_ed.setPlaceholderText("e.g. Break")
            start_ed = QTimeEdit()
            start_ed.setDisplayFormat("HH:mm")
            start_ed.setTime(QTime(11, 0))
            end_ed = QTimeEdit()
            end_ed.setDisplayFormat("HH:mm")
            end_ed.setTime(QTime(11, 30))
            after_spin = QSpinBox()
            after_spin.setRange(1, max(1, self.periods_spin.value() - 1))
            after_spin.setValue(min(3, max(1, self.periods_spin.value() - 1)))
            after_spin.setSuffix(" (after period)")
            self._breaks_layout.addRow(f"Break {i+1} name:", name_ed)
            self._breaks_layout.addRow(f"Break {i+1} start:", start_ed)
            self._breaks_layout.addRow(f"Break {i+1} end:", end_ed)
            self._breaks_layout.addRow(f"Break {i+1} after period:", after_spin)
            self._break_edits.append((name_ed, start_ed, end_ed, after_spin))

    def _update_friday_breaks_ui(self) -> None:
        n = self.friday_breaks_spin.value()
        while self._friday_breaks_layout.count():
            child = self._friday_breaks_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()
        self._friday_break_edits.clear()
        for i in range(n):
            name_ed = QLineEdit()
            name_ed.setPlaceholderText("e.g. Break")
            start_ed = QTimeEdit()
            start_ed.setDisplayFormat("HH:mm")
            start_ed.setTime(QTime(11, 0))
            end_ed = QTimeEdit()
            end_ed.setDisplayFormat("HH:mm")
            end_ed.setTime(QTime(11, 30))
            after_spin = QSpinBox()
            after_spin.setRange(1, max(1, self.periods_spin.value() - 1))
            after_spin.setValue(min(3, max(1, self.periods_spin.value() - 1)))
            self._friday_breaks_layout.addRow(f"Fri break {i+1} name:", name_ed)
            self._friday_breaks_layout.addRow(f"Fri break {i+1} start:", start_ed)
            self._friday_breaks_layout.addRow(f"Fri break {i+1} end:", end_ed)
            self._friday_breaks_layout.addRow(f"Fri break {i+1} after period:", after_spin)
            self._friday_break_edits.append((name_ed, start_ed, end_ed, after_spin))

    def _save(self) -> None:
        if not self.main_window.db:
            return
        name = self.name_edit.text().strip()
        if not name:
            QMessageBox.warning(
                self, "Required Field",
                "School name is required. Please enter a name for your school.",
            )
            self.name_edit.setFocus()
            return

        weekend_days = ",".join(
            str(i) for i, cb in enumerate(self.day_checks) if cb.isChecked()
        )

        school = School(
            name=name,
            academic_year=self.year_edit.text().strip(),
            days_per_week=self.days_spin.value(),
            periods_per_day=self.periods_spin.value(),
            weekend_days=weekend_days,
            bell_schedule_json=json.dumps({
                "period_minutes": self.period_minutes_spin.value(),
                "school_start": self.school_start_edit.text().strip() or "08:00",
                "first_start": self.first_period_edit.text().strip() or "08:30",
                "zero_period": self.zero_period_check.isChecked(),
                "breaks": [{"name": (a.text().strip() or "Break"), "start": b.time().toString("HH:mm"), "end": c.time().toString("HH:mm"), "after_period": d.value()} for a, b, c, d in self._break_edits],
                **({"friday": {"first_start": self.friday_first_edit.text().strip() or "08:30", "period_minutes": self.friday_period_minutes_spin.value(), "breaks": [{"name": (a.text().strip() or "Break"), "start": b.time().toString("HH:mm"), "end": c.time().toString("HH:mm"), "after_period": d.value()} for a, b, c, d in self._friday_break_edits]}} if self.friday_different_check.isChecked() else {}),
            }),
        )

        svc = SchoolService(self.main_window.db)
        svc.save_school(school)
        QMessageBox.information(self, "Saved", "School settings saved.")
