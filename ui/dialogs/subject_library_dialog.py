"""Dialog to import subjects from the default library (checkbox selection)."""
from __future__ import annotations
from typing import Optional, Set, TYPE_CHECKING

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QDialogButtonBox, QScrollArea, QWidget, QCheckBox, QFrame,
    QMessageBox,
)
from PySide6.QtCore import Qt

from utils.helpers import DEFAULT_SUBJECTS
from models.domain import Subject

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


class SubjectLibraryDialog(QDialog):
    """Select subjects from the default library to add to the project."""

    def __init__(
        self,
        parent=None,
        db: Optional["DatabaseConnection"] = None,
        *,
        existing_codes: Optional[Set[str]] = None,
        existing_names: Optional[Set[str]] = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Import from Subject Library")
        self.setMinimumWidth(420)
        self.setMinimumHeight(400)
        self.db = db
        self._existing_codes = existing_codes or set()
        self._existing_names = existing_names or set()
        self._checkboxes: list[QCheckBox] = []
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)

        info = QLabel(
            "Select subjects to add to your project. You can edit names and codes after import."
        )
        info.setWordWrap(True)
        info.setStyleSheet("color:#555; margin-bottom:8px;")
        layout.addWidget(info)

        # Select all / none
        btn_row = QHBoxLayout()
        select_all_btn = QPushButton("Select All")
        select_all_btn.clicked.connect(self._select_all)
        btn_row.addWidget(select_all_btn)
        select_none_btn = QPushButton("Deselect All")
        select_none_btn.clicked.connect(self._deselect_all)
        btn_row.addWidget(select_none_btn)
        btn_row.addStretch()
        layout.addLayout(btn_row)

        # Scroll area with checkboxes
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        content = QWidget()
        vbox = QVBoxLayout(content)
        for name, code, category, color in DEFAULT_SUBJECTS:
            code_key = code.strip().upper() if code else ""
            name_key = name.strip().lower() if name else ""
            already_added = (
                (code_key and code_key in self._existing_codes)
                or (name_key and name_key in self._existing_names)
            )
            label_text = f"{name} ({code}) — {category}"
            if already_added:
                label_text += " — Already added"
            cb = QCheckBox(label_text)
            cb.setProperty("subject_data", (name, code, category, color))
            cb.setProperty("already_added", already_added)
            if already_added:
                cb.setEnabled(False)
                cb.setChecked(False)
                cb.setStyleSheet("color: #888;")
                cb.setToolTip("This subject is already in your project.")
            self._checkboxes.append(cb)
            vbox.addWidget(cb)
        vbox.addStretch()
        scroll.setWidget(content)
        layout.addWidget(scroll)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _select_all(self) -> None:
        for cb in self._checkboxes:
            if not cb.property("already_added"):
                cb.setChecked(True)

    def _deselect_all(self) -> None:
        for cb in self._checkboxes:
            cb.setChecked(False)

    def _on_accept(self) -> None:
        if not self.get_selected():
            QMessageBox.warning(
                self, "No Selection",
                "Select at least one subject to import.",
            )
            return
        self.accept()

    def get_selected(self) -> list[Subject]:
        """Return Subject instances for each checked item (excluding already-added)."""
        result = []
        for cb in self._checkboxes:
            if cb.isChecked() and not cb.property("already_added"):
                data = cb.property("subject_data")
                if data:
                    name, code, category, color = data
                    result.append(Subject(
                        name=name, code=code, category=category, color=color,
                        max_per_day=2, double_allowed=False, preferred_room_type="",
                    ))
        return result
