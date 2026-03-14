"""Subjects management wizard page."""
from __future__ import annotations
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QMessageBox, QFileDialog,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QColor

from models.domain import Subject
from utils.helpers import card_colors
from services.subject_service import SubjectService
from ui.dialogs.subject_dialog import SubjectDialog
from ui.dialogs.subject_library_dialog import SubjectLibraryDialog
from ui.dialogs.import_preview_dialog import run_import_preview
from imports.excel_import import import_subjects_from_excel
from imports.sample_templates import write_subjects_template

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class SubjectsPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Subjects")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Add and manage the subjects taught at your school.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        # Toolbar
        toolbar = QHBoxLayout()
        add_btn = QPushButton("+ Add Subject")
        add_btn.clicked.connect(self._add)
        toolbar.addWidget(add_btn)

        import_lib_btn = QPushButton("Import from Library")
        import_lib_btn.setProperty("primary", True)
        import_lib_btn.setToolTip("Select from default subjects (Mathematics, Physics, etc.) with checkboxes")
        import_lib_btn.clicked.connect(self._import_from_library)
        toolbar.addWidget(import_lib_btn)

        import_excel_btn = QPushButton("Import from Excel")
        import_excel_btn.clicked.connect(self._import_excel)
        toolbar.addWidget(import_excel_btn)

        template_btn = QPushButton("Download Template")
        template_btn.clicked.connect(self._download_template)
        toolbar.addWidget(template_btn)

        edit_btn = QPushButton("Edit")
        edit_btn.clicked.connect(self._edit)
        toolbar.addWidget(edit_btn)

        del_btn = QPushButton("Delete")
        del_btn.setProperty("danger", True)
        del_btn.clicked.connect(self._delete)
        toolbar.addWidget(del_btn)

        toolbar.addStretch()
        layout.addLayout(toolbar)

        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Name", "Code", "Category", "Color", "Max/Day", "Double?", "Pref. Room Type"
        ])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.doubleClicked.connect(self._edit)
        layout.addWidget(self.table)

        self.empty_label = QLabel("No subjects added yet. Import from Excel or add manually.")
        self.empty_label.setProperty("subheading", True)
        self.empty_label.setWordWrap(True)
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.empty_label)

        # Nav
        nav = QHBoxLayout()
        nav.addStretch()
        next_btn = QPushButton("Next: Classes")
        next_btn.clicked.connect(lambda: self.main_window.navigate_to(3))
        nav.addWidget(next_btn)
        layout.addLayout(nav)

    def on_enter(self) -> None:
        self._refresh()

    def _refresh(self) -> None:
        if not self.main_window.db:
            return
        svc = SubjectService(self.main_window.db)
        subjects = svc.get_all()
        self.table.setRowCount(len(subjects))
        self.empty_label.setVisible(len(subjects) == 0)
        for row, s in enumerate(subjects):
            self.table.setItem(row, 0, QTableWidgetItem(s.name))
            self.table.setItem(row, 1, QTableWidgetItem(s.code))
            self.table.setItem(row, 2, QTableWidgetItem(s.category))
            color_item = QTableWidgetItem("")
            bg, fg = card_colors(s.color)
            color_item.setBackground(QColor(bg))
            color_item.setForeground(QColor(fg))
            self.table.setItem(row, 3, color_item)
            self.table.setItem(row, 4, QTableWidgetItem(str(s.max_per_day)))
            self.table.setItem(row, 5, QTableWidgetItem("Yes" if s.double_allowed else "No"))
            self.table.setItem(row, 6, QTableWidgetItem(s.preferred_room_type))

            for col in range(7):
                item = self.table.item(row, col)
                if item:
                    item.setData(Qt.ItemDataRole.UserRole, s.id)

    def _add(self) -> None:
        if not self.main_window.db:
            return
        dlg = SubjectDialog(self, self.main_window.db, None)
        if dlg.exec():
            svc = SubjectService(self.main_window.db)
            try:
                svc.create(dlg.get_subject())
            except ValueError as e:
                QMessageBox.warning(self, "Duplicate Subject", str(e))
                return
            self._refresh()

    def _import_from_library(self) -> None:
        if not self.main_window.db:
            return
        svc = SubjectService(self.main_window.db)
        existing = svc.get_all()
        existing_codes = {s.code.strip().upper() for s in existing if s.code}
        existing_names = {s.name.strip().lower() for s in existing if s.name}
        dlg = SubjectLibraryDialog(
            self, self.main_window.db,
            existing_codes=existing_codes, existing_names=existing_names,
        )
        if dlg.exec():
            svc = SubjectService(self.main_window.db)
            added, skipped = 0, 0
            for subj in dlg.get_selected():
                try:
                    svc.create(subj)
                    added += 1
                except ValueError:
                    skipped += 1
            self._refresh()
            msg = f"Added {added} subject(s) from the library."
            if skipped:
                msg += f" {skipped} already existed and were skipped."
            msg += " You can edit names and codes in the table."
            QMessageBox.information(self, "Import Complete", msg)

    def _import_excel(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getOpenFileName(self, "Import Subjects", "", "Excel Files (*.xlsx)")
        if not path:
            return
        run_import_preview(
            self,
            self.main_window.db,
            path,
            import_subjects_from_excel,
            "subject(s)",
            on_success=self._refresh,
        )

    def _download_template(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, "Save Template", "subjects_template.xlsx", "Excel Files (*.xlsx)")
        if path:
            try:
                write_subjects_template(path)
                QMessageBox.information(self, "Template Saved", f"Saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", str(e))

    def _edit(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        sid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        svc = SubjectService(self.main_window.db)
        subject = svc.get_by_id(sid)
        if not subject:
            return
        dlg = SubjectDialog(self, self.main_window.db, subject)
        if dlg.exec():
            updated = dlg.get_subject()
            updated.id = sid
            try:
                svc.update(updated)
            except ValueError as e:
                QMessageBox.warning(self, "Duplicate Subject", str(e))
                return
            self._refresh()

    def _delete(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        sid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        name = self.table.item(row, 0).text()
        reply = QMessageBox.question(
            self, "Delete Subject",
            f"Delete subject '{name}'? This will also remove related lessons.",
        )
        if reply == QMessageBox.StandardButton.Yes:
            svc = SubjectService(self.main_window.db)
            svc.delete(sid)
            self._refresh()
