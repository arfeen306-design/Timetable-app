# Timetable App — Two Products

This repository contains **two products** in one codebase:

1. **Online SaaS** — Web app (backend + frontend). Run and deploy from the **`online/`** folder.
2. **Offline macOS app** — Desktop app (PySide6). Run and build for offline install from the **`offline/`** folder.

---

## Online SaaS (web product)

**Entry point:** `online/`  
**Run:** `./online/run_backend.sh` and `./online/run_web.sh` (or from repo root: `./run_backend.sh`, `./run_web.sh`)

| Files / folders | Purpose |
|-----------------|--------|
| `backend/` | FastAPI API, PostgreSQL, auth, CRUD, validation, generation, export |
| `web/` | React (Vite) frontend — login, project editor, generate, review, export |
| `core/` | Shared timetable engine (validators) — used by backend |
| `solver/` | Shared solver — used by backend |
| `run_backend.sh`, `run_web.sh` | Launcher scripts (also under `online/`) |

Deployment: use `backend/` and `web/` with the backend’s `requirements.txt` and the web’s `npm install` / build. Ensure `PYTHONPATH` includes the repo root so `core` and `solver` are importable.

---

## Offline macOS app (desktop, installable offline)

**Entry point:** `offline/`  
**Run:** `./offline/run.sh` or from repo root: `python main.py`  
**Build .app for install:** From repo root: `pyinstaller SchoolTimetable.spec` (see `packaging/`, `DISTRIBUTION_README.md`)

| Files / folders | Purpose |
|-----------------|--------|
| `main.py` | Application entry point |
| `app/` | Qt/PySide6 application bootstrap |
| `ui/` | Windows, wizard pages, dialogs (left sidebar, steps 1–10) |
| `database/` | SQLite connection and schema (.ttb project files) |
| `core/` | Validators, engine logic |
| `solver/` | Timetable solver |
| `imports/` | Excel import (teachers, classes, subjects, lessons) |
| `exports/` | Excel, PDF, CSV export |
| `repositories/` | Data access (desktop) |
| `services/` | Business logic (desktop) |
| `models/` | Domain models |
| `utils/` | Helpers, display utils |
| `sample_data/` | Demo data loader |
| `packaging/`, `build/` | Build macOS app bundle |
| `SchoolTimetable.spec` | PyInstaller spec for .app |
| `requirements.txt`, `requirements-packaging.txt` | Python deps |

Projects are stored as local `.ttb` (SQLite) files. No server required. Users can install the built `.app` and run it offline.

---

## Summary

- **Use `online/`** when you want to run or deploy the **web (SaaS)** product.
- **Use `offline/`** when you want to run or build the **desktop (macOS)** product for offline use.

Both products share the same engine (`core/`, `solver/`) but use different UIs and data storage (PostgreSQL vs SQLite).
