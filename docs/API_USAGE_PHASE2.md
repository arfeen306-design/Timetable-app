# API Usage — Phase 2

How to use the Phase 2 backend endpoints locally (auth, project scoping, CRUD, validate, generate, review, export).

## Running the backend

From the **project root** (parent of `backend/`):

```bash
# With venv activated and PYTHONPATH so core/solver can be imported
export PYTHONPATH=.   # or set in env
uvicorn backend.main:app --reload --app-dir .
```

Or from `backend/` with project root on path:

```bash
cd backend
PYTHONPATH=.. uvicorn main:app --reload
```

## Auth

- **POST /api/auth/login**  
  Body: `{ "email": "...", "password": "..." }`  
  Returns: `{ "access_token": "...", "token_type": "bearer" }`

- **GET /api/auth/me** (optional)  
  Header: `Authorization: Bearer <token>`  
  Returns current user (e.g. id, email, school_id).

Use `Authorization: Bearer <token>` on all project-scoped requests below.

## Project scoping

All project endpoints use **project_id** in the path and enforce that the project belongs to the current user’s school. If not, the response is **404**.

- **GET /api/projects** — list projects for the school.
- **GET /api/projects/{project_id}** — get one project (404 if other school).
- **POST /api/projects** — create project (body: name, academic_year, etc.).

## School settings

- **GET /api/projects/{project_id}/school-settings**  
  Returns school settings for the project; creates default if missing.

- **PUT /api/projects/{project_id}/school-settings**  
  Body: optional `name`, `academic_year`, `days_per_week`, `periods_per_day`, `weekend_days`, `bell_schedule_json`.  
  Partial update supported.

## Subjects

- **GET /api/projects/{project_id}/subjects** — list.
- **GET /api/projects/{project_id}/subjects/{subject_id}** — get one (404 if not in project).
- **POST /api/projects/{project_id}/subjects** — create (body: name, code, color, category, max_per_day, double_allowed, preferred_room_type).
- **PATCH /api/projects/{project_id}/subjects/{subject_id}** — update (partial).
- **DELETE /api/projects/{project_id}/subjects/{subject_id}** — delete.

## Classes, rooms, teachers, lessons, constraints

Same pattern under:

- `/api/projects/{project_id}/classes` — list, create, get, update, delete.
- `/api/projects/{project_id}/rooms` — list, create, get, update, delete.
- `/api/projects/{project_id}/teachers` — list, create, get, update, delete.  
  - **GET/PUT /api/projects/{project_id}/teachers/{teacher_id}/subjects** — get/set subject IDs for teacher.
- `/api/projects/{project_id}/lessons` — list, create, get, update, delete (body includes teacher_id, subject_id, class_id, periods_per_week, allowed_room_ids, etc.).
- `/api/projects/{project_id}/constraints** — list, create, get, update, delete (body: entity_type, entity_id, day_index, period_index, constraint_type, weight, is_hard).

All require the same Bearer token and return 404 for other school’s project.

## Validation

- **POST /api/projects/{project_id}/generate/validate**  
  Runs core `validate_for_generation(provider)`.  
  Returns: `{ "is_valid", "errors", "warnings", "grouped_errors", "readiness_summary" }`.

## Generation

- **POST /api/projects/{project_id}/generate**  
  Validates; if valid, runs solver, creates a run, saves entries.  
  Returns: `{ "success", "message", "run_id", "entries_count" }` or failure with `messages` / validation info.

- **GET /api/projects/{project_id}/generate/runs/latest**  
  Returns latest run (id, status, started_at, finished_at, message, entries_count).

- **GET /api/projects/{project_id}/generate/unscheduled-lessons**  
  Returns lessons where scheduled count &lt; periods_per_week.

## Review

All review endpoints require a **completed** timetable run; otherwise 400/404.

- **GET /api/projects/{project_id}/review/run-summary** — latest run summary.
- **GET /api/projects/{project_id}/review/class/{class_id}** — class timetable (entries + grid).
- **GET /api/projects/{project_id}/review/teacher/{teacher_id}** — teacher timetable.
- **GET /api/projects/{project_id}/review/room/{room_id}** — room timetable.
- **GET /api/projects/{project_id}/review/master** — all entries + grid.
- **GET /api/projects/{project_id}/review/workload** — teacher workload (periods_scheduled per teacher).

## Export

Export endpoints generate a file from the **latest completed run** and return it for download. If no completed run, 400.

- **GET /api/projects/{project_id}/exports/excel** — download Excel.
- **GET /api/projects/{project_id}/exports/pdf** — download PDF.
- **GET /api/projects/{project_id}/exports/csv** — download CSV.

Requires PYTHONPATH so that `exports.excel_export`, `exports.pdf_export`, `exports.csv_export` and `database.connection`/`database.schema` are available.

## Example flow

1. Login → get token.
2. Create or open project → get project_id.
3. PUT school-settings, POST subjects, classes, rooms, teachers, lessons, constraints.
4. POST generate/validate → fix any errors.
5. POST generate → get run_id and entries_count.
6. GET review/class/{class_id}, review/teacher/{teacher_id}, review/master, review/workload.
7. GET exports/excel (or pdf/csv) → save file.
