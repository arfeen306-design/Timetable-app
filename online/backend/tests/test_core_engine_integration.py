"""Test core engine integration path: service layer accepts a data provider."""
from __future__ import annotations
import pytest
from typing import Any


class MinimalProvider:
    """Minimal TimetableDataProvider for tests (empty data)."""
    def get_school(self) -> dict[str, Any] | None:
        return None
    def get_subjects(self) -> list[dict[str, Any]]:
        return []
    def get_classes(self) -> list[dict[str, Any]]:
        return []
    def get_teachers(self) -> list[dict[str, Any]]:
        return []
    def get_rooms(self) -> list[dict[str, Any]]:
        return []
    def get_lessons(self) -> list[dict[str, Any]]:
        return []
    def get_constraints(self) -> list[dict[str, Any]]:
        return []
    def get_locked_entries(self) -> list[dict[str, Any]]:
        return []
    def get_lesson_allowed_rooms(self) -> list[dict[str, Any]]:
        return []


def test_validate_project_data_accepts_provider():
    """Service layer validate_project_data runs without error and returns expected shape."""
    import sys
    import os
    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend not in sys.path:
        sys.path.insert(0, backend)
    from services.timetable_engine_service import validate_project_data
    provider = MinimalProvider()
    result = validate_project_data(provider)
    assert "is_valid" in result
    assert "errors" in result
    assert "warnings" in result
    assert result["is_valid"] is False  # no school configured


def test_generate_timetable_accepts_provider():
    """Service layer generate_timetable runs without error and returns expected shape."""
    import sys
    import os
    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend not in sys.path:
        sys.path.insert(0, backend)
    from backend.services.timetable_engine_service import generate_timetable
    provider = MinimalProvider()
    result = generate_timetable(provider, time_limit_seconds=1)
    assert "success" in result
    assert "entries" in result
    assert "messages" in result
