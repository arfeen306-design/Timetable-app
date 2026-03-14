"""Searchable combo box: type to filter items, stable dropdown colors."""
from __future__ import annotations
from typing import Any

from PySide6.QtWidgets import QComboBox, QCompleter, QStyledItemDelegate, QStyleOptionViewItem
from PySide6.QtCore import Qt, QTimer, QRect
from PySide6.QtGui import QPalette, QColor, QPainter, QFont
from PySide6.QtCore import QSortFilterProxyModel

# QStyle.State_Selected flag value (avoid QAbstractItemView.StateFlag which doesn't exist in PySide6)
STATE_SELECTED = 0x8000


class ReadableItemDelegate(QStyledItemDelegate):
    """Ensure list items always use readable foreground/background (works with stylesheet)."""
    def initStyleOption(self, option, index, *args, **kwargs):
        # Defensive: Qt may pass 2 or 3 args on some platforms; only forward (option, index) to avoid segfault
        super().initStyleOption(option, index)
        if option is None:
            return
        try:
            if option.state & STATE_SELECTED:
                option.palette.setColor(QPalette.ColorGroup.Active, QPalette.ColorRole.HighlightedText, QColor("#ffffff"))
                option.palette.setColor(QPalette.ColorGroup.Active, QPalette.ColorRole.Highlight, QColor("#4A90D9"))
            else:
                option.palette.setColor(QPalette.ColorGroup.Active, QPalette.ColorRole.Text, QColor("#333333"))
                option.palette.setColor(QPalette.ColorGroup.Active, QPalette.ColorRole.Base, QColor("#ffffff"))
        except Exception:
            pass


class SearchHighlightDelegate(QStyledItemDelegate):
    """Paints completer popup items with the filter substring in bold."""
    def __init__(self, combo: QComboBox) -> None:
        super().__init__(combo)
        self._combo = combo

    def paint(self, painter: QPainter, option: QStyleOptionViewItem, index: Any) -> None:
        filter_text = (self._combo.lineEdit().text() or "").strip() if self._combo.lineEdit() else ""
        text = (index.data(Qt.ItemDataRole.DisplayRole) or "").strip()
        if not filter_text or filter_text.lower() not in text.lower():
            super().paint(painter, option, index)
            return
        option_copy = QStyleOptionViewItem(option)
        self.initStyleOption(option_copy, index)
        painter.save()
        low = text.lower()
        idx = low.find(filter_text.lower())
        if idx < 0:
            painter.restore()
            super().paint(painter, option, index)
            return
        rect = option.rect.adjusted(2, 0, -2, 0)
        normal_color = option_copy.palette.color(QPalette.ColorGroup.Active, QPalette.ColorRole.Text)
        highlight_color = QColor("#B71C1C")
        if option_copy.state & STATE_SELECTED:
            normal_color = option_copy.palette.color(QPalette.ColorGroup.Active, QPalette.ColorRole.HighlightedText)
            highlight_color = QColor("#FFFFFF")
        font = option_copy.font
        before, match, after = text[:idx], text[idx : idx + len(filter_text)], text[idx + len(filter_text) :]
        x = rect.left()
        y = rect.center().y()
        painter.setFont(font)
        if before:
            painter.setPen(normal_color)
            painter.drawText(x, y, before)
            x += painter.fontMetrics().horizontalAdvance(before)
        bold_font = QFont(font)
        bold_font.setBold(True)
        painter.setFont(bold_font)
        painter.setPen(highlight_color)
        painter.drawText(x, y, match)
        x += painter.fontMetrics().horizontalAdvance(match)
        if after:
            painter.setFont(font)
            painter.setPen(normal_color)
            painter.drawText(x, y, after)
        painter.restore()


def make_searchable(combo: QComboBox) -> None:
    """Make an existing QComboBox searchable and ensure readable dropdown."""
    combo.setEditable(True)
    combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
    proxy = QSortFilterProxyModel(combo)
    proxy.setSourceModel(combo.model())
    proxy.setFilterCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
    proxy.setFilterKeyColumn(0)
    completer = QCompleter(proxy, combo)
    completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
    completer.setCompletionMode(QCompleter.CompletionMode.PopupCompletion)
    completer.setFilterMode(Qt.MatchFlag.MatchContains)
    combo.setCompleter(completer)
    combo.lineEdit().textChanged.connect(proxy.setFilterFixedString)

    # Store proxy so we can clear filter before model changes (avoids QSortFilterProxyModel inconsistent changes warning)
    combo._searchable_proxy = proxy
    _original_clear = combo.clear
    def _clear_with_filter_reset():
        proxy.setFilterFixedString("")
        if combo.lineEdit():
            combo.lineEdit().blockSignals(True)
            combo.lineEdit().setText("")
            combo.lineEdit().blockSignals(False)
        _original_clear()
    combo.clear = _clear_with_filter_reset

    def on_activated(idx):
        src = proxy.mapToSource(idx)
        if src.isValid():
            row = src.row()
            # Defer to next event loop to avoid macOS crash when updating combo during completer popup close.
            # Use a callable that accepts *args so it is never confused with delegate initStyleOption (avoids segfault).
            def deferred_set(*_args, **_kwargs):
                if 0 <= row < combo.count():
                    combo.setCurrentIndex(row)
            QTimer.singleShot(0, deferred_set)

    completer.activated.connect(on_activated)
    combo.setItemDelegate(ReadableItemDelegate(combo))
    popup = completer.popup()
    if popup:
        popup.setItemDelegate(SearchHighlightDelegate(combo))
    if combo.minimumWidth() < 200:
        combo.setMinimumWidth(200)
