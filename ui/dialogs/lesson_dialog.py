"""Dialog for creating/editing a Lesson."""
from __future__ import annotations
from typing import Optional

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QComboBox, QSpinBox,
    QCheckBox, QDialogButtonBox, QListWidget, QListWidgetItem,
    QTextEdit, QAbstractItemView, QGroupBox, QLabel, QMessageBox,
    QScrollArea, QWidget, QFrame,
)
from PySide6.QtCore import Qt

from models.domain import Lesson
from services.teacher_service import TeacherService
from services.subject_service import SubjectService
from services.class_service import ClassService
from services.room_service import RoomService
from database.connection import DatabaseConnection
from ui.widgets.searchable_combo import make_searchable
from utils.display_utils import (
    teacher_display_label,
    subject_display_label,
    class_display_label,
)
from utils.session_state import (
    ordered_teacher_ids,
    ordered_class_ids,
    ordered_subject_ids,
)


def _req(text: str) -> QLabel:
    """Label with red asterisk for required fields."""
    return QLabel(f'{text} <span style="color:#E74C3C;">*</span>')


class LessonDialog(QDialog):
    def __init__(
        self, parent=None, db: Optional[DatabaseConnection] = None,
        lesson: Optional[Lesson] = None,
        allowed_room_ids: Optional[list[int]] = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Edit Lesson" if lesson else "New Lesson")
        self.setMinimumWidth(520)
        self.setMinimumHeight(600)
        self.db = db
        self._allowed_room_ids = allowed_room_ids or []
        self._room_ids: list[int] = []
        self._build_ui()
        if lesson:
            self._load(lesson)

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll_content = QWidget()
        form_layout = QVBoxLayout(scroll_content)

        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)
        form.setSpacing(10)

        # --- Teacher ---
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
        form.addRow(_req("Teacher:"), self.teacher_combo)

        # --- Subject ---
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
        form.addRow(_req("Subject:"), self.subject_combo)

        # --- Class ---
        self.class_combo = QComboBox()
        self.class_combo.setMaxVisibleItems(20)
        if self.db:
            classes = ClassService(self.db).get_all()
            by_id = {c.id: c for c in classes}
            for cid in ordered_class_ids(classes):
                c = by_id.get(cid)
                if c:
                    self.class_combo.addItem(class_display_label(c), c.id)
        make_searchable(self.class_combo)
        form.addRow(_req("Class:"), self.class_combo)

        # --- Periods per week ---
        ppw_box = QVBoxLayout()
        self.ppw_spin = QSpinBox()
        self.ppw_spin.setRange(1, 20)
        self.ppw_spin.setValue(3)
        ppw_box.addWidget(self.ppw_spin)
        ppw_hint = QLabel(
            "How many times per week this lesson happens.\n"
            "e.g. 6 = about 1 per day, with 1 day getting 2."
        )
        ppw_hint.setStyleSheet("color:#888; font-size:11px;")
        ppw_hint.setWordWrap(True)
        ppw_box.addWidget(ppw_hint)
        form.addRow(_req("Periods / Week:"), ppw_box)

        # --- Lesson length in periods (consecutive periods, NOT minutes) ---
        dur_box = QVBoxLayout()
        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(1, 8)
        self.duration_spin.setValue(1)
        dur_box.addWidget(self.duration_spin)
        dur_hint = QLabel(
            "Lesson length in periods (not minutes). 1 = single period, 2 = double period.\n"
            "Period duration in minutes is set in School settings."
        )
        dur_hint.setStyleSheet("color:#888; font-size:11px;")
        dur_hint.setWordWrap(True)
        dur_box.addWidget(dur_hint)
        form.addRow(_req("Lesson length (periods):"), dur_box)

        # --- Importance (replaces confusing "Priority" 1-10) ---
        self.importance_combo = QComboBox()
        self.importance_combo.addItem("Normal", 5)
        self.importance_combo.addItem("High importance", 8)
        self.importance_combo.addItem("Flexible", 3)
        self.importance_combo.setToolTip(
            "High importance: place these lessons first. Flexible: can be moved if needed. Normal: standard scheduling."
        )
        form.addRow("Importance:", self.importance_combo)

        # --- Locked ---
        self.locked_check = QCheckBox("Lock (keep exact slot on re-generation)")
        form.addRow("", self.locked_check)

        # --- Preferred room ---
        self.pref_room_combo = QComboBox()
        self.pref_room_combo.setMaxVisibleItems(15)
        self.pref_room_combo.addItem("(No preference)", None)
        if self.db:
            for r in RoomService(self.db).get_all():
                self.pref_room_combo.addItem(f"{r.name} ({r.room_type})", r.id)
        form.addRow("Preferred Room:", self.pref_room_combo)

        form_layout.addLayout(form)

        # --- Allowed rooms ---
        rooms_group = QGroupBox("Allowed Rooms (leave empty = any room is fine)")
        rooms_vbox = QVBoxLayout(rooms_group)
        self.rooms_list = QListWidget()
        self.rooms_list.setSelectionMode(QAbstractItemView.SelectionMode.MultiSelection)
        self.rooms_list.setMinimumHeight(80)
        self.rooms_list.setMaximumHeight(120)
        if self.db:
            for r in RoomService(self.db).get_all():
                item = QListWidgetItem(f"{r.name} ({r.room_type}, cap {r.capacity})")
                item.setData(Qt.ItemDataRole.UserRole, r.id)
                self.rooms_list.addItem(item)
                self._room_ids.append(r.id)
                if r.id in self._allowed_room_ids:
                    item.setSelected(True)
        rooms_vbox.addWidget(self.rooms_list)
        form_layout.addWidget(rooms_group)

        # --- Notes ---
        self.notes_edit = QTextEdit()
        self.notes_edit.setPlaceholderText("Optional notes...")
        self.notes_edit.setMaximumHeight(45)
        form_layout.addWidget(self.notes_edit)

        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)

        # --- Buttons ---
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _load(self, l: Lesson) -> None:
        idx = self.teacher_combo.findData(l.teacher_id)
        if idx >= 0:
            self.teacher_combo.setCurrentIndex(idx)
        idx = self.subject_combo.findData(l.subject_id)
        if idx >= 0:
            self.subject_combo.setCurrentIndex(idx)
        idx = self.class_combo.findData(l.class_id)
        if idx >= 0:
            self.class_combo.setCurrentIndex(idx)
        self.ppw_spin.setValue(l.periods_per_week)
        self.duration_spin.setValue(l.duration)
        # Map numeric priority to importance combo (3=Flexible, 5=Normal, 8=High)
        p = l.priority
        if p >= 7:
            self.importance_combo.setCurrentIndex(1)
        elif p <= 4:
            self.importance_combo.setCurrentIndex(2)
        else:
            self.importance_combo.setCurrentIndex(0)
        self.locked_check.setChecked(l.locked)
        self.notes_edit.setPlainText(l.notes)
        if l.preferred_room_id:
            idx = self.pref_room_combo.findData(l.preferred_room_id)
            if idx >= 0:
                self.pref_room_combo.setCurrentIndex(idx)

    def _on_accept(self) -> None:
        missing = []
        if self.teacher_combo.count() == 0:
            missing.append("Teachers")
        if self.subject_combo.count() == 0:
            missing.append("Subjects")
        if self.class_combo.count() == 0:
            missing.append("Classes")
        if missing:
            QMessageBox.warning(
                self, "Missing Data",
                f"Cannot create lesson. Add {', '.join(missing)} first.",
            )
            return
        # Critical: with searchable (editable) combos, user can type without selecting.
        # currentData() is None if no valid item is selected -> would crash on save.
        if self.teacher_combo.currentData() is None:
            QMessageBox.warning(
                self, "Invalid Selection",
                "Please select a Teacher from the list. Click the dropdown and choose an item—typing alone is not enough.",
            )
            self.teacher_combo.setFocus()
            return
        if self.subject_combo.currentData() is None:
            QMessageBox.warning(
                self, "Invalid Selection",
                "Please select a Subject from the list. Click the dropdown and choose an item—typing alone is not enough.",
            )
            self.subject_combo.setFocus()
            return
        if self.class_combo.currentData() is None:
            QMessageBox.warning(
                self, "Invalid Selection",
                "Please select a Class from the list. Click the dropdown and choose an item—typing alone is not enough.",
            )
            self.class_combo.setFocus()
            return
        self.accept()

    def get_lesson(self) -> tuple[Lesson, list[int]]:
        priority = self.importance_combo.currentData()
        if priority is None:
            priority = 5
        # Defensive: only called after accept(), so these should be set; avoid None causing DB crash
        teacher_id = self.teacher_combo.currentData()
        subject_id = self.subject_combo.currentData()
        class_id = self.class_combo.currentData()
        if teacher_id is None or subject_id is None or class_id is None:
            raise ValueError("Teacher, Subject, and Class must be selected from the list.")
        lesson = Lesson(
            teacher_id=teacher_id,
            subject_id=subject_id,
            class_id=class_id,
            periods_per_week=self.ppw_spin.value(),
            duration=self.duration_spin.value(),
            priority=int(priority),
            locked=self.locked_check.isChecked(),
            preferred_room_id=self.pref_room_combo.currentData(),
            notes=self.notes_edit.toPlainText().strip(),
        )
        allowed = []
        for item in self.rooms_list.selectedItems():
            rid = item.data(Qt.ItemDataRole.UserRole)
            if rid is not None:
                allowed.append(rid)
        return lesson, allowed
