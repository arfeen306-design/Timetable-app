"""Teachers management wizard page."""
from __future__ import annotations
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QMessageBox, QFileDialog,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QColor

from utils.helpers import card_colors
from services.teacher_service import TeacherService
from ui.dialogs.teacher_dialog import TeacherDialog
from ui.dialogs.import_preview_dialog import run_import_preview
from imports.excel_import import import_teachers_from_excel
from imports.sample_templates import write_teachers_template

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class TeachersPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Teachers")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Add and manage teaching staff.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        toolbar = QHBoxLayout()
        add_btn = QPushButton("+ Add Teacher")
        add_btn.setProperty("primary", True)
        add_btn.clicked.connect(self._add)
        toolbar.addWidget(add_btn)

        import_btn = QPushButton("Import from Excel")
        import_btn.clicked.connect(self._import_excel)
        toolbar.addWidget(import_btn)

        template_btn = QPushButton("Download Template")
        template_btn.setToolTip("Download sample Excel file for importing teachers")
        template_btn.clicked.connect(self._download_template)

        edit_btn = QPushButton("Edit")
        edit_btn.clicked.connect(self._edit)
        toolbar.addWidget(edit_btn)

        del_btn = QPushButton("Delete")
        del_btn.setProperty("danger", True)
        del_btn.clicked.connect(self._delete)
        toolbar.addWidget(del_btn)

        toolbar.addWidget(template_btn)
        toolbar.addStretch()
        layout.addLayout(toolbar)

        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Name", "Code", "Title", "Color", "Max/Day", "Max/Week", ""
        ])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.doubleClicked.connect(self._edit)
        layout.addWidget(self.table)

        self.empty_label = QLabel("No teachers added yet. Add at least one teacher before creating lessons.")
        self.empty_label.setProperty("subheading", True)
        self.empty_label.setWordWrap(True)
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.empty_label)

        nav = QHBoxLayout()
        nav.addStretch()
        next_btn = QPushButton("Next: Lessons")
        next_btn.clicked.connect(lambda: self.main_window.navigate_to(6))
        nav.addWidget(next_btn)
        layout.addLayout(nav)

    def on_enter(self) -> None:
        self._refresh()

    def _refresh(self) -> None:
        if not self.main_window.db:
            return
        svc = TeacherService(self.main_window.db)
        teachers = svc.get_all()
        self.table.setRowCount(len(teachers))
        self.empty_label.setVisible(len(teachers) == 0)
        for row, t in enumerate(teachers):
            self.table.setItem(row, 0, QTableWidgetItem(t.display_name))
            self.table.setItem(row, 1, QTableWidgetItem(t.code))
            self.table.setItem(row, 2, QTableWidgetItem(t.title))
            color_item = QTableWidgetItem("")
            bg, fg = card_colors(t.color)
            color_item.setBackground(QColor(bg))
            color_item.setForeground(QColor(fg))
            self.table.setItem(row, 3, color_item)
            self.table.setItem(row, 4, QTableWidgetItem(str(t.max_periods_day)))
            self.table.setItem(row, 5, QTableWidgetItem(str(t.max_periods_week)))
            self.table.setItem(row, 6, QTableWidgetItem(""))
            for col in range(7):
                item = self.table.item(row, col)
                if item:
                    item.setData(Qt.ItemDataRole.UserRole, t.id)

    def _add(self) -> None:
        if not self.main_window.db:
            return
        dlg = TeacherDialog(self, self.main_window.db, None)
        if dlg.exec():
            svc = TeacherService(self.main_window.db)
            try:
                svc.create(dlg.get_teacher())
            except ValueError as e:
                QMessageBox.warning(self, "Duplicate Teacher", str(e))
                return
            self._refresh()

    def _import_excel(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "Import Teachers", "", "Excel Files (*.xlsx)"
        )
        if not path:
            return
        run_import_preview(
            self,
            self.main_window.db,
            path,
            import_teachers_from_excel,
            "teacher(s)",
            on_success=self._refresh,
        )

    def _download_template(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self, "Save Template", "teachers_template.xlsx", "Excel Files (*.xlsx)"
        )
        if path:
            try:
                write_teachers_template(path)
                QMessageBox.information(self, "Template Saved", f"Saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", str(e))

    def _edit(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        tid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        svc = TeacherService(self.main_window.db)
        teacher = svc.get_by_id(tid)
        if not teacher:
            return
        dlg = TeacherDialog(self, self.main_window.db, teacher)
        if dlg.exec():
            updated = dlg.get_teacher()
            updated.id = tid
            try:
                svc.update(updated)
            except ValueError as e:
                QMessageBox.warning(self, "Duplicate Teacher", str(e))
                return
            self._refresh()

    def _delete(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        tid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        name = self.table.item(row, 0).text()
        from repositories.lesson_repo import LessonRepository
        lesson_count = LessonRepository(self.main_window.db).count_by_teacher(tid)
        if lesson_count > 0:
            msg = (
                f"This teacher is assigned to {lesson_count} lesson(s). "
                "Deleting will remove these lessons. Delete anyway?"
            )
        else:
            msg = f"Delete teacher '{name}'?"
        reply = QMessageBox.question(
            self, "Delete Teacher",
            msg,
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if reply == QMessageBox.StandardButton.Yes:
            svc = TeacherService(self.main_window.db)
            svc.delete(tid)
            self._refresh()
