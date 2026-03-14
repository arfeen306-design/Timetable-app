# Timetable App – Improvement Audit and Plan

## Part 1: Audit of Current Implementation and Gap List

### 1. CRITICAL UI BUG FIXES

| Req | Current State | Gap |
|-----|---------------|-----|
| **1.1 Dropdown visibility** | `ui/styles.py` has `QComboBox` and `QComboBox QAbstractItemView` with `selection-background-color: #4A90D9; selection-color: white` and generic `::item` min-height/padding. No explicit **hover** or **focus** colors for list items. | On macOS/Windows, native styling can override and cause white-on-white or invisible text on hover/selection. Need: explicit `color`, `background-color` for item, `:hover`, `:selected`, `:focus` so all states are readable. No searchable dropdowns yet. |
| **1.2 Overlapping dropdowns in lesson tab** | `LessonDialog` uses several `QComboBox` and a `QListWidget` in a form; minimum sizes set (520×600). No `QScrollArea`; no explicit z-order or popup policy. | Possible clipping/overlap when many subjects/teachers; popup could render behind other widgets. Need: audit spacing, ensure popup is on top, consider scroll area for form. |

### 2. DATA ENTRY WORKFLOW

| Req | Current State | Gap |
|-----|---------------|-----|
| **2.1 Subject library** | Subjects page: table + Add / Edit / Delete only. Each subject is typed manually. | No predefined library. No “import from default list” with checkboxes. No one-click import of default set (Mathematics MAT, Physics, Chemistry, etc.). No checkbox picker for “select some and add to project”. |
| **2.2 Faster class/subject assignment** | Lesson and bulk dialogs use plain `QComboBox` for teacher, subject, class. | No multiselect or checkbox-based subject selection where multiple subjects are chosen at once. |
| **2.3 Bulk lesson** | `BulkLessonDialog`: one teacher + one subject → many classes (checkboxes + periods/week). | Missing: “copy lesson mappings from one class to another”; “one class with multiple subject–teacher pairs” (could be multiple bulk runs); copy from previous year (no year/snapshot support in schema). |

### 3. IMPORT FEATURES

| Req | Current State | Gap |
|-----|---------------|-----|
| **3.1 Excel import** | No import code. Only export (Excel, CSV, PDF). | Need: import teachers, classes, subjects; import lesson/teacher–subject–class mapping; downloadable sample templates; validation before save; row-level errors (row N, reason). |
| **3.2 PDF import** | None. | Secondary; skip unless trivial. |

### 4. SCHOOL TIMING AND BELL SCHEDULE

| Req | Current State | Gap |
|-----|---------------|-----|
| **4** | Schema: `school.bell_schedule_json` (TEXT default `'[]'`). `School` model and `SchoolRepository` read/write it. **School page**: only name, academic year, days/week, periods/day, weekend checkboxes. No bell UI. | No zero period, no start/end times per period, no break/lunch, no labels (Assembly, Break, Lunch). No clear separation in UI between “period duration in minutes” and “lesson duration in periods”. Need: bell schedule builder, period times (e.g. 40/45/50/60 min), clear “Lesson length in periods” label. |

### 5. VALIDATION AND REQUIRED FIELDS

| Req | Current State | Gap |
|-----|---------------|-----|
| **5** | Some dialogs use `_req()` with red asterisk (e.g. Lesson, Bulk, Subject). School page: “School Name” has no red star. Validation in `core/validators.py` returns errors list; Generate page shows them. | Not all required fields show red star (e.g. School name). No single place that lists “exact reasons” for incomplete step (e.g. “School name is required”, “At least one teacher must be added”). Nav shows counts and ✓/○ but not textual reasons. |

### 6. TIMETABLE GENERATION FAILURE MESSAGES

| Req | Current State | Gap |
|-----|---------------|-----|
| **6** | Solver returns: INFEASIBLE → “No feasible timetable exists with the current constraints. Try relaxing…” ; else “Solver timed out…”. Pre-generation `validate_for_generation()` has detailed errors (teacher overload, class overload, etc.) but they are only shown in Validate output; if user clicks Generate without validating, solver can fail with generic message. | No human-readable, cause-specific messages from solver (e.g. “Teacher Zain is assigned 38 weekly lessons but only 30 periods available”). Need: run validation before/during failure and surface those errors; optionally group by teacher overload, class overload, room overload, availability, missing data. |

