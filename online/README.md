# Online SaaS — School Timetable Generator

This folder is the **entry point for the web (online) product**. All files required to run or deploy the online SaaS live in the parent directory as listed below.

## What belongs to the online product

| Location (from repo root) | Purpose |
|---------------------------|--------|
| `backend/` | FastAPI API, PostgreSQL, auth, CRUD, validation, generation, export |
| `web/` | React frontend (Vite) — login, sidebar UI, project editor, generate, review, export |
| `core/` | Timetable engine (validators) — used by backend |
| `solver/` | Solver — used by backend |
| `run_backend.sh`, `run_web.sh` | Launcher scripts (also linked from this folder) |

## How to run

From **repo root**:

```bash
./run_backend.sh   # API on http://127.0.0.1:8000
./run_web.sh      # Web on http://localhost:5173
```

Or from **this folder**:

```bash
./run_backend.sh
./run_web.sh
```

## First-time setup

1. PostgreSQL: create DB (e.g. `timetable_saas`), run migrations.
2. Backend: `./backend/venv/bin/pip install -r backend/requirements.txt`
3. Seed dev user: `./backend/venv/bin/python -m backend.scripts.seed_dev`
4. Web: `cd web && npm install`

See `../docs/` for API and deployment details.
