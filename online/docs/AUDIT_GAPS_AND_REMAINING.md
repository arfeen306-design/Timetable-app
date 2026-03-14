# Timetable App — Part 1 (Audit), Part 2 (Gap List), Part 7 (Remaining Work)

---

## Part 1: Repository Audit — What Already Exists

### Application entry and bootstrap
- **`main.py`**: Entry point; creates `Application`, runs `app.run()`.
- **`app/application.py`**: `Application` sets Qt app name/version, platform font (Darwin/Windows/other), creates `MainWindow`, no project opened by default.

### Main window and navigation
- **`ui/main_window.py`**: `MainWindow` with sidebar `QListWidget` (10 steps), `QStackedWidget` for pages, `ProjectService`, `WizardController`. Methods: `open_project`, `new_project`, `new_temp_project`, `save_project`, `save_project_as`, `navigate_to`, `update_nav_status`, `closeEvent`. Window title shows current path or "[Unsaved Project]".
- **`ui/wizard/wizard_controller.py`**: Builds 10 pages (Intro, School, Subjects, Classes, Classrooms, Teachers, Lessons, Constraints, Generate, Review). `on_page_entered`, `get_step_statuses` (counts per step, ok/empty/na).

### Intro / project start
- **`ui/wizard/intro_page.py`**: Three buttons: **Create New Project** (save dialog, then `new_project`), **Open Existing Project** (file dialog, then `open_project`), **Load Demo Data** (in-memory project + `load_demo_data`, then navigate to School). No **Open Recent**, **Duplicate Previous**, or **Reuse Previous Year**.

### Project and database
- **`services/project_service.py`**: `ProjectService` — `new_project(path)`, `open_project(path)`, `save_as(new_path)` (copy file + reopen), `close()`, `new_temp_project()` (in-memory). `current_path` stored; no recent-list persistence.
- **`database/connection.py`**: `DatabaseConnection` — open/close, WAL, foreign keys, `execute`/`fetchone`/`fetchall`, `clone_for_thread`, `initialize_schema`, `create_new`/`open_existing`.
- **`database/schema.py`**: Tables: `school`, `subject`, `school_class`, `class_group_division`, `class_group`, `teacher`, `teacher_subject`, `room`, `lesson`, `lesson_allowed_room`, `time_constraint`, `timetable_entry`, `project_settings`. No `teacher_contact`, no `bell_schedule_period` (only `school.bell_schedule_json`), no `recent_project` table.

### Models (domain)
- **`models/domain.py`**: Dataclasses: `School`, `Subject`, `SchoolClass`, `ClassGroupDivision`, `ClassGroup`, `Teacher`, `TeacherSubject`, `Room`, `Lesson`, `LessonAllowedRoom`, `TimeConstraint`, `TimetableEntry`. No `TeacherContact`; `Teacher` has no `email`, `whatsapp_number`, `is_class_teacher`, `class_teacher_for_class_id`.

### Repositories
- **`repositories/school_repo.py`**: get, save (with `bell_schedule_json`).
- **`repositories/subject_repo.py`**, **`class_repo.py`**, **`teacher_repo.py`**, **`room_repo.py`**, **`lesson_repo.py`**, **`timetable_repo.py`**, **`constraint_repo.py`**: CRUD and specialised queries. No teacher_contact repo; no recent_project repo.

### Services
- **`services/school_service.py`**, **subject_service.py**, **class_service.py**, **teacher_service.py**, **room_service.py**, **lesson_service.py**, **constraint_service.py**, **timetable_service.py**: Wrap repos, expose validate/generate/conflicts. No teacher-contact service; no recent-projects service; no “delete teacher” dependency check before delete.

### School setup UI
- **`ui/wizard/school_page.py`**: School name* (red star), academic year, days/week, periods/day, weekend checkboxes, **Bell schedule** group: period duration (minutes), first period start, zero period checkbox; save to `bell_schedule_json`. No per-period start/end, break/lunch labels. Save validates name required.

### Subjects
- **`ui/wizard/subjects_page.py`**: Table, Add / **Import from Library** / **Import from Excel** / **Download Template** / Edit / Delete. **`ui/dialogs/subject_dialog.py`**: Name*, code, category, color, max per day, double, preferred room type. **`ui/dialogs/subject_library_dialog.py`**: Checkbox list of `DEFAULT_SUBJECTS`, import selected. **`utils/helpers.py`**: `DEFAULT_SUBJECTS` (MAT, PHY, CHEM, etc.).