### 7. LESSON DISTRIBUTION

| Req | Current State | Gap |
|-----|---------------|-----|
| **7** | Solver has soft “spread lesson occurrences across different days” (penalty for same_day). | Already present; can strengthen weight or add explicit “prefer 1 per day” style penalty. No UI explanation. |

### 8. PRIORITY FIELD

| Req | Current State | Gap |
|-----|---------------|-----|
| **8** | Lesson form: “Priority” 1–10 spinbox with hint “Scheduling importance: 10 = highest…”. | Confusing. Need: remove or replace with “High importance / Normal / Flexible” (with tooltip) and map to numeric internally. |

### 9. USER FRIENDLINESS AND VISUAL DESIGN

| Req | Current State | Gap |
|-----|---------------|-----|
| **9** | Clean styles; subject colors in grid and exports. | Could be more “school friendly” and colorful; forms could have clearer spacing/labels; print/export could improve B&W and single-page summary. |

### 10. EXPORT IMPROVEMENTS

| Req | Current State | Gap |
|-----|---------------|-----|
| **10.1 Teacher workload total** | Teacher Excel sheet: no “Total Weekly Workload”. Teacher PDF: not implemented (PDF export is class-only). | Need: “Total Weekly Workload: X periods” on teacher timetable view and in teacher Excel/PDF export. |
| **10.2 Master timetable** | Excel: one sheet per class, one per teacher, Teacher Load sheet. No single “all classes vertically” view. | Need: master timetable export (all classes in one consolidated layout) for Excel and PDF. |
| **10.3 Others** | Class/teacher/room views exist. Excel has class and teacher sheets; PDF has class only. Conflict report exists in `TimetableService.get_conflicts()`, shown after generate. | Add teacher PDF; ensure room export in Excel (already have room_repo); unscheduled lesson report not present. |

### 11. TAB FLOW AND PAGE ACCESS

| Req | Current State | Gap |
|-----|---------------|-----|
| **11** | Wizard nav: step names, counts, ✓/○, green/red/gray. User can click any enabled step. | Missing: exact “what is missing” per step (e.g. “School name required”); warning before generation if essential data missing. |

### 12. OPTIONAL AI

| Req | Current State | Gap |
|-----|---------------|-----|
| **12** | None. | Defer; no AI integration. |

### 13–14. IMPLEMENTATION & TESTING

- Work within existing app; no full rewrite.
- Add tests for: dropdown/selection behavior (where testable), Excel import validation, subject library import, bell schedule validation, teacher workload calculation, generation failure messages, required-field validation.

---

## Part 2: Improvement Plan (Implementation Order)

1. **Dropdown visibility and lesson dialog (1.1, 1.2)**  
   - Fix combo/list styles for all states (hover, selected, focus).  
   - Add searchable combo for teacher/subject/class where useful.  
   - Ensure lesson dialog has proper layout/spacing and popup visibility.

2. **Required fields and validation UX (5, 11)**  
   - Red star on School name and all required fields.  
   - Show incomplete-step reasons (e.g. under nav or on page).  
   - Warning before generation if validation fails.

3. **Priority simplification (8)**  
   - Replace numeric priority with High/Normal/Flexible + tooltip; map to 1–10 in backend.

4. **Subject library (2.1)**  
   - Default subject list (MAT, Physics, Chem, Bio, Comp, Eng, PST, IST, PE, Urdu).  
   - “Import from library” with checkboxes; one-click import all; edit after import; keep “Add custom”.

5. **Bell schedule builder (4)**  
   - UI on School page: zero period, number of periods, start/end per period, break/lunch, labels.  
   - Store in `bell_schedule_json`.  
   - Clarify “period duration (minutes)” vs “lesson duration (periods)” in labels.

6. **Generation failure messages (6)**  
   - Always run validation before solve; on INFEASIBLE/timeout, show validation errors and grouped messages (teacher/class/room overload, etc.).

7. **Teacher workload in exports (10.1)**  
   - Add “Total Weekly Workload: X periods” to teacher Excel sheet and to teacher PDF (when added).

8. **Master timetable export (10.2)**  
   - New export: all classes in one vertical layout (Excel + PDF).

