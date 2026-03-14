# Generation Flow — Validate, Generate, Save Run, Review, Export

This document describes the backend flow from validation through generation, storage, review, and export.

## 1. Validation (before generate)

- **Endpoint:** `POST /api/projects/{project_id}/generate/validate`
- **Backend:**
  1. Load project (with school scoping via `get_project_or_404`).
  2. Build `PostgresDataProvider(db, project_id)`.
  3. Call `validate_for_generation(provider)` from `core.validators` (core engine).
  4. Return `{ is_valid, errors, warnings, grouped_errors, readiness_summary }`.
- **Purpose:** Let the frontend show grouped errors/warnings and readiness so the user can fix data before generating.

## 2. Generation

- **Endpoint:** `POST /api/projects/{project_id}/generate`
- **Backend:**
  1. Load project (scoped).
  2. Run validation; if `!is_valid`, return 200 with `success: false` and validation payload.
  3. Create a `TimetableRun` with status `"running"`.
  4. Call `TimetableSolver(provider).solve(time_limit_seconds)` (core engine).
  5. If solver fails: update run to status `"failed"`, set message; return `success: false`, `messages`, `run_id`.
  6. If solver succeeds:
     - Delete existing **non-locked** timetable entries for the project (any run).
     - Save new entries as `TimetableEntry` rows (project_id, run_id, lesson_id, day_index, period_index, room_id, locked).
     - Update run to status `"completed"`, set `entries_count` and `finished_at`.
  7. Return `{ success: true, run_id, entries_count, message }` or failure payload.
- **Persistence:** `timetable_runs` and `timetable_entries` in PostgreSQL; entries are tied to `run_id` and `project_id`.

## 3. Review

- **Endpoints:**  
  `GET .../review/run-summary`, `.../review/class/{class_id}`, `.../review/teacher/{teacher_id}`, `.../review/room/{room_id}`, `.../review/master`, `.../review/workload`
- **Backend:**
  1. Ensure project is scoped.
  2. Get **latest** timetable run for the project; if no run or status ≠ `"completed"`, return 404/400.
  3. Load entries via `get_entries_with_joins(project_id, run_id, ...)` (optionally filtered by class_id, teacher_id, room_id).
  4. Return entries plus optional grid (day × period) and workload (periods per teacher).
- **Timing:** Grid and labels can be derived from `school_settings.bell_schedule_json` (zero period, breaks, Friday timing) in the frontend or future backend enhancement.

## 4. Export

- **Endpoints:** `GET .../exports/excel`, `.../exports/pdf`, `.../exports/csv`
- **Backend:**
  1. Ensure project is scoped and latest run is **completed**.
  2. Load entries for that run (minimal fields: lesson_id, day_index, period_index, room_id, locked).
  3. Build temp SQLite DB from `PostgresDataProvider` + these entries (`build_sqlite_from_provider` in `backend/services/export_adapter.py`).
  4. Call desktop export function: `export_excel(db, path)` / `export_pdf(db, path)` / `export_csv(db, path)`.
  5. Return the generated file (e.g. `FileResponse(path, ...)`).
- **Dependency:** PYTHONPATH must include project root so `database.connection`, `database.schema`, and `exports.*` are available.

## Data flow summary

```
Project (PostgreSQL)
    → PostgresDataProvider(project_id)
        → validate_for_generation(provider)  → JSON response
        → TimetableSolver(provider).solve()  → (success, entries, messages)
    → TimetableRun + TimetableEntry (PostgreSQL)
    → get_entries_with_joins()               → Review JSON
    → build_sqlite_from_provider + entries   → Temp SQLite
        → export_excel/pdf/csv(sqlite_conn, path) → File download
```

## Error handling

- **Validation errors:** Returned in `grouped_errors` and `errors`; frontend can show before generate.
- **Solver failure:** Run is stored with status `"failed"` and message; API returns `success: false` and `messages`.
- **No completed run (review/export):** 400/404 with message like “No completed timetable run. Generate a timetable first.”
