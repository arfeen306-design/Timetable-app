"""Timetable time engine: generate period slots from school settings.

Supports:
  • Per-lesson durations via lesson_durations array in bell_schedule_json
  • Breaks inserted after specified period index
  • Friday / Saturday / any exceptional-day overrides
  • Falls back to global period_duration_minutes when no per-lesson array
"""
from __future__ import annotations
import json
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class PeriodSlot:
    period_index: int  # 0-based (-1 for breaks)
    start_time: str    # "HH:MM"
    end_time: str
    is_break: bool
    break_name: Optional[str] = None
    duration_minutes: int = 0


def _parse_time(t: str) -> int:
    """Return minutes-since-midnight for 'HH:MM'."""
    if not t or ":" not in t:
        return 8 * 60
    parts = t.strip().split(":")
    h = int(parts[0]) if parts[0].strip().isdigit() else 8
    m = int(parts[1]) if len(parts) > 1 and parts[1].strip().isdigit() else 0
    return h * 60 + m


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


def _parse_bell_schedule(bell_json: str) -> dict:
    """Parse bell_schedule_json into a dict, handling both object and array formats."""
    if not bell_json or bell_json.strip() in ("", "[]", "{}"):
        return {}
    try:
        parsed = json.loads(bell_json)
        if isinstance(parsed, dict):
            return parsed
        return {}
    except Exception:
        return {}


def generate_period_slots_for_day(
    day_index: int,  # 0=Mon, 1=Tue, ..., 4=Fri, 5=Sat
    school_start_time: str,
    school_end_time: str,
    period_duration_minutes: int,
    breaks_json: str,
    periods_per_day: int = 0,
    bell_schedule_json: str = "{}",
    friday_start_time: Optional[str] = None,
    friday_end_time: Optional[str] = None,
    is_friday: bool = False,
    is_saturday: bool = False,
    saturday_start_time: Optional[str] = None,
    saturday_end_time: Optional[str] = None,
) -> List[PeriodSlot]:
    """
    Generate ordered list of period slots for one day.
    
    Reads per-lesson durations from bell_schedule_json:
      { "lesson_durations": [45, 45, 60, 45, ...], "first_period_start": "08:30",
        "friday_lesson_durations": [...], "friday_first_period_start": "08:10" }
    
    Falls back to global period_duration_minutes if no per-lesson array.
    """
    bell = _parse_bell_schedule(bell_schedule_json)

    # ── Determine start time and per-lesson durations for this day ────────
    if is_friday and bell.get("friday_different"):
        # Exceptional day: use bell_schedule_json settings
        fp_start = bell.get("friday_first_period_start")
        start_min = _parse_time(fp_start) if fp_start else _parse_time(friday_start_time or school_start_time)
        end_min = _parse_time(friday_end_time or school_end_time)
    elif is_saturday and saturday_start_time and saturday_end_time:
        # Legacy Saturday override (deprecated — prefer bell_schedule_json)
        start_min = _parse_time(saturday_start_time)
        end_min = _parse_time(saturday_end_time)
    else:
        fp_start = bell.get("first_period_start")
        start_min = _parse_time(fp_start) if fp_start else _parse_time(school_start_time)
        end_min = _parse_time(school_end_time)

    # Per-lesson duration arrays
    if is_friday and bell.get("friday_different"):
        lesson_durations = bell.get("friday_lesson_durations", [])
        default_dur = bell.get("friday_default_duration", period_duration_minutes)
    else:
        lesson_durations = bell.get("lesson_durations", [])
        default_dur = bell.get("default_duration", period_duration_minutes)

    # ── Parse breaks ─────────────────────────────────────────────────────
    all_breaks = _parse_breaks(breaks_json)
    # Filter by day if days list exists, else include all non-friday breaks
    day_num = day_index + 1  # Mon=1, Tue=2, ..., Sat=6

    if is_friday and bell.get("friday_different"):
        # Use friday-specific breaks
        day_breaks = [b for b in all_breaks if b.get("is_friday")]
    else:
        day_breaks = [b for b in all_breaks if not b.get("is_friday")]
        # Also filter by days list if present
        day_breaks_filtered = []
        for b in day_breaks:
            days = b.get("days")
            if days is None or day_num in days:
                day_breaks_filtered.append(b)
        day_breaks = day_breaks_filtered

    # Build break lookup: after_period -> break_info
    break_after: dict[int, dict] = {}
    for b in day_breaks:
        ap = b.get("after_period")
        if ap is not None:
            break_after[ap] = b

    # ── How many periods? ────────────────────────────────────────────────
    if is_friday and bell.get("friday_different"):
        # Use exceptional day's period count
        fri_pcount = bell.get("friday_periods_per_day")
        max_periods = int(fri_pcount) if fri_pcount else (periods_per_day if periods_per_day > 0 else 50)
    else:
        max_periods = periods_per_day if periods_per_day > 0 else 50

    # ── Generate slots ───────────────────────────────────────────────────
    result: List[PeriodSlot] = []
    current_min = start_min
    period_index = 0

    while period_index < max_periods and current_min < end_min:
        # Get this lesson's duration
        if period_index < len(lesson_durations) and lesson_durations[period_index]:
            dur = int(lesson_durations[period_index])
        else:
            dur = int(default_dur)

        end_period = current_min + dur
        # Don't exceed school end time (unless we have a fixed number of periods)
        if periods_per_day > 0 or end_period <= end_min:
            result.append(PeriodSlot(
                period_index=period_index,
                start_time=_format_time(current_min),
                end_time=_format_time(end_period),
                is_break=False,
                duration_minutes=dur,
            ))
            current_min = end_period
        else:
            break

        # Insert break after this period if configured
        # after_period uses 1-based: after_period=2 means after lesson 2 (period_index=1)
        after_key = period_index + 1  # convert 0-based to 1-based
        if after_key in break_after:
            b = break_after[after_key]
            break_dur = b.get("duration_minutes", 10)
            if is_friday and b.get("friday_override_minutes") is not None:
                break_dur = b["friday_override_minutes"]
            result.append(PeriodSlot(
                period_index=-1,
                start_time=_format_time(current_min),
                end_time=_format_time(current_min + break_dur),
                is_break=True,
                break_name=b.get("name", "Break"),
                duration_minutes=break_dur,
            ))
            current_min += break_dur

        period_index += 1

    return result