9. **Excel import (3.1)**  
   - Import teachers, classes, subjects with sample templates and row-level validation.  
   - Then lesson mapping import if practical.

10. **Copy lessons from class to class (2.3)**  
    - “Copy from class” in Lessons page: pick source class, pick target class(s), copy lesson structure.

11. **Tests**  
    - Tests for validators, subject library, import validation, workload calculation, generation messages.

---

## Part 4: Files Changed and Why

| File | Change |
|------|--------|
| **ui/styles.py** | Fixed dropdown visibility: explicit `color`, `background-color` for `QComboBox` and `QAbstractItemView::item`, plus `:hover`, `:selected`, `:selected:hover` so items stay readable on macOS/Windows. |
| **ui/widgets/searchable_combo.py** | New: `ReadableItemDelegate` and `make_searchable(combo)` for type-to-filter combos with stable colors; uses `QSortFilterProxyModel` and `QCompleter`. |
| **ui/dialogs/lesson_dialog.py** | Scroll area for form; searchable teacher/subject/class combos; "Lesson length (periods)" label; duration 1–8; Priority replaced with Importance combo (High/Normal/Flexible) mapped to 5/8/3. |
| **ui/dialogs/bulk_lesson_dialog.py** | Searchable teacher and subject combos. |
| **ui/dialogs/copy_lessons_dialog.py** | New: copy all lesson assignments from one class to multiple target classes. |
| **ui/dialogs/subject_library_dialog.py** | New: checkbox list of default subjects; import selected into project. |
| **ui/wizard/school_page.py** | Required-field red star and validation for school name; bell schedule group: period duration (minutes), first period start, zero period checkbox; load/save `bell_schedule_json`. |
| **ui/wizard/subjects_page.py** | "Import from Library" and "Import from Excel" + "Download Template" buttons; subject library dialog integration. |
| **ui/wizard/lessons_page.py** | "Copy from Class" button and `CopyLessonsDialog` integration. |
| **ui/wizard/teachers_page.py** | "Import from Excel" and "Download Template"; row-level error display. |
| **ui/wizard/classes_page.py** | "Import from Excel" and "Download Template". |
| **ui/wizard/generate_page.py** | On solver failure, run validation and show "Reasons (fix these…)" with errors/warnings in output. |
| **utils/helpers.py** | Added `DEFAULT_SUBJECTS` list (Mathematics MAT, Physics, Chemistry, etc.). |
| **exports/excel_export.py** | Teacher workload total at bottom of each teacher sheet; new "Master Timetable" sheet with all classes vertically. |
| **imports/excel_import.py** | New: `import_teachers_from_excel`, `import_classes_from_excel`, `import_subjects_from_excel` with row-level `RowError` and `ImportResult`. |
| **imports/sample_templates.py** | New: `write_teachers_template`, `write_classes_template`, `write_subjects_template`. |
| **imports/__init__.py** | New package. |
| **tests/test_imports.py** | New: default subjects structure, Excel import valid file, missing first name row error, subjects import. |
| **docs/IMPROVEMENT_AUDIT_AND_PLAN.md** | This audit and plan document. |

---

## Part 5: Tests Added/Updated

- **tests/test_imports.py**: `TestDefaultSubjects` (required codes, structure), `TestExcelImport` (teachers valid, teachers missing first name row error, subjects valid).
- Existing **tests/test_validators.py**, **test_solver.py**, **test_models.py** unchanged; all 13 + 5 = 18 tests pass.

---

## Part 6: Optional / Future Work

- **PDF import**: Omitted; Excel is primary.
- **AI assistance**: Not implemented.
- **Copy from previous academic year**: Would require snapshot/versioning; not in current schema.
- **Unscheduled lesson report**: Can be added as separate export or validation report.
- **Room PDF export**: Add if teacher PDF is added for consistency.
- **Teacher PDF export**: PDF export is class-only; teacher timetable PDF with workload total can be added.
- **Full per-period bell times**: Bell schedule stores period_minutes and first_start; per-period start/end and break/lunch labels can be extended.
- **Lesson mapping Excel import**: Import teacher–subject–class mapping from Excel (columns: Teacher, Subject, Class, Lessons Per Week, etc.) left for follow-up.
