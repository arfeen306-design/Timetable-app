# Part 1: Audit of Current Implementation and Exact Gaps

This document audits the codebase against the full improvement prompt and lists exact gaps.

---

## PART 1 (CRITICAL BELL SCHEDULE AND TIMING) — GAPS

### 1.1 Zero period must reflect in timetable

| Location | Current state | Gap |
|----------|---------------|-----|
| **Schema / bell_schedule_json** | Stored as `{"period_minutes", "first_start", "zero_period"}` in `school.bell_schedule_json`. | No structural change; zero period is a boolean only. |
| **Solver** | Uses `school["periods_per_day"]` only. Does not add an extra “period” for zero. | **Gap**: When zero_period is true, solver and grid still use N periods; zero period is not an extra row/slot. |
| **Timetable grid (class/teacher/room)** | Rows = 1..periods_per_day. Labels from `get_period_label(p)` → "Period 1", "Period 2", ... | **Gap**: No "Zero Period" row when zero period is enabled; no start/end times in headers. |
| **Excel export** | Period column uses `get_period_label(p)`. No zero row, no times. | **Gap**: Zero period not shown; no start/end times. |
| **PDF export** | Same: period labels only, no zero row, no times. | **Gap**: Same as Excel. |
| **Master timetable** | Same structure. | **Gap**: Same. |

**Exact gaps**: (1) When zero period is on, `periods_per_day` or the displayed grid must include zero (e.g. row 0 = Zero Period, then Period 1..N). (2) All views/exports must show start/end time for each period (and zero) derived from first_start and period_minutes (and later per-period duration).

---

### 1.2 Total number of breaks and break timing

| Location | Current state | Gap |
|----------|---------------|-----|
| **School page** | No UI for breaks. | **Gap**: No fields for: number of breaks, name, start time, end time, type (short/lunch/assembly). |
| **bell_schedule_json** | Only period_minutes, first_start, zero_period. | **Gap**: No `breaks` array (name, start, end, type). |
| **Solver** | All slots are teaching slots. | **Gap**: Breaks must be non-teaching slots (or explicit break slots in the grid). |
| **Grid / exports** | No break rows. | **Gap**: Break rows must appear in class/teacher timetable and exports with correct timing. |

**Exact gaps**: Add breaks to bell schedule (UI + JSON structure). Multiple breaks per day. Solver must not place lessons in break slots. Grid and exports must show break rows with name and time range.

---

### 1.3 Show each period time on all timetables

| Location | Current state | Gap |
|----------|---------------|-----|
| **get_period_label** | Returns "Period 1", "Period 2", ... | **Gap**: No start/end time. Need a way to compute period start/end from bell schedule (and later per-period/friday). |
| **Timetable grid** | Vertical header = period label only. | **Gap**: Must show "Period 1 08:00-08:50" (or similar). |
| **Excel** | Column A = period label only. | **Gap**: Same; add start and end time. |
| **PDF** | Same. | **Gap**: Same. |
| **Master** | Same. | **Gap**: Same. |

**Exact gaps**: (1) Add helper (e.g. `get_period_times(school, period_index, day_index)` or from a computed bell structure) returning (start_time, end_time). (2) Use it in grid headers, Excel, PDF, master. (3) When per-period duration and Friday are added, this helper must use them.

---

### 1.4 Breaks must reflect in class and teacher timetable

| Current state | Gap |
|---------------|-----|
| No breaks in data model or UI. | Once breaks exist (1.2), they must appear as distinct rows/slots in class and teacher timetable views and in exports, not confused with teaching periods. |

---

### 1.5 Friday timing different

| Location | Current state | Gap |
|----------|---------------|-----|
| **School page** | Single first start, single period duration. | **Gap**: No "Friday schedule" section: Friday start, Friday end, Friday period timing, Friday breaks. |
| **bell_schedule_json** | Single global timing. | **Gap**: No `friday` or `day_schedules` (e.g. day_index 4 = Friday) with its own start/end/periods/breaks. |
| **Solver** | Same slots for all days. | **Gap**: Friday may have fewer/different periods; solver must use day-specific slot count. |
| **Grid / exports** | Same structure all days. | **Gap**: Friday column (or row) may show different period count and times. |

**Exact gaps**: (1) UI: "Friday (or last working day) different schedule" with its own start/end, period count, period durations, breaks. (2) Schema/JSON: store Friday (or per-day) schedule. (3) Solver: when building slots, use day-specific number of teaching periods and exclude break slots. (4) Views/exports: show Friday times and break rows correctly.

---

### 1.6 Each period duration separately

