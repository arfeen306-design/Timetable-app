# School Timetable — Web SaaS Migration Plan

This document covers the full migration from the existing desktop timetable application to a multi-school, online SaaS product. It is organized in the order requested: audit, refactor plan, architecture, database, API, frontend, subscriptions, implementation roadmap, and documentation.

---

## Part 1 — Audit: Current Desktop Codebase and Reuse for Web

### 1.1 Project layout (application code, excluding venv/build/dist)

| Path | Purpose |
|------|--------|
| `main.py` | Entry point; creates Qt Application and MainWindow |
| `app/application.py` | Qt app bootstrap, font, MainWindow; **desktop-only** |
| `database/connection.py` | SQLite connection wrapper (`open`, `execute`, `fetchone`, `fetchall`, `commit`, `last_insert_id`); **reusable** if abstracted behind an interface |
| `database/schema.py` | SQLite DDL for single-project tables; **logic reusable**, DDL will become PostgreSQL |
| `models/domain.py` | Dataclasses: School, Subject, SchoolClass, ClassGroupDivision, ClassGroup, Teacher, TeacherSubject, Room, Lesson, LessonAllowedRoom, TimeConstraint, TimetableEntry; **reuse as-is** for core engine |
| `core/validators.py` | `validate_for_generation(db)` → ValidationResult (errors, warnings, grouped_errors); takes `DatabaseConnection`; **reuse logic** with a data-source abstraction |
| `solver/engine.py` | `TimetableSolver(db)`, `.solve(time_limit_seconds)` → (success, entries, messages); reads all data via `db.fetchone`/`fetchall`; **reuse solver logic**; dependency on DB must be abstracted (see Part 2) |
| `repositories/*.py` | CRUD and queries against `DatabaseConnection`; **patterns reusable**; web will have new repos talking to PostgreSQL with school_id/project_id |
| `services/*.py` | Orchestrate repos + solver/validation; **TimetableService** (validate, generate, get_*_timetable, lock/unlock, clear, get_unscheduled_lessons, get_conflicts) is the main entry for generation; **reuse as service layer** once data source is abstracted |
| `exports/excel_export.py` | `export_excel(db, path)` — builds workbook from repos; **reuse logic** with abstract data source or in-memory structures |
| `exports/pdf_export.py` | `export_pdf(db, path)` — same pattern; **reuse** |
| `exports/csv_export.py` | `export_csv(db, path)` — same; **reuse** |
| `utils/helpers.py` | Day names, period labels, bell/slot sequence, colors, etc.; **reuse as-is** in core and backend |
| `imports/*.py` | Excel import, sample templates; **reuse** for backend import APIs |
| `services/project_service.py` | File-based project (new/open/save_as/duplicate, recent list via QSettings); **replace** with backend project API; desktop keeps this |
| `ui/**` | All PySide6 (MainWindow, wizard pages, dialogs, widgets); **desktop-only**; do not port UI code directly |

### 1.2 What can be reused directly for web

- **Domain models** (`models/domain.py`): All dataclasses are UI-agnostic and can be shared by core engine and backend DTOs.
- **Business rules and helpers** (`utils/helpers.py`): Day names, period labels, bell schedule parsing, colors — no Qt dependency.
- **Validation rules** (`core/validators.py`): Logic is pure once input data is provided; only the data source (currently `db`) needs to be abstracted.
- **Solver algorithm** (`solver/engine.py`): OR-Tools CP-SAT model and constraints; only the data-loading layer (currently raw SQL on `db`) must be abstracted so the same code can run from PostgreSQL-backed project data (e.g. via an in-memory snapshot or a thin data provider interface).
- **Export logic** (`exports/excel_export.py`, `pdf_export.py`, `csv_export.py`): Formatting and layout; they only need a way to get school, classes, teachers, rooms, lessons, timetable entries (e.g. from a DB abstraction or from in-memory structures loaded from API).
- **Repository pattern**: Same patterns (get_all, get_by_id, save, delete) will apply to the web backend; implementations will use SQLAlchemy/PostgreSQL and be scoped by `school_id` and `project_id`.

