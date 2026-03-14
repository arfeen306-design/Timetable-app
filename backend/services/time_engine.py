"""Timetable time engine: generate period slots from school settings (start/end times, breaks, Friday)."""
from __future__ import annotations
import json
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class PeriodSlot:
    period_index: int  # 0-based
    start_time: str    # "HH:MM"
    end_time: str
    is_break: bool
    break_name: Optional[str] = None


def _parse_time(t: str) -> tuple[int, int]:
    """Return (minutes_since_midnight) for 'HH:MM' or 'H:MM'."""
    if not t or ":" not in t:
        return 8 * 60, 0  # default 08:00
    parts = t.strip().split(":")
    h = int(parts[0]) if parts[0].strip().isdigit() else 8
    m = int(parts[1]) if len(parts) > 1 and parts[1].strip().isdigit() else 0
    return h * 60 + m, 0


def _format_time(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h:02d}:{m:02d}"


def _parse_breaks(breaks_json: str) -> List[dict]:
    if not breaks_json or breaks_json.strip() == "":
        return []
    try:
        return json.loads(breaks_json)
    except Exception:
        return []


def generate_period_slots_for_day(
    day_index: int,  # 0=Mon, 1=Tue, ..., 4=Fri, 5=Sat
    school_start_time: str,
    school_end_time: str,
    period_duration_minutes: int,
    breaks_json: str,
    friday_start_time: Optional[str] = None,
    friday_end_time: Optional[str] = None,
    is_friday: bool = False,
    is_saturday: bool = False,
    saturday_start_time: Optional[str] = None,
    saturday_end_time: Optional[str] = None,
) -> List[PeriodSlot]:
    """
    Generate ordered list of period slots for one day.
    Uses Friday override times when is_friday and they are set.
    Uses Saturday times when is_saturday and they are set.
    Inserts break slots after the configured period index.
    """
    if is_saturday and saturday_start_time and saturday_end_time:
        start_min, _ = _parse_time(saturday_start_time)
        end_min, _ = _parse_time(saturday_end_time)
    elif is_friday and friday_start_time and friday_end_time:
        start_min, _ = _parse_time(friday_start_time)
        end_min, _ = _parse_time(friday_end_time)
    else:
        start_min, _ = _parse_time(school_start_time)
        end_min, _ = _parse_time(school_end_time)

    breaks = _parse_breaks(breaks_json)
    # Filter breaks that apply to this day (days list: 0=Sun, 1=Mon, ... so day_index+1 for Mon=1)
    # Spec says "days applied" - assume 1=Mon, 2=Tue, ... 6=Sat
    day_num = day_index + 1  # Mon=1, Tue=2, ..., Sat=6
    day_breaks = [b for b in breaks if isinstance(b, dict) and day_num in b.get("days", [])]

    result: List[PeriodSlot] = []
    period_index = 0
    current_min = start_min

    while current_min < end_min and period_index < 50:  # safety limit
        # Normal teaching period first
        end_period = min(current_min + period_duration_minutes, end_min)
        result.append(PeriodSlot(
            period_index=period_index,
            start_time=_format_time(current_min),
            end_time=_format_time(end_period),
            is_break=False,
        ))
        current_min = end_period
        # Then insert break if one is configured after this period
        for b in day_breaks:
            after = b.get("after_period")
            if after is None:
                continue
            if period_index == after:
                dur = b.get("duration_minutes", 10)
                if is_friday and b.get("friday_override_minutes") is not None:
                    dur = b["friday_override_minutes"]
                result.append(PeriodSlot(
                    period_index=-1,
                    start_time=_format_time(current_min),
                    end_time=_format_time(current_min + dur),
                    is_break=True,
                    break_name=b.get("name", "Break"),
                ))
                current_min += dur
                break
        period_index += 1

    return result


def generate_week_slots(settings: dict) -> dict:
    """
    settings: dict with school_start_time, school_end_time, period_duration_minutes,
              breaks_json, friday_start_time, friday_end_time, saturday_start_time, saturday_end_time,
              working_days (e.g. "1,2,3,4,5" for Mon-Fri).
    Returns: { "days": [ { "day_index": 0, "day_name": "Monday", "slots": [ PeriodSlot... ] }, ... ] }
    """
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    working = set()
    wd = settings.get("working_days") or "1,2,3,4,5"
    for x in str(wd).split(","):
        try:
            working.add(int(x.strip()) - 1)  # 1=Mon -> index 0
        except ValueError:
            pass

    days_out = []
    for day_index in range(6):
        if day_index not in working:
            continue
        slots = generate_period_slots_for_day(
            day_index=day_index,
            school_start_time=settings.get("school_start_time") or "08:00",
            school_end_time=settings.get("school_end_time") or "15:00",
            period_duration_minutes=int(settings.get("period_duration_minutes") or 45),
            breaks_json=settings.get("breaks_json") or "[]",
            friday_start_time=settings.get("friday_start_time"),
            friday_end_time=settings.get("friday_end_time"),
            is_friday=(day_index == 4),
            is_saturday=(day_index == 5),
            saturday_start_time=settings.get("saturday_start_time"),
            saturday_end_time=settings.get("saturday_end_time"),
        )
        days_out.append({
            "day_index": day_index,
            "day_name": day_names[day_index],
            "slots": [
                {
                    "period_index": s.period_index,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "is_break": s.is_break,
                    "break_name": s.break_name,
                }
                for s in slots
            ],
        })
    return {"days": days_out}
