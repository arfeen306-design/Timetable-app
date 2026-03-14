"""Dialog for assigning one teacher + one subject to multiple classes at once."""
from __future__ import annotations
from typing import Optional

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout, QComboBox, QSpinBox,
    QDialogButtonBox, QLabel, QMessageBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QCheckBox, QAbstractItemView, QGroupBox, QLineEdit,
)
from PySide6.QtCore import Qt

from models.domain import Lesson
from services.teacher_service import TeacherService
from services.subject_service import SubjectService
from services.class_service import ClassService
from services.lesson_service import LessonService
from database.connection import DatabaseConnection
from ui.widgets.searchable_combo import make_searchable
from utils.display_utils import (
    teacher_display_label,
    subject_display_label,
    class_display_label,
    class_search_text,
)
from utils.session_state import get_filter, set_filter, ordered_teacher_ids, ordered_subject_ids


def _req(text: str) -> QLabel:
    return QLabel(f'{text} <span style="color:#E74C3C;">*</span>')


class BulkLessonDialog(QDialog):
    """Assign one teacher teaching one subject to multiple classes at once."""

    def __init__(self, parent=None, db: Optional[DatabaseConnection] = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Bulk Assign Lessons")
        self.setMinimumSize(720, 560)
        self.resize(760, 620)
        self.db = db
        self._classes = []
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)

        info = QLabel(
            "Assign one teacher and one subject to multiple classes at once.\n"
            "Check the classes you want, set periods/week for each."
        )
        info.setStyleSheet("color:#555; margin-bottom:8px;")
        info.setWordWrap(True)
        layout.addWidget(info)

        # Teacher + Subject selection
        top_form = QFormLayout()
        top_form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self.teacher_combo = QComboBox()
        self.teacher_combo.setMaxVisibleItems(20)
        if self.db:
            teachers = TeacherService(self.db).get_all()
            by_id = {t.id: t for t in teachers}
            for tid in ordered_teacher_ids(teachers):
                t = by_id.get(tid)
                if t:
                    self.teacher_combo.addItem(teacher_display_label(t), t.id)
        make_searchable(self.teacher_combo)
        top_form.addRow(_req("Teacher:"), self.teacher_combo)

        self.subject_combo = QComboBox()
        self.subject_combo.setMaxVisibleItems(20)
        if self.db:
            subjects = SubjectService(self.db).get_all()
            by_id = {s.id: s for s in subjects}
            for sid in ordered_subject_ids(subjects):
                s = by_id.get(sid)
                if s:
                    self.subject_combo.addItem(subject_display_label(s), s.id)
        make_searchable(self.subject_combo)
        top_form.addRow(_req("Subject:"), self.subject_combo)

        self.default_ppw_spin = QSpinBox()
        self.default_ppw_spin.setRange(1, 20)
        self.default_ppw_spin.setValue(3)
        self.default_ppw_spin.setToolTip("Default periods/week for newly checked classes")
        top_form.addRow("Default Periods/Week:", self.default_ppw_spin)

        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(1, 8)
        self.duration_spin.setValue(1)
        self.duration_spin.setToolTip("Lesson length in periods (1 = single, 2 = double period)")
        top_form.addRow("Lesson length (periods):", self.duration_spin)

        layout.addLayout(top_form)

        # Classes table with checkboxes and per-class periods/week
        classes_group = QGroupBox("Select Classes")
        classes_layout = QVBoxLayout(classes_group)

        # Filter classes (live search)
        filter_row = QHBoxLayout()
        filter_row.addWidget(QLabel("Filter:"))
        self.class_filter_edit = QLineEdit()
        self.class_filter_edit.setPlaceholderText("Type to filter by grade, section, stream, code...")
        self.class_filter_edit.setClearButtonEnabled(True)
        self.class_filter_edit.textChanged.connect(self._filter_class_table)
        self.class_filter_edit.textChanged.connect(
            lambda t: set_filter("bulk_class_filter", t)
        )
        filter_row.addWidget(self.class_filter_edit)
        classes_layout.addLayout(filter_row)

        # Select all / none buttons
        sel_row = QHBoxLayout()
        sel_visible_btn = QLabel('<a href="#" style="color:#4A90D9;">Select visible only</a>')
        sel_visible_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        sel_visible_btn.linkActivated.connect(self._select_all)
        sel_row.addWidget(sel_visible_btn)
        clear_visible_btn = QLabel('<a href="#" style="color:#E74C3C;">Clear visible only</a>')
        clear_visible_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        clear_visible_btn.linkActivated.connect(self._clear_visible_only)
        sel_row.addWidget(clear_visible_btn)
        sel_all_btn = QLabel('<a href="#" style="color:#666;">Select all</a>')
        sel_all_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        sel_all_btn.linkActivated.connect(self._select_all_rows)
        sel_row.addWidget(sel_all_btn)
        sel_none_btn = QLabel('<a href="#" style="color:#666;">Deselect all</a>')
        sel_none_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        sel_none_btn.linkActivated.connect(self._deselect_all)
        sel_row.addWidget(sel_none_btn)
        sel_row.addStretch()
        classes_layout.addLayout(sel_row)

        self.class_table = QTableWidget()
        self.class_table.setColumnCount(3)
        self.class_table.setHorizontalHeaderLabels(["Assign", "Class", "Periods / Week"])
        self.class_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        self.class_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.class_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.class_table.setColumnWidth(0, 56)
        self.class_table.setColumnWidth(2, 110)
        self.class_table.setMinimumHeight(220)
        self.class_table.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
        self.class_table.verticalHeader().setVisible(False)

        if self.db:
            self._classes = ClassService(self.db).get_all()
            self.class_table.setRowCount(len(self._classes))
            for row, cls in enumerate(self._classes):
                # Checkbox
                cb = QCheckBox()
                self.class_table.setCellWidget(row, 0, cb)
                # Class name (display label for consistency and search)
                name_item = QTableWidgetItem(class_display_label(cls))
                name_item.setFlags(name_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                name_item.setData(Qt.ItemDataRole.UserRole, cls.id)
                name_item.setData(Qt.ItemDataRole.UserRole + 1, class_search_text(cls))  # search text for filter
                self.class_table.setItem(row, 1, name_item)
                # Periods/week spinner
                spin = QSpinBox()
                spin.setRange(1, 20)
                spin.setValue(3)
                self.class_table.setCellWidget(row, 2, spin)

        classes_layout.addWidget(self.class_table)
        layout.addWidget(classes_group)

        # Remembered filter: restore after build
        saved = get_filter("bulk_class_filter")
        if saved:
            self.class_filter_edit.blockSignals(True)
            self.class_filter_edit.setText(saved)
            self.class_filter_edit.blockSignals(False)
            self._filter_class_table(saved)

        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _select_all(self) -> None:
        """Select only currently visible rows."""
        for row in range(self.class_table.rowCount()):
            if self.class_table.isRowHidden(row):
                continue
            cb = self.class_table.cellWidget(row, 0)
            if cb:
                cb.setChecked(True)

    def _clear_visible_only(self) -> None:
        """Clear only currently visible rows."""
        for row in range(self.class_table.rowCount()):
            if self.class_table.isRowHidden(row):
                continue
            cb = self.class_table.cellWidget(row, 0)
            if cb:
                cb.setChecked(False)

    def _select_all_rows(self) -> None:
        """Select all rows (including hidden)."""
        for row in range(self.class_table.rowCount()):
            cb = self.class_table.cellWidget(row, 0)
            if cb:
                cb.setChecked(True)

    def _deselect_all(self) -> None:
        """Deselect all rows."""
        for row in range(self.class_table.rowCount()):
            cb = self.class_table.cellWidget(row, 0)
            if cb:
                cb.setChecked(False)

    def _filter_class_table(self, text: str) -> None:
        """Show only rows whose class search text contains the filter (case-insensitive)."""
        needle = (text or "").strip().lower()
        for row in range(self.class_table.rowCount()):
            item = self.class_table.item(row, 1)
            if item is None:
                self.class_table.setRowHidden(row, True)
                continue
            search_text = item.data(Qt.ItemDataRole.UserRole + 1) or ""
            self.class_table.setRowHidden(row, needle not in search_text)

    def _on_accept(self) -> None:
        if self.teacher_combo.count() == 0:
            QMessageBox.warning(self, "Missing", "Add teachers first.")
            return
        if self.subject_combo.count() == 0:
            QMessageBox.warning(self, "Missing", "Add subjects first.")
            return
        if self.teacher_combo.currentData() is None:
            QMessageBox.warning(
                self, "Invalid Selection",
                "Please select a Teacher from the list (click dropdown and choose an item).",
            )
            return
        if self.subject_combo.currentData() is None:
            QMessageBox.warning(
                self, "Invalid Selection",
                "Please select a Subject from the list (click dropdown and choose an item).",
            )
            return

        selected = self._get_selected()
        if not selected:
            QMessageBox.warning(self, "No Classes", "Select at least one class.")
            return

        self.accept()

    def _get_selected(self) -> list[tuple[int, int]]:
        """Returns list of (class_id, periods_per_week) for checked rows."""
        result = []
        for row in range(self.class_table.rowCount()):
            cb = self.class_table.cellWidget(row, 0)
            if cb and cb.isChecked():
                cls_id = self.class_table.item(row, 1).data(Qt.ItemDataRole.UserRole)
                spin = self.class_table.cellWidget(row, 2)
                ppw = spin.value() if spin else self.default_ppw_spin.value()
                result.append((cls_id, ppw))
        return result

    def create_lessons(self) -> int:
        """Create all lessons and return count created."""
        if not self.db:
            return 0

        teacher_id = self.teacher_combo.currentData()
        subject_id = self.subject_combo.currentData()
        selected = self._get_selected()

        svc = LessonService(self.db)
        count = 0
        duration = self.duration_spin.value()
        for cls_id, ppw in selected:
            lesson = Lesson(
                teacher_id=teacher_id,
                subject_id=subject_id,
                class_id=cls_id,
                periods_per_week=ppw,
                duration=duration,
                priority=5,
            )
            svc.create(lesson)
            count += 1
        return count