### 1.3 What is desktop-only and must not be mixed into core

- `app/application.py`: Qt application and MainWindow creation.
- `ui/main_window.py`: Menu, file dialogs, wizard stack, navigation.
- `ui/wizard/*`: All wizard pages (intro, school, subjects, classes, classrooms, teachers, lessons, constraints, generate, review).
- `ui/dialogs/*`: All dialogs (lesson, class, teacher, subject, room, bulk lesson, copy lessons, import preview, subject library).
- `ui/widgets/*`: Timetable grid, searchable combo, color button.
- `ui/styles.py`: Qt stylesheets (can stay desktop-only).
- `services/project_service.py`: Uses QSettings and file paths; web will use API only.

### 1.4 Data flow today

1. User opens/creates a project → `ProjectService` opens a SQLite file (or memory) → `DatabaseConnection` is set on `MainWindow` and passed to wizard.
2. Wizard pages use services/repos that take `db: DatabaseConnection` and read/write SQLite.
3. Generate: `TimetableService(db).validate()` then `TimetableService(db).generate()` → `TimetableSolver(db).solve()` reads all tables via `db.fetchall`/`fetchone`, then `TimetableRepository(db).save_entries(entries)`.
4. Export: `export_excel(db, path)` etc. use repos and services with the same `db`.

So the **single coupling point** for web is: **everything that currently takes `DatabaseConnection`** must be callable with data that ultimately comes from PostgreSQL (e.g. by introducing a **data provider / project snapshot** interface that the solver, validators, and exports can use).

---

## Part 2 — Refactor: What Must Change Before Web

### 2.1 Core engine independence from desktop UI

- **No PySide6 in core.** Ensure no `ui/` or `app/` imports in `models/`, `core/`, `solver/`, `exports/`, or in shared `utils/helpers.py`. (Current codebase is already clean; keep it that way.)
- **Database abstraction for solver and validation.** The solver and validators currently take `DatabaseConnection` and run SQL. Two main options:
  - **Option A (recommended):** Introduce a **read-only data provider interface** (e.g. `TimetableDataProvider`) with methods such as `get_school()`, `get_subjects()`, `get_teachers()`, `get_lessons()`, etc., returning the same structures the solver/validators expect (dicts or domain objects). The desktop keeps an adapter that implements this interface from `DatabaseConnection`; the web backend builds an in-memory snapshot from PostgreSQL (or a temporary SQLite copy per run) and passes an adapter over that. No change to solver/validator **logic**.
  - **Option B:** Refactor solver/validators to accept **in-memory dicts/lists** (e.g. `school`, `lessons`, `teachers`, …) and remove direct SQL. Then desktop loads these from SQLite before calling; backend loads from PostgreSQL. More invasive but removes DB dependency from core entirely.
- **Exports.** Same as above: either (A) an adapter that provides the same data the export functions expect (school, classes, teachers, entries, etc.), or (B) change export signatures to accept in-memory structures. Option A is less invasive: keep `export_excel(db, path)` but allow `db` to be an adapter that reads from a project snapshot.

### 2.2 Concrete refactor steps

