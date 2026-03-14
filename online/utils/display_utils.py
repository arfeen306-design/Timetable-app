"""Display and sort helpers for classes, teachers, and subjects (large-school selection UX)."""
from __future__ import annotations
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.domain import SchoolClass, Teacher, Subject


def _numeric_grade(grade: str) -> int:
    """Extract numeric grade for sorting. '9' -> 9, '10' -> 10, 'Grade 11' -> 11."""
    if not grade or not isinstance(grade, str):
        return 0
    s = grade.strip()
    try:
        return int(s)
    except ValueError:
        pass
    m = re.search(r"\b(\d{1,2})\b", s)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass
    return 0


def class_display_label(c: "SchoolClass") -> str:
    """Readable label for class: e.g. 'Grade 9 Silver' or 'Grade 10 Business (10-B)'."""
    grade = (c.grade or "").strip()
    section = (c.section or "").strip()
    stream = (c.stream or "").strip()
    if c.name and c.name.strip():
        base = c.name.strip()
    else:
        parts = [f"Grade {grade}"] if grade else []
        if section:
            parts.append(section)
        if stream:
            parts.append(stream)
        base = " ".join(parts).strip() or "Class"
    if c.code and c.code.strip() and f"({c.code.strip()})" not in base:
        return f"{base} ({c.code.strip()})"
    return base


def class_sort_key(c: "SchoolClass") -> tuple:
    """Sort key: (numeric_grade, section, stream, name) for stable academic order."""
    return (
        _numeric_grade(c.grade or ""),
        (c.section or "").strip().lower(),
        (c.stream or "").strip().lower(),
        (c.name or "").strip().lower(),
    )


def class_search_text(c: "SchoolClass") -> str:
    """Single string for search/filter: grade, section, stream, code, name."""
    parts = [
        c.grade or "",
        c.section or "",
        c.stream or "",
        c.code or "",
        c.name or "",
    ]
    return " ".join(p.strip().lower() for p in parts if p).strip()


def teacher_display_label(t: "Teacher", include_code: bool = True) -> str:
    """Readable label: 'Mr. John Smith' or 'Mr. John Smith (JSM)'."""
    title = (t.title or "").strip()
    first = (t.first_name or "").strip()
    last = (t.last_name or "").strip()
    name = f"{first} {last}".strip() or "Teacher"
    if title:
        name = f"{title} {name}"
    if include_code and t.code and t.code.strip():
        return f"{name} ({t.code.strip()})"
    return name


def teacher_sort_key(t: "Teacher") -> tuple:
    """Sort key: (last_name, first_name) for stable order."""
    return (
        (t.last_name or "").strip().lower(),
        (t.first_name or "").strip().lower(),
    )


def teacher_search_text(t: "Teacher") -> str:
    """Single string for search: first, last, title, code."""
    parts = [
        t.first_name or "",
        t.last_name or "",
        t.title or "",
        t.code or "",
    ]
    return " ".join(p.strip().lower() for p in parts if p).strip()


def subject_display_label(s: "Subject", include_code: bool = True) -> str:
    """Readable label: 'Mathematics (MAT)' for searchable combo."""
    name = (s.name or "").strip() or "Subject"
    if include_code and s.code and s.code.strip() and f"({s.code.strip()})" not in name:
        return f"{name} ({s.code.strip()})"
    return name


def subject_sort_key(s: "Subject") -> tuple:
    """Sort key: (category, name) for stable order."""
    return (
        (s.category or "").strip().lower(),
        (s.name or "").strip().lower(),
    )


def subject_search_text(s: "Subject") -> str:
    """Single string for search: name, code, category."""
    parts = [
        s.name or "",
        s.code or "",
        s.category or "",
    ]
    return " ".join(p.strip().lower() for p in parts if p).strip()
