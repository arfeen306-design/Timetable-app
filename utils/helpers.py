"""Utility helpers for the timetable application."""
from __future__ import annotations

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

SUBJECT_COLORS = [
    "#4A90D9", "#E8725A", "#50C878", "#F5A623", "#9B59B6",
    "#1ABC9C", "#E74C3C", "#3498DB", "#2ECC71", "#F39C12",
    "#8E44AD", "#16A085", "#D35400", "#2980B9", "#27AE60",
    "#C0392B", "#7F8C8D", "#2C3E50", "#E67E22", "#1ABC9C",
]

CLASS_COLORS = [
    "#50C878", "#4A90D9", "#E8725A", "#F5A623", "#9B59B6",
    "#1ABC9C", "#E74C3C", "#3498DB", "#2ECC71", "#F39C12",
]

ROOM_TYPES = [
    "Classroom", "Laboratory", "Computer Lab", "Library",
    "Auditorium", "Art Room", "Music Room", "Sports Hall",
    "Workshop", "Other",
]

TEACHER_TITLES = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."]

SUBJECT_CATEGORIES = ["Core", "Elective", "Lab", "Activity", "Language", "Other"]

# Default for timetable cards when no color is set (ensure readability everywhere)
DEFAULT_CARD_BG = "#FFFFFF"
DEFAULT_CARD_TEXT = "#000000"

# Default subject library for one-click or checkbox import (name, code, category, color)
DEFAULT_SUBJECTS = [
    ("Mathematics", "MAT", "Core", "#4A90D9"),
    ("Physics", "Physics", "Core", "#3498DB"),
    ("Chemistry", "Chem", "Core", "#2ECC71"),
    ("Biology", "Bio", "Core", "#27AE60"),
    ("Computer Science", "Comp", "Core", "#9B59B6"),
    ("English", "Eng", "Core", "#F39C12"),
    ("Pakistan Studies", "PST", "Core", "#16A085"),
    ("Islamiyat", "IST", "Core", "#1ABC9C"),
    ("Physical Education", "PE", "Activity", "#7F8C8D"),
    ("Urdu", "UR", "Language", "#E67E22"),
    # Additional subjects per improvement spec
    ("Arts", "Arts", "Activity", "#E8725A"),
    ("Business", "Bus", "Elective", "#8E44AD"),
    ("Commerce", "Com", "Elective", "#2980B9"),
    ("Accounting", "Acc", "Elective", "#27AE60"),
    ("Additional Mathematics", "Add Math", "Core", "#4A90D9"),
    ("History", "Hist", "Core", "#D35400"),
    ("Geography", "Geo", "Core", "#1ABC9C"),
]


def get_day_name(index: int) -> str:
    if 0 <= index < len(DAY_NAMES):
        return DAY_NAMES[index]
    return f"Day {index + 1}"


def get_day_short(index: int) -> str:
    if 0 <= index < len(DAY_NAMES_SHORT):
        return DAY_NAMES_SHORT[index]
    return f"D{index + 1}"


def get_period_label(index: int, zero_period: bool = False) -> str:
    """When zero_period is True, index 0 is 'Zero Period', else 'Period 1', 'Period 2', ..."""
    if zero_period and index == 0:
        return "Zero Period"
    return f"Period {index + (0 if zero_period else 1)}"


def get_period_label_short(index: int, zero_period: bool = False) -> str:
    """Short label for clean timetable display: '1', '2', ... or 'Zero Period'."""
    if zero_period and index == 0:
        return "Zero Period"
    return str(index + (0 if zero_period else 1))


def format_time_range(start: str, end: str) -> str:
    """Format time range for clean display: '8:30 to 9:20'."""
    s = (start or "").strip() or "08:30"
    e = (end or "").strip() or "09:20"
    return f"{s} to {e}"


def _parse_time(s: str) -> tuple[int, int]:
    """Parse 'HH:MM' to (hours, minutes). Returns (0, 0) on failure."""
    if not s or not isinstance(s, str):
        return (0, 0)
    s = s.strip()
    parts = s.replace(".", ":").split(":")
    if len(parts) >= 2:
        try:
            h, m = int(parts[0]), int(parts[1])
            return (max(0, min(23, h)), max(0, min(59, m)))
        except ValueError:
            pass
    return (0, 0)


def _time_to_str(h: int, m: int) -> str:
    return f"{h:02d}:{m:02d}"


def get_period_times(bell: dict | None, period_index: int, zero_period: bool = False) -> tuple[str, str]:
    """Return (start_time, end_time) as 'HH:MM' for the period. bell has period_minutes, first_start, zero_period."""
    if not bell:
        return ("08:00", "08:50")
    period_min = int(bell.get("period_minutes") or 50)
    first = str(bell.get("first_start") or "08:00").strip()
    fh, fm = _parse_time(first)
    zero = bool(bell.get("zero_period", False))

    if zero and period_index == 0:
        school_start = str(bell.get("school_start") or "").strip()
        if school_start:
            sh, sm = _parse_time(school_start)
            return (_time_to_str(sh, sm), _time_to_str(fh, fm))
        total_m = fh * 60 + fm - period_min
        if total_m < 0:
            total_m = 0
        sh, sm = divmod(total_m, 60)
        return (_time_to_str(sh, sm), _time_to_str(fh, fm))
    if zero:
        start_m = (fh * 60 + fm) + (period_index - 1) * period_min
    else:
        start_m = (fh * 60 + fm) + period_index * period_min
    end_m = start_m + period_min
    sh, sm = divmod(start_m, 60)
    eh, em = divmod(end_m, 60)
    return (_time_to_str(sh % 24, sm), _time_to_str(eh % 24, em))