1. **Define `TimetableDataProvider` (or equivalent) interface** in `core/` (or a new `core_engine/` package): methods to return school, subjects, classes, teachers, rooms, lessons, lesson_allowed_rooms, time_constraints, timetable_entries (and optionally locked entries). Return types: dicts matching current SQL row keys or domain objects.
2. **Implement `SqliteDataProvider(DatabaseConnection)** in the current codebase, delegating to `db.fetchone`/`fetchall` and mapping to the expected structures. Replace direct `db` usage in `TimetableSolver` and `validate_for_generation` with this provider (solver and validators receive the provider instead of `db`).
3. **Keep `TimetableRepository.save_entries`** for writing results. For desktop it continues to use `db`; for web, the backend will persist entries to PostgreSQL (and optionally keep a “current run” in a temp SQLite for a single generation if we use Option A with SQLite copy). So the “write” path can remain in the repository layer that the backend will reimplement for PostgreSQL.
4. **Exports:** Keep `export_excel(db, path)` signature but type the first argument as `TimetableDataProvider` (or a union with `DatabaseConnection` and an adapter). Implement the adapter so that export code only uses the provider interface. Backend will then either (a) build a snapshot in SQLite and pass the existing connection, or (b) implement a `PostgresDataProvider` that reads from the project’s tables and passes that to the same export functions (if we refactor exports to take a provider).
5. **Project service:** Do not move file-based logic to the core. Desktop keeps `ProjectService`; web uses only API (create/list/open/duplicate project by id).

### 2.3 What not to do

- Do not rewrite the solver from scratch.
- Do not move PySide6 code into `core/` or `solver/`.
- Do not hardcode web-only concepts (school_id, project_id, tenant) into the existing desktop code paths; confine multi-tenancy to the backend and to the data layer that **feeds** the core engine.

---

## Part 3 — SaaS Architecture in Detail

### 3.1 High-level layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js or React)                                     │
│  Auth, dashboard, project list, project editor, generate,        │
│  review, export downloads, billing placeholders                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTPS / REST API
┌───────────────────────────────▼───────────────────────────────────┐
│  Backend API (FastAPI)                                            │
│  Auth (JWT/session), schools, projects, CRUD (subjects, classes,  │
│  teachers, rooms, lessons, constraints), generation, review,    │
│  exports, subscriptions                                           │
└───────────────────────────────┬───────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐    ┌─────────▼─────────┐   ┌───────▼────────┐
│ Core Engine    │    │ PostgreSQL         │   │ File storage   │
│ (solver,       │    │ (school/project    │   │ (exports:      │
│ validation,    │    │  scoped tables)     │   │  local / S3)   │
│ exports)       │    │                    │   │                │
└────────────────┘    └───────────────────┘   └────────────────┘
```

- **Core engine:** Pure Python package (or subfolder) used by the backend. It contains solver, validation, export functions, and domain models. It is fed with project data (via the data provider abstraction) and does not know about HTTP or tenants; the backend is responsible for loading the correct project and scoping.
- **Backend:** Handles authentication, authorization (school-scoped, project-scoped), CRUD, and calls into the core engine for validate/generate and for generating export files. It stores export files in local disk or cloud storage and returns download URLs or streams.
- **Frontend:** SPA or Next.js app; all persistence and generation go through the API.

### 3.2 Multi-school isolation

- Every request that touches data is tied to a **user** and that user’s **school** (and optionally **project**). Backend derives `school_id` from the authenticated user (e.g. from JWT or session) and filters all queries by `school_id`; project-scoped endpoints also filter by `project_id` and ensure the project belongs to that school.
- No API endpoint returns another school’s projects or data. File storage paths include `school_id` (and optionally `project_id`) so exports and uploads are isolated.
- Database: all school-owned and project-owned tables have `school_id` and/or `project_id`; use row-level security (RLS) or strict application-level filtering.

### 3.3 Generation and export flow (online)

1. User clicks Generate in the UI → Frontend calls `POST /api/projects/{project_id}/generate` (or similar).
2. Backend loads project data from PostgreSQL (for that project_id and school), builds the data provider (e.g. in-memory snapshot or temp SQLite), runs validation then solver from the core engine, and writes the resulting entries to `timetable_entries` (and optionally `timetable_runs` for history).
3. If generation is slow, the backend can run the solver in a background task (Celery/RQ or FastAPI background) and expose a status/poll endpoint; for a first version, synchronous generation is acceptable.
4. Export: User requests Excel/PDF/CSV → Backend loads the same project and current timetable from PostgreSQL, calls the core engine’s export functions (with a path in school-scoped storage), then returns the file (stream or redirect to a signed URL). Exports are generated on the server; no solver or export logic in the browser.

---

## Part 4 — PostgreSQL Database Schema (Web Version)

All tables that hold school or project data must be scoped. Use `school_id` and `project_id` as appropriate; soft delete is optional but recommended for projects and key entities.

### 4.1 Auth and tenants

- **users**  
  `id`, `email`, `password_hash`, `name`, `role` (platform_admin | school_admin), `is_active`, `email_verified_at`, `created_at`, `updated_at`

