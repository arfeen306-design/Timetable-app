"""Resolve application base path for bundled (PyInstaller) and development runs."""
from __future__ import annotations
import os
import sys


def get_base_path() -> str:
    """
    Return the root directory for the application.
    When running as a PyInstaller bundle, this is sys._MEIPASS.
    Otherwise, it is the directory containing the main package (parent of app/).
    """
    if getattr(sys, "frozen", False) and getattr(sys, "_MEIPASS", None):
        return sys._MEIPASS
    # Development: parent of 'app' package (project root)
    this_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(this_dir)