def generate_week_slots(settings: dict) -> dict:
    """
    Generate period slots for all working days of the week.
    
    settings: dict with school_start_time, school_end_time, period_duration_minutes,
              breaks_json, bell_schedule_json, friday_start_time, friday_end_time,
              saturday_start_time, saturday_end_time, working_days, periods_per_day.
    """
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    working = set()
    wd = settings.get("working_days") or "1,2,3,4,5"
    for x in str(wd).split(","):
        try:
            working.add(int(x.strip()) - 1)  # 1=Mon -> index 0
        except ValueError:
            pass

    # Determine exceptional day from bell_schedule_json
    bell_raw = settings.get("bell_schedule_json") or "{}"
    bell = _parse_bell_schedule(bell_raw)
    exceptional_day_idx = bell.get("friday_day_index", 4) if bell.get("friday_different") else -1

    days_out = []
    for day_index in range(7):
        if day_index not in working:
            continue
        is_exceptional = (day_index == exceptional_day_idx)
        slots = generate_period_slots_for_day(
            day_index=day_index,
            school_start_time=settings.get("school_start_time") or "08:00",
            school_end_time=settings.get("school_end_time") or "15:00",
            period_duration_minutes=int(settings.get("period_duration_minutes") or 45),
            breaks_json=settings.get("breaks_json") or "[]",
            periods_per_day=int(settings.get("periods_per_day") or 0),
            bell_schedule_json=bell_raw,
            friday_start_time=settings.get("friday_start_time"),
            friday_end_time=settings.get("friday_end_time"),
            is_friday=is_exceptional,
            is_saturday=False,
            saturday_start_time=settings.get("saturday_start_time"),
            saturday_end_time=settings.get("saturday_end_time"),
        )
        days_out.append({
            "day_index": day_index,
            "day_name": day_names[day_index] if day_index < len(day_names) else f"Day {day_index + 1}",
            "slots": [
                {
                    "period_index": s.period_index,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "is_break": s.is_break,
                    "break_name": s.break_name,
                    "duration_minutes": s.duration_minutes,
                }
                for s in slots
            ],
        })
    return {"days": days_out}