| Location | Current state | Gap |
|----------|---------------|-----|
| **School page** | One "Period duration (minutes)" for all periods. | **Gap**: No per-period duration (e.g. Period 1: 40 min, Period 2: 45 min, Break, Period 3: 50 min). |
| **bell_schedule_json** | Single `period_minutes`. | **Gap**: Need `periods` array with duration (and optionally start/end) per period index, or similar. |
| **Time calculation** | Not used in solver (solver works in period indices). | **Gap**: Exports and labels need computed start/end from per-period durations and breaks. |

**Exact gaps**: Add per-period duration (and optionally start/end) to bell schedule; UI to edit; use in time display and exports.

---

## PART 2 (SUBJECT LIBRARY) — GAPS

| Current state | Gap |
|---------------|-----|
| **DEFAULT_SUBJECTS** in `utils/helpers.py` | 10 subjects: Mathematics (MAT), Physics (PHY), Chemistry (CHEM), Biology (BIO), Computer Science (COMP), English (ENG), Pakistan Studies (PST), Islamiyat (IST), Physical Education (PE), Urdu (UR). | **Gap**: Add Arts (Arts), Business (Bus), Commerce (Com), Accounting (Acc), Additional Mathematics (Add Math), History (Hist), Geography (Geo). Fix Physics abbreviation to "Physics" or keep PHY per requirement "Physics as Physics" (likely meaning display name; code can stay PHY). Requirement says "Mathematics as MAT", "Physics as Physics" — interpret as: add the new ones with given names/codes; keep existing; "Physics as Physics" may mean label. |
| **Subject library dialog** | Checkbox list, Select All / Deselect All, returns Subject list. | **Gap**: None for one-click import or checkbox selection; ensure "edit after import" is clear (already possible via Edit after import). Custom subjects already possible (Add). |
| **Abbreviations** | Some codes differ (e.g. CHEM vs "Chem"). | **Gap**: Align new subjects with required abbreviations; keep existing list. |

**Exact gaps**: Extend `DEFAULT_SUBJECTS` with 7 new entries. Ensure one-click import all and checkbox selection both work (already do). No change needed for "edit after import" or custom subjects.

---

## PART 3 (CONSTRAINT IMPROVEMENTS) — GAPS

### 3.1 Breaks in constraints

| Current state | Gap |
|---------------|-----|
| Constraint grid is days × periods. No notion of breaks. | When breaks exist, constraint screen should show structure (e.g. break rows or greyed break slots) so user sees real school structure. Period indices remain 0..N-1; breaks are non-teaching slots. |

### 3.2 Whole day unavailability with one tick

| Location | Current state | Gap |
|----------|---------------|-----|
| **Constraints page** | Grid of checkboxes per (day, period). Uncheck = unavailable. | **Gap**: No "whole day unavailable" button/toggle per day. User must uncheck each period. |
| **Solver** | Reads time_constraint; supports per-slot unavailability. | **Gap**: None; once whole-day is stored as multiple period constraints (or one logical "whole day"), solver already respects them. |

**Exact gaps**: Add "Unavailable whole day" control per day (e.g. one checkbox per day that sets all periods for that day unavailable, or a "Block entire day" button). Optionally allow overriding individual periods after.

### 3.3 Morning/afternoon only

| Current state | Gap |
|---------------|-----|
| Only "unavailable" per slot is implemented. | **Gap**: No constraint types "available_after", "unavailable_before", "morning_only", "afternoon_only". Solver and constraint UI only support marking slots unavailable. |

**Exact gaps**: Add constraint types or derived rules (e.g. "available after 11:00" → mark periods before 11 as unavailable using period times when available). Keep existing per-slot unavailability.

---

## PART 4 (GENERATION AND ERROR EXPLANATION) — GAPS

### 4.1 Solver respects new timing structure

| Current state | Gap |
|---------------|-----|
| Solver uses days × periods_per_day, no zero row, no breaks, no Friday, no per-period duration. | **Gap**: Solver must: (1) include zero period as a slot when enabled; (2) exclude break slots from assignable slots; (3) use Friday-specific period count and slot set; (4) respect whole-day unavailability. |

### 4.2 Human-readable failure explanations

| Current state | Gap |
|---------------|-----|
| **validators.py** | Grouped categories: Missing data, Teacher overload, Class overload, Room (warnings). | **Gap**: Add categories: "timing conflict", "availability conflict", "impossible distribution". Add concrete messages like "Teacher Zain is unavailable on Friday but has Friday lessons", "Grade 10 Science needs more weekly periods than available slots", "Physics Lab required during break/blocked periods", "Friday timetable shorter than required load". |
| **generate_page** | Shows grouped validation on failure. | **Gap**: Ensure new categories and messages appear; possibly run extra checks (e.g. Friday load vs Friday slots) and add to validation. |

### 4.3 Balanced weekly distribution

