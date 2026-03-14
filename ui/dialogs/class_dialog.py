"""Dialog for creating/editing a SchoolClass."""
from __future__ import annotations
from typing import Optional

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QLineEdit, QComboBox,
    QSpinBox, QDialogButtonBox, QLabel, QMessageBox,
)
from PySide6.QtCore import Qt

from models.domain import SchoolClass
from services.teacher_service import TeacherService
from services.room_service import RoomService
from ui.widgets.color_button import ColorButton
from ui.widgets.searchable_combo import make_searchable
from utils.helpers import CLASS_COLORS
from utils.display_utils import teacher_display_label
from database.connection import DatabaseConnection


def _req(text: str) -> QLabel:
    """Label with red asterisk for required fields."""
    return QLabel(f'{text} <span style="color:#E74C3C;">*</span>')


class ClassDialog(QDialog):
    def __init__(
        self, parent=None, db: Optional[DatabaseConnection] = None,
        school_class: Optional[SchoolClass] = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Edit Class" if school_class else "New Class")
        self.setMinimumWidth(420)
        self.db = db
        self._edit_id = school_class.id if school_class else None
        self._build_ui()
        if school_class:
            self._load(school_class)

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self.grade_edit = QLineEdit()
        self.grade_edit.setPlaceholderText("e.g., 9, 10, 11")
        form.addRow(_req("Grade:"), self.grade_edit)

        self.section_edit = QLineEdit()
        self.section_edit.setPlaceholderText("e.g., A, B, Science")
        form.addRow("Section:", self.section_edit)

        self.stream_edit = QLineEdit()
        self.stream_edit.setPlaceholderText("e.g., Science, Commerce")
        form.addRow("Stream:", self.stream_edit)

        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("e.g., Grade 9 Science")
        form.addRow("Display Name:", self.name_edit)

        self.code_edit = QLineEdit()
        self.code_edit.setPlaceholderText("e.g., 9-SCI")
        self.code_edit.setMaxLength(10)
        form.addRow("Code:", self.code_edit)

        self.color_btn = ColorButton(CLASS_COLORS[0])
        form.addRow("Color:", self.color_btn)

        self.strength_spin = QSpinBox()
        self.strength_spin.setRange(1, 200)
        self.strength_spin.setValue(30)
        form.addRow("Student Strength:", self.strength_spin)

        self.teacher_combo = QComboBox()
        self.teacher_combo.addItem("(None)", None)
        if self.db:
            svc = TeacherService(self.db)
            for t in svc.get_all():
                self.teacher_combo.addItem(teacher_display_label(t), t.id)
        make_searchable(self.teacher_combo)
        form.addRow("Class Teacher:", self.teacher_combo)

        self.room_combo = QComboBox()
        self.room_combo.addItem("(None)", None)
        if self.db:
            svc = RoomService(self.db)
            for r in svc.get_all():
                self.room_combo.addItem(r.name, r.id)
        make_searchable(self.room_combo)
        form.addRow("Home Room:", self.room_combo)

        layout.addLayout(form)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

        # Auto-fill name when grade/section change
        self.grade_edit.textChanged.connect(self._auto_name)
        self.section_edit.textChanged.connect(self._auto_name)

    def _auto_name(self) -> None:
        if not self.name_edit.isModified():
            grade = self.grade_edit.text().strip()
            section = self.section_edit.text().strip()
            name = f"Grade {grade}"
            if section:
                name += f" {section}"
            self.name_edit.setText(name)

    def _load(self, c: SchoolClass) -> None:
        self.grade_edit.setText(c.grade)
        self.section_edit.setText(c.section)
        self.stream_edit.setText(c.stream)
        self.name_edit.setText(c.name)
        self.name_edit.setModified(True)
        self.code_edit.setText(c.code)
        self.color_btn.color = c.color
        self.strength_spin.setValue(c.strength)

        if c.class_teacher_id:
            idx = self.teacher_combo.findData(c.class_teacher_id)
            if idx >= 0:
                self.teacher_combo.setCurrentIndex(idx)
        if c.home_room_id:
            idx = self.room_combo.findData(c.home_room_id)
            if idx >= 0:
                self.room_combo.setCurrentIndex(idx)

    def _on_accept(self) -> None:
        if not self.grade_edit.text().strip():
            QMessageBox.warning(self, "Missing Data", "Grade is required.")
            self.grade_edit.setFocus()
            return
        if self.db:
            from services.class_service import ClassService
            grade = self.grade_edit.text().strip()
            section = self.section_edit.text().strip()
            stream = self.stream_edit.text().strip()
            svc = ClassService(self.db)
            if svc.repo.get_by_grade_section_stream(
                grade, section, stream, exclude_id=self._edit_id
            ):
                QMessageBox.warning(
                    self, "Duplicate Class",
                    "A class with this grade, section, and stream already exists. "
                    "Please use different values or edit the existing class.",
                )
                self.grade_edit.setFocus()
                return
        self.accept()

    def get_class(self) -> SchoolClass:
        grade = self.grade_edit.text().strip()
        section = self.section_edit.text().strip()
        return SchoolClass(
            grade=grade,
            section=section,
            stream=self.stream_edit.text().strip(),
            name=self.name_edit.text().strip() or f"Grade {grade} {section}".strip(),
            code=self.code_edit.text().strip(),
            color=self.color_btn.color,
            class_teacher_id=self.teacher_combo.currentData(),
            home_room_id=self.room_combo.currentData(),
            strength=self.strength_spin.value(),
        )