### Classes
- **`ui/wizard/classes_page.py`**: Table, Add / **Import from Excel** / **Download Template** / Edit / Delete. **`ui/dialogs/class_dialog.py`**: Grade, section, stream, name, code, color, class teacher (combo), home room (combo), strength. Schema has `class_teacher_id`, `home_room_id`.

### Classrooms
- **`ui/wizard/classrooms_page.py`**: Table, Add / Edit / Delete. **`ui/dialogs/room_dialog.py`**: Name, code, type, capacity, color, home class.

### Teachers
- **`ui/wizard/teachers_page.py`**: Table, Add / **Import from Excel** / **Download Template** / Edit / Delete. **`ui/dialogs/teacher_dialog.py`**: First/last name, code, title, color, max periods day/week. No email, WhatsApp, class-teacher flag. Delete confirms but **no warning** “this teacher is assigned to N lessons”.

### Lessons
- **`ui/wizard/lessons_page.py`**: Table, **Add Single Lesson**, **Bulk Assign**, **Copy from Class**, Edit, Delete; prerequisite banner (teachers/subjects/classes). **`ui/dialogs/lesson_dialog.py`**: Teacher*/Subject*/Class* (searchable combos, validation that currentData() not None), periods/week, lesson length (periods), Importance (Normal/High/Flexible), locked, preferred room, allowed rooms list, notes; scroll area; try/except on save. **`ui/dialogs/bulk_lesson_dialog.py`**: One teacher + one subject, class table with checkboxes and periods/week; searchable combos; validation. **`ui/dialogs/copy_lessons_dialog.py`**: Copy from one class to many.

### Constraints
- **`ui/wizard/constraints_page.py`**: Time constraints (entity type, entity, day, period, type, hard/soft). **`services/constraint_service.py`**, **`repositories/constraint_repo.py`**.

### Solver and generation
- **`solver/engine.py`**: `TimetableSolver` — loads school, lessons, teachers, classes, rooms, constraints, locked entries, allowed rooms; builds CP-SAT model; hard constraints (no double-book, locked, room unavail, subject max/day, teacher max/day); soft (spread days, preferred/home rooms, avoid last period core, balance teacher days). Returns (success, entries, messages). On INFEASIBLE/timeout returns generic message.
- **`ui/wizard/generate_page.py`**: Validate button, Generate (thread), time limit; on **solver failure** runs validation and shows “Reasons (fix these…)” with errors/warnings. Progress and message area.

### Review and export
- **`ui/wizard/review_page.py`**: Tabs Class / Teacher / Room timetable (combo + `TimetableGrid`), Export Excel/CSV/PDF, Save/Save As. **`ui/widgets/timetable_grid.py`**: Grid, lock/unlock context menu. **`exports/excel_export.py`**: Per-class sheets, per-teacher sheets (with **Total Weekly Workload** at bottom), **Master Timetable** sheet (all classes vertically), Teacher Load sheet. **`exports/csv_export.py`**, **`exports/pdf_export.py`**: Class timetables (PDF class-only; no teacher PDF). **`services/timetable_service.py`**: `get_conflicts()`; no unscheduled-lesson report.

### UI shared
- **`ui/styles.py`**: Combo styles with explicit item/hover/selected colors. **`ui/widgets/searchable_combo.py`**: `make_searchable()` (editable + completer + proxy + deferred setCurrentIndex). **`ui/widgets/color_button.py`**.

### Import
- **`imports/excel_import.py`**: `import_teachers_from_excel`, `import_classes_from_excel`, `import_subjects_from_excel`; row-level `RowError`, `ImportResult`. **`imports/sample_templates.py`**: `write_teachers_template`, `write_classes_template`, `write_subjects_template`. No lesson-mapping import.

### Validation
- **`core/validators.py`**: `validate_for_generation()` — school, subjects, classes, teachers, lessons exist; lesson refs valid; class/teacher load vs slots; teacher max day/week. Returns `ValidationResult` (errors, warnings). No grouping by category (teacher overload / class overload / etc.).

