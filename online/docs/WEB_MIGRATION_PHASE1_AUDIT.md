# Web Migration Phase 1 — Audit

This document records what was found in the desktop timetable application and how it was classified for Phase 1 web migration.

---

## 1. Pure reusable core logic

| Module | Location | Notes |
|--------|----------|--------|
| **Domain models** | `models/domain.py` | School, Subject, SchoolClass, ClassGroupDivision, ClassGroup, Teacher, TeacherSubject, Room, Lesson, LessonAllowedRoom, TimeConstraint, TimetableEntry. No UI imports; can be reused as-is. |
| **Validation logic** | `core/validators.py` | `validate_for_generation(data: TimetableDataProvider)` → ValidationResult (errors, warnings, grouped_errors). Refactored to use data provider; no PySide. |
| **Timetable solver** | `solver/engine.py` | `TimetableSolver(data)`, `.solve(time_limit_seconds)` → (success, entries, messages). Uses OR-Tools CP-SAT; accepts DatabaseConnection or TimetableDataProvider. No UI. |
| **Data provider protocol** | `core/data_provider.py` | `TimetableDataProvider` protocol (get_school, get_subjects, get_classes, get_teachers, get_rooms, get_lessons, get_constraints, get_locked_entries, get_lesson_allowed_rooms). Enables solver/validation to run with SQLite or PostgreSQL-backed data. |
| **Export generation** | `exports/excel_export.py`, `exports/pdf_export.py`, `exports/csv_export.py` | `export_excel(db, path)` etc. Use repos + DB; logic is reusable. For web, backend can pass an adapter or build data from PostgreSQL. |
| **Business/utility helpers** | `utils/helpers.py` | Day names, period labels, bell schedule parsing, colors, card_colors, get_day_slot_sequence, etc. No UI. |
| **SQLite data provider** | `database/data_provider_sqlite.py` | `SqliteDataProvider(db)` implements TimetableDataProvider for desktop. Reusable from desktop only; web will have PostgresDataProvider. |

---

## 2. Desktop-only code

| Module | Location | Notes |
|--------|----------|--------|
| **Application bootstrap** | `app/application.py` | QApplication, font, MainWindow. Must remain desktop. |
| **Main window** | `ui/main_window.py` | QMainWindow, sidebar nav, wizard stack, file dialogs (open/save/duplicate). Desktop only. |
| **Wizard pages** | `ui/wizard/*.py` | intro_page, school_page, subjects_page, classes_page, classrooms_page, teachers_page, lessons_page, constraints_page, generate_page, review_page, wizard_controller. All PySide widgets. |
| **Dialogs** | `ui/dialogs/*.py` | lesson_dialog, class_dialog, teacher_dialog, subject_dialog, room_dialog, subject_library_dialog, bulk_lesson_dialog, copy_lessons_dialog, import_preview_dialog. Desktop only. |
| **Widgets** | `ui/widgets/*.py` | timetable_grid, searchable_combo, color_button. Desktop only. |
| **Styles** | `ui/styles.py` | Qt stylesheets. Desktop only. |
| **Project service** | `services/project_service.py` | File-based project (new/open/save_as/duplicate, recent list via QSettings). Desktop-only; web uses API. |
| **Communication service** | `services/communication_service.py` | If it opens desktop dialogs or external apps, desktop only. |
| **Desktop-specific utils** | `utils/base_path.py`, `utils/session_state.py`, `utils/display_utils.py` | If they depend on Qt or desktop session, remain desktop only. |

---

## 3. Mixed code that was refactored (or must stay clear)

| Module | Location | Refactor / status |
|--------|----------|-------------------|
| **TimetableService** | `services/timetable_service.py` | Uses SqliteDataProvider for validate(); passes db to solver (solver wraps with SqliteDataProvider). No UI; desktop continues to use it. Backend will call same validation/solver via a PostgresDataProvider or snapshot. |
| **Repositories** | `repositories/*.py` | All take DatabaseConnection and run SQL. Pattern reusable; web will have new repos (SQLAlchemy, project_id/school_id scoped). No refactor needed in desktop code. |
| **Exports** | `exports/*.py` | Take `db: DatabaseConnection`. Logic reusable; backend can feed data via adapter or temp DB. No change to desktop exports. |
| **School/Class/Teacher/etc. services** | `services/school_service.py`, etc. | Use repos + db; no UI. Stay in desktop; backend will have its own services and repos. |

---

## 4. Summary

- **Reused directly:** Domain models, validators, solver, data provider protocol, SqliteDataProvider, helpers, export logic (with same data source abstraction).
- **Moved:** Nothing physically moved; core engine is identified as `models/`, `core/`, `solver/`, `exports/` (and `utils/helpers.py`), with data access abstracted via TimetableDataProvider.
- **Refactored:** Validators and solver now depend on TimetableDataProvider instead of raw DatabaseConnection; desktop uses SqliteDataProvider(db).
- **Remain desktop only:** All of `app/`, `ui/`, `services/project_service.py`, and any Qt- or file-workflow-specific code.

---

## 5. What was not done in Phase 1

- No removal or relocation of existing desktop files.
- No change to desktop UI flows or to solver behavior.
- Exports still take `DatabaseConnection`; backend integration (adapter or snapshot) is for a later phase.
