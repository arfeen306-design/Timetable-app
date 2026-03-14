# Timetable Web (Phase 2 frontend)

Minimal React frontend for the Timetable API. Requires the backend running on port 8000.

## Run

```bash
# From project root (Timetable app/)
cd web
npm install
npm run dev
```

Then open http://localhost:3000. The dev server proxies `/api` and `/health` to http://127.0.0.1:8000.

## Login

Use the same credentials as your backend (e.g. after seeding: `admin@school.demo` / `demo123`).

## Flow

1. **Login** — Sign in with email/password.
2. **Dashboard** — List projects, create a new project, or open one.
3. **Project editor** — Tabs: School settings, Subjects, Classes, Rooms, Teachers, Lessons, Constraints. Add/edit/delete data.
4. **Generate** — Validate project data, then generate timetable. View errors or success.
5. **Review** — View class/teacher/room timetables, master summary, workload.
6. **Export** — Download Excel, PDF, or CSV (requires a completed generation run).
