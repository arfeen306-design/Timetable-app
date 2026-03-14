"""Classes management wizard page."""
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
from services.class_service import ClassService
from ui.dialogs.class_dialog import ClassDialog
from ui.dialogs.import_preview_dialog import run_import_preview
from imports.excel_import import import_classes_from_excel
from imports.sample_templates import write_classes_template

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ClassesPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Classes & Sections")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Add and manage classes, sections, and streams.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        toolbar = QHBoxLayout()
        add_btn = QPushButton("+ Add Class")
        add_btn.setProperty("primary", True)
        add_btn.clicked.connect(self._add)
        toolbar.addWidget(add_btn)

        import_btn = QPushButton("Import from Excel")
        import_btn.clicked.connect(self._import_excel)
        toolbar.addWidget(import_btn)

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

        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Name", "Grade", "Section", "Stream", "Code", "Color", "Strength"
        ])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.doubleClicked.connect(self._edit)
        layout.addWidget(self.table)

        self.empty_label = QLabel("No classes added yet. Import from Excel or add manually.")
        self.empty_label.setProperty("subheading", True)
        self.empty_label.setWordWrap(True)
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.empty_label)

        nav = QHBoxLayout()
        nav.addStretch()
        next_btn = QPushButton("Next: Classrooms")
        next_btn.clicked.connect(lambda: self.main_window.navigate_to(4))
        nav.addWidget(next_btn)
        layout.addLayout(nav)

    def on_enter(self) -> None:
        self._refresh()

    def _refresh(self) -> None:
        if not self.main_window.db:
            return
        svc = ClassService(self.main_window.db)
        classes = svc.get_all()
        self.table.setRowCount(len(classes))
        self.empty_label.setVisible(len(classes) == 0)
        for row, c in enumerate(classes):
            self.table.setItem(row, 0, QTableWidgetItem(c.name))
            self.table.setItem(row, 1, QTableWidgetItem(c.grade))
            self.table.setItem(row, 2, QTableWidgetItem(c.section))
            self.table.setItem(row, 3, QTableWidgetItem(c.stream))
            self.table.setItem(row, 4, QTableWidgetItem(c.code))
            color_item = QTableWidgetItem("")
            bg, fg = card_colors(c.color)
            color_item.setBackground(QColor(bg))
            color_item.setForeground(QColor(fg))
            self.table.setItem(row, 5, color_item)
            self.table.setItem(row, 6, QTableWidgetItem(str(c.strength)))
            for col in range(7):
                item = self.table.item(row, col)
                if item:
                    item.setData(Qt.ItemDataRole.UserRole, c.id)

    def _add(self) -> None:
        if not self.main_window.db:
            return
        dlg = ClassDialog(self, self.main_window.db)
        if dlg.exec():
            svc = ClassService(self.main_window.db)
            try:
                svc.create(dlg.get_class())
            except ValueError as e:
                QMessageBox.warning(self, "Duplicate Class", str(e))
                return
            self._refresh()

    def _import_excel(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getOpenFileName(self, "Import Classes", "", "Excel Files (*.xlsx)")
        if not path:
            return
        run_import_preview(
            self,
            self.main_window.db,
            path,
            import_classes_from_excel,
            "class(es)",
            on_success=self._refresh,
        )

    def _download_template(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, "Save Template", "classes_template.xlsx", "Excel Files (*.xlsx)")
        if path:
            try:
                write_classes_template(path)
                QMessageBox.information(self, "Template Saved", f"Saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", str(e))

    def _edit(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        cid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        svc = ClassService(self.main_window.db)
        cls = svc.get_by_id(cid)
        if not cls:
            return
        dlg = ClassDialog(self, self.main_window.db, cls)
        if dlg.exec():
            updated = dlg.get_class()
            updated.id = cid
            try:
                svc.update(updated)
            except ValueError as e:
                QMessageBox.warning(self, "Duplicate Class", str(e))
                return
            self._refresh()

    def _delete(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        cid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        name = self.table.item(row, 0).text()
        reply = QMessageBox.question(
            self, "Delete Class",
            f"Delete class '{name}'? This will also remove related lessons.",
        )
        if reply == QMessageBox.StandardButton.Yes:
            svc = ClassService(self.main_window.db)
            svc.delete(cid)
            self._refresh()
