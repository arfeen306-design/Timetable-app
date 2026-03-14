# Run the Backend Locally

This document explains how to run the FastAPI timetable backend on your machine for development.

**Important:** The backend uses **package-style imports** (`backend.auth`, `backend.models`, etc.). You must run the app **from the project root** so that the `backend` package resolves correctly.

---

## 1. Prerequisites

- **Python 3.10+**
- **PostgreSQL** (local or remote) with a database created for the app
- Terminal/shell

---

## 2. Backend location

The backend lives under the timetable project root:

```
Timetable app/          ← project root (run commands from here)
  backend/
    main.py
    config.py
    requirements.txt
    api/
    auth/
    models/
    ...
```

---

## 3. Setup steps

### 3.1 Create and activate a virtualenv

From the **project root** (or from `backend/`):

```bash
cd path/to/Timetable\ app/backend
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
```

### 3.2 Install dependencies

From the backend directory (with venv activated):

```bash
pip install -r requirements.txt
```

### 3.3 Environment variables

Create a file `backend/.env` (or export variables in your shell). Minimum:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME
SECRET_KEY=your-secret-key-at-least-32-chars
DEBUG=true
```

- **DATABASE_URL** — Replace USER, PASSWORD, and DATABASE_NAME with your PostgreSQL credentials and database name.
- **SECRET_KEY** — Used for JWT signing. Use a long random string in production (e.g. `openssl rand -hex 32`).
- **DEBUG** — Set to `true` for local dev (enables `/docs` and detailed errors).

Optional:

```env
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

(10080 = 7 days.)

### 3.4 Create the database and schema

1. Create a PostgreSQL database (if you haven’t already):

   ```bash
   createdb timetable_saas
   ```

2. Apply the schema. Use the SQL in **`docs/POSTGRES_SCHEMA.md`** (run the CREATE TABLE statements in order, respecting circular FKs), or run Alembic migrations when they are added.

   For Phase 1 you need at least: **users**, **schools**, **school_memberships**, **projects**, **subjects**. Easiest is to use SQLAlchemy to create tables. **From the project root** (with venv activated and `backend` on PYTHONPATH):

   ```bash
   cd path/to/Timetable\ app
   python -c "from backend.models.base import init_db; init_db()"
   ```

3. **Seed a dev user** (optional, for login). From the project root:

   ```bash
   python -m backend.scripts.seed_dev
   ```

   Then you can log in with `admin@school.demo` / `demo123` and create/list projects.

---

## 4. Run the server

**From the project root** (with venv activated). Use `-m` so Python treats the project as a package:

```bash
cd path/to/Timetable\ app
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Or activate the venv and run:

```bash
./backend/venv/bin/python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

- **API base:** http://localhost:8000  
- **Health check:** http://localhost:8000/health  
- **OpenAPI docs:** http://localhost:8000/docs (when DEBUG=true)

---

## 5. Using the core timetable engine from the backend

The backend is designed to call the existing solver and validators. To do that, the Python path must include the **timetable project root** so that `solver`, `core`, `models`, `exports`, and `utils` can be imported. When you run from project root as above, add:

```bash
PYTHONPATH=. python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Then validation, generation, and export (Excel/PDF/CSV) can use the desktop app’s core engine.

---

## 6. Quick checks

1. **Health:** `curl http://localhost:8000/health` → `{"status":"ok"}`.
2. **Login:** After seeding, `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@school.demo","password":"demo123"}'` → returns access_token and user.
3. **Me (with token):** `curl http://localhost:8000/api/auth/me -H "Authorization: Bearer YOUR_TOKEN"`.
4. **List projects:** `curl http://localhost:8000/api/projects -H "Authorization: Bearer YOUR_TOKEN"`.

Once the DB is wired, login will validate credentials and projects will be filtered by the user’s school.

---

## 7. Run tests

From the **project root** (with venv activated and dependencies installed, including pytest and httpx):

```bash
cd path/to/Timetable\ app
python -m pytest backend/tests/ -v
```

Tests use `backend.*` imports and expect to be run with the project root as the working directory (so the `backend` package is found). Tests cover: health route, DB session, login/me, school-scoped project list, project access protection (other school’s project returns 404), subjects list/create, Phase 2 CRUD, and core-engine service integration.

---

## 8. Troubleshooting

- **ModuleNotFoundError: No module named 'backend'** — Run from the **project root** and use `python -m uvicorn backend.main:app` (not from inside `backend/` with `uvicorn main:app`).
- **ModuleNotFoundError for solver/core/models** (during validate/generate/export) — Ensure PYTHONPATH includes the timetable project root: `PYTHONPATH=. python -m uvicorn backend.main:app --reload`.
- **Database connection errors** — Check DATABASE_URL, that PostgreSQL is running, and that the database and schema exist.
- **401 on /api/projects** — Send a valid JWT in the Authorization header (Bearer &lt;token&gt;).
