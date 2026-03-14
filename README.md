# School Timetable Generator

This repo contains **two products**:

- **Online SaaS** — Web app (React + FastAPI). See **[`online/`](online/README.md)** to run or deploy.
- **Offline macOS app** — Desktop app (PySide6) you can install and run offline. See **[`offline/`](offline/README.md)** to run or build the .app.

Details: **[STRUCTURE.md](STRUCTURE.md)**.

**How to run (full guide and links):** **[docs/HOW_TO_RUN.md](docs/HOW_TO_RUN.md)**.

---

A professional offline desktop application for generating clash-free school timetables.

## Features

- Wizard-based setup flow for school configuration
- Subject, class, teacher, room, and lesson management
- Constraint-based timetable generation using Google OR-Tools CP-SAT solver
- Hard constraints: no teacher/class/room double-booking, weekly load requirements
- Soft constraints: spread lessons across days, minimize gaps, prefer rooms
- Manual lock support for preserving specific assignments
- Export to Excel (.xlsx), CSV, and PDF
- Save/open projects as .ttb files (SQLite databases)
- Built-in demo data for testing

## Requirements

- Python 3.10+
- PySide6
- Google OR-Tools
- openpyxl
- pandas
- reportlab

## Installation

```bash
cd "Timetable app"
pip install -r requirements.txt
```

## Running

```bash
python main.py
```

## Quick Start

1. Launch the application
2. Click "Load Demo Data" to populate with sample school data
3. Navigate through the wizard steps to review data
4. Go to "Generate" and click "Generate Timetable"
5. Review results in the "Review & Export" tab
6. Export to Excel, CSV, or PDF

## Project Structure

```
app/            - Application bootstrap
core/           - Business rules and validators
database/       - SQLite connection and schema
models/         - Domain entity dataclasses
repositories/   - Database access layer
services/       - Application logic layer
solver/         - OR-Tools timetable engine
ui/             - PySide6 user interface
exports/        - Excel, CSV, PDF generation
utils/          - Helper utilities
sample_data/    - Demo school dataset
tests/          - Unit and integration tests
```

## Running Tests

```bash
cd "Timetable app"
python -m pytest tests/ -v
```

## Project Files

Projects are saved as `.ttb` files, which are SQLite databases. They can be opened and inspected with any SQLite browser.

## Packaging for distribution

To build a double-clickable app for Mac or Windows (no Python required for end users):

- **Mac:** From project root run `./build/build_mac.sh`. Output: `dist/School Timetable Generator/`. Zip that folder and send to Mac users.
- **Windows:** On a Windows machine run `build\build_win.bat`. Output: `dist\School Timetable Generator\`. Zip that folder and send to Windows users.

See **build/BUILD.md** for full build steps, icons, and troubleshooting. Use **DISTRIBUTION_README.md** as the user-facing readme (install, open, report bugs, where projects are stored).
