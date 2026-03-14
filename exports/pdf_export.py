"""PDF export for printable class timetables."""
from __future__ import annotations
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak,
)

from repositories.timetable_repo import TimetableRepository
from repositories.class_repo import ClassRepository
from repositories.school_repo import SchoolRepository
from repositories.teacher_repo import TeacherRepository
from repositories.lesson_repo import LessonRepository
from services.class_service import ClassService
from services.teacher_service import TeacherService
from utils.helpers import get_day_short, get_period_label, get_period_label_short, get_period_times, format_time_range, get_day_slot_sequence, color_hex_to_rgb, card_colors

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


def export_pdf(db: DatabaseConnection, path: str) -> None:
    """Export class timetables as a multi-page PDF."""
    school_repo = SchoolRepository(db)
    school = school_repo.get()
    if not school:
        raise ValueError("No school settings found.")

    import json
    bell = {}
    if school.bell_schedule_json:
        try:
            raw = school.bell_schedule_json
            bell = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(bell, dict):
                bell = {}
        except (TypeError, ValueError):
            pass
    zero_period = bool(bell.get("zero_period", False))
    num_periods = school.periods_per_day + (1 if zero_period else 0)
    num_days = school.days_per_week

    slots_per_day = [
        get_day_slot_sequence(bell, d, school.periods_per_day + (1 if zero_period else 0), zero_period)
        for d in range(num_days)
    ]
    num_slots = max(len(s) for s in slots_per_day) if slots_per_day else num_periods
    vertical_labels = []
    for r in range(num_slots):
        if slots_per_day and r < len(slots_per_day[0]):
            slot = slots_per_day[0][r]
            if slot.get("type") == "period":
                lbl = get_period_label_short(slot["period_index"], zero_period)
                vertical_labels.append(f"{lbl}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
            else:
                vertical_labels.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
        else:
            vertical_labels.append("—")

    tt_repo = TimetableRepository(db)
    class_repo = ClassRepository(db)
    classes = ClassService(db).get_all()

    doc = SimpleDocTemplate(
        path, pagesize=landscape(A4),
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    for cls_idx, cls in enumerate(classes):
        entries = tt_repo.get_by_class(cls.id)

        # Title
        elements.append(Paragraph(
            f"<b>{school.name}</b> - {school.academic_year}",
            styles["Title"],
        ))
        elements.append(Paragraph(
            f"Timetable: <b>{cls.name}</b>",
            styles["Heading2"],
        ))
        elements.append(Spacer(1, 0.5 * cm))

        # Build data: days vertical (rows), time slots horizontal (columns)
        header = ["Day"] + [vertical_labels[col] if col < len(vertical_labels) else "—" for col in range(num_slots)]
        data = [header]

        entry_map: dict[tuple[int, int], object] = {}
        for e in entries:
            entry_map[(e.day_index, e.period_index)] = e

        for day in range(num_days):
            row_label = get_day_short(day)
            row = [row_label]
            day_slots = slots_per_day[day] if day < len(slots_per_day) else []
            for col in range(num_slots):
                if col >= len(day_slots):
                    row.append("")
                    continue
                slot = day_slots[col]
                if slot.get("type") == "period":
                    entry = entry_map.get((day, slot.get("period_index", 0)))
                    if entry:
                        text = entry.subject_code or entry.subject_name
                        if entry.teacher_name:
                            text += f"\n{entry.teacher_name}"
                        if entry.room_name:
                            text += f"\n{entry.room_name}"
                        row.append(text)
                    else:
                        row.append("")
                else:
                    row.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
            data.append(row)

        # Column widths: day column + one per slot
        available_width = landscape(A4)[0] - 3 * cm
        day_col_width = 2.5 * cm
        slot_col_width = (available_width - day_col_width) / num_slots
        col_widths = [day_col_width] + [slot_col_width] * num_slots

        table = Table(data, colWidths=col_widths, repeatRows=1)

        # Style: header row, day column (col 0), then grid
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#ECF0F1")),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (1, 1), (-1, -1), 8),
            ("ROWHEIGHTS", (0, 0), (-1, -1), 1.2 * cm),
        ]

        for day in range(num_days):
            day_slots = slots_per_day[day] if day < len(slots_per_day) else []
            for col in range(num_slots):
                if col >= len(day_slots):
                    continue
                slot = day_slots[col]
                row_idx_1 = day + 1
                col_idx = col + 1
                if slot.get("type") == "period":
                    entry = entry_map.get((day, slot.get("period_index", 0)))
                    if entry:
                        bg_hex, fg_hex = card_colors(entry.subject_color)
                        r, g, b = color_hex_to_rgb(bg_hex)
                        bg = colors.Color(r / 255, g / 255, b / 255)
                        fg = colors.black if fg_hex.upper() == "#000000" else colors.white
                        style_cmds.append(("BACKGROUND", (col_idx, row_idx_1), (col_idx, row_idx_1), bg))
                        style_cmds.append(("TEXTCOLOR", (col_idx, row_idx_1), (col_idx, row_idx_1), fg))
                else:
                    style_cmds.append(("BACKGROUND", (col_idx, row_idx_1), (col_idx, row_idx_1), colors.HexColor("#E8E8E8")))

        table.setStyle(TableStyle(style_cmds))
        elements.append(table)

        if cls_idx < len(classes) - 1:
            elements.append(PageBreak())

    doc.build(elements)


def export_teacher_pdf(db: DatabaseConnection, path: str) -> None:
    """Export teacher timetables as a multi-page PDF with total weekly workload per teacher."""
    school_repo = SchoolRepository(db)
    school = school_repo.get()
    if not school:
        raise ValueError("No school settings found.")

    import json
    bell = {}
    if school.bell_schedule_json:
        try:
            raw = school.bell_schedule_json
            bell = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(bell, dict):
                bell = {}
        except (TypeError, ValueError):
            pass
    zero_period = bool(bell.get("zero_period", False))
    num_periods = school.periods_per_day + (1 if zero_period else 0)
    num_days = school.days_per_week

    slots_per_day = [
        get_day_slot_sequence(bell, d, school.periods_per_day + (1 if zero_period else 0), zero_period)
        for d in range(num_days)
    ]
    num_slots = max(len(s) for s in slots_per_day) if slots_per_day else num_periods
    vertical_labels = []
    for r in range(num_slots):
        if slots_per_day and r < len(slots_per_day[0]):
            slot = slots_per_day[0][r]
            if slot.get("type") == "period":
                lbl = get_period_label_short(slot["period_index"], zero_period)
                vertical_labels.append(f"{lbl}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
            else:
                vertical_labels.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
        else:
            vertical_labels.append("—")

    tt_repo = TimetableRepository(db)
    teacher_repo = TeacherRepository(db)
    lesson_repo = LessonRepository(db)
    teachers = TeacherService(db).get_all()
    all_lessons = lesson_repo.get_all()

    doc = SimpleDocTemplate(
        path, pagesize=landscape(A4),
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    for t_idx, teacher in enumerate(teachers):
        entries = tt_repo.get_by_teacher(teacher.id)
        total_periods = sum(l.periods_per_week for l in all_lessons if l.teacher_id == teacher.id)

        # Title
        elements.append(Paragraph(
            f"<b>{school.name}</b> - {school.academic_year}",
            styles["Title"],
        ))
        elements.append(Paragraph(
            f"Timetable: <b>{teacher.full_name}</b>",
            styles["Heading2"],
        ))
        elements.append(Spacer(1, 0.5 * cm))

        # Build data: days vertical (rows), time slots horizontal (columns)
        header = ["Day"] + [vertical_labels[col] if col < len(vertical_labels) else "—" for col in range(num_slots)]
        data = [header]

        entry_map: dict[tuple[int, int], object] = {}
        for e in entries:
            entry_map[(e.day_index, e.period_index)] = e

        for day in range(num_days):
            row = [get_day_short(day)]
            day_slots = slots_per_day[day] if day < len(slots_per_day) else []
            for col in range(num_slots):
                if col >= len(day_slots):
                    row.append("")
                    continue
                slot = day_slots[col]
                if slot.get("type") == "period":
                    entry = entry_map.get((day, slot.get("period_index", 0)))
                    if entry:
                        text = entry.subject_code or entry.subject_name
                        if entry.class_name:
                            text += f"\n{entry.class_name}"
                        if entry.room_name:
                            text += f"\n{entry.room_name}"
                        row.append(text)
                    else:
                        row.append("")
                else:
                    row.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
            data.append(row)

        available_width = landscape(A4)[0] - 3 * cm
        day_col_width = 2.5 * cm
        slot_col_width = (available_width - day_col_width) / num_slots
        col_widths = [day_col_width] + [slot_col_width] * num_slots

        table = Table(data, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#ECF0F1")),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (1, 1), (-1, -1), 8),
            ("ROWHEIGHTS", (0, 0), (-1, -1), 1.2 * cm),
        ]

        for day in range(num_days):
            day_slots = slots_per_day[day] if day < len(slots_per_day) else []
            for col in range(num_slots):
                if col >= len(day_slots):
                    continue
                slot = day_slots[col]
                row_idx_1 = day + 1
                col_idx = col + 1
                if slot.get("type") == "period":
                    entry = entry_map.get((day, slot.get("period_index", 0)))
                    if entry:
                        bg_hex, fg_hex = card_colors(entry.subject_color)
                        r, g, b = color_hex_to_rgb(bg_hex)
                        bg = colors.Color(r / 255, g / 255, b / 255)
                        fg = colors.black if fg_hex.upper() == "#000000" else colors.white
                        style_cmds.append(("BACKGROUND", (col_idx, row_idx_1), (col_idx, row_idx_1), bg))
                        style_cmds.append(("TEXTCOLOR", (col_idx, row_idx_1), (col_idx, row_idx_1), fg))
                else:
                    style_cmds.append(("BACKGROUND", (col_idx, row_idx_1), (col_idx, row_idx_1), colors.HexColor("#E8E8E8")))

        table.setStyle(TableStyle(style_cmds))
        elements.append(table)

        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph(
            f"<b>Total weekly periods: {total_periods}</b>",
            styles["Normal"],
        ))

        if t_idx < len(teachers) - 1:
            elements.append(PageBreak())

    doc.build(elements)


def _sanitize_filename(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in " _-").strip() or "file"


def export_single_teacher_pdf(db: DatabaseConnection, teacher_id: int, path: str) -> None:
    """Export one teacher's timetable to a single PDF (email/WhatsApp-ready)."""
    from repositories.teacher_repo import TeacherRepository
    from repositories.lesson_repo import LessonRepository
    school_repo = SchoolRepository(db)
    school = school_repo.get()
    if not school:
        raise ValueError("No school settings found.")
    teacher_repo = TeacherRepository(db)
    teacher = teacher_repo.get_by_id(teacher_id)
    if not teacher:
        raise ValueError("Teacher not found.")
    tt_repo = TimetableRepository(db)
    lesson_repo = LessonRepository(db)
    entries = tt_repo.get_by_teacher(teacher_id)
    all_lessons = lesson_repo.get_all()
    total_weekly_periods = sum(l.periods_per_week for l in all_lessons if l.teacher_id == teacher_id)
    import json
    bell = {}
    if school.bell_schedule_json:
        try:
            raw = school.bell_schedule_json
            bell = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(bell, dict):
                bell = {}
        except (TypeError, ValueError):
            pass
    zero_period = bool(bell.get("zero_period", False))
    num_periods = school.periods_per_day + (1 if zero_period else 0)
    num_days = school.days_per_week
    slots_per_day = [
        get_day_slot_sequence(bell, d, school.periods_per_day + (1 if zero_period else 0), zero_period)
        for d in range(num_days)
    ]
    num_slots = max(len(s) for s in slots_per_day) if slots_per_day else num_periods
    vertical_labels = []
    for r in range(num_slots):
        if slots_per_day and r < len(slots_per_day[0]):
            slot = slots_per_day[0][r]
            if slot.get("type") == "period":
                lbl = get_period_label_short(slot["period_index"], zero_period)
                vertical_labels.append(f"{lbl}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
            else:
                vertical_labels.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
        else:
            vertical_labels.append("—")
    doc = SimpleDocTemplate(path, pagesize=landscape(A4), leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"<b>{school.name}</b> - {school.academic_year}", styles["Title"]),
                Paragraph(f"Timetable: <b>{teacher.full_name}</b>", styles["Heading2"]), Spacer(1, 0.5*cm)]
    header = ["Day"] + [vertical_labels[col] if col < len(vertical_labels) else "—" for col in range(num_slots)]
    data = [header]
    entry_map = {(e.day_index, e.period_index): e for e in entries}
    for day in range(num_days):
        row = [get_day_short(day)]
        day_slots = slots_per_day[day] if day < len(slots_per_day) else []
        for col in range(num_slots):
            if col >= len(day_slots):
                row.append("")
                continue
            slot = day_slots[col]
            if slot.get("type") == "period":
                entry = entry_map.get((day, slot.get("period_index", 0)))
                row.append(_cell_text(entry, for_teacher=True) if entry else "")
            else:
                row.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
        data.append(row)
    table, style_cmds = _build_table_with_slots(data, num_days, num_slots, slots_per_day, entry_map)
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(f"<b>Total weekly periods: {total_weekly_periods}</b>", styles["Normal"]))
    doc.build(elements)


def _cell_text(entry, for_teacher: bool = False) -> str:
    text = entry.subject_code or entry.subject_name
    if for_teacher:
        if entry.class_name:
            text += f"\n{entry.class_name}"
    else:
        if entry.teacher_name:
            text += f"\n{entry.teacher_name}"
    if entry.room_name:
        text += f"\n{entry.room_name}"
    return text


def _build_table_with_colors(data, num_days, num_periods, entry_map):
    available_width = landscape(A4)[0] - 3*cm
    period_col_width, day_col_width = 2.5*cm, (available_width - 2.5*cm) / num_days
    col_widths = [period_col_width] + [day_col_width]*num_days
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#ECF0F1")),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (1, 1), (-1, -1), 8),
        ("ROWHEIGHTS", (0, 0), (-1, -1), 1.2*cm),
    ]
    for p in range(num_periods):
        for d in range(num_days):
            entry = entry_map.get((d, p))
            if entry:
                bg_hex, fg_hex = card_colors(entry.subject_color)
                r, g, b = color_hex_to_rgb(bg_hex)
                bg = colors.Color(r/255, g/255, b/255)
                fg = colors.black if fg_hex.upper() == "#000000" else colors.white
                row_idx, col_idx = p+1, d+1
                style_cmds.append(("BACKGROUND", (col_idx, row_idx), (col_idx, row_idx), bg))
                style_cmds.append(("TEXTCOLOR", (col_idx, row_idx), (col_idx, row_idx), fg))
    return table, style_cmds


