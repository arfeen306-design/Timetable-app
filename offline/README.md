# Offline macOS App — School Timetable Generator

This folder is the **entry point for the desktop (offline) app**. All files required to run or build the macOS app for offline install live in the parent directory as listed below.

## What belongs to the offline product

| Location (from repo root) | Purpose |
|---------------------------|--------|
| `main.py` | Entry point |
| `app/` | PySide6 application bootstrap |
| `ui/` | Main window, left sidebar (1–10 steps), wizard pages, dialogs |
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
| `packaging/`, `build/` | Build macOS .app bundle |
| `SchoolTimetable.spec` | PyInstaller spec |
| `requirements.txt`, `requirements-packaging.txt` | Python dependencies |

Projects are stored as local `.ttb` (SQLite) files. **No server required.**

## How to run (development)

From **repo root**:

```bash
python main.py
```

Or from **this folder**:

```bash
./run.sh
```

Requires: Python 3.10+, PySide6, and deps from `../requirements.txt`.

## How to build for offline install (macOS)

To create an app bundle that users can install and run without Python:

1. From **repo root**:
   ```bash
   pyinstaller SchoolTimetable.spec
   ```
2. The built app is under `dist/`. See `../packaging/` and `../DISTRIBUTION_README.md`.

Users can copy the `.app` to Applications and run it offline.
