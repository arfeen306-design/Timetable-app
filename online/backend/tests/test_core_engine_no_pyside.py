"""Test that core timetable engine can be imported without PySide/desktop UI.

Run this test from the Timetable app project root with PYTHONPATH including the root,
so that solver, core, models are the desktop app's modules.
"""
from __future__ import annotations
import sys
import os


def test_core_engine_importable_without_pyside():
    """Import solver, core.validators, models.domain and ensure no PySide6 in import chain."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app_root = os.path.dirname(backend_dir)
    # Ensure app root is first so we import desktop app's core/solver/models, not backend's
    while app_root in sys.path:
        sys.path.remove(app_root)
    sys.path.insert(0, app_root)
    qt_keys = [k for k in sys.modules if "PySide6" in k or "PyQt" in k]
    for k in qt_keys:
        del sys.modules[k]
    from core import validators  # noqa: F401
    from core.data_provider import TimetableDataProvider  # noqa: F401
    from models import domain  # noqa: F401
    from solver import engine  # noqa: F401
    assert "PySide6" not in sys.modules, "Core engine must not import PySide6"
    assert "PyQt6" not in sys.modules
    from core.validators import ValidationResult
    r = ValidationResult()
    assert r.is_valid is True
    assert len(r.errors) == 0
