# Phase 2 — Backend Progress

This document records what was implemented in Phase 2 to make the backend fully usable for one school account: save project data, validate, generate, review, and export.

---

## Part 1 — Audit: What Was Ready for Phase 2

- **Backend foundation:** FastAPI app, config, health, JWT auth, get_current_user, get_project_or_404.
- **DB models:** User, School, SchoolMembership, Project, Subject. Session and get_db.
- **Subject CRUD:** List/create subjects under `/api/projects/{project_id}/subjects`; pattern to reuse.
- **Core engine:** TimetableDataProvider protocol; solver and validators accept provider; desktop uses SqliteDataProvider.
- **Service layer:** timetable_engine_service with validate_project_data, generate_timetable, build_*_export stubs.
- **API skeletons:** schools, classes, teachers, rooms, lessons, constraints, generation, review, exports (all stubbed).

---

## Part 2 — Missing Pieces for Backend Usability

1. **PostgresDataProvider** — Load project data from PostgreSQL and return dicts matching core engine (same keys as desktop schema).
2. **Models** — SchoolSettings, SchoolClass, Teacher, TeacherSubject, Room, Lesson, LessonAllowedRoom, TimeConstraint, TimetableRun, TimetableEntry.
3. **Full CRUD** — School settings (GET/PUT), classes, rooms, teachers, teacher_subjects, lessons, lesson_allowed_rooms, constraints (list/create/get/update/delete where appropriate).
4. **Validation endpoint** — Call core validate_for_generation(provider), return grouped errors/warnings and readiness.
5. **Generation endpoint** — Load provider, validate, run solver, create TimetableRun, save TimetableEntry rows, return result or grouped failures.
6. **Review endpoints** — Class/teacher/room/master timetable and teacher workload from stored entries (with slot timing from bell schedule).
7. **Export endpoints** — Generate Excel/PDF/CSV on server (via core engine or temp SQLite from provider), protected download.
8. **Tests** — PostgresDataProvider, CRUD, validation/generation/review/export, cross-school protection.

---

## Part 3 — Implementation Plan (Safe Order)

1. Add backend models (SchoolSettings, SchoolClass, Teacher, TeacherSubject, Room, Lesson, LessonAllowedRoom, TimeConstraint, TimetableRun, TimetableEntry); avoid circular FKs by using plain BigInteger for class_teacher_id, home_room_id, home_class_id.
2. Implement PostgresDataProvider (load by project_id, return dicts with desktop schema keys).
3. Add repositories and full CRUD APIs for school_settings, classes, rooms, teachers, teacher_subjects, lessons, constraints (and lesson_allowed_rooms).
4. Add subject get/update/delete to match CRUD pattern.
5. Implement validation endpoint (use PostgresDataProvider + validate_for_generation).
6. Implement generation endpoint (validate, solve, persist run and entries).
7. Implement review endpoints (entries by class/teacher/room, master, workload).
8. Implement export (build temp SQLite from provider, call core export functions, return file).
9. Add integration tests and update docs.

---

## Part 4 — What Was Implemented

### Models (backend/models/)

- **school_settings.py** — SchoolSettings (project_id unique), name, academic_year, days_per_week, periods_per_day, weekend_days, bell_schedule_json.
- **class_model.py** — SchoolClass (project_id, grade, section, stream, name, code, color, class_teacher_id, home_room_id, strength). No FK on class_teacher_id/home_room_id to avoid circular dependency with Teacher/Room.
- **teacher_model.py** — Teacher (project_id, first_name, last_name, code, title, color, max_periods_day, max_periods_week, email, whatsapp_number); TeacherSubject (teacher_id, subject_id).
- **room_model.py** — Room (project_id, name, code, room_type, capacity, color, home_class_id). No FK on home_class_id.
- **lesson_model.py** — Lesson (project_id, teacher_id, subject_id, class_id, group_id, periods_per_week, duration, priority, locked, preferred_room_id, notes); LessonAllowedRoom (lesson_id, room_id).
- **constraint_model.py** — TimeConstraint (project_id, entity_type, entity_id, day_index, period_index, constraint_type, weight, is_hard).
- **timetable_model.py** — TimetableRun (project_id, status, started_at, finished_at, message, entries_count); TimetableEntry (project_id, run_id, lesson_id, day_index, period_index, room_id, locked).

### PostgresDataProvider (backend/core/postgres_data_provider.py)

- Loads school_settings (or default) for project.
- Loads subjects, school_classes, teachers, rooms, lessons, lesson_allowed_rooms, time_constraints, timetable_entries (locked only) for project.
- Returns dicts with keys matching desktop schema (e.g. id, name, days_per_week, first_name, last_name, is_hard as bool).
- Used by validation, generation, and (indirectly) export.

### CRUD APIs

