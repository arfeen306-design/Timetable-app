"""Dialog for creating/editing a Subject."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QLineEdit, QComboBox,
    QSpinBox, QCheckBox, QDialogButtonBox, QLabel, QMessageBox,
)
from PySide6.QtCore import Qt

from models.domain import Subject
from ui.widgets.color_button import ColorButton
from utils.helpers import SUBJECT_CATEGORIES, ROOM_TYPES, SUBJECT_COLORS

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


def _req(text: str) -> QLabel:
    """Label with red asterisk for required fields."""
    return QLabel(f'{text} <span style="color:#E74C3C;">*</span>')


class SubjectDialog(QDialog):
    def __init__(
        self, parent=None, db: Optional["DatabaseConnection"] = None,
        subject: Optional[Subject] = None,
    ) -> None:
        super().__init__(parent)
        self.db = db
        self._subject = subject
        self.setWindowTitle("Edit Subject" if subject else "New Subject")
        self.setMinimumWidth(400)
        self._build_ui()
        if subject:
            self._load(subject)

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("e.g., Mathematics")
        form.addRow(_req("Name:"), self.name_edit)

        self.code_edit = QLineEdit()
        self.code_edit.setPlaceholderText("e.g., MAT (auto-generated if empty)")
        self.code_edit.setMaxLength(6)
        form.addRow("Code:", self.code_edit)

        self.category_combo = QComboBox()
        self.category_combo.addItems(SUBJECT_CATEGORIES)
        form.addRow("Category:", self.category_combo)

        self.color_btn = ColorButton(SUBJECT_COLORS[0])
        form.addRow("Color:", self.color_btn)

        self.max_per_day_spin = QSpinBox()
        self.max_per_day_spin.setRange(1, 10)
        self.max_per_day_spin.setValue(2)
        form.addRow("Max Periods/Day:", self.max_per_day_spin)

        self.double_check = QCheckBox("Allow double periods")
        form.addRow("", self.double_check)

        self.pref_room_combo = QComboBox()
        self.pref_room_combo.addItem("(Any)")
        self.pref_room_combo.addItems(ROOM_TYPES)
        form.addRow("Preferred Room Type:", self.pref_room_combo)

        layout.addLayout(form)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _load(self, s: Subject) -> None:
        self.name_edit.setText(s.name)
        self.code_edit.setText(s.code)
        idx = self.category_combo.findText(s.category)
        if idx >= 0:
            self.category_combo.setCurrentIndex(idx)
        self.color_btn.color = s.color
        self.max_per_day_spin.setValue(s.max_per_day)
        self.double_check.setChecked(s.double_allowed)
        if s.preferred_room_type:
            idx = self.pref_room_combo.findText(s.preferred_room_type)
            if idx >= 0:
                self.pref_room_combo.setCurrentIndex(idx)

    def _on_accept(self) -> None:
        if not self.name_edit.text().strip():
            QMessageBox.warning(self, "Missing Data", "Subject name is required.")
            self.name_edit.setFocus()
            return
        if self.db:
            from services.subject_service import SubjectService
            name = self.name_edit.text().strip()
            code = self.code_edit.text().strip() or name[:3].upper()
            svc = SubjectService(self.db)
            exclude_id = self._subject.id if self._subject else None
            if svc.repo.get_by_name(name, exclude_id=exclude_id):
                QMessageBox.warning(
                    self, "Duplicate Subject",
                    "A subject with this name already exists. Please use a different name or edit the existing subject.",
                )
                self.name_edit.setFocus()
                return
            if svc.repo.get_by_code(code, exclude_id=exclude_id):
                QMessageBox.warning(
                    self, "Duplicate Subject",
                    "A subject with this code already exists. Please use a different code or edit the existing subject.",
                )
                self.code_edit.setFocus()
                return
        self.accept()

    def get_subject(self) -> Subject:
        pref_room = self.pref_room_combo.currentText()
        if pref_room == "(Any)":
            pref_room = ""
        return Subject(
            name=self.name_edit.text().strip(),
            code=self.code_edit.text().strip() or self.name_edit.text()[:3].upper(),
            color=self.color_btn.color,
            category=self.category_combo.currentText(),
            max_per_day=self.max_per_day_spin.value(),
            double_allowed=self.double_check.isChecked(),
            preferred_room_type=pref_room,
        )
