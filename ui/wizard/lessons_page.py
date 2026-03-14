"""Lessons management wizard page."""
from __future__ import annotations
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QMessageBox, QFileDialog,
)
from PySide6.QtCore import Qt

from services.lesson_service import LessonService
from ui.dialogs.import_preview_dialog import run_import_preview
from imports.excel_import import import_lessons_from_excel
from imports.sample_templates import write_lessons_template
from ui.dialogs.lesson_dialog import LessonDialog
from ui.dialogs.bulk_lesson_dialog import BulkLessonDialog
from ui.dialogs.copy_lessons_dialog import CopyLessonsDialog
from utils.session_state import (
    push_recent_teacher,
    push_recent_subject,
    push_recent_class,
)

if TYPE_CHECKING:
    from ui.main_window import MainWindow


def _importance_label(priority: int) -> str:
    if priority >= 7:
        return "High"
    if priority <= 4:
        return "Flexible"
    return "Normal"


class LessonsPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Lesson Assignments")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Assign teachers to subjects and classes with weekly period counts.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        toolbar = QHBoxLayout()

        add_btn = QPushButton("+ Add Single Lesson")
        add_btn.clicked.connect(self._add)
        toolbar.addWidget(add_btn)

        bulk_btn = QPushButton("+ Bulk Assign (1 Teacher -> Many Classes)")
        bulk_btn.setProperty("primary", True)
        bulk_btn.setToolTip("Assign one teacher+subject to multiple classes in one step")
        bulk_btn.clicked.connect(self._bulk_add)
        toolbar.addWidget(bulk_btn)

        copy_btn = QPushButton("Copy from Class")
        copy_btn.setToolTip("Copy lesson structure from one class to other classes")
        copy_btn.clicked.connect(self._copy_from_class)
        toolbar.addWidget(copy_btn)

        import_btn = QPushButton("Import from Excel")
        import_btn.setToolTip("Import teacher–subject–class mappings from Excel (Teacher, Subject, Class, Periods Per Week)")
        import_btn.clicked.connect(self._import_excel)
        toolbar.addWidget(import_btn)

        template_btn = QPushButton("Download Template")
        template_btn.setToolTip("Save a sample Excel template for lesson import")
        template_btn.clicked.connect(self._download_lesson_template)
        toolbar.addWidget(template_btn)

        edit_btn = QPushButton("Edit")
        edit_btn.clicked.connect(self._edit)
        toolbar.addWidget(edit_btn)

        del_btn = QPushButton("Delete")
        del_btn.setProperty("danger", True)
        del_btn.clicked.connect(self._delete)
        toolbar.addWidget(del_btn)

        toolbar.addStretch()

        self.summary_label = QLabel("")
        self.summary_label.setStyleSheet("color: #666; font-style: italic;")
        toolbar.addWidget(self.summary_label)

        layout.addLayout(toolbar)

        # Warning banner for empty prerequisites
        self.warning_banner = QLabel("")
        self.warning_banner.setWordWrap(True)
        self.warning_banner.setStyleSheet(
            "background-color:#FDF2E9; color:#E67E22; padding:8px; "
            "border:1px solid #F5CBA7; border-radius:4px; font-weight:bold;"
        )
        self.warning_banner.setVisible(False)
        layout.addWidget(self.warning_banner)

        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Teacher", "Subject", "Class", "Periods/Week",
            "Consec. Periods", "Importance", "Locked"
        ])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.doubleClicked.connect(self._edit)
        layout.addWidget(self.table)

        nav = QHBoxLayout()
        nav.addStretch()
        next_btn = QPushButton("Next: Constraints")
        next_btn.clicked.connect(lambda: self.main_window.navigate_to(7))
        nav.addWidget(next_btn)
        layout.addLayout(nav)

    def on_enter(self) -> None:
        self._check_prerequisites()
        self._refresh()

    def _check_prerequisites(self) -> None:
        """Show warning if teachers/subjects/classes are missing."""
        if not self.main_window.db:
            return
        missing = []
        if not self.main_window.db.fetchone("SELECT id FROM teacher LIMIT 1"):
            missing.append("Teachers")
        if not self.main_window.db.fetchone("SELECT id FROM subject LIMIT 1"):
            missing.append("Subjects")
        if not self.main_window.db.fetchone("SELECT id FROM school_class LIMIT 1"):
            missing.append("Classes")

        if missing:
            self.warning_banner.setText(
                f"You must add {', '.join(missing)} before creating lessons. "
                f"Go back and fill those tabs first."
            )
            self.warning_banner.setVisible(True)
        else:
            self.warning_banner.setVisible(False)

    def _refresh(self) -> None:
        if not self.main_window.db:
            return
        svc = LessonService(self.main_window.db)
        lessons = svc.get_all()
        self.table.setRowCount(len(lessons))
        total_periods = 0
        for row, l in enumerate(lessons):
            self.table.setItem(row, 0, QTableWidgetItem(l.teacher_name))
            self.table.setItem(row, 1, QTableWidgetItem(l.subject_name))
            self.table.setItem(row, 2, QTableWidgetItem(l.class_name))
            self.table.setItem(row, 3, QTableWidgetItem(str(l.periods_per_week)))
            self.table.setItem(row, 4, QTableWidgetItem(str(l.duration)))
            self.table.setItem(row, 5, QTableWidgetItem(_importance_label(l.priority)))
            self.table.setItem(row, 6, QTableWidgetItem("Yes" if l.locked else "No"))
            total_periods += l.periods_per_week
            for col in range(7):
                item = self.table.item(row, col)
                if item:
                    item.setData(Qt.ItemDataRole.UserRole, l.id)

        self.summary_label.setText(
            f"{len(lessons)} lessons, {total_periods} total periods/week"
        )

    def _add(self) -> None:
        if not self.main_window.db:
            return
        dlg = LessonDialog(self, self.main_window.db)
        if dlg.exec():
            try:
                svc = LessonService(self.main_window.db)
                lesson, room_ids = dlg.get_lesson()
                svc.create(lesson, room_ids)
                push_recent_teacher(lesson.teacher_id)
                push_recent_subject(lesson.subject_id)
                push_recent_class(lesson.class_id)
                self._refresh()
            except ValueError as e:
                QMessageBox.warning(self, "Validation", str(e))
            except Exception as e:
                QMessageBox.critical(
                    self, "Save Failed",
                    f"Could not save lesson.\n\n{e}",
                )

    def _bulk_add(self) -> None:
        if not self.main_window.db:
            return
        dlg = BulkLessonDialog(self, self.main_window.db)
        if dlg.exec():
            try:
                count = dlg.create_lessons()
                push_recent_teacher(dlg.teacher_combo.currentData())
                push_recent_subject(dlg.subject_combo.currentData())
                for cls_id, _ in dlg._get_selected():
                    push_recent_class(cls_id)
                QMessageBox.information(
                    self, "Bulk Assign",
                    f"Created {count} lesson assignment(s).",
                )
                self._refresh()
            except Exception as e:
                QMessageBox.critical(
                    self, "Bulk Assign Failed",
                    f"Could not save some lessons.\n\n{e}",
                )

    def _copy_from_class(self) -> None:
        if not self.main_window.db:
            return
        dlg = CopyLessonsDialog(self, self.main_window.db)
        if dlg.exec():
            count = dlg.copy_lessons()
            if count > 0:
                source_id = dlg.source_combo.currentData()
                if source_id:
                    push_recent_class(source_id)
                for i in range(dlg.target_list.count()):
                    item = dlg.target_list.item(i)
                    if item and item.isSelected():
                        cid = item.data(Qt.ItemDataRole.UserRole)
                        if cid:
                            push_recent_class(cid)
            QMessageBox.information(
                self, "Copy Complete",
                f"Copied lesson assignments to {count} new lesson(s).",
            )
            self._refresh()

    def _import_excel(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "Import Lesson Mappings", "", "Excel Files (*.xlsx)"
        )
        if not path:
            return
        run_import_preview(
            self,
            self.main_window.db,
            path,
            import_lessons_from_excel,
            "lesson(s)",
            on_success=self._refresh,
        )

    def _download_lesson_template(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self, "Save Lesson Template", "lessons_template.xlsx", "Excel Files (*.xlsx)"
        )
        if path:
            try:
                write_lessons_template(path)
                QMessageBox.information(self, "Template Saved", f"Saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", str(e))

    def _edit(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        lid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        svc = LessonService(self.main_window.db)
        lesson = svc.get_by_id(lid)
        if not lesson:
            return
        allowed = svc.get_allowed_rooms(lid)
        dlg = LessonDialog(self, self.main_window.db, lesson, allowed)
        if dlg.exec():
            try:
                updated, room_ids = dlg.get_lesson()
                updated.id = lid
                svc.update(updated, room_ids)
                self._refresh()
            except ValueError as e:
                QMessageBox.warning(self, "Validation", str(e))
            except Exception as e:
                QMessageBox.critical(
                    self, "Save Failed",
                    f"Could not update lesson.\n\n{e}",
                )

    def _delete(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        lid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        reply = QMessageBox.question(self, "Delete Lesson", "Delete this lesson assignment?")
        if reply == QMessageBox.StandardButton.Yes:
            svc = LessonService(self.main_window.db)
            svc.delete(lid)
            self._refresh()