def _minutes_from_midnight(s: str) -> int:
    h, m = _parse_time(s)
    return h * 60 + m


def get_day_bell(bell: dict | None, day_index: int) -> dict:
    """Use friday config when day_index==4 (Friday) if present."""
    if not bell or not isinstance(bell, dict):
        return bell or {}
    if day_index == 4 and isinstance(bell.get("friday"), dict):
        f = bell["friday"]
        return {
            "first_start": f.get("first_start") or bell.get("first_start") or "08:30",
            "period_minutes": int(f.get("period_minutes") or bell.get("period_minutes") or 50),
            "breaks": f.get("breaks") if isinstance(f.get("breaks"), list) else (bell.get("breaks") or []),
        }
    return bell


def get_period_times_with_breaks(
    bell: dict | None, period_index: int, num_periods: int,
    zero_period: bool = False, day_index: int = 0,
) -> tuple[str, str]:
    """Return (start, end) for the period when breaks exist. Uses timeline with breaks."""
    day_bell = get_day_bell(bell, day_index) or bell or {}
    period_min = int(day_bell.get("period_minutes") or 50)
    first = str(day_bell.get("first_start") or "08:30").strip()
    breaks = day_bell.get("breaks") or []
    if not isinstance(breaks, list):
        breaks = []
    sorted_breaks = sorted(
        [b for b in breaks if isinstance(b, dict) and b.get("after_period")],
        key=lambda b: int(b.get("after_period", 0)),
    )
    current = _minutes_from_midnight(first)
    for p in range(num_periods):
        start_m = current
        end_m = current + period_min
        if p == period_index:
            return (_time_to_str(*divmod(start_m, 60)), _time_to_str(*divmod(end_m % (24 * 60), 60)))
        current = end_m
        for b in sorted_breaks:
            if int(b.get("after_period", 0)) == p + 1:
                current = _minutes_from_midnight(str(b.get("end", "11:30")).strip() or "11:30")
    return ("08:30", "09:20")


def get_day_slot_sequence(
    bell: dict | None, day_index: int, num_periods: int, zero_period: bool = False,
) -> list[dict]:
    """Ordered slots for the day: each period and each break. For grid display."""
    day_bell = get_day_bell(bell, day_index) or bell or {}
    period_min = int(day_bell.get("period_minutes") or 50)
    first = str(day_bell.get("first_start") or "08:30").strip()
    breaks = day_bell.get("breaks") or []
    if not isinstance(breaks, list):
        breaks = []
    sorted_breaks = sorted(
        [(i, b) for i, b in enumerate(breaks) if isinstance(b, dict) and b.get("after_period")],
        key=lambda x: (int(x[1].get("after_period", 0)), x[0]),
    )
    slots: list[dict] = []
    current = _minutes_from_midnight(first)
    for p in range(num_periods):
        start_m, end_m = current, current + period_min
        slots.append({
            "type": "period",
            "period_index": p,
            "start": _time_to_str(*divmod(start_m, 60)),
            "end": _time_to_str(*divmod(end_m % (24 * 60), 60)),
        })
        current = end_m
        # Add all breaks that occur after this period (multiple breaks can follow the same period)
        for _idx, b in sorted_breaks:
            if int(b.get("after_period", 0)) == p + 1:
                es = str(b.get("end", "11:30")).strip() or "11:30"
                current = _minutes_from_midnight(es)
                slots.append({
                    "type": "break",
                    "name": str(b.get("name", "Break")).strip() or "Break",
                    "start": str(b.get("start", "11:00")).strip() or "11:00",
                    "end": es,
                })
    return slots


def color_hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color to (r,g,b). Returns (255,255,255) if missing or invalid."""
    if not hex_color or not isinstance(hex_color, str):
        return (255, 255, 255)
    hex_color = hex_color.strip().lstrip("#")
    if len(hex_color) != 6:
        return (255, 255, 255)
    try:
        return (
            int(hex_color[0:2], 16),
            int(hex_color[2:4], 16),
            int(hex_color[4:6], 16),
        )
    except (ValueError, TypeError):
        return (255, 255, 255)


def card_colors(hex_color: str | None) -> tuple[str, str]:
    """Return (background_hex, text_hex) for a timetable card. Uses white/black if no color."""
    if not hex_color or not str(hex_color).strip():
        return (DEFAULT_CARD_BG, DEFAULT_CARD_TEXT)
    hex_color = str(hex_color).strip()
    return (hex_color, contrasting_text_color(hex_color))


def contrasting_text_color(bg_hex: str) -> str:
    r, g, b = color_hex_to_rgb(bg_hex)
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#000000" if luminance > 0.5 else "#FFFFFF"
