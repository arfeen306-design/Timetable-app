"""Classrooms management wizard page."""
from __future__ import annotations
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QMessageBox,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QColor

from utils.helpers import card_colors
from services.room_service import RoomService
from ui.dialogs.room_dialog import RoomDialog

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ClassroomsPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Classrooms")
        title.setProperty("heading", True)
        layout.addWidget(title)

        subtitle = QLabel("Add and manage rooms, labs, and other teaching spaces.")
        subtitle.setProperty("subheading", True)
        layout.addWidget(subtitle)

        toolbar = QHBoxLayout()
        add_btn = QPushButton("+ Add Room")
        add_btn.setProperty("primary", True)
        add_btn.clicked.connect(self._add)
        toolbar.addWidget(add_btn)

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
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(["Name", "Code", "Type", "Capacity", "Color"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.doubleClicked.connect(self._edit)
        layout.addWidget(self.table)

        nav = QHBoxLayout()
        nav.addStretch()
        next_btn = QPushButton("Next: Teachers")
        next_btn.clicked.connect(lambda: self.main_window.navigate_to(5))
        nav.addWidget(next_btn)
        layout.addLayout(nav)

    def on_enter(self) -> None:
        self._refresh()

    def _refresh(self) -> None:
        if not self.main_window.db:
            return
        svc = RoomService(self.main_window.db)
        rooms = svc.get_all()
        self.table.setRowCount(len(rooms))
        for row, r in enumerate(rooms):
            self.table.setItem(row, 0, QTableWidgetItem(r.name))
            self.table.setItem(row, 1, QTableWidgetItem(r.code))
            self.table.setItem(row, 2, QTableWidgetItem(r.room_type))
            self.table.setItem(row, 3, QTableWidgetItem(str(r.capacity)))
            color_item = QTableWidgetItem("")
            bg, fg = card_colors(r.color)
            color_item.setBackground(QColor(bg))
            color_item.setForeground(QColor(fg))
            self.table.setItem(row, 4, color_item)
            for col in range(5):
                item = self.table.item(row, col)
                if item:
                    item.setData(Qt.ItemDataRole.UserRole, r.id)

    def _add(self) -> None:
        if not self.main_window.db:
            return
        dlg = RoomDialog(self)
        if dlg.exec():
            svc = RoomService(self.main_window.db)
            svc.create(dlg.get_room())
            self._refresh()

    def _edit(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        rid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        svc = RoomService(self.main_window.db)
        room = svc.get_by_id(rid)
        if not room:
            return
        dlg = RoomDialog(self, room)
        if dlg.exec():
            updated = dlg.get_room()
            updated.id = rid
            svc.update(updated)
            self._refresh()

    def _delete(self) -> None:
        if not self.main_window.db:
            return
        row = self.table.currentRow()
        if row < 0:
            return
        rid = self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        name = self.table.item(row, 0).text()
        reply = QMessageBox.question(self, "Delete Room", f"Delete room '{name}'?")
        if reply == QMessageBox.StandardButton.Yes:
            svc = RoomService(self.main_window.db)
            svc.delete(rid)
            self._refresh()