| Current state | Gap |
|---------------|-----|
| **solver/engine.py** | Soft constraint: spread lessons across days (penalty for same day). | **Gap**: Refine so 5 lessons → prefer 1 per day; 6 → 1 per day + 1 extra; 7 → even spread. Document and tune weights. |

---

## PART 5 (FAST DATA ENTRY AND IMPORT) — GAPS

| Item | Current state | Gap |
|------|---------------|-----|
| **Teacher import** | `import_teachers_from_excel` with row errors, templates. | **Gap**: Teacher import does not include email/whatsapp; template and import should support them. |
| **Class import** | Exists with validation. | **Gap**: Ensure summary and safe import (no silent failure) — verify. |
| **Subject import** | Exists. | **Gap**: Same. |
| **Teacher–subject–class mapping import** | Not implemented. | **Gap**: New Excel import: rows (Teacher, Subject, Class, Periods per week); validate and create lessons. |
| **Weekly lesson count in Excel** | N/A. | **Gap**: Covered by lesson-mapping import. |
| **Templates** | Teachers, classes, subjects templates exist. | **Gap**: Add lesson mapping template. |
| **Subject selection** | Searchable combos, subject library. | **Gap**: Lesson form already uses subject list; bulk/copy use same. No change if already list-based. |

---

## PART 6 (UI POLISH AND BUG FIXING) — GAPS

| Item | Current state | Gap |
|------|---------------|-----|
| **Dropdown hover** | ReadableItemDelegate uses STATE_SELECTED and palette; searchable_combo. | **Gap**: Ensure all combo boxes use the same delegate or styles so no white-on-white or disappearing text on hover/selection. Verify teachers, classes, subjects, rooms, lesson forms. |
| **Default white/black** | card_colors(), DEFAULT_CARD_BG/TEXT used in grid, Excel, PDF, table cells. | **Gap**: None; already implemented. |
| **Scroll School and Review** | QScrollArea on both pages. | **Gap**: None; already implemented. |
| **Forms** | Spacing, labels, red star, validation messages. | **Gap**: General polish pass; ensure all forms have good spacing, aligned labels, red star for required, friendly messages. |

---

## PART 7 (EXPORT POLISH) — GAPS

| Item | Current state | Gap |
|------|---------------|-----|
| **Teacher timetable total weekly workload** | Excel: "Total Weekly Workload" at bottom of teacher sheet. PDF: same in export_teacher_pdf and export_single_teacher_pdf. | **Gap**: Review page teacher tab does not show total workload text under grid; add if practical. |
| **Master timetable** | Excel: "Master Timetable" sheet, all classes vertically. | **Gap**: PDF master (all classes in one view) not present; add if practical. |
| **Period and break timing in exports** | Exports show period label only. | **Gap**: Add start/end time (and break rows when implemented) to Excel and PDF. |
| **Existing exports** | Class, teacher, room, teacher load, conflict, unscheduled, teacher PDFs to folder, class for class teachers. | **Gap**: Keep all; add timing and break info when available. |

---

## PART 8–12

- **Part 8 (priority order)**: Follow as stated: 1) UI polish, 2) Excel/import, 3) Bell/timing, 4) Solver/errors, 5) Export polish, 6) Pilot readiness, 7) International roadmap.
- **Part 9 (international roadmap)**: No full implementation; keep architecture and docs (APP_SUMMARY_AND_INTERNATIONAL_ROADMAP.md) compatible.
- **Part 10**: Work incrementally; audit first (this document), then implement; don’t break tests.
- **Part 11 (testing)**: Add/update tests for: zero period in timetable/exports, breaks, Friday timing, period start/end display, whole-day unavailability, subject library, Excel import validation, dropdown readability (if testable), teacher workload total, master export, failure explanations, balanced distribution.
- **Part 12**: Output in order: Part 1 (this audit), Part 2 (plan), Part 3 (code changes), Part 4 (files changed), Part 5 (tests), Part 6 (summary).

---

## Summary of Gaps (Concise)

1. **Bell/timing**: Zero period not a visible slot; no breaks; no period start/end in UI or exports; no Friday schedule; single period duration for all.
2. **Subject library**: Add 7 subjects (Arts, Business, Commerce, Accounting, Add Math, History, Geography).
3. **Constraints**: No break display in grid; no whole-day unavailable one-click; no morning/afternoon-only constraint types.
4. **Solver**: Does not use zero period slot, breaks, Friday, or per-period duration; needs to respect new structure.
5. **Validation**: Add timing/availability/impossible-distribution messages and categories.
6. **Import**: Lesson mapping Excel import missing; teacher import missing email/whatsapp in template/import.
7. **UI**: Verify dropdown readability everywhere; form polish.
8. **Export**: Period/break timing in exports; teacher workload on review tab if practical; PDF master if practical.