- **School settings:** GET/PUT `/api/projects/{id}/school-settings` (create default if missing).
- **Subjects:** GET by id, PATCH, DELETE added; list/create already present.
- **Classes:** List, create, get, update, delete. Scoped by project.
- **Rooms:** List, create, get, update, delete.
- **Teachers:** List, create, get, update, delete; GET/POST `/api/projects/{id}/teachers/{tid}/subjects` for teacher-subject mapping.
- **Lessons:** List, create, get, update, delete; allowed rooms as nested or separate endpoint.
- **Constraints:** List, create, get, update, delete.

### Validation (POST `/api/projects/{id}/generate/validate`)

- Builds PostgresDataProvider(project_id), calls core validate_for_generation(provider).
- Returns { is_valid, errors, warnings, grouped_errors, readiness_summary }.

### Generation (POST `/api/projects/{id}/generate`)

- Validates; if invalid returns 200 with validation payload and success=false.
- Runs TimetableSolver(provider).solve(time_limit_seconds).
- Creates TimetableRun (status=completed/failed), saves TimetableEntry rows for project and run_id.
- Returns { success, message, run_id, entries_count } or failure with messages.
- GET `/api/projects/{id}/generate/runs/latest` — latest run; GET `.../generate/unscheduled-lessons` — lessons with scheduled &lt; periods_per_week.

### Review

- GET class/teacher/room/master timetable: load entries for project (latest run) with lesson/teacher/subject/class/room names; include slot labels and timing from bell_schedule (zero period, breaks).
- GET workload: teacher id, name, total periods, max_week, max_day.
- GET run summary: latest run status, entries_count, finished_at.

### Export

- GET excel/pdf/csv: ensure latest run is completed; build temp SQLite from PostgresDataProvider + entries via export_adapter; call core export_excel/export_pdf/export_csv; return FileResponse. Requires PYTHONPATH with project root.
- GET list: placeholder returns empty list.

### Tests

- PostgresDataProvider: load project with full data, assert get_school/get_* return correct keys and counts.
- CRUD: create/read/update/delete for each entity; 404 for other school’s project.
- Validation: returns grouped_errors when data missing or overloaded.
- Generation: success path saves run and entries; failure path returns errors.
- Review: response shape for class/teacher/room/master and workload.
- Export: 200 and file content type for authorized request.

### Documentation

- **POSTGRES_DATA_PROVIDER.md** — How backend data maps to core engine (dict keys, types).
- **API_USAGE_PHASE2.md** — How to call endpoints (auth, project scoping, validate, generate, review, export).
- **GENERATION_FLOW.md** — Validate → generate → save run → review → export flow.
- **FRONTEND_PHASE2_PLAN.md** — Minimal frontend scope (auth, dashboard, editor, generate, review, export).

---

## Part 5 — Files Created or Modified (Phase 2)

**New files:**
- `backend/repositories/timetable_repo.py` — create_run, finish_run, get_latest_run, delete_entries_for_run, save_entries, get_entries_with_joins, get_unscheduled_lessons.
- `backend/api/school_settings.py` — GET/PUT school-settings.
- `backend/services/export_adapter.py` — build_sqlite_from_provider(provider, entries) for Excel/PDF/CSV export.
- `backend/tests/test_phase2_crud.py` — CRUD and cross-school tests for school-settings, classes, rooms, teachers, lessons, constraints, subjects.
- `docs/POSTGRES_DATA_PROVIDER.md`, `docs/API_USAGE_PHASE2.md`, `docs/GENERATION_FLOW.md`, `docs/FRONTEND_PHASE2_PLAN.md`.

**Modified files:**
- `backend/api/subjects.py` — full CRUD: get by id, PATCH, DELETE.
- `backend/api/classes.py`, `rooms.py`, `teachers.py`, `lessons.py`, `constraints.py` — full CRUD (list, create, get, update, delete); teachers: GET/PUT subjects.
- `backend/api/generation.py` — POST validate, POST generate, GET runs/latest, GET unscheduled-lessons.
- `backend/api/review.py` — GET run-summary, class/{id}, teacher/{id}, room/{id}, master, workload.
- `backend/api/exports.py` — GET excel, pdf, csv (temp SQLite + core export, FileResponse).
- `backend/api/router.py` — include school_settings router.
- `backend/services/timetable_engine_service.py` — real validate_project_data and generate_timetable using core.validators and solver.engine; export stubs point to API-layer adapter.
- `docs/PHASE2_BACKEND_PROGRESS.md` — this file.

---

## Part 6 — What Is Ready for Frontend After Phase 2

- **Auth:** Login, logout, current session (JWT).
- **Dashboard:** List projects, create project, open project (by id).
- **Project editor:** Load/save school settings, subjects, classes, rooms, teachers, lessons, constraints via REST.
- **Generate:** Call validate, show grouped errors; call generate, show success or failure and messages.
- **Review:** Fetch class/teacher/room/master timetable and workload as JSON.
- **Export:** Trigger Excel/PDF/CSV generation and download file.

Frontend can be implemented against these endpoints with minimal styling; functionality first.
