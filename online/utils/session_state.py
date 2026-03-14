"""Session-scoped state for filters and recent selections (large-school UX)."""
from __future__ import annotations
from typing import List

# Filter text remembered within session for bulk/copy dialogs
_filter_state: dict[str, str] = {
    "bulk_class_filter": "",
    "copy_target_filter": "",
}

# Recent entity IDs (max 10 each) for quick reuse
_recent_teachers: List[int] = []
_recent_classes: List[int] = []
_recent_subjects: List[int] = []
_MAX_RECENT = 10


def get_filter(key: str) -> str:
    return _filter_state.get(key, "")


def set_filter(key: str, value: str) -> None:
    _filter_state[key] = (value or "").strip()


def get_recent_teachers() -> List[int]:
    return list(_recent_teachers)


def get_recent_classes() -> List[int]:
    return list(_recent_classes)


def get_recent_subjects() -> List[int]:
    return list(_recent_subjects)


def push_recent_teacher(teacher_id: int) -> None:
    if not teacher_id:
        return
    try:
        _recent_teachers.remove(teacher_id)
    except ValueError:
        pass
    _recent_teachers.insert(0, teacher_id)
    del _recent_teachers[_MAX_RECENT:]


def push_recent_class(class_id: int) -> None:
    if not class_id:
        return
    try:
        _recent_classes.remove(class_id)
    except ValueError:
        pass
    _recent_classes.insert(0, class_id)
    del _recent_classes[_MAX_RECENT:]


def push_recent_subject(subject_id: int) -> None:
    if not subject_id:
        return
    try:
        _recent_subjects.remove(subject_id)
    except ValueError:
        pass
    _recent_subjects.insert(0, subject_id)
    del _recent_subjects[_MAX_RECENT:]


def ordered_teacher_ids(teachers: list) -> list:
    """Return teacher ids in display order: recent first, then rest."""
    recent_set = set(_recent_teachers)
    seen = set()
    out = []
    for rid in _recent_teachers:
        if rid not in seen and any(getattr(t, "id", None) == rid for t in teachers):
            out.append(rid)
            seen.add(rid)
    for t in teachers:
        i = getattr(t, "id", None)
        if i is not None and i not in seen:
            out.append(i)
    return out


def ordered_class_ids(classes: list) -> list:
    """Return class ids in display order: recent first, then rest."""
    seen = set()
    out = []
    for rid in _recent_classes:
        if rid not in seen and any(getattr(c, "id", None) == rid for c in classes):
            out.append(rid)
            seen.add(rid)
    for c in classes:
        i = getattr(c, "id", None)
        if i is not None and i not in seen:
            out.append(i)
    return out


def ordered_subject_ids(subjects: list) -> list:
    """Return subject ids in display order: recent first, then rest."""
    seen = set()
    out = []
    for rid in _recent_subjects:
        if rid not in seen and any(getattr(s, "id", None) == rid for s in subjects):
            out.append(rid)
            seen.add(rid)
    for s in subjects:
        i = getattr(s, "id", None)
        if i is not None and i not in seen:
            out.append(i)
    return out