def _build_table_with_slots(data, num_days, num_slots, slots_per_day, entry_map):
    """Build table and style: days as rows, slots as columns (transposed)."""
    available_width = landscape(A4)[0] - 3*cm
    day_col_width = 2.5*cm
    slot_col_width = (available_width - day_col_width) / num_slots
    col_widths = [day_col_width] + [slot_col_width]*num_slots
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#ECF0F1")),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (1, 1), (-1, -1), 8),
        ("ROWHEIGHTS", (0, 0), (-1, -1), 1.2*cm),
    ]
    for day in range(num_days):
        day_slots = slots_per_day[day] if day < len(slots_per_day) else []
        for col in range(num_slots):
            if col >= len(day_slots):
                continue
            slot = day_slots[col]
            row_idx_1 = day + 1
            col_idx = col + 1
            if slot.get("type") == "period":
                entry = entry_map.get((day, slot.get("period_index", 0)))
                if entry:
                    bg_hex, fg_hex = card_colors(entry.subject_color)
                    r, g, b = color_hex_to_rgb(bg_hex)
                    bg = colors.Color(r/255, g/255, b/255)
                    fg = colors.black if fg_hex.upper() == "#000000" else colors.white
                    style_cmds.append(("BACKGROUND", (col_idx, row_idx_1), (col_idx, row_idx_1), bg))
                    style_cmds.append(("TEXTCOLOR", (col_idx, row_idx_1), (col_idx, row_idx_1), fg))
            else:
                style_cmds.append(("BACKGROUND", (col_idx, row_idx_1), (col_idx, row_idx_1), colors.HexColor("#E8E8E8")))
    return table, style_cmds


