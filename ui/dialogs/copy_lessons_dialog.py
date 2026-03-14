"""Copy lesson assignments from one class to another (or multiple target classes)."""
from __future__ import annotations
from typing import Optional, TYPE_CHECKING

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout, QComboBox, QLabel,
    QDialogButtonBox, QMessageBox, QListWidget, QListWidgetItem,
    QAbstractItemView, QLineEdit, QPushButton,
)
from PySide6.QtCore import Qt

from services.class_service import ClassService
from services.lesson_service import LessonService
from database.connection import DatabaseConnection
from ui.widgets.searchable_combo import make_searchable
from utils.display_utils import class_display_label, class_search_text
from utils.session_state import get_filter, set_filter

if TYPE_CHECKING:
    pass


def _req(text: str) -> QLabel:
    return QLabel(f'{text} <span style="color:#E74C3C;">*</span>')


class CopyLessonsDialog(QDialog):
    """Copy all lesson mappings from a source class to one or more target classes."""

    def __init__(self, parent=None, db: Optional[DatabaseConnection] = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Copy Lessons from Class")
        self.setMinimumWidth(450)
        self.setMinimumHeight(380)
        self.db = db
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)

        info = QLabel(
            "Copy all lesson assignments (teacher, subject, periods per week, etc.) "
            "from one class to other classes. Target classes will receive the same structure."
        )
        info.setWordWrap(True)
        info.setStyleSheet("color:#555; margin-bottom:8px;")
        layout.addWidget(info)

        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self.source_combo = QComboBox()
        self.source_combo.setMaxVisibleItems(15)
        if self.db:
            for c in ClassService(self.db).get_all():
                self.source_combo.addItem(class_display_label(c), c.id)
        make_searchable(self.source_combo)
        form.addRow(_req("Copy from class:"), self.source_combo)

        layout.addLayout(form)

        target_label = QLabel("To classes (select one or more):")
        target_label.setStyleSheet("font-weight:bold;")
        layout.addWidget(target_label)
        filter_row = QHBoxLayout()
        filter_row.addWidget(QLabel("Filter:"))
        self.target_filter_edit = QLineEdit()
        self.target_filter_edit.setPlaceholderText("Type to filter by grade, section, stream, code...")
        self.target_filter_edit.setClearButtonEnabled(True)
        self.target_filter_edit.textChanged.connect(self._filter_target_list)
        self.target_filter_edit.textChanged.connect(
            lambda t: set_filter("copy_target_filter", t)
        )
        filter_row.addWidget(self.target_filter_edit)
        layout.addLayout(filter_row)
        sel_row = QHBoxLayout()
        sel_visible_btn = QLabel('<a href="#" style="color:#4A90D9;">Select visible only</a>')
        sel_visible_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        sel_visible_btn.linkActivated.connect(self._select_visible_only)
        sel_row.addWidget(sel_visible_btn)
        clear_visible_btn = QLabel('<a href="#" style="color:#E74C3C;">Clear visible only</a>')
        clear_visible_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        clear_visible_btn.linkActivated.connect(self._clear_visible_only)
        sel_row.addWidget(clear_visible_btn)
        sel_row.addStretch()
        layout.addLayout(sel_row)
        same_grade_btn = QPushButton("Copy to other classes in same grade")
        same_grade_btn.setToolTip("Filter by source class grade and select all visible targets")
        same_grade_btn.clicked.connect(self._copy_to_same_grade)
        layout.addWidget(same_grade_btn)
        self.target_list = QListWidget()
        self.target_list.setSelectionMode(QAbstractItemView.SelectionMode.MultiSelection)
        self.target_list.setMinimumHeight(120)
        if self.db:
            for c in ClassService(self.db).get_all():
                item = QListWidgetItem(class_display_label(c))
                item.setData(Qt.ItemDataRole.UserRole, c.id)
                item.setData(Qt.ItemDataRole.UserRole + 1, class_search_text(c))
                self.target_list.addItem(item)
        layout.addWidget(self.target_list)

        # Remembered filter
        saved = get_filter("copy_target_filter")
        if saved:
            self.target_filter_edit.blockSignals(True)
            self.target_filter_edit.setText(saved)
            self.target_filter_edit.blockSignals(False)
            self._filter_target_list(saved)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _filter_target_list(self, text: str) -> None:
        """Show only list items whose class search text contains the filter (case-insensitive)."""
        needle = (text or "").strip().lower()
        for i in range(self.target_list.count()):
            item = self.target_list.item(i)
            if item is None:
                continue
            search_text = (item.data(Qt.ItemDataRole.UserRole + 1) or "").lower()
            item.setHidden(needle not in search_text)

    def _select_visible_only(self) -> None:
        """Select only currently visible (non-hidden) target items."""
        for i in range(self.target_list.count()):
            item = self.target_list.item(i)
            if item and not item.isHidden():
                item.setSelected(True)

    def _clear_visible_only(self) -> None:
        """Deselect only currently visible target items."""
        for i in range(self.target_list.count()):
            item = self.target_list.item(i)
            if item and not item.isHidden():
                item.setSelected(False)

    def _copy_to_same_grade(self) -> None:
        """Filter target list by source class grade and select all visible (for copy to same grade)."""
        if not self.db:
            return
        source_id = self.source_combo.currentData()
        if not source_id:
            QMessageBox.information(
                self, "Select Source",
                "Select a source class first.",
            )
            return
        svc = ClassService(self.db)
        source_class = svc.get_by_id(source_id)
        if not source_class:
            return
        grade = (source_class.grade or "").strip()
        if not grade:
            QMessageBox.information(
                self, "No Grade",
                "Source class has no grade set.",
            )
            return
        self.target_filter_edit.blockSignals(True)
        self.target_filter_edit.setText(grade)
        self.target_filter_edit.blockSignals(False)
        set_filter("copy_target_filter", grade)
        self._filter_target_list(grade)
        self._select_visible_only()

    def _on_accept(self) -> None:
        if self.source_combo.count() == 0:
            QMessageBox.warning(self, "Missing Data", "Add classes first.")
            return
        source_id = self.source_combo.currentData()
        target_ids = []
        for i in range(self.target_list.count()):
            item = self.target_list.item(i)
            if item.isSelected():
                tid = item.data(Qt.ItemDataRole.UserRole)
                if tid and tid != source_id:
                    target_ids.append(tid)
        if not target_ids:
            QMessageBox.warning(
                self, "No Target",
                "Select at least one different class to copy to.",
            )
            return
        self.accept()

    def copy_lessons(self) -> int:
        """Perform the copy. Returns number of lessons created."""
        if not self.db:
            return 0
        source_id = self.source_combo.currentData()
        target_ids = []
        for i in range(self.target_list.count()):
            item = self.target_list.item(i)
            if item.isSelected():
                tid = item.data(Qt.ItemDataRole.UserRole)
                if tid and tid != source_id:
                    target_ids.append(tid)

        lesson_svc = LessonService(self.db)
        all_lessons = lesson_svc.get_all()
        source_lessons = [l for l in all_lessons if l.class_id == source_id]
        count = 0
        for target_id in target_ids:
            for l in source_lessons:
                from models.domain import Lesson
                new_lesson = Lesson(
                    teacher_id=l.teacher_id,
                    subject_id=l.subject_id,
                    class_id=target_id,
                    group_id=l.group_id,
                    periods_per_week=l.periods_per_week,
                    duration=l.duration,
                    priority=l.priority,
                    locked=False,
                    preferred_room_id=l.preferred_room_id,
                    notes=l.notes or "",
                )
                lesson_svc.create(new_lesson)
                count += 1
        return count
