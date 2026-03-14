# Pilot Readiness and Production Polish — Audit

## Part 1: Audit of Current State

### 1.1 Pilot checklist and documentation
- **Current:** No pilot readiness checklist in docs or in-app. No PILOT_READINESS_CHECKLIST.md, REAL_SCHOOL_IMPORT_GUIDE.md, PILOT_TEST_SCENARIOS.md, or KNOWN_LIMITATIONS.md.
- **Gap:** Admin has no structured way to confirm project is ready before use; no issue logging structure.

### 1.2 Import flows
- **Current:** Teachers, classes, subjects, lessons import from Excel with row-level validation (`RowError`, `ImportResult`). Errors shown in a message box **after** import runs; successful rows are already committed. No preview-before-commit; no “total/valid/invalid/duplicate” summary before writing.
- **Duplicate handling:** Teachers/classes/subjects reject duplicates with a clear error and skip that row; no option to “block entire import” or “skip duplicates” as a mode—behavior is fixed (skip row, report error).
- **Gap:** User cannot see a validation summary and then choose to confirm or cancel; data can be partially imported before errors are seen.

### 1.3 Exports
- **Excel:** Uses `ClassRepository(db).get_all()` and `TeacherRepository(db).get_all()` directly. Class order is DB `ORDER BY grade, section` (text); teacher order is `ORDER BY first_name, last_name`. Services use `class_sort_key` / `teacher_sort_key` for UI but exports do not—**order can differ from UI**.
- **PDF:** Same—uses `class_repo.get_all()`, `teacher_repo.get_all()`. No use of display_utils or services for order.
- **Time display:** Excel and PDF use `get_day_slot_sequence`, `format_time_range`, `get_period_label_short`; zero period and breaks are reflected. Friday uses `get_day_bell(bell, 4)` in slot sequence. **Largely consistent**; worth verifying Friday in export explicitly.
- **Teacher workload:** Excel shows “Total Weekly Workload: X teaching periods” per teacher sheet and a “Teacher Load” sheet with Total Assigned, Max/Week, Max/Day. PDF teacher export has workload. **Terminology:** “Total Assigned” vs “Total Weekly Workload” vs “teaching periods”—should be one consistent label.
- **Master timetable:** Classes iterated in repo order; no explicit academic sort. Print layout: margins and table layout exist; no explicit “fit to page” or page-break control for master.

### 1.4 Generation flow
- **Pre-generation:** `validate_for_generation()` returns `ValidationResult` (errors, warnings, grouped_errors). Generate page runs validation on enter and shows errors/warnings in a QTextEdit; “Validate Data” and “Generate Timetable” buttons. **No explicit readiness summary** (e.g. “Teachers: 24, Classes: 30, Lessons: 210, Hard conflicts: 0, Warnings: 3”) before generate.
- **Post-generation:** On success, shows “Timetable generated successfully!”, conflicts count, unscheduled lessons list. **No single-line summary** (e.g. “Scheduled: 206, Unscheduled: 4, Conflicts: 0”). On failure, shows solver messages and validation reasons.

### 1.5 Empty states and labels
- **Current:** Some pages show tables that are empty with no message (e.g. no “No teachers added yet. Add at least one teacher before creating lessons.”). Lesson page has a warning banner when teachers/subjects/classes are missing. Not all list/table empty states have guidance.
- **Labels:** Grade/class/teacher/subject display use `display_utils` in dialogs and review; exports use raw `cls.name`, `teacher.full_name`—mostly consistent. “Lesson length (periods)” vs “Duration” may appear in different places; worth standardizing.

### 1.6 Keyboard and tab
- **Current:** No documented focus shortcuts for filter fields in Bulk/Copy dialogs. Enter/Escape behavior is default (Enter can trigger default button). Tab order not explicitly reviewed.

---

## Part 2: Gaps and Risks Before Pilot

| Area | Gap / Risk |
|------|------------|
| **Pilot checklist** | No checklist for school admin to confirm setup, bell schedule, Friday timing, exports, sample generation, workload, conflicts, unscheduled. |
| **Issue logging** | No structure (title, screen, steps, expected/actual, priority, status) for recording pilot issues. |
| **Import safety** | No preview before commit; user sees errors only after some rows are imported. No “total/valid/invalid/duplicate” summary or confirm/cancel flow. |
| **Export order** | Classes and teachers in Excel/PDF use repo order, not the same academic/display order as UI (services sort). |
| **Workload label** | “Total Weekly Workload” vs “Total Assigned” vs “teaching periods”—inconsistent across Excel/PDF/summary. |
| **Readiness summary** | No clear pre-generation counts (teachers, classes, subjects, rooms, lessons) and validation summary in one place. |
| **Post-generation summary** | No one-line “Scheduled X, Unscheduled Y, Conflicts Z” at top of result. |
| **Empty states** | Some empty tables/pages lack guidance text. |
| **Real dataset validation** | Validation exists but no single “pilot data validation summary” screen before generation. |
| **Documentation** | No PILOT_READINESS_CHECKLIST.md, REAL_SCHOOL_IMPORT_GUIDE.md, PILOT_TEST_SCENARIOS.md, KNOWN_LIMITATIONS.md. |

