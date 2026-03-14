"""Color picker button widget."""
from PySide6.QtWidgets import QPushButton, QColorDialog
from PySide6.QtGui import QColor
from PySide6.QtCore import Signal


class ColorButton(QPushButton):
    """Button that opens a color picker and displays the selected color."""

    color_changed = Signal(str)

    def __init__(self, color: str = "#4A90D9", parent=None) -> None:
        super().__init__(parent)
        self._color = color
        self.setFixedSize(36, 36)
        self.setCursor(self.cursor())
        self.clicked.connect(self._pick_color)
        self._update_style()

    @property
    def color(self) -> str:
        return self._color

    @color.setter
    def color(self, value: str) -> None:
        self._color = value
        self._update_style()

    def _update_style(self) -> None:
        self.setStyleSheet(
            f"background-color: {self._color}; border: 2px solid #888; border-radius: 4px;"
        )

    def _pick_color(self) -> None:
        c = QColorDialog.getColor(QColor(self._color), self, "Select Color")
        if c.isValid():
            self._color = c.name()
            self._update_style()
            self.color_changed.emit(self._color)