def export_single_class_pdf(db: DatabaseConnection, class_id: int, path: str) -> None:
    """Export one class timetable to a single PDF (for class teacher email/WhatsApp delivery)."""
    from repositories.class_repo import ClassRepository
    school_repo = SchoolRepository(db)
    school = school_repo.get()
    if not school:
        raise ValueError("No school settings found.")
    class_repo = ClassRepository(db)
    cls = class_repo.get_by_id(class_id)
    if not cls:
        raise ValueError("Class not found.")
    tt_repo = TimetableRepository(db)
    entries = tt_repo.get_by_class(class_id)
    import json
    bell = {}
    if school.bell_schedule_json:
        try:
            raw = school.bell_schedule_json
            bell = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(bell, dict):
                bell = {}
        except (TypeError, ValueError):
            pass
    zero_period = bool(bell.get("zero_period", False))
    num_periods = school.periods_per_day + (1 if zero_period else 0)
    num_days = school.days_per_week
    slots_per_day = [
        get_day_slot_sequence(bell, d, school.periods_per_day + (1 if zero_period else 0), zero_period)
        for d in range(num_days)
    ]
    num_slots = max(len(s) for s in slots_per_day) if slots_per_day else num_periods
    vertical_labels = []
    for r in range(num_slots):
        if slots_per_day and r < len(slots_per_day[0]):
            slot = slots_per_day[0][r]
            if slot.get("type") == "period":
                lbl = get_period_label_short(slot["period_index"], zero_period)
                vertical_labels.append(f"{lbl}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
            else:
                vertical_labels.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
        else:
            vertical_labels.append("—")
    doc = SimpleDocTemplate(path, pagesize=landscape(A4), leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"<b>{school.name}</b> - {school.academic_year}", styles["Title"]),
                Paragraph(f"Class Timetable: <b>{cls.name}</b>", styles["Heading2"]), Spacer(1, 0.5*cm)]
    header = ["Day"] + [vertical_labels[col] if col < len(vertical_labels) else "—" for col in range(num_slots)]
    data = [header]
    entry_map = {(e.day_index, e.period_index): e for e in entries}
    for day in range(num_days):
        row = [get_day_short(day)]
        day_slots = slots_per_day[day] if day < len(slots_per_day) else []
        for col in range(num_slots):
            if col >= len(day_slots):
                row.append("")
                continue
            slot = day_slots[col]
            if slot.get("type") == "period":
                entry = entry_map.get((day, slot.get("period_index", 0)))
                row.append(_cell_text(entry, for_teacher=False) if entry else "")
            else:
                row.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
        data.append(row)
    table, style_cmds = _build_table_with_slots(data, num_days, num_slots, slots_per_day, entry_map)
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)
    doc.build(elements)
