"""Excel import for teachers and classes — project-scoped, same format as desktop app."""
from __future__ import annotations
from dataclasses import dataclass, field
from io import BytesIO
from typing import List

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from backend.repositories import teacher_repo, class_repo


@dataclass
class RowError:
    row: int  # 1-based Excel row
    message: str


@dataclass
class ImportResult:
    success_count: int = 0
    errors: List[RowError] = field(default_factory=list)
    total_rows: int = 0

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def _cell(row: list, col_index: int) -> str:
    if col_index < len(row):
        v = row[col_index]
        return str(v).strip() if v is not None else ""
    return ""


def import_teachers_from_excel(
    db: Session, project_id: int, content: bytes
) -> ImportResult:
    """Parse teachers Excel (desktop template format) and create via teacher_repo."""
    result = ImportResult()
    wb = load_workbook(BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if len(rows) < 2:
        result.errors.append(RowError(1, "File must have a header row and at least one data row."))
        return result

    data_rows = rows[1:]
    result.total_rows = len(data_rows)
    header = [str(c).strip().lower() if c else "" for c in rows[0]]
    first_i = next((i for i, h in enumerate(header) if "first" in h and "name" in h), 0)
    last_i = next((i for i, h in enumerate(header) if "last" in h and "name" in h), 1)
    code_i = next((i for i, h in enumerate(header) if "abbreviation" in h or "code" in h), 2)
    title_i = next((i for i, h in enumerate(header) if "title" in h), 3)
    max_day_i = next((i for i, h in enumerate(header) if "max" in h and "day" in h), -1)
    max_week_i = next((i for i, h in enumerate(header) if "max" in h and "week" in h), -1)

    for row_idx, row in enumerate(rows[1:], start=2):
        row = list(row) if row else []
        first = _cell(row, first_i)
        last = _cell(row, last_i)
        if not first and not last:
            continue
        if not first:
            result.errors.append(RowError(row_idx, "First Name is required."))
            continue
        code = _cell(row, code_i) or (first[:3].upper() if first else "")
        title = _cell(row, title_i) or "Mr."
        try:
            max_day = int(_cell(row, max_day_i) or 6)
            max_week = int(_cell(row, max_week_i) or 30)
        except ValueError:
            result.errors.append(RowError(row_idx, "Max Periods Day/Week must be numbers."))
            continue
        if max_day < 1 or max_week < 1:
            result.errors.append(RowError(row_idx, "Max periods must be at least 1."))
            continue
        if teacher_repo.find_by_name(db, project_id, first, last):
            result.errors.append(
                RowError(row_idx, "A teacher with this first and last name already exists.")
            )
            continue
        try:
            teacher_repo.create(
                db,
                project_id=project_id,
                first_name=first,
                last_name=last,
                code=code,
                title=title,
                max_periods_day=max_day,
                max_periods_week=max_week,
            )
            result.success_count += 1
        except Exception as e:
            result.errors.append(RowError(row_idx, str(e)))
    return result


def import_classes_from_excel(
    db: Session, project_id: int, content: bytes
) -> ImportResult:
    """Parse classes Excel (desktop template format) and create via class_repo."""
    result = ImportResult()
    wb = load_workbook(BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if len(rows) < 2:
        result.errors.append(RowError(1, "File must have a header row and at least one data row."))
        return result

    result.total_rows = len(rows) - 1
    header = [str(c).strip().lower() if c else "" for c in rows[0]]
    grade_i = next((i for i, h in enumerate(header) if "grade" in h), 0)
    section_i = next((i for i, h in enumerate(header) if "section" in h), 1)
    stream_i = next((i for i, h in enumerate(header) if "stream" in h), -1)
    name_i = next((i for i, h in enumerate(header) if "name" in h), 2)
    if name_i >= len(header):
        name_i = max(grade_i, section_i, stream_i if stream_i >= 0 else 0) + 1

    for row_idx, row in enumerate(rows[1:], start=2):
        row = list(row) if row else []
        grade = _cell(row, grade_i)
        section = _cell(row, section_i)
        stream = _cell(row, stream_i) if stream_i >= 0 else ""
        name = _cell(row, name_i)
        if not name:
            name = f"Grade {grade} {section}".strip() or f"Row {row_idx}"
        if class_repo.find_by_grade_section_stream(db, project_id, grade, section, stream):
            result.errors.append(
                RowError(row_idx, "A class with this grade, section and stream already exists.")
            )
            continue
        try:
            code = (str(grade or "") + str(section or "")).replace(" ", "")[:10] or name[:6]
            class_repo.create(
                db,
                project_id=project_id,
                grade=grade or "",
                section=section or "",
                stream=stream or "",
                name=name,
                code=code,
                strength=30,
            )
            result.success_count += 1
        except Exception as e:
            result.errors.append(RowError(row_idx, str(e)))
    return result