- **schools**  
  `id`, `name`, `slug`, `settings_json` (e.g. contact, address), `created_at`, `updated_at`

- **school_memberships** (school_users)  
  `id`, `school_id`, `user_id`, `role` (admin | member), `created_at`  
  Unique (school_id, user_id). A user can belong to one school for v1; later multiple schools per user possible.

- **subscription_plans**  
  `id`, `name`, `slug`, `limits_json` (max_projects, max_classes, etc.), `is_active`, `created_at`

- **subscriptions**  
  `id`, `school_id`, `plan_id`, `status` (trial | active | past_due | cancelled), `trial_ends_at`, `starts_at`, `ends_at`, `created_at`, `updated_at`

### 4.2 Project and project-scoped data

- **projects**  
  `id`, `school_id`, `name`, `academic_year`, `archived`, `last_generated_at`, `created_at`, `updated_at`  
  All project data (school row, subjects, classes, …) is keyed by `project_id` so multiple projects per school are supported.

- **school_settings** (per project)  
  `id`, `project_id`, `days_per_week`, `periods_per_day`, `weekend_days`, `bell_schedule_json`, `name`, `academic_year`  
  Single row per project (1:1 with project for “school” config).

- **subjects**  
  `id`, `project_id`, `name`, `code`, `color`, `category`, `max_per_day`, `double_allowed`, `preferred_room_type`, `created_at`, `updated_at`

- **school_classes** (classes)  
  `id`, `project_id`, `grade`, `section`, `stream`, `name`, `code`, `color`, `class_teacher_id`, `home_room_id`, `strength`, `created_at`, `updated_at`

- **class_group_divisions**  
  `id`, `project_id`, `class_id`, `name`

- **class_groups**  
  `id`, `division_id`, `name`, `code`

- **teachers**  
  `id`, `project_id`, `first_name`, `last_name`, `code`, `title`, `color`, `max_periods_day`, `max_periods_week`, `email`, `whatsapp_number`, `created_at`, `updated_at`

- **teacher_subjects**  
  `id`, `teacher_id`, `subject_id`  
  teacher_id/subject_id reference project-scoped tables.

- **rooms**  
  `id`, `project_id`, `name`, `code`, `room_type`, `capacity`, `color`, `home_class_id`, `created_at`, `updated_at`

- **lessons**  
  `id`, `project_id`, `teacher_id`, `subject_id`, `class_id`, `group_id`, `periods_per_week`, `duration`, `priority`, `locked`, `preferred_room_id`, `notes`, `created_at`, `updated_at`

- **lesson_allowed_rooms**  
  `id`, `lesson_id`, `room_id`

- **time_constraints**  
  `id`, `project_id`, `entity_type`, `entity_id`, `day_index`, `period_index`, `constraint_type`, `weight`, `is_hard`, `created_at`, `updated_at`

- **timetable_runs** (optional but useful)  
  `id`, `project_id`, `status`, `started_at`, `finished_at`, `message`, `entries_count`  
  One row per generation run; can link `timetable_entries` to a run_id for history.

- **timetable_entries**  
  `id`, `project_id`, `run_id` (nullable), `lesson_id`, `day_index`, `period_index`, `room_id`, `locked`, `created_at`  
  Current “active” run can be identified by latest `run_id` or a flag on `timetable_runs`.

- **exports** (optional)  
  `id`, `project_id`, `school_id`, `run_id`, `format` (excel | pdf | csv), `file_path`, `file_size`, `created_at`  
  For listing and re-download of past exports.

### 4.3 Indexes and constraints

- Foreign keys: all `project_id` and `school_id` references with ON DELETE CASCADE or RESTRICT as appropriate.
- Unique constraints where needed (e.g. project_id + name for subjects).
- Indexes on (school_id), (project_id), (project_id, run_id) for fast filtering.

### 4.4 Migration from desktop SQLite

- Desktop schema (`database/schema.py`) maps to the above with the addition of `project_id` (and `school_id` where applicable). A one-time or per-project migration script can read a .ttb file and insert into PostgreSQL with a given `school_id` and `project_id`.

---