### Sample data
- **`sample_data/demo_loader.py`**: `load_demo_data(db)` — school, subjects, teachers, classes, rooms, lessons (Islamabad Model School style).

### Tests
- **`tests/test_models.py`**, **test_validators.py**, **test_solver.py**, **test_imports.py**, **test_lesson_single_assignment.py** (21 tests total).

---

## Part 2: Gap List Against Full Requirements

### Project and startup
| Requirement | Status | Gap |
|-------------|--------|-----|
| Create New Project | Done | — |
| Open Existing Project | Done | — |
| **Open Recent Project** | Missing | No recent list; no persistence of recent paths (e.g. in `project_settings` or a config file). |
| **Duplicate Previous Project** | Missing | No “Duplicate” that copies current .ttb to new path and opens it. |
| **Reuse previous year / Load Demo** | Partial | Demo exists; “reuse previous year” would need snapshot or copy-from-file and is not implemented. |
| Save / Save As | Done | — |

### School timing and bell schedule
| Requirement | Status | Gap |
|-------------|--------|-----|
| Working days, periods per day | Done | — |
| Zero period | Done | Checkbox on school page; stored in bell_schedule_json. |
| **Start/end time per period** | Partial | Only global “first period start” and “period duration (minutes)”. No per-period start/end or labels. |
| **Break / lunch** | Missing | No break duration, lunch break, or labels (Assembly, Break, Lunch) in UI or schema. |
| Period duration in minutes vs lesson length in periods | Done | Clarified in UI and lesson form. |

### Subject library and workflow
| Requirement | Status | Gap |
|-------------|--------|-----|
| Built-in default subjects (MAT, Physics, etc.) | Done | `DEFAULT_SUBJECTS` and subject library dialog. |
| One-click import all, checkbox select some | Done | — |
| Edit after import, add custom | Done | — |

### Teacher
| Requirement | Status | Gap |
|-------------|--------|-----|
| Teacher CRUD, list | Done | — |
| **Teacher contact: email** | Missing | No field in schema or UI. |
| **Teacher contact: WhatsApp number** | Missing | No field in schema or UI. |
| **Class teacher flag** | Partial | Schema/UI: class has `class_teacher_id` (teacher); teacher side has no `is_class_teacher` or `class_teacher_for_class_id`. |
| **Dependency warning before delete** | Missing | Delete teacher does not check “assigned to N lessons” or block/warn. |

### Lesson form and assignment
| Requirement | Status | Gap |
|-------------|--------|-----|
| Dropdown visibility, searchable | Done | Styles + make_searchable + validation so no None. |
| Single-assignment crash fix | Done | currentData() validation, deferred setCurrentIndex, try/except. |
| Lesson length in periods, Importance | Done | — |
| Bulk assign one teacher+subject to many classes | Done | — |
| Copy from one class to others | Done | — |
| Copy previous year structure | Missing | No “reuse previous year” flow. |

### Solver and generation messages
| Requirement | Status | Gap |
|-------------|--------|-----|
| Human-readable failure reasons | Partial | Generate page shows validation errors on failure; solver still returns generic INFEASIBLE/timeout text. |
| **Group messages** (teacher overload, class overload, room overload, availability, missing data) | Missing | Validation returns flat list; no grouping by category. |
| Balanced weekly distribution | Done | Solver soft constraint for spread across days. |

### Export
| Requirement | Status | Gap |
|-------------|--------|-----|
| Class / teacher / room timetable | Done | Excel and review tabs. |
| Teacher workload total | Done | In Excel teacher sheets. |
| Master timetable (all classes vertically) | Done | Excel “Master Timetable” sheet. |
| Teacher PDF with workload | Missing | PDF is class-only. |
| **Unscheduled lesson report** | Missing | No export or view of lessons not placed. |
| Conflict report | Done | Shown after generate; could be export. |
| **Communication-ready** (email/WhatsApp ready) | Missing | No “export for sending” or per-teacher/per-class-teacher output structure. |

### Import
| Requirement | Status | Gap |
|-------------|--------|-----|
| Import teachers, classes, subjects from Excel | Done | With templates and row errors. |
| **Teacher–subject–class (lesson) mapping import** | Missing | Not implemented. |
| PDF import | Not required | Secondary; omitted. |

