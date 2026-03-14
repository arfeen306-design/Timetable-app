# Local Development, Deployment, and Pilot Launch

This document covers how to run the timetable product locally, deploy the web version, and run a pilot with real schools.

---

## 1. Local development

### 1.1 Desktop app (existing)

- **Requirements:** Python 3.10+, PySide6, OR-Tools, openpyxl, reportlab, etc. (see project `requirements.txt` or `venv`).
- **Run:**
  ```bash
  cd "Timetable app"
  ./venv/bin/python main.py
  ```
- **Project files:** Create or open a `.ttb` file (SQLite). No server required.

### 1.2 Backend (FastAPI)

- **Requirements:** Python 3.10+, see `backend/requirements.txt`.
- **Setup:**
  ```bash
  cd "Timetable app/backend"
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```
- **Environment:** Create `backend/.env` with at least:
  - `DATABASE_URL=postgresql://user:pass@localhost:5432/timetable_saas`
  - `SECRET_KEY=<random-secret>`
  - `DEBUG=true`
- **Database:** Create PostgreSQL DB and apply schema from `docs/POSTGRES_SCHEMA.md` (or use Alembic when migrations are added).
- **Run:**
  ```bash
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```
- **API base:** http://localhost:8000  
- **Docs:** http://localhost:8000/docs (when DEBUG=true)

### 1.3 Frontend (planned)

- **Stack:** Next.js or React (see migration plan).
- **Run (when built):**
  ```bash
  cd frontend && npm install && npm run dev
  ```
- **App:** http://localhost:3000 (or configured port). Set API base URL to http://localhost:8000/api.

### 1.4 Using the core engine from the backend

The backend must call the existing solver, validators, and exports. Options:

- **Option A:** Run the backend from the **Timetable app root** and set `PYTHONPATH` so that `solver`, `core`, `database`, `models`, `exports` are importable:
  ```bash
  cd "Timetable app"
  PYTHONPATH=. uvicorn backend.main:app --reload --app-dir backend
  ```
- **Option B:** Install the timetable app as an editable package (e.g. `pip install -e .` from the project root) so the same imports work when running from `backend/`.

The backend then implements a **PostgreSQL data provider** that loads one project’s data (school_settings, subjects, classes, teachers, rooms, lessons, constraints, timetable_entries) and implements the `TimetableDataProvider` interface. Generation and export endpoints use this provider (or a temporary SQLite snapshot) with the existing solver and export code.

---

## 2. Deployment (staging / production)

### 2.1 Recommended layout

- **Frontend:** Host on Vercel, Netlify, or similar. Build command: `npm run build`. Output: static/SSR as per framework. Set env: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` (or equivalent).
- **Backend:** Host on Render, Railway, Fly.io, or a VPS. Run ASGI app (e.g. `uvicorn main:app --host 0.0.0.0 --port 8000` or gunicorn + uvicorn workers). Set env: `DATABASE_URL`, `SECRET_KEY`, `DEBUG=false`, `ALLOWED_ORIGINS=https://app.yourdomain.com`.
- **Database:** Managed PostgreSQL (e.g. Render, Supabase, Neon, RDS). Run migrations (Alembic or manual SQL from `docs/POSTGRES_SCHEMA.md`) before first deploy.
- **File storage:** Local disk for exports in dev; for production use a bucket (e.g. S3, GCS) and set `STORAGE_PATH` / `STORAGE_URL_PREFIX` or equivalent so generated Excel/PDF/CSV files are stored and served (or signed URLs) without exposing internal paths.

### 2.2 Environment variables (production)

- `DATABASE_URL` — PostgreSQL connection string.
- `SECRET_KEY` — Strong random key (e.g. `openssl rand -hex 32`).
- `DEBUG` — `false`.
- `ACCESS_TOKEN_EXPIRE_MINUTES` — Optional; default 7 days.
- `ALLOWED_ORIGINS` or CORS config — Frontend origin(s) only.
- `STORAGE_PATH` / cloud storage config — Where to store export files.
- Email (optional) — For password reset; placeholder until implemented.

### 2.3 Security checklist

- HTTPS only for frontend and API.
- No secrets in frontend or in repo; use env vars.
- All API routes that touch school/project data must enforce auth and school/project scope.
- Rate limiting on login and expensive endpoints (optional but recommended).

---

## 3. Pilot launch with real schools

### 3.1 Goals

- A few schools (e.g. 3–10) use the web product.
- Each school has its own account; data is isolated.
- Manual subscription activation by platform admin is acceptable.
- Save/resume and export downloads must be reliable; errors must be clear.

### 3.2 Preparation

1. **Accounts:** Platform admin creates schools and school-admin users (or provides a simple “invite” / signup flow). No public self-signup required for pilot.
2. **Subscriptions:** Create subscription plans (e.g. “Pilot”, “Free trial”). Manually assign a plan to each school and set trial/active dates.
3. **Data isolation:** Verify that every project/list/export endpoint filters by `school_id` (and `project_id`) derived from the authenticated user. Test with two school accounts and confirm they cannot see each other’s data.
4. **Save and resume:** Test full flow: create project → edit data → save → leave → log in again → open project → confirm data is intact.
5. **Generation and exports:** Test generate → review → download Excel/PDF/CSV; confirm files are correct and downloads work.
6. **Error reporting:** Ensure validation and generation errors are returned in a grouped, readable form (e.g. `grouped_errors` by category). Frontend should display these clearly.

### 3.3 Rollout

- Deploy backend and frontend to staging; run smoke tests.
- Create one pilot school and run through the full workflow.
- Fix critical issues, then enable remaining pilot schools.
- Collect feedback on performance, UX, and missing features for the next phase.

---

## 4. References

- **Product and migration plan:** `docs/SAAS_MIGRATION_PLAN.md`
- **PostgreSQL schema:** `docs/POSTGRES_SCHEMA.md`
- **Backend readme:** `backend/README.md`