## Part 5 — Backend API Structure

Base path: `/api` (or `/api/v1`). All project/school endpoints require auth and school/project scope.

### 5.1 Auth

- `POST /api/auth/register` — optional; or create user by platform admin only.
- `POST /api/auth/login` — email + password → JWT or session cookie.
- `POST /api/auth/logout`
- `GET /api/auth/me` — current user and linked school(s).

### 5.2 Schools

- `GET /api/schools/me` — current user’s school profile.
- `PATCH /api/schools/me` — update school profile (school admin).

### 5.3 Projects

- `POST /api/projects` — create project (school_id from user).
- `GET /api/projects` — list projects for school.
- `GET /api/projects/{id}` — get one project (metadata).
- `POST /api/projects/{id}/duplicate` — duplicate project.
- `PATCH /api/projects/{id}` — update name, academic_year, archive.
- `DELETE /api/projects/{id}` — delete (or soft delete).

### 5.4 Project data (all under `/api/projects/{project_id}/...`)

- **School setup:** `GET/PUT /api/projects/{id}/school-settings` (bell schedule, days, periods, etc.).
- **Subjects:** CRUD ` /api/projects/{id}/subjects`, bulk import if needed.
- **Classes:** CRUD ` /api/projects/{id}/classes`.
- **Teachers:** CRUD ` /api/projects/{id}/teachers`, teacher-subject mapping.
- **Rooms:** CRUD ` /api/projects/{id}/rooms`.
- **Lessons:** CRUD ` /api/projects/{id}/lessons`, bulk/copy endpoints.
- **Constraints:** CRUD ` /api/projects/{id}/constraints`.

### 5.5 Generation and review

- `POST /api/projects/{id}/validate` — run pre-generation validation, return errors/warnings.
- `POST /api/projects/{id}/generate` — run solver, persist entries, return success + messages or grouped errors.
- `GET /api/projects/{id}/timetable/class/{class_id}` — class timetable.
- `GET /api/projects/{id}/timetable/teacher/{teacher_id}` — teacher timetable.
- `GET /api/projects/{id}/timetable/room/{room_id}` — room timetable.
- `GET /api/projects/{id}/timetable/master` — full timetable.
- `GET /api/projects/{id}/timetable/workload` — teacher workload summary.
- `GET /api/projects/{id}/timetable/unscheduled` — unscheduled lessons.

### 5.6 Exports

- `POST /api/projects/{id}/exports/excel` — generate Excel, return download URL or stream.
- `POST /api/projects/{id}/exports/pdf` — generate PDF.
- `POST /api/projects/{id}/exports/csv` — generate CSV.
- `GET /api/projects/{id}/exports` — list recent exports (if stored).

### 5.7 Subscriptions (v1 minimal)

- `GET /api/schools/me/subscription` — current plan and status.
- Platform admin: `POST /api/admin/schools/{id}/subscription` — set plan, trial end, etc. (manual activation).

---

## Part 6 — Frontend Page Structure and User Flows

### 6.1 Public

- Home, Features, Pricing, Contact — static or marketing pages.
- Login (and optional Register).

### 6.2 After login (school dashboard)

- Dashboard: overview, quick links.
- Projects: list (cards or table), Create project, Open, Duplicate, Archive.
- Create project: name, academic year → redirect to project editor.

### 6.3 Project editor (wizard-style or tabs)

- School setup: name, academic year, days, periods, bell schedule, zero period, breaks.
- Subjects: list, add/edit/delete, subject library.
- Classes: list, add/edit, class teacher, home room.
- Rooms: list, add/edit.
- Teachers: list, add/edit, subject assignment.
- Lessons: list, add/edit, bulk assign, copy mappings.
- Constraints: teacher/class/room unavailability, whole-day, Friday awareness.

### 6.4 Generate and review

- Generate: button → call validate then generate; show success or grouped errors; optional progress if async.
- Review: tabs or views for Class / Teacher / Room / Master timetable and workload summary; read-only grid.

### 6.5 Export

- Buttons: Download Excel, Download PDF, Download CSV; trigger generation and then download (or open in new tab). Optional: “Recent exports” list.

