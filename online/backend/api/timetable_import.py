"""Timetable import: parse CSV/Excel/PDF to extract teachers, subjects, classes.
Also provides per-project demo data loader."""
from __future__ import annotations
import io, re, csv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.models.base import get_db
from backend.models.project import Project, Subject
from backend.models.teacher_model import Teacher
from backend.models.class_model import SchoolClass
from backend.models.room_model import Room
from backend.models.lesson_model import Lesson
from backend.models.timetable_history import TimetableHistory
from backend.auth.project_scope import get_project_or_404

router = APIRouter()


# ── Extraction result ─────────────────────────────────────────────────────

class TimetableExtract:
    def __init__(self):
        self.teachers: list[dict]  = []
        self.classes:  list[dict]  = []
        self.subjects: list[dict]  = []
        self.slots:    list[dict]  = []
        self.periods:  int         = 0
        self.days:     int         = 0
        self.warnings: list[str]  = []


# ── Parsers ───────────────────────────────────────────────────────────────

def _split_cell(val: str):
    """Try to split 'Subject - Teacher' or 'Teacher / Subject'."""
    parts = re.split(r'[-/|]', val, maxsplit=1)
    if len(parts) >= 2:
        return parts[0].strip().title(), parts[1].strip().title()
    return None, val.strip().title()


def parse_csv_timetable(content: bytes) -> TimetableExtract:
    ext = TimetableExtract()
    teachers: set[str]  = set()
    subjects: set[str]  = set()
    try:
        text = content.decode("utf-8-sig")
    except Exception:
        text = content.decode("latin-1")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        ext.warnings.append("Empty CSV file")
        return ext

    for ri, row in enumerate(rows[1:], 1):
        for ci, cell in enumerate(row[1:], 1):
            val = cell.strip()
            if not val:
                continue
            subj, teacher = _split_cell(val)
            if subj:
                subjects.add(subj)
            teachers.add(teacher)
            ext.slots.append({"period": ri, "col": ci, "raw": val})

    ext.teachers = [{"name": t} for t in sorted(teachers)]
    ext.subjects = [{"name": s} for s in sorted(subjects)]
    ext.periods  = max((s["period"] for s in ext.slots), default=0)
    ext.days     = max((s["col"] for s in ext.slots), default=0)
    return ext


def parse_excel_timetable(content: bytes) -> TimetableExtract:
    ext = TimetableExtract()
    teachers: set[str]  = set()
    subjects: set[str]  = set()
    classes:  list[dict] = []
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception as e:
        ext.warnings.append(f"Could not parse Excel: {e}")
        return ext

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        ext.warnings.append("Empty spreadsheet")
        return ext

    # Detect class/day headers from first row
    for cell in rows[0][1:]:
        val = str(cell or "").strip()
        if val and not any(d in val.lower() for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]):
            match = re.search(r'(\d{1,2})\s*[-\u2013]?\s*([A-Za-z])', val)
            if match:
                classes.append({"name": val, "grade": match.group(1), "section": match.group(2).upper()})
            elif val:
                classes.append({"name": val, "grade": None, "section": None})

    for ri, row in enumerate(rows[1:], 1):
        for ci, cell in enumerate(row[1:], 1):
            val = str(cell or "").strip()
            if not val or val == "None":
                continue
            subj, teacher = _split_cell(val)
            if subj:
                subjects.add(subj)
            teachers.add(teacher)
            ext.slots.append({"period": ri, "col": ci, "raw": val})

    ext.teachers = [{"name": t} for t in sorted(teachers)]
    ext.subjects = [{"name": s} for s in sorted(subjects)]
    ext.classes  = classes
    ext.periods  = max((s["period"] for s in ext.slots), default=0)
    ext.days     = max((s["col"] for s in ext.slots), default=0)
    return ext


