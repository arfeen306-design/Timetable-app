# Frontend Phase 2 — Minimal Scope

After the Phase 2 backend is in place, the frontend should implement a **minimal but complete** flow: functionality first, minimal styling.

## 1. Auth

- **Login** — Form: email, password; call `POST /api/auth/login`; store token (e.g. in memory or localStorage); redirect to dashboard.
- **Logout** — Clear token; redirect to login.
- **Current session** — Optional: call `GET /api/auth/me` with Bearer token to show user/school name.

## 2. Dashboard

- **List projects** — `GET /api/projects`; show list of projects for the school.
- **Create project** — Form: name, academic year; `POST /api/projects`; then open the new project.
- **Open project** — Navigate to project editor (e.g. `/projects/{id}` or `/projects/{id}/settings`).

## 3. Project editor sections

One page or tabs for:

- **School settings** — Load `GET .../school-settings`, form for name, academic year, days per week, periods per day, weekend days, bell schedule (JSON or simple fields); save with `PUT .../school-settings`.
- **Subjects** — List `GET .../subjects`, add/edit/delete (POST, PATCH, DELETE).
- **Classes** — List, add, edit, delete (grade, section, name, strength, class teacher, home room).
- **Rooms** — List, add, edit, delete (name, type, capacity, color).
- **Teachers** — List, add, edit, delete; manage teacher subjects (GET/PUT `.../teachers/{id}/subjects`).
- **Lessons** — List, add, edit, delete (teacher, subject, class, periods per week, preferred room, allowed rooms).
- **Constraints** — List, add, edit, delete (entity type, entity id, day, period, type, hard/soft).

Use the same Bearer token and project_id in the path for all requests.

## 4. Generate page

- **Validate** — Button: `POST .../generate/validate`; show `is_valid`, `errors`, `warnings`, `grouped_errors`, `readiness_summary` (e.g. in a panel or list).
- **Generate** — Button: `POST .../generate`; show success (run_id, entries_count) or failure (message, messages).
- Show grouped errors or success summary; no need for advanced styling.

## 5. Review page

- **Run summary** — `GET .../review/run-summary`; show latest run status, entries count, finished_at.
- **Class view** — Dropdown or list of classes; `GET .../review/class/{class_id}`; show grid (day × period) with subject/teacher/room.
- **Teacher view** — Same for teachers; `GET .../review/teacher/{teacher_id}`.
- **Room view** — Same for rooms; `GET .../review/room/{room_id}`.
- **Master view** — `GET .../review/master`; show full grid or table.
- **Workload** — `GET .../review/workload`; show table of teacher name and periods_scheduled.

Use a clean but minimal layout (tables or simple grids).

## 6. Export page

- **Download Excel** — Link or button: `GET .../exports/excel` (open in new tab or trigger download).
- **Download PDF** — `GET .../exports/pdf`.
- **Download CSV** — `GET .../exports/csv`.

Handle 400 (no completed run) with a short message.

## Out of scope for Phase 2

- Payment / billing.
- Multi-user school collaboration (beyond single school account).
- Full public marketing site.
- Heavy visual polish; focus on correctness and usability.

## API base

- Base URL: e.g. `http://localhost:8000` (or env).
- All project endpoints: `/api/projects/{project_id}/...`.
- Header: `Authorization: Bearer <token>`.

See **API_USAGE_PHASE2.md** for exact endpoints and request/response shapes.
