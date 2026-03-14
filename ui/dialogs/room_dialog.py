"""Dialog for creating/editing a Room."""
from __future__ import annotations
from typing import Optional

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QLineEdit, QComboBox,
    QSpinBox, QDialogButtonBox, QLabel, QMessageBox,
)
from PySide6.QtCore import Qt

from models.domain import Room
from ui.widgets.color_button import ColorButton
from utils.helpers import ROOM_TYPES


def _req(text: str) -> QLabel:
    """Label with red asterisk for required fields."""
    return QLabel(f'{text} <span style="color:#E74C3C;">*</span>')


class RoomDialog(QDialog):
    def __init__(self, parent=None, room: Optional[Room] = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Edit Room" if room else "New Room")
        self.setMinimumWidth(380)
        self._build_ui()
        if room:
            self._load(room)

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("e.g., Room 101")
        form.addRow(_req("Name:"), self.name_edit)

        self.code_edit = QLineEdit()
        self.code_edit.setPlaceholderText("e.g., R101")
        self.code_edit.setMaxLength(8)
        form.addRow("Code:", self.code_edit)

        self.type_combo = QComboBox()
        self.type_combo.addItems(ROOM_TYPES)
        form.addRow("Room Type:", self.type_combo)

        self.capacity_spin = QSpinBox()
        self.capacity_spin.setRange(1, 500)
        self.capacity_spin.setValue(40)
        form.addRow("Capacity:", self.capacity_spin)

        self.color_btn = ColorButton("#9B59B6")
        form.addRow("Color:", self.color_btn)

        layout.addLayout(form)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _load(self, r: Room) -> None:
        self.name_edit.setText(r.name)
        self.code_edit.setText(r.code)
        idx = self.type_combo.findText(r.room_type)
        if idx >= 0:
            self.type_combo.setCurrentIndex(idx)
        self.capacity_spin.setValue(r.capacity)
        self.color_btn.color = r.color

    def _on_accept(self) -> None:
        if not self.name_edit.text().strip():
            QMessageBox.warning(self, "Missing Data", "Room name is required.")
            self.name_edit.setFocus()
            return
        self.accept()

    def get_room(self) -> Room:
        return Room(
            name=self.name_edit.text().strip(),
            code=self.code_edit.text().strip() or self.name_edit.text()[:4].upper(),
            room_type=self.type_combo.currentText(),
            capacity=self.capacity_spin.value(),
            color=self.color_btn.color,
        )