---

## Part 3: Implementation Plan (Safe Order)

1. **Documentation (no code risk)**  
   - Add `docs/PILOT_READINESS_CHECKLIST.md` (checklist items from prompt).  
   - Add `docs/PILOT_ISSUE_TEMPLATE.md` (issue title, screen, steps, expected/actual, priority, status).  
   - Add `docs/KNOWN_LIMITATIONS.md` (short list of current limitations).  
   - Add or extend `docs/REAL_SCHOOL_IMPORT_GUIDE.md` (prepare data, import, validate, templates).

2. **Export ordering**  
   - In `exports/excel_export.py` and `exports/pdf_export.py`, use `ClassService(db).get_all()` and `TeacherService(db).get_all()` (or equivalent sorted lists) so class and teacher order match UI. Keep repo usage where only IDs/entities are needed and order comes from service.

3. **Teacher workload label**  
   - Standardize on one phrase (e.g. “Total weekly periods” or “Teaching periods per week”) in Excel teacher sheet, Teacher Load sheet, and PDF teacher export.

4. **Import preview (validation-only + dialog)**  
   - Add `validate_teachers_import(db, path) -> ImportResult` (and similar for classes, subjects, lessons) that run the same validation and row logic but **do not** commit; return counts and row errors.  
   - Add a small “Import preview” dialog: run validate, show “Total rows / Valid / Invalid / Duplicates” and list of row errors; buttons “Import valid rows” and “Cancel”. On “Import valid rows”, run existing import (which will skip invalid/duplicate again). Alternatively: run import in a transaction and rollback if user cancels after preview—simpler is “preview = validate only”, then “Confirm” runs real import.

5. **Generation readiness summary**  
   - On Generate page, before or beside “Validate Data”, show a short summary: counts of teachers, classes, subjects, rooms, lessons; and “Validation: Pass / Fail (N errors)”. Use existing validation; no new validation logic.

6. **Post-generation summary**  
   - After successful generation, prepend a single summary line: “Scheduled: X lessons, Unscheduled: Y, Conflicts: Z” (using existing conflicts and unscheduled data).

7. **Empty state guidance**  
   - Add a line or label on relevant wizard pages when the main table is empty (e.g. “No teachers yet. Add or import from Excel.”).

8. **Optional**  
   - Focus shortcut for filter in Bulk/Copy (e.g. Ctrl+F focuses filter).  
   - Export error list from import preview to file.

---

## Part 5: Files Changed (Implementation Summary)

| File | Change |
|------|--------|
| `docs/PILOT_READINESS_AUDIT.md` | This audit; Parts 5 and 8 added. |
| `docs/PILOT_READINESS_CHECKLIST.md` | New: checklist for school admin. |
| `docs/PILOT_ISSUE_TEMPLATE.md` | New: issue logging template. |
| `docs/KNOWN_LIMITATIONS.md` | New: current limitations list. |
| `docs/REAL_SCHOOL_IMPORT_GUIDE.md` | New: prepare/import/validate guide. |
| `docs/PILOT_TEST_SCENARIOS.md` | New: test scenarios for pilot. |
| `imports/excel_import.py` | `dry_run` on all import functions; `ImportResult.total_rows`, `invalid_count`; no commit when `dry_run=True`. |
| `ui/dialogs/import_preview_dialog.py` | New: preview dialog and `run_import_preview()`. |
| `ui/wizard/teachers_page.py` | Use `run_import_preview`; empty-state label. |
| `ui/wizard/classes_page.py` | Use `run_import_preview`; empty-state label. |
| `ui/wizard/subjects_page.py` | Use `run_import_preview`; empty-state label. |
| `ui/wizard/lessons_page.py` | Use `run_import_preview`. |
| `ui/wizard/generate_page.py` | Readiness summary (counts); post-gen one-liner (scheduled/unscheduled/conflicts). |
| `exports/excel_export.py` | `ClassService`/`TeacherService` for order; "Total weekly periods" / "Weekly periods" label. |
| `exports/pdf_export.py` | `ClassService`/`TeacherService`; `LessonRepository` for workload; "Total weekly periods" label. |
| `tests/test_imports.py` | Test `dry_run` does not commit. |

---

## Part 8: Remaining Limitations Before Full Production

- **Import:** Preview shows valid/invalid counts and row errors; duplicate policy remains "skip row and report". No "block entire file" or "merge" option. Export of error list to file not implemented.
- **Exports:** Academic order and workload label are now consistent; print layout (page breaks, fit-to-page) is unchanged.
- **Generation:** Readiness and post-gen summaries added; solver behavior and validation rules unchanged. No in-app pilot issue logger; use PILOT_ISSUE_TEMPLATE.md externally.
- **Keyboard/tab:** Focus shortcuts and tab order not added in this phase.
- **Scale:** Very large schools (hundreds of sections) may need higher time limits and can still see slower UI; no architectural change in this phase.
- **Out of scope:** No ERP, email, WhatsApp, cloud sync, or AI scheduling in this phase.
