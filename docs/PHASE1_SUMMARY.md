# Phase 1 Complete — Summary

This document summarizes what was delivered in Phase 1 (web migration foundation) and what should happen in Phase 2.

---

## What is complete for Phase 1

### 1. Audit and classification

- **WEB_MIGRATION_PHASE1_AUDIT.md** — Classified desktop code into: pure reusable core (solver, validators, domain models, data provider, exports, helpers), desktop-only (app, ui, project_service), and mixed/refactored (TimetableService, repos, exports using provider/db).

### 2. Core engine boundary

- **CORE_ENGINE_BOUNDARY.md** — Defines what belongs in the core engine, what must never be in UI code, and how desktop and backend both use the engine via `TimetableDataProvider`.
- **Existing refactor (from prior work):** `core/data_provider.py` (protocol), `database/data_provider_sqlite.py` (SQLite implementation). Solver and validators use the provider; desktop app still works.

### 3. Backend foundation

- **BACKEND_ARCHITECTURE_PHASE1.md** — Backend structure, auth model, school/project ownership, database design summary, next-phase notes.
- **FastAPI app:** `backend/main.py`, config, CORS, health route, API router.
- **Config:** `backend/config.py` — env-based (database_url, secret_key, debug, etc.).
- **Database:** SQLAlchemy Base, engine, SessionLocal, `get_db`; migration-ready.
- **Models:** User, School, SchoolMembership, Project, Subject (in `backend/models/`).
- **Auth:** JWT create/verify, password hashing, `get_current_user` / `get_current_user_optional`, login and `/me` wired to DB.
- **School-scoped projects:** List projects by current user’s school; create project for current school; get project by id with 404 if project belongs to another school.
- **Project-scoping dependency:** `get_project_or_404(project_id)` for all project-scoped routes.

### 4. API skeletons

- **Implemented:** Health, login, me, list projects, create project, get project (with access check), **list subjects**, **create subject** (example pattern).
- **Skeletons (TODO Phase 2):** schools/me, projects/{id}/classes, teachers, rooms, lessons, constraints, generate/validate, review (class/teacher/room/master/workload), exports (excel/pdf/csv, list).

### 5. Database schema and mapping

- **POSTGRES_SCHEMA.md** (existing) — Full PostgreSQL schema for users, schools, memberships, projects, school_settings, subjects, classes, teachers, rooms, lessons, constraints, timetable_runs, timetable_entries, exports, subscriptions.
- **DATA_MODEL_MAPPING.md** — How desktop SQLite tables map to web PostgreSQL tables (project_id/school_id scoping).

### 6. Core engine integration (service layer)

- **backend/services/timetable_engine_service.py** — Service contracts: `validate_project_data(provider)`, `generate_timetable(provider)`, `build_excel_export`, `build_pdf_export`, `build_csv_export`. Phase 1 returns placeholders; Phase 2 will call the real core engine.

### 7. Desktop app

- **Unchanged.** Desktop still runs; solver and validators use `TimetableDataProvider`; desktop uses `SqliteDataProvider(db)`. No PySide in core.

### 8. Documentation

- **WEB_MIGRATION_PHASE1_AUDIT.md** — What was found, what was refactored, what remains desktop-only.
- **CORE_ENGINE_BOUNDARY.md** — Core engine contents, import rules, how desktop and backend use it.
- **BACKEND_ARCHITECTURE_PHASE1.md** — Backend layout, auth, school/project ownership, DB summary.
- **DATA_MODEL_MAPPING.md** — Desktop → web table mapping.
- **RUN_BACKEND_LOCALLY.md** — Setup, env, schema, seed script, run server, run tests, troubleshooting.

### 9. Tests

- **test_backend_startup.py** — Health route, app loads.
- **test_db_session.py** — Session creation, User/School/Project CRUD.
- **test_auth.py** — Login failure/success, me with token.
- **test_projects_scoping.py** — List/create projects for current school.
- **test_project_access_protection.py** — Get other school’s project → 404.
- **test_subjects.py** — List/create subjects for project (example endpoint).
- **test_core_engine_integration.py** — Service layer accepts a minimal provider.
- **test_core_engine_no_pyside.py** — Import solver, core, models from desktop app; assert PySide6 not loaded.

### 10. Dev seed

- **backend/scripts/seed_dev.py** — Creates one school, one user (`admin@school.demo` / `demo123`), one membership so login and project flows work locally.

---

## What should happen in Phase 2

1. **Full project CRUD and project data** — Implement school_settings, and full CRUD for classes, teachers, rooms, lessons, constraints (repositories + API).
2. **PostgresDataProvider** — Load one project’s data from PostgreSQL into a `TimetableDataProvider` (same dict shape as desktop) so the core engine can run unchanged.
3. **Generation endpoints** — Validate and generate: call `validate_for_generation(provider)` and `TimetableSolver(provider).solve()`, persist timetable_entries and timetable_runs.
4. **Review endpoints** — Return class/teacher/room/master timetable and workload from DB.
5. **Export endpoints** — Generate Excel/PDF/CSV on the server (using core exports or adapter), store in school-scoped storage, return download URL or stream.
6. **Frontend** — Auth pages, dashboard, project list, project editor (school setup, subjects, classes, teachers, rooms, lessons, constraints), generate, review, export (no full billing yet).
7. **Optional:** Multiple users per school, subscription checks before create/generate/export, Alembic migrations for schema changes.

---

## Files created or modified (Phase 1)

| Area | Files |
|------|--------|
| **Docs** | `docs/WEB_MIGRATION_PHASE1_AUDIT.md`, `docs/CORE_ENGINE_BOUNDARY.md`, `docs/BACKEND_ARCHITECTURE_PHASE1.md`, `docs/DATA_MODEL_MAPPING.md`, `docs/RUN_BACKEND_LOCALLY.md`, `docs/PHASE1_SUMMARY.md` (this file). |
| **Backend** | `backend/main.py`, `backend/config.py`, `backend/requirements.txt`, `backend/models/base.py`, `backend/models/user.py`, `backend/models/school.py`, `backend/models/project.py`, `backend/models/__init__.py`, `backend/repositories/user_repo.py`, `backend/repositories/membership_repo.py`, `backend/repositories/project_repo.py`, `backend/repositories/subject_repo.py`, `backend/auth/jwt.py`, `backend/auth/password.py`, `backend/auth/deps.py`, `backend/auth/project_scope.py`, `backend/api/router.py`, `backend/api/auth.py`, `backend/api/projects.py`, `backend/api/subjects.py`, `backend/api/schools.py`, `backend/api/classes.py`, `backend/api/teachers.py`, `backend/api/rooms.py`, `backend/api/lessons.py`, `backend/api/constraints.py`, `backend/api/generation.py`, `backend/api/review.py`, `backend/api/exports.py`, `backend/services/timetable_engine_service.py`, `backend/scripts/seed_dev.py`, `backend/tests/conftest.py`, `backend/tests/test_*.py`. |
| **Desktop (unchanged)** | Core engine (solver, validators, data_provider, SqliteDataProvider) and desktop app remain as previously refactored; no new changes in Phase 1. |
