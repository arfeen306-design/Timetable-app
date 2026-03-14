# Part 4: Files Changed and Why

## Phase 1 — UI polish and dropdowns

| File | Change | Why |
|------|--------|-----|
| `ui/wizard/review_page.py` | Import `make_searchable`; call it on `class_combo`, `teacher_combo`, `room_combo`. | Ensures dropdown items stay readable on hover/selection (no white-on-white). |
| `ui/wizard/constraints_page.py` | Import `make_searchable`; call it on `entity_combo`. | Same readability for teacher/class/room selector. |
| `ui/dialogs/class_dialog.py` | Import `make_searchable`; call it on `teacher_combo` and `room_combo`. | Same for class teacher and home room combos. |

## Phase 2 — Subject library and Excel import

| File | Change | Why |
|------|--------|-----|
| `utils/helpers.py` | Extended `DEFAULT_SUBJECTS` with 7 entries (Arts, Bus, Com, Acc, Add Math, Hist, Geo); aligned abbreviations (e.g. Eng, Chem, Comp, Physics). | Part 2 spec: add subjects with given abbreviations; keep existing list. |
| `imports/excel_import.py` | Added `import_lessons_from_excel()`: reads Teacher, Subject, Class, Periods Per Week; resolves by name/code; inserts lessons with row-level errors. | Part 5: teacher–subject–class mapping import from Excel. |
| `imports/sample_templates.py` | Added `write_lessons_template()`: writes sample Excel with headers and one row. | Part 5: sample template for lesson import. |
| `ui/wizard/lessons_page.py` | Import from excel_import and sample_templates; added "Import from Excel" and "Download Template" buttons; `_import_excel()` and `_download_lesson_template()`. | Part 5: UI for lesson mapping import and template download. |

## Phase 3 — Whole-day unavailability

| File | Change | Why |
|------|--------|-----|
| `ui/wizard/constraints_page.py` | Added "Unavailable whole day" row with one checkbox per day; `_on_whole_day_toggled(day, checked)` sets all period checkboxes for that day; load syncs whole-day from existing constraints. | Part 3: one-click whole-day unavailable for teachers/classes/rooms. |

## Phase 4 — Bell schedule: zero period and period times

| File | Change | Why |
|------|--------|-----|
| `utils/helpers.py` | `get_period_label(index, zero_period=False)`; added `_parse_time`, `_time_to_str`, `get_period_times(bell, period_index, zero_period)`. | Part 1: zero period label and period start/end times from bell. |
| `ui/wizard/review_page.py` | Parse `bell_schedule_json`; compute `display_periods` (include zero when enabled); set grid row count and vertical headers to label + start–end time. | Part 1: zero period and times on class/teacher/room timetable. |
| `solver/engine.py` | Parse `bell_schedule_json` (handle sqlite3.Row and list default); when `zero_period` true, `num_periods = periods_per_day + 1`; use for total_slots and slot building. | Part 1: solver respects zero period as extra slot. |
| `exports/excel_export.py` | Parse bell; `num_periods` includes zero; period column = label + start–end in class, teacher, and master sheets. | Part 1: zero period and times in Excel. |
| `exports/pdf_export.py` | Same in `export_pdf`, `export_teacher_pdf`, `export_single_teacher_pdf`, `export_single_class_pdf`: parse bell, use `num_periods` and period label+times. | Part 1: zero period and times in PDF. |
| `ui/wizard/constraints_page.py` | Parse bell; use `num_periods` (with zero) and `get_period_label(p, zero_period)` for grid. | Part 1: constraint grid shows zero period row when enabled. |

## Robustness (bell_schedule_json shape)

| File | Change | Why |
|------|--------|-----|
| `solver/engine.py` | Use `school["bell_schedule_json"]` in try; treat parsed list as `bell = {}`. | sqlite3.Row has no `.get`; DB default `'[]'` parses to list. |
| `exports/excel_export.py`, `exports/pdf_export.py`, `ui/wizard/review_page.py`, `ui/wizard/constraints_page.py` | After `json.loads`, set `bell = {}` when `not isinstance(bell, dict)`. | Avoid `.get` on list when schema default is `'[]'`. |

## Tests

| File | Change | Why |
|------|--------|-----|
| `tests/test_imports.py` | Expect `"Eng"` in default subjects; added `test_default_subjects_includes_new_library_entries`; added `test_import_lessons_from_excel_resolves_teacher_subject_class`; import `import_lessons_from_excel`. | Part 11: subject library and lesson import coverage. |
| `tests/test_helpers.py` | New file: `TestPeriodLabel`, `TestPeriodTimes` for `get_period_label` and `get_period_times`. | Part 11: period label and time helpers. |

---

# Part 5: Tests Added or Updated

- **test_imports.py**: `test_default_subjects_has_required_entries` now expects `"Eng"`; new `test_default_subjects_includes_new_library_entries` (Arts, Bus, Com, Acc, Add Math, Hist, Geo); new `test_import_lessons_from_excel_resolves_teacher_subject_class` (one row, teacher/subject/class resolution, periods_per_week).
- **test_helpers.py** (new): `TestPeriodLabel` (with/without zero period); `TestPeriodTimes` (default bell, first period, zero period times).

All 26 tests pass (21 existing + 5 new).

---

# Part 6: What Remains for Pilot Testing and International Roadmap

## Done in this pass

- **Part 1 (critical timing):** Zero period reflected in grid, solver, Excel, PDF, master; period start/end on all timetables and exports; solver uses extra slot when zero period is on.
- **Part 2 (subject library):** 7 new subjects; one-click/checkbox import and edit-after-import unchanged.
- **Part 3 (constraints):** Whole-day unavailability one-click; zero period row in constraint grid when enabled.
- **Part 5 (fast entry):** Lesson mapping Excel import + template; row validation and import summary.
- **Part 6 (UI):** Searchable/readable combos on review and constraints and class dialog.
- **Part 7 (export):** Period label + times in Excel/PDF; teacher workload total already present in Excel/PDF.

## Left for pilot / next iterations

1. **Part 1 (bell schedule):** Multiple breaks (count, name, start, end, type); breaks in grid and solver; Friday-only schedule (start/end, period/break timing); per-period duration (not single duration).
2. **Part 3:** Breaks (and zero) visible in constraint UI as structure; morning/afternoon-only or “available after X” constraints.
3. **Part 4:** Solver: break slots non-assignable; Friday slot set; human-readable grouped failure messages (timing/availability/impossible distribution); tuned balanced weekly distribution.
4. **Part 5:** Teacher/class import: optional email/WhatsApp columns and templates if desired.
5. **Part 6:** Form polish (spacing, required-field star, validation copy) on all data-entry forms.
6. **Part 7:** Total weekly workload on Review tab teacher view (if desired); PDF master timetable (all classes in one doc).

## International roadmap (architecture only, not implemented)

- **Part 9:** Keep design compatible with: i18n (Qt tr, locale, week start, RTL); accessibility (keyboard, screen reader, focus, contrast); data standards (JSON/XML schema, identifiers); multi-school/large data; communication (email/WhatsApp/delivery log); robustness (validation, backup, audit, privacy); scheduling depth (per-period times, breaks, Friday, curriculum, rotation). Document in `APP_SUMMARY_AND_INTERNATIONAL_ROADMAP.md` and avoid hardcoding that blocks these.
