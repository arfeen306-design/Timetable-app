"""Dialog for creating/editing a Teacher."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QLineEdit, QComboBox,
    QSpinBox, QDialogButtonBox, QLabel, QMessageBox,
)
from PySide6.QtCore import Qt

from models.domain import Teacher
from ui.widgets.color_button import ColorButton
from utils.helpers import TEACHER_TITLES

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


def _req(text: str) -> QLabel:
    """Label with red asterisk for required fields."""
    return QLabel(f'{text} <span style="color:#E74C3C;">*</span>')


class TeacherDialog(QDialog):
    def __init__(
        self, parent=None, db: Optional["DatabaseConnection"] = None,
        teacher: Optional[Teacher] = None,
    ) -> None:
        super().__init__(parent)
        self.db = db
        self._edit_id: Optional[int] = teacher.id if teacher else None
        self.setWindowTitle("Edit Teacher" if teacher else "New Teacher")
        self.setMinimumWidth(400)
        self._build_ui()
        if teacher:
            self._load(teacher)

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self.title_combo = QComboBox()
        self.title_combo.addItems(TEACHER_TITLES)
        form.addRow("Title:", self.title_combo)

        self.first_name_edit = QLineEdit()
        self.first_name_edit.setPlaceholderText("First name")
        form.addRow(_req("First Name:"), self.first_name_edit)

        self.last_name_edit = QLineEdit()
        self.last_name_edit.setPlaceholderText("Last name")
        form.addRow("Last Name:", self.last_name_edit)

        self.code_edit = QLineEdit()
        self.code_edit.setPlaceholderText("e.g., ZAI")
        self.code_edit.setMaxLength(6)
        form.addRow("Code:", self.code_edit)

        self.email_edit = QLineEdit()
        self.email_edit.setPlaceholderText("e.g., teacher@school.edu")
        form.addRow("Email:", self.email_edit)

        self.whatsapp_edit = QLineEdit()
        self.whatsapp_edit.setPlaceholderText("e.g., +1234567890")
        form.addRow("WhatsApp:", self.whatsapp_edit)

        self.color_btn = ColorButton("#E8725A")
        form.addRow("Color:", self.color_btn)

        self.max_day_spin = QSpinBox()
        self.max_day_spin.setRange(1, 15)
        self.max_day_spin.setValue(6)
        form.addRow("Max Periods/Day:", self.max_day_spin)

        self.max_week_spin = QSpinBox()
        self.max_week_spin.setRange(1, 60)
        self.max_week_spin.setValue(30)
        form.addRow("Max Periods/Week:", self.max_week_spin)

        layout.addLayout(form)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _load(self, t: Teacher) -> None:
        idx = self.title_combo.findText(t.title)
        if idx >= 0:
            self.title_combo.setCurrentIndex(idx)
        self.first_name_edit.setText(t.first_name)
        self.last_name_edit.setText(t.last_name)
        self.code_edit.setText(t.code)
        self.email_edit.setText(t.email or "")
        self.whatsapp_edit.setText(t.whatsapp_number or "")
        self.color_btn.color = t.color
        self.max_day_spin.setValue(t.max_periods_day)
        self.max_week_spin.setValue(t.max_periods_week)

    def _on_accept(self) -> None:
        if not self.first_name_edit.text().strip():
            QMessageBox.warning(self, "Missing Data", "First name is required.")
            self.first_name_edit.setFocus()
            return
        if self.db:
            from services.teacher_service import TeacherService
            first = self.first_name_edit.text().strip()
            last = self.last_name_edit.text().strip()
            svc = TeacherService(self.db)
            if svc.repo.get_by_first_last(first, last, exclude_id=self._edit_id):
                QMessageBox.warning(
                    self, "Duplicate Teacher",
                    "A teacher with this first and last name already exists. "
                    "Please use a different name or edit the existing teacher.",
                )
                self.first_name_edit.setFocus()
                return
        self.accept()

    def get_teacher(self) -> Teacher:
        first = self.first_name_edit.text().strip()
        last = self.last_name_edit.text().strip()
        return Teacher(
            id=self._edit_id,
            first_name=first,
            last_name=last,
            code=self.code_edit.text().strip() or f"{first[:1]}{last[:2]}".upper(),
            title=self.title_combo.currentText(),
            color=self.color_btn.color,
            max_periods_day=self.max_day_spin.value(),
            max_periods_week=self.max_week_spin.value(),
            email=self.email_edit.text().strip(),
            whatsapp_number=self.whatsapp_edit.text().strip(),
        )
