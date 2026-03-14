# Core Engine Boundary

This document defines what belongs in the core timetable engine, what must never live in UI code, and how both the desktop app and the FastAPI backend use the engine.

---

## 1. What belongs in the core engine

The **core engine** is the set of code that contains only timetable domain and business logic and has **no dependency on PySide, Qt, or desktop UI**. It is callable from both the desktop app and the future FastAPI backend.

### 1.1 Included modules

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **Domain models** | `models/domain.py` | Dataclasses: School, Subject, SchoolClass, ClassGroupDivision, ClassGroup, Teacher, TeacherSubject, Room, Lesson, LessonAllowedRoom, TimeConstraint, TimetableEntry. |
| **Data provider protocol** | `core/data_provider.py` | Read-only interface for project data (get_school, get_subjects, get_classes, get_teachers, get_rooms, get_lessons, get_constraints, get_locked_entries, get_lesson_allowed_rooms). |
| **Validation** | `core/validators.py` | `validate_for_generation(data: TimetableDataProvider)` → ValidationResult. Pre-generation checks (school configured, entities exist, lesson references, class/teacher load, etc.). |
| **Solver** | `solver/engine.py` | `TimetableSolver(data)`, `.solve(time_limit_seconds)` → (success, entries, messages). OR-Tools CP-SAT; no UI. |
| **Export generation** | `exports/excel_export.py`, `pdf_export.py`, `csv_export.py` | Produce Excel/PDF/CSV from project data. Currently take DatabaseConnection; can be called with an adapter that implements the same data surface. |
| **Non-UI utilities** | `utils/helpers.py` | Day names, period labels, bell schedule parsing, colors, time formatting. |

### 1.2 Data access boundary

- The core engine **does not** know about PostgreSQL or multi-tenancy. It consumes data through:
  - **TimetableDataProvider** (read-only) for solver and validation.
  - **DatabaseConnection** (desktop) or an **adapter** (backend) for exports, until exports are refactored to use a provider.
- The **desktop** implements `SqliteDataProvider(DatabaseConnection)` and uses it for validate/solve; writes go through existing repositories and SQLite.
- The **backend** will implement a provider that reads from PostgreSQL (e.g. loads a project snapshot into memory or a temp SQLite) and call the same solver/validation; writes go to PostgreSQL via backend repos.

---

## 2. What must never stay inside UI code

- **Solver logic** — Must remain in `solver/engine.py`. No constraint-building or OR-Tools usage in dialogs or wizard pages.
- **Validation rules** — Must remain in `core/validators.py`. UI may display ValidationResult but must not duplicate checks.
- **Export formatting** — Must remain in `exports/`. UI only triggers export and chooses path (desktop) or calls API (web).
- **Domain and business rules** — Workload limits, max per day, constraint types, etc. live in core or backend services, not in Qt widgets.

---

## 3. How the desktop app uses the core engine

1. **Project data:** Stored in a SQLite file (`.ttb`). `DatabaseConnection` is opened by `ProjectService`.
2. **Validation:** When the user clicks Validate/Generate, the desktop calls `TimetableService(db).validate()`, which uses `SqliteDataProvider(db)` and `validate_for_generation(provider)`.
3. **Generation:** `TimetableService(db).generate()` creates `TimetableSolver(db)` (which wraps db in SqliteDataProvider) and calls `.solve()`. Results are saved via `TimetableRepository(db).save_entries(entries)`.
4. **Exports:** UI calls `export_excel(db, path)` etc., which use repos and services with the same `db`.
5. **No core code imports PySide.** The desktop imports core/solver/models/repos/services and passes in `db` or provider.

---

## 4. How the backend uses the core engine (Phase 1+)

1. **Project data:** Stored in PostgreSQL; scoped by `school_id` and `project_id`.
2. **Validation:** Backend loads project data (e.g. into a snapshot or temp SQLite), builds a `TimetableDataProvider` over it, and calls `validate_for_generation(provider)`. Returns ValidationResult as JSON.
3. **Generation:** Same provider is passed to `TimetableSolver(provider).solve()`. Backend persists returned entries to PostgreSQL (timetable_entries, timetable_runs).
4. **Exports:** Backend loads project + timetable from PostgreSQL, either passes an adapter to existing export functions or generates files in a service that uses the same data structures. Files are stored in school-scoped storage and returned as download URL or stream.
5. **Backend never imports PySide.** Backend only imports core engine modules (solver, core.validators, core.data_provider, models.domain, utils.helpers) and its own db/auth layers.

---

## 5. Import rules

- **Core engine modules** may import: `models.domain`, `core.data_provider`, `core.validators`, `solver.engine`, `utils.helpers`, and standard library / ortools / openpyxl / reportlab. They must **not** import `app`, `ui`, `PySide6`, or `database.connection` (except optionally for type hints behind TYPE_CHECKING where the runtime type is a protocol implementation).
- **Desktop app** may import core engine, database, repositories, services, and UI. It provides the concrete `DatabaseConnection` and `SqliteDataProvider`.
- **Backend** may import core engine (with PYTHONPATH or package layout so that `solver`, `core`, `models`, `exports`, `utils.helpers` are available) and its own api, auth, models, services, repositories. It must not import desktop-only code.

---

## 6. Phase 1 outcome

- Core engine boundary is **defined and enforced** by the data provider abstraction and by keeping solver/validation/export logic out of UI.
- Desktop continues to work; backend foundation is ready to call the same engine via a PostgreSQL-backed provider and service layer.
