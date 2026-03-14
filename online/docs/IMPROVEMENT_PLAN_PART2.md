# Part 2: Improvement Plan in Implementation Order

Follow PART 8 priority: (1) UI polish, (2) Excel/import, (3) Bell/timing, (4) Solver/errors, (5) Export polish, (6) Pilot readiness, (7) International roadmap.

---

## Phase 1 — UI polish and bug fixing

| # | Task | Files / approach |
|---|------|------------------|
| 1.1 | Ensure all searchable/plain combos use ReadableItemDelegate or equivalent so dropdown text is never white-on-white or unreadable on hover/selection | `ui/widgets/searchable_combo.py` (already has delegate); ensure every combo that shows teachers/classes/subjects/rooms uses `make_searchable` or the same delegate. Audit: lesson form, bulk dialogs, constraints page, wizard combos. |
| 1.2 | Default white/black for missing colors | Already in `utils/helpers.py` (card_colors, DEFAULT_CARD_BG/TEXT). Verify usage in grid, Excel, PDF, table cells — no blank/invisible text. |
| 1.3 | Scroll on School and Review pages | Already QScrollArea. Verify when window minimized/resized. |
| 1.4 | Form polish: spacing, aligned labels, red star for required, friendly validation | School page (name*), lesson form, constraints, data entry pages. |

---

## Phase 2 — Excel import and fast entry

| # | Task | Files / approach |
|---|------|------------------|
| 2.1 | Add 7 subjects to DEFAULT_SUBJECTS; keep existing; ensure one-click import and checkbox selection | `utils/helpers.py`: extend DEFAULT_SUBJECTS. Subject library dialog already supports select all and checkbox. |
| 2.2 | Teacher/class/subject import: row-wise validation, summary, no silent failure | Verify `imports/excel_import.py` and UI show RowError and ImportResult clearly. |
| 2.3 | Lesson mapping import from Excel (teacher, subject, class, periods per week) | New function in `imports/excel_import.py`; new template in `imports/sample_templates.py`; hook in UI (e.g. Data or Lessons step). |
| 2.4 | Subject selection: keep list/checkbox/multiselect where used | No change if lesson form and bulk already use subject list. |

---

## Phase 3 — Bell schedule and timing improvements

| # | Task | Files / approach |
|---|------|------------------|
| 3.1 | Zero period as visible slot | When zero_period is true: (a) solver uses (periods_per_day + 1) or explicit zero slot; (b) grid shows "Zero Period" row with correct start/end; (c) exports include zero row and times. |
| 3.2 | Period start/end on all timetables | Add helper that computes start/end from bell_schedule_json (first_start, period_minutes; later per-period and Friday). Use in grid header, Excel, PDF, master. |
| 3.3 | Breaks: data model and UI | Extend bell_schedule_json with `breaks: [{name, start, end, type}]`. School page: add break list (name, start, end, type). |
| 3.4 | Breaks in grid and exports | Grid: break rows between periods; exports: same; solver: break slots are non-assignable. |
| 3.5 | Friday separate schedule | bell_schedule_json: `friday: {start, end, period_durations?, breaks?}` or `day_schedules[4]`. UI: "Friday different" section. Solver: use Friday slot set. |
| 3.6 | Per-period duration | bell_schedule_json: `periods: [{duration_minutes}]` or similar. UI: table/list per period duration. Use in time helper and exports. |

---

## Phase 4 — Solver and error explanation

| # | Task | Files / approach |
|---|------|------------------|
| 4.1 | Solver: zero period slot, break slots, Friday slots, whole-day unavailability | `solver/engine.py`: build slot list from school (zero + teaching periods, exclude breaks, day-specific count for Friday). Respect time_constraint (whole-day = all periods that day). |
| 4.2 | Validation categories and messages | `core/validators.py`: add timing conflict, availability conflict, room overload, impossible distribution. Add concrete messages (e.g. "Teacher X unavailable on Friday but has Friday lessons"). |
| 4.3 | Balanced weekly distribution | Keep/refine soft constraint in solver: prefer 1 lesson per day for 5/week; 6 → 1 per day + 1 extra; 7 → even. |

---

## Phase 5 — Constraint improvements

| # | Task | Files / approach |
|---|------|------------------|
| 5.1 | Whole-day unavailability one click | Constraints page: per day, add "Unavailable whole day" that sets all periods for that day; optionally allow per-period override. |
| 5.2 | Breaks (and zero) in constraint UI | When breaks/zero exist, show them in constraint grid (e.g. greyed or labeled) so structure is visible. |
| 5.3 | Morning/afternoon only | Support "available after X", "unavailable before X" by deriving period unavailability from period times (when available). |

---

## Phase 6 — Export polish

| # | Task | Files / approach |
|---|------|------------------|
| 6.1 | Teacher timetable total weekly workload | Ensure in Excel and PDF; add to Review tab teacher view if practical. |
| 6.2 | Master timetable: all classes vertically | Excel already has Master sheet; add PDF master if practical. |
| 6.3 | Period and break timing in all exports | Use period start/end and break rows in Excel and PDF. |
| 6.4 | Keep all existing exports | No removals. |

---

## Phase 7 — Pilot readiness and international roadmap

| # | Task |
|---|------|
| 7.1 | Pilot testing: manual test zero period, breaks, Friday, imports, exports, constraints. |
| 7.2 | International: keep Qt tr, locale, RTL, accessibility, data schema, multi-school, communication, robustness as documented and architecture-friendly; no full implementation in this pass. |

---

## Implementation order (concrete steps)

1. **Phase 1**: Fix dropdown delegate usage everywhere; verify colors and scroll; form polish.
2. **Phase 2**: Extend DEFAULT_SUBJECTS; add lesson mapping Excel import and template; verify other imports.
3. **Phase 3**: Implement zero period in grid and solver; add period start/end helper and use in grid/exports; add breaks (model + UI + grid + solver); add Friday schedule; add per-period duration.
4. **Phase 4**: Solver respect new structure; add validation categories and messages; balanced distribution.
5. **Phase 5**: Whole-day unavailable; break/zero in constraint UI; morning/afternoon if time.
6. **Phase 6**: Export timing and workload; master PDF if practical.
7. **Phase 7**: Documentation and pilot checklist; international roadmap doc update.