def parse_pdf_timetable(content: bytes) -> TimetableExtract:
    ext = TimetableExtract()
    teachers: set[str] = set()
    subjects: set[str] = set()
    try:
        import pdfplumber
        pdf = pdfplumber.open(io.BytesIO(content))
    except Exception as e:
        ext.warnings.append(f"Could not parse PDF: {e}")
        return ext

    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for ri, row in enumerate(table):
                if not row:
                    continue
                for ci, cell in enumerate(row):
                    val = str(cell or "").strip()
                    if not val:
                        continue
                    subj, teacher = _split_cell(val)
                    if subj:
                        subjects.add(subj)
                    if teacher and len(teacher) > 1:
                        teachers.add(teacher)
                    ext.slots.append({"period": ri, "col": ci, "raw": val})

    ext.teachers = [{"name": t} for t in sorted(teachers)]
    ext.subjects = [{"name": s} for s in sorted(subjects)]
    ext.periods  = max((s["period"] for s in ext.slots), default=0)
    ext.days     = max((s["col"] for s in ext.slots), default=0)
    pdf.close()
    return ext


# ── Import endpoint ──────────────────────────────────────────────────────

@router.post("/import-timetable")
async def import_timetable(
    project: Project = Depends(get_project_or_404),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    fname = file.filename or ""
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""

    if ext in ("xlsx", "xls"):
        extracted = parse_excel_timetable(content)
    elif ext == "csv":
        extracted = parse_csv_timetable(content)
    elif ext == "pdf":
        extracted = parse_pdf_timetable(content)
    else:
        raise HTTPException(400, f"Unsupported file type: .{ext}. Use CSV, Excel, or PDF.")

    return {
        "teachers":  extracted.teachers,
        "classes":   extracted.classes,
        "subjects":  extracted.subjects,
        "periods":   extracted.periods,
        "days":      extracted.days,
        "slots":     extracted.slots,
        "warnings":  extracted.warnings,
    }


# ── Confirm import: save extracted data ─────────────────────────────────

class ConfirmImportData(BaseModel):
    teachers: list[dict] = []
    subjects: list[dict] = []
    classes:  list[dict] = []


@router.post("/confirm-import")
def confirm_import(
    data: ConfirmImportData,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    created_subjects = 0
    created_teachers = 0
    created_classes  = 0

    for s in data.subjects:
        name = s.get("name", "").strip()
        if name:
            db.add(Subject(project_id=project.id, name=name))
            created_subjects += 1

    for t in data.teachers:
        name = t.get("name", "").strip()
        if name:
            parts = name.split(" ", 1)
            db.add(Teacher(
                project_id=project.id,
                first_name=parts[0],
                last_name=parts[1] if len(parts) > 1 else "",
            ))
            created_teachers += 1

    for c in data.classes:
        name = c.get("name", "").strip()
        if name:
            db.add(SchoolClass(
                project_id=project.id,
                name=name,
                grade=c.get("grade", ""),
                section=c.get("section", ""),
            ))
            created_classes += 1

    db.add(TimetableHistory(
        project_id=project.id,
        action="uploaded",
        description=f"Imported: {created_teachers} teachers, {created_subjects} subjects, {created_classes} classes",
        teacher_count=created_teachers,
        class_count=created_classes,
    ))
    db.commit()

    return {
        "ok": True,
        "created_teachers": created_teachers,
        "created_subjects": created_subjects,
        "created_classes":  created_classes,
    }


# ── Per-project demo data loader ─────────────────────────────────────────

@router.post("/load-demo")
def load_demo_data(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    """Clear existing data and load the rich Pakistani O-Level demo dataset."""
    pid = project.id

    # Clear existing data for this project
    db.query(Lesson).filter(Lesson.project_id == pid).delete()
    db.query(Teacher).filter(Teacher.project_id == pid).delete()
    db.query(Subject).filter(Subject.project_id == pid).delete()
    db.query(SchoolClass).filter(SchoolClass.project_id == pid).delete()
    db.query(Room).filter(Room.project_id == pid).delete()
    db.flush()

    from backend.services.demo_data import seed_demo_data
    counts = seed_demo_data(pid, db)

    return {
        "ok": True,
        "message": f"Demo data loaded: {counts['classes']} classes, {counts['teachers']} teachers, {counts['subjects']} subjects",
        **counts,
    }