### 6.6 Billing (placeholder)

- Current plan, status, “Upgrade” placeholder, payment history placeholder.

---

## Part 7 — Subscription and Membership Architecture

- **Plans:** Stored in `subscription_plans` (name, slug, limits_json). Limits can include: max_projects, max_classes, max_teachers, max_exports_per_month, feature flags.
- **Subscription:** One active subscription per school (`subscriptions.school_id`), with status (trial | active | past_due | cancelled), trial_ends_at, starts_at, ends_at. Manual activation by platform admin: set plan_id, status, dates.
- **Gating:** Backend checks subscription before create project, before generate, or before export if you want to enforce limits; frontend can hide or disable actions based on plan.
- **No payment gateway in v1:** Billing pages are placeholders; subscription is updated by admin only.

---

## Part 8 — Implementation Roadmap (Step-by-Step)

1. **Audit** — Done; see Part 1.
2. **Refactor core for data abstraction** — Add `TimetableDataProvider` and `SqliteDataProvider`; switch solver and validators to use it; keep exports working with current DB or adapter. Desktop continues to use SQLite.
3. **PostgreSQL schema** — Create migrations (e.g. Alembic) for users, schools, school_memberships, subscription_plans, subscriptions, projects, school_settings, subjects, classes, teachers, rooms, lessons, constraints, timetable_runs, timetable_entries, exports.
4. **FastAPI scaffold** — App factory, config (env), auth (JWT or session), dependency for “current user” and “current school/project”. Implement Auth, School, Project (create/list/get/duplicate/update/delete) and project-scoped CRUD stubs.
5. **Project save/load** — Full CRUD for school_settings, subjects, classes, teachers, rooms, lessons, constraints; all scoped by project_id; API returns JSON matching frontend needs.
6. **Wire solver to backend** — Load project from PostgreSQL into in-memory snapshot (or temp SQLite); run validation and solver via core engine; persist timetable_entries (and timetable_runs). Expose validate and generate endpoints.
7. **Wire exports to backend** — After generation, call core engine’s export functions with a path under school/project storage; return file stream or signed URL. Implement Excel, PDF, CSV endpoints.
8. **Frontend auth and dashboard** — Login, logout, me; dashboard and project list; create/open/duplicate/archive project.
9. **Frontend project editor** — All steps: school setup, subjects, classes, rooms, teachers, lessons, constraints (forms and lists).
10. **Frontend review and export** — Timetable views (class/teacher/room/master), workload; export buttons and download.
11. **Subscription-ready** — Plans and subscriptions in DB; GET subscription endpoint; platform admin endpoint to set subscription; optional feature gating in backend.
12. **Deployment** — Docker or Procfile for backend; frontend on Vercel; PostgreSQL and env-based config; docs for local dev, staging, production, and pilot.

---

## Part 9 — Implementation Order (Code)

Implementation will proceed in this order:

1. Add `core_engine` (or refactor in-place) with data provider interface and Sqlite adapter; solver and validators use it.
2. Create `backend/` with FastAPI, config, auth, and PostgreSQL models/migrations.
3. Implement project and project-data APIs; then generation and exports using the core engine.
4. Create `frontend/` (Next.js or React) with auth, dashboard, project editor, review, and export flows.
5. Add subscription tables and minimal admin/subscription API and UI placeholders.
6. Add deployment and pilot documentation.

---

## Part 10 — Documentation (Local Development, Deployment, Pilot)

- **Local development:** How to run backend (venv, env vars, PostgreSQL URL), run frontend (npm/pnpm), run migrations, and optionally run the desktop app against the same core.
- **Deployment:** Recommended hosting (e.g. backend on Render/Railway, frontend on Vercel, PostgreSQL managed DB); environment variables; file storage (local vs S3); scaling and background tasks if used.
- **Pilot:** How to create school accounts (e.g. by platform admin), activate subscription, and onboard schools; data isolation checklist; support and error reporting.

This document will be updated as implementation progresses. Current implementation status: core data provider refactor and backend scaffold are in place; see `docs/DEV_DEPLOY.md` and `backend/README.md`.
