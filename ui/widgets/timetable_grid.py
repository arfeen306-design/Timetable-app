"""Timetable grid widget for displaying and interacting with timetable entries."""
from __future__ import annotations
from typing import Optional, List

from PySide6.QtWidgets import (
    QTableWidget, QTableWidgetItem, QHeaderView, QMenu, QAbstractItemView,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QFont, QAction

from models.domain import TimetableEntry
from utils.helpers import get_day_short, get_period_label, format_time_range, card_colors


class TimetableGrid(QTableWidget):
    """Grid widget that displays a timetable as days x periods."""

    entry_lock_toggled = Signal(int, bool)  # entry_id, lock_state

    def __init__(self, num_days: int = 5, num_periods: int = 7, parent=None) -> None:
        super().__init__(parent)
        self.num_days = num_days
        self.num_periods = num_periods
        self._entries: list[TimetableEntry] = []
        self._entry_map: dict[tuple[int, int], TimetableEntry] = {}

        self.setRowCount(num_days)
        self.setColumnCount(num_periods)

        # Headers: days vertical, periods horizontal
        self.setVerticalHeaderLabels([get_day_short(d) for d in range(num_days)])
        self.setHorizontalHeaderLabels([get_period_label(p) for p in range(num_periods)])

        # Sizing
        self.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.verticalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.setMinimumHeight(350)

        # Appearance
        self.setAlternatingRowColors(False)
        self.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self._show_context_menu)

    def load_entries(self, entries: list[TimetableEntry]) -> None:
        self._entries = entries
        self._entry_map.clear()
        self.clearContents()

        for entry in entries:
            day = entry.day_index
            period = entry.period_index
            if 0 <= day < self.num_days and 0 <= period < self.num_periods:
                self._entry_map[(day, period)] = entry
                self._set_cell(day, period, entry)

    def load_entries_with_slots(
        self,
        entries: list[TimetableEntry],
        slots_per_day: List[List[dict]],
        vertical_labels: List[str],
        friday_time_bar: Optional[List[str]] = None,
    ) -> None:
        """Fill grid: days vertical (rows), time slots horizontal (columns).
        If friday_time_bar is provided, add a row above Friday showing Fri slot times."""
        self._entries = entries
        self._entry_map = {(e.day_index, e.period_index): e for e in entries}
        self.clearContents()

        num_slots = len(vertical_labels)
        friday_row_index = 4
        use_friday_bar = (
            friday_time_bar is not None
            and len(friday_time_bar) > 0
            and self.num_days > friday_row_index
        )
        if use_friday_bar:
            v_header = (
                [get_day_short(d) for d in range(friday_row_index)]
                + ["Fri times"]
                + [get_day_short(d) for d in range(friday_row_index, self.num_days)]
            )
            self.setRowCount(self.num_days + 1)
            self.setVerticalHeaderLabels(v_header)
        else:
            self.setRowCount(self.num_days)
            self.setVerticalHeaderLabels([get_day_short(d) for d in range(self.num_days)])

        self.setColumnCount(num_slots)
        self.setHorizontalHeaderLabels(vertical_labels)
        self.horizontalHeader().setMinimumSectionSize(50)

        def row_for_day(day: int) -> int:
            if not use_friday_bar:
                return day
            return day + 1 if day >= friday_row_index else day

        for day in range(self.num_days):
            r = row_for_day(day)
            day_slots = slots_per_day[day] if day < len(slots_per_day) else []
            for col in range(num_slots):
                if col >= len(day_slots):
                    continue
                slot = day_slots[col]
                if slot.get("type") == "period":
                    period_index = slot.get("period_index", 0)
                    entry = self._entry_map.get((day, period_index))
                    if entry:
                        self._set_cell_at(r, col, entry)
                else:
                    name = slot.get("name", "Break")
                    start = slot.get("start", "")
                    end = slot.get("end", "")
                    self._set_break_cell(r, col, f"{name}\n{format_time_range(start, end)}")

        if use_friday_bar:
            time_bar_row = friday_row_index
            for col in range(num_slots):
                label = friday_time_bar[col] if col < len(friday_time_bar) else ""
                item = QTableWidgetItem(label)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                item.setBackground(QColor("#D0E0F0"))
                item.setForeground(QColor("#1a1a1a"))
                font = QFont()
                font.setPointSize(8)
                item.setFont(font)
                item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                self.setItem(time_bar_row, col, item)

    def _set_cell_at(self, day: int, col: int, entry: TimetableEntry) -> None:
        """Set cell at (day row, slot col) with entry content."""
        subject = entry.subject_code or entry.subject_name
        teacher = entry.teacher_name
        room = entry.room_name or ""
        lines = [subject]
        if teacher:
            lines.append(teacher)
        if room:
            lines.append(room)
        text = "\n".join(lines)
        item = QTableWidgetItem(text)
        item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        item.setData(Qt.ItemDataRole.UserRole, entry.id)
        bg, fg = card_colors(entry.subject_color)
        item.setBackground(QColor(bg))
        item.setForeground(QColor(fg))
        font = QFont()
        font.setPointSize(9)
        if entry.locked:
            font.setBold(True)
        item.setFont(font)
        item.setToolTip(f"{text}\n[LOCKED]" if entry.locked else text)
        self.setItem(day, col, item)

    def _set_break_cell(self, day: int, col: int, label: str) -> None:
        item = QTableWidgetItem(label)
        item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        item.setBackground(QColor("#E8E8E8"))
        item.setForeground(QColor("#555555"))
        font = QFont()
        font.setPointSize(9)
        item.setFont(font)
        item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
        self.setItem(day, col, item)

    def _set_cell(self, day: int, period: int, entry: TimetableEntry) -> None:
        subject = entry.subject_code or entry.subject_name
        teacher = entry.teacher_name
        room = entry.room_name or ""

        lines = [subject]
        if teacher:
            lines.append(teacher)
        if room:
            lines.append(room)

        text = "\n".join(lines)
        item = QTableWidgetItem(text)
        item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        item.setData(Qt.ItemDataRole.UserRole, entry.id)

        # Color: use default white/black when no color set
        bg, fg = card_colors(entry.subject_color)
        item.setBackground(QColor(bg))
        item.setForeground(QColor(fg))

        font = QFont()
        font.setPointSize(9)
        if entry.locked:
            font.setBold(True)
        item.setFont(font)

        if entry.locked:
            item.setToolTip(f"{text}\n[LOCKED]")
        else:
            item.setToolTip(text)

        self.setItem(day, period, item)

    def _show_context_menu(self, pos) -> None:
        item = self.itemAt(pos)
        if not item:
            return

        entry_id = item.data(Qt.ItemDataRole.UserRole)
        if entry_id is None:
            return

        entry = None
        for e in self._entries:
            if e.id == entry_id:
                entry = e
                break

        if not entry:
            return

        menu = QMenu(self)
        if entry.locked:
            unlock_action = QAction("Unlock Entry", self)
            unlock_action.triggered.connect(lambda: self.entry_lock_toggled.emit(entry_id, False))
            menu.addAction(unlock_action)
        else:
            lock_action = QAction("Lock Entry", self)
            lock_action.triggered.connect(lambda: self.entry_lock_toggled.emit(entry_id, True))
            menu.addAction(lock_action)

        menu.exec(self.viewport().mapToGlobal(pos))
