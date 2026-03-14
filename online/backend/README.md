# Timetable SaaS Backend

FastAPI backend for the online timetable product. Serves the REST API for schools, projects, generation, and exports.

## Stack

- **Python 3.10+**
- **FastAPI** — API
- **SQLAlchemy 2** — ORM
- **PostgreSQL** — database
- **JWT** — auth (python-jose)
- **Alembic** — migrations (see `docs/POSTGRES_SCHEMA.md` for schema)

## Local development

### 1. Create virtualenv and install deps

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # or Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment

Create a `.env` file (or export variables):

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/timetable_saas
SECRET_KEY=your-secret-key-use-openssl-rand-hex-32
DEBUG=true
```

### 3. Database

- Ensure PostgreSQL is running and create a database:
  ```bash
  createdb timetable_saas
  ```
- Apply schema: use the SQL in `../docs/POSTGRES_SCHEMA.md` or run Alembic when migrations are added.

### 4. Run the server

From the `backend` directory:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs (when `DEBUG=true`)

### 5. Using the core timetable engine

The backend is designed to call the **desktop app’s core engine** (solver, validation, exports). To do that from the backend:

- Either add the **parent project root** to `PYTHONPATH` when running the server, e.g.:
  ```bash
  cd /path/to/Timetable\ app
  PYTHONPATH=. uvicorn backend.main:app --reload --app-dir backend
  ```
- Or install the desktop app as an editable package so that `solver`, `core`, `database`, `models`, `exports` are importable.

Then the backend can implement a **PostgreSQL data provider** that loads project data (school, subjects, classes, teachers, rooms, lessons, constraints, entries) for a given `project_id` and presents it via the same `TimetableDataProvider` interface used by the solver and validators. Generation and export endpoints can then call the existing solver and export functions with that provider (or a temporary SQLite copy built from the loaded data).

## Project layout

- `api/` — route handlers (auth, projects, school, generation, exports, …)
- `auth/` — JWT, password hashing, dependencies
- `models/` — SQLAlchemy models and session
- `schemas/` — Pydantic request/response models
- `services/` — business logic (calls core engine, repos)
- `repositories/` — data access (projects, subjects, …)
- `core/` — wrappers or re-exports for the timetable core engine
- `config.py` — settings from env

## Production

- Set `DEBUG=false`.
- Use a strong `SECRET_KEY`.
- Use a real PostgreSQL instance and a safe `DATABASE_URL`.
- Run migrations with Alembic.
- Serve with gunicorn + uvicorn workers or a similar ASGI server.
- Configure CORS `allow_origins` for your frontend origin only.

See `../docs/SAAS_MIGRATION_PLAN.md` and `../docs/DEV_DEPLOY.md` for full migration and deployment notes.