### Tab flow and validation
| Requirement | Status | Gap |
|-------------|--------|-----|
| Incomplete step indicators | Partial | Counts and ✓/○; no per-step textual “School name required” etc. |
| Required field red stars | Done | School name, lesson fields. |

### Database and models (required by spec)
| Requirement | Status | Gap |
|-------------|--------|-----|
| **TeacherContact** (email, whatsapp_number) | Missing | No table or model. |
| **BellSchedulePeriod** (per-period start/end, is_break, is_lunch) | Missing | Only `bell_schedule_json` on school. |
| **RecentProject** (or equivalent) | Missing | No table or persisted list. |
| **GeneratedReportLog** | Optional | Not implemented. |
| Teacher: **is_class_teacher**, **class_teacher_for_class_id** | Missing | Class has class_teacher_id; teacher side not denormalised. |

### Testing
| Requirement | Status | Gap |
|-------------|--------|-----|
| Single-assignment crash fix | Done | test_lesson_single_assignment.py. |
| Excel import, subject library | Done | test_imports.py. |
| Teacher workload total | Covered | By export code; no dedicated test. |
| **Teacher delete warning** | Missing | No test. |
| **Recent project reopening** | Missing | No test (feature missing). |
| **Bell schedule validation** | Missing | No test. |
| **Generation failure grouping** | Missing | No test. |

---

## Part 7: Remaining Future Work (Summary)

### High priority (to implement next)
1. **Recent projects** — Persist last N project paths (e.g. in `project_settings` or config); intro page “Open Recent” with list; open from list.
2. **Duplicate project** — “Duplicate” action: copy current .ttb to new path, open new path.
3. **Teacher contact fields** — Add `teacher_contact` table (teacher_id, email, whatsapp_number) or columns on teacher; UI in teacher dialog; model/repo/service.
4. **Teacher delete dependency warning** — Before delete, count lessons; if > 0, warn “This teacher is assigned to N lessons. Delete anyway?” (and optionally block or allow).
5. **Grouped generation failure messages** — Run validation on failure and group errors into: teacher overload, class overload, room overload, availability, missing data; show under clear headings.
6. **Unscheduled lesson report** — After generation, list lessons that have fewer timetable_entry rows than periods_per_week; export or show in UI.
7. **Teacher PDF export** — Add teacher timetable PDF (with total weekly workload) alongside existing class PDF.

### Medium priority
8. **Lesson mapping Excel import** — Import rows (Teacher, Subject, Class, Lessons Per Week, etc.); validate and create lessons.
9. **Reuse previous year** — “Reuse previous year” or “Copy from file”: open another .ttb (or snapshot), copy structure (e.g. subjects, classes, teachers, lessons) into current project; may require UI to choose what to copy.
10. **Per-step incomplete reasons** — On wizard nav or on page, show exact text (“School name is required”, “Add at least one teacher”) instead of only counts/colors.
11. **Communication-ready exports** — Structure exports so that “per teacher” and “per class teacher (class timetable)” outputs are obvious for future email/WhatsApp (e.g. one file per teacher, or one folder per teacher with timetable + optional class timetable).

### Lower priority / optional
12. **Full bell schedule** — Per-period start/end, break/lunch slots, labels (Assembly, Break, Lunch) in UI and in `bell_schedule_json` or a `bell_schedule_period` table.
13. **Teacher-side class teacher** — Add `is_class_teacher` and `class_teacher_for_class_id` on Teacher for symmetry and quick filters.
14. **GeneratedReportLog** — Optional table to log each export (who, when, what) for audit.
15. **PDF import** — Only if stable and low effort; not a priority.
16. **AI assistance** — Optional helper only; not in scope for current delivery.

---

## Implementation Order (from Part 3)

After this document, implementation should proceed in this order:

1. Recent projects (persist, intro page “Open Recent”).
2. Duplicate project (copy .ttb, open).
3. Teacher contact (schema + UI + model/repo/service).
4. Teacher delete warning (lesson count + confirm).
5. Grouped generation failure messages (validation + grouping).
6. Unscheduled lesson report (compute + show/export).
7. Teacher PDF export (with workload total).
8. Then: lesson mapping import, per-step messages, communication-ready structure, and remaining items as needed.
