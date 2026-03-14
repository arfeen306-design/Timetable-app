"""Application stylesheet and style constants."""
import os
import tempfile
import atexit

_STYLE_DIR = os.path.dirname(os.path.abspath(__file__))
_ARROW_PATH = os.path.join(_STYLE_DIR, "assets", "dropdown_arrow.svg")

def _arrow_url():
    """Absolute path for dropdown arrow; use temp copy if path has spaces (Qt stylesheet issue)."""
    p = _ARROW_PATH
    if not os.path.isfile(p):
        return ""
    if " " not in p:
        return p.replace("\\", "/")
    try:
        with open(p, "rb") as f:
            data = f.read()
        fd, path = tempfile.mkstemp(suffix=".svg", prefix="timetable_arrow_")
        os.write(fd, data)
        os.close(fd)
        atexit.register(lambda: os.path.exists(path) and os.remove(path))
        return path.replace("\\", "/")
    except Exception:
        return ""

_ARROW_URL_FOR_STYLESHEET = _arrow_url()

MAIN_STYLESHEET = """
QMainWindow {
    background-color: #f5f5f5;
}

QPushButton {
    padding: 8px 16px;
    border: 1px solid #cccccc;
    border-radius: 4px;
    background-color: #ffffff;
    min-height: 24px;
}

QPushButton:hover {
    background-color: #e8e8e8;
    border-color: #999999;
}

QPushButton:pressed {
    background-color: #d0d0d0;
}

QPushButton[primary="true"] {
    background-color: #4A90D9;
    color: white;
    border: 1px solid #3a7bc8;
    font-weight: bold;
}

QPushButton[primary="true"]:hover {
    background-color: #3a7bc8;
}

QPushButton[danger="true"] {
    background-color: #E74C3C;
    color: white;
    border: 1px solid #c0392b;
}

QPushButton[danger="true"]:hover {
    background-color: #c0392b;
}

QTableWidget {
    gridline-color: #ddd;
    background-color: white;
    alternate-background-color: #f9f9f9;
    selection-background-color: #4A90D9;
    selection-color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
}

QTableWidget::item {
    padding: 4px 8px;
}

QHeaderView::section {
    background-color: #f0f0f0;
    padding: 6px;
    border: 1px solid #ddd;
    font-weight: bold;
}

QLineEdit, QSpinBox {
    padding: 6px 8px;
    border: 1px solid #cccccc;
    border-radius: 4px;
    background-color: white;
    min-height: 24px;
}

QComboBox {
    padding: 6px 8px;
    padding-right: 28px;
    border: 1px solid #cccccc;
    border-radius: 4px;
    background-color: white;
    min-height: 24px;
    color: #333333;
}

QComboBox::drop-down {
    subcontrol-origin: padding;
    subcontrol-position: top right;
    width: 26px;
    border-left: 1px solid #cccccc;
    background-color: #f5f5f5;
    border-top-right-radius: 3px;
    border-bottom-right-radius: 3px;
}

QComboBox::down-arrow {
    image: url("%s");
    width: 14px;
    height: 14px;
    subcontrol-position: center;
}

/* Force readable dropdown list on all platforms (fixes white-on-white / invisible hover) */
QComboBox QAbstractItemView {
    background-color: #ffffff;
    color: #333333;
    border: 1px solid #cccccc;
    selection-background-color: #4A90D9;
    selection-color: #ffffff;
    outline: 0;
    padding: 4px;
    min-width: 200px;
}

QComboBox QAbstractItemView::item {
    min-height: 28px;
    padding: 6px 10px;
    background-color: #ffffff;
    color: #333333;
}

QComboBox QAbstractItemView::item:hover {
    background-color: #E8F4FD;
    color: #333333;
}

QComboBox QAbstractItemView::item:selected {
    background-color: #4A90D9;
    color: #ffffff;
}

QComboBox QAbstractItemView::item:selected:hover {
    background-color: #3a7bc8;
    color: #ffffff;
}

QLineEdit:focus, QSpinBox:focus, QComboBox:focus {
    border-color: #4A90D9;
}

QGroupBox {
    font-weight: bold;
    border: 1px solid #ddd;
    border-radius: 6px;
    margin-top: 12px;
    padding-top: 16px;
}

QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 6px;
}

QListWidget {
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
}

QListWidget::item {
    padding: 8px;
    border-bottom: 1px solid #eee;
}

QListWidget::item:selected {
    background-color: #4A90D9;
    color: white;
}

QTextEdit {
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
}

QProgressBar {
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
    min-height: 20px;
}

QProgressBar::chunk {
    background-color: #4A90D9;
    border-radius: 3px;
}

QLabel[heading="true"] {
    font-size: 18px;
    font-weight: bold;
    color: #333333;
    margin-bottom: 8px;
}

QLabel[subheading="true"] {
    font-size: 13px;
    color: #666666;
    margin-bottom: 16px;
}

QLabel[required="true"] {
    color: #E74C3C;
    font-weight: bold;
}

QLabel[status_ok="true"] {
    color: #27AE60;
}

QLabel[status_warn="true"] {
    color: #F39C12;
}

QLabel[status_error="true"] {
    color: #E74C3C;
}
""" % (_ARROW_URL_FOR_STYLESHEET,)

WIZARD_NAV_STYLE = """
QListWidget {
    background-color: #2C3E50;
    border: none;
    border-radius: 0;
    color: white;
    font-size: 13px;
}

QListWidget::item {
    padding: 12px 16px;
    border-bottom: 1px solid #34495E;
    color: #BDC3C7;
}

QListWidget::item:selected {
    background-color: #4A90D9;
    color: white;
    font-weight: bold;
}

QListWidget::item:hover:!selected {
    background-color: #34495E;
}

QListWidget::item:disabled {
    color: #5D6D7E;
}

QListWidget::item:selected {
    color: white;
}
"""
