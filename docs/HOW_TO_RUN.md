# How to run — complete guide

This document covers how to run **both** the **online web app** and the **offline macOS desktop app**, with links and step-by-step setup.

---

## Quick start — web app (no PostgreSQL)

The app now uses **SQLite** by default, so you don’t need PostgreSQL.

1. **First time only** — from the project root:
   ```bash
   cd "/Users/admin/Desktop/Timetable app"
   ./backend/venv/bin/pip install -r backend/requirements.txt
   cd web && npm install && cd ..
   ./backend/venv/bin/python -m backend.scripts.seed_dev
   ```
   You should see: `Created school id=1, user id=1... Login: admin@school.demo / demo123`

2. **Terminal 1 — start backend:**
   ```bash
   ./run_backend.sh
   ```
   Leave it running. You should see the API on port 8000.

3. **Terminal 2 — start frontend:**
   ```bash
   ./run_web.sh
   ```
   Leave it running. Vite will use port **3987** (or next free port).

4. **Open in browser:**  
   **http://localhost:3987**  
   Log in with **`admin@school.demo`** / **`demo123`**

| What        | Link |
|------------|------|
| **Web app** | **http://localhost:3987** |
| API docs   | http://127.0.0.1:8000/docs |
| Health     | http://127.0.0.1:8000/health |

---

## 1. Online web app (SaaS) — full guide

The web app has two parts: a **backend API** and a **frontend**. You run them in two terminals.

### Prerequisites

- **Python 3.10+** with the backend virtual environment and dependencies
- **Node.js 18+** and npm (for the frontend)
- **Database:** SQLite by default (no setup). For PostgreSQL, set `DATABASE_URL` in `.env`.

### Step 1: Open the project

```bash
cd "/Users/admin/Desktop/Timetable app"
```

*(Use your actual path to the `Timetable app` folder.)*

### Step 2: Database (first time only)

1. **Create the database** (if it doesn’t exist):

   ```bash
   createdb timetable_saas
   ```

   On macOS, PostgreSQL often uses your OS username. If you get a “role postgres does not exist” error, the backend will try the current user automatically. Just ensure the DB exists:

   ```bash
   createdb timetable_saas
   ```

2. **Run migrations** (Alembic, if you use them):

   ```bash
   ./backend/venv/bin/python -m alembic -c backend/alembic.ini upgrade head
   ```

   *(If you don’t have Alembic migrations yet, the app may create tables on first run.)*

3. **Create a dev user and school**:

   ```bash
   ./backend/venv/bin/python -m backend.scripts.seed_dev
   ```

   You should see either “Created school…” or “Dev user already exists.”

4. **Optional — reset dev password** (if login fails):

   ```bash
   ./backend/venv/bin/python -m backend.scripts.reset_dev_password
   ```

   Default login: **`admin@school.demo`** / **`demo123`**

### Step 3: Install dependencies (first time only)

**Backend:**

```bash
./backend/venv/bin/pip install -r backend/requirements.txt
```

**Frontend:**

```bash
cd web && npm install && cd ..
```

### Step 4: Start the backend (Terminal 1)

From the **project root** (`Timetable app`):

```bash
./run_backend.sh
```

Or:

```bash
./online/run_backend.sh
```

- **API base URL:** **http://127.0.0.1:8000**
- **Health check:** http://127.0.0.1:8000/health  
- **API docs (Swagger):** http://127.0.0.1:8000/docs  
- **ReDoc:** http://127.0.0.1:8000/redoc  

Leave this terminal running.

### Step 5: Start the frontend (Terminal 2)

From the **project root**:

```bash
./run_web.sh
```

Or:

```bash
./online/run_web.sh
```

- **Web app URL:** **http://localhost:3987**  
  (Vite uses port 3987; the frontend proxies `/api` and `/health` to the backend on port 8000.)

### Step 6: Open the app and log in

1. In your browser go to: **http://localhost:3987**
2. Log in with: **`admin@school.demo`** / **`demo123`** (or the credentials you set with the seed/reset scripts)
3. You should see the **Introduction** screen and the left sidebar (1. Introduction … 10. Review & Export).

### Quick reference — online app

| What              | Link / command |
|-------------------|----------------|
| Open web app      | **http://localhost:3987** |
| API root          | http://127.0.0.1:8000 |
| API docs          | http://127.0.0.1:8000/docs |
| Health check      | http://127.0.0.1:8000/health |
| Start backend     | `./run_backend.sh` or `./online/run_backend.sh` |
| Start frontend    | `./run_web.sh` or `./online/run_web.sh` |
| Default login     | `admin@school.demo` / `demo123` |

---

## 2. Offline macOS desktop app

The desktop app runs locally with no server. Projects are stored as `.ttb` (SQLite) files.

### Prerequisites

- **Python 3.10+**
- **PySide6** and other dependencies from `requirements.txt`

### Install dependencies (first time only)

From the **project root**:

```bash
pip install -r requirements.txt
```

Or use a venv:

```bash
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run the desktop app

From the **project root**:

```bash
python main.py
```

Or from the `offline` folder:

```bash
./offline/run.sh
```

The **School Timetable Generator** window opens with the left sidebar (1. Introduction … 10. Review & Export). Use **Create New Project** or **Open Existing Project** to work with `.ttb` files.

### Build an installable .app (optional)

To build a macOS app bundle that can be installed and run without Python:

From the **project root**:

```bash
pip install -r requirements-packaging.txt
pyinstaller SchoolTimetable.spec
```

The built app is in **`dist/`**. See **`packaging/README.md`** and **`DISTRIBUTION_README.md`** for details.

### Quick reference — desktop app

| What           | Command / path |
|----------------|----------------|
| Run app        | `python main.py` or `./offline/run.sh` |
| Run from       | Project root (`Timetable app`) |
| Build .app     | `pyinstaller SchoolTimetable.spec` (from project root) |

---

## 3. Troubleshooting

### Backend won’t start

- **“role postgres does not exist”**  
  Create the DB with your OS user: `createdb timetable_saas`. The backend config will use the current user if the default Postgres URL fails.

- **“ModuleNotFoundError: core” or “solver”**  
  Start the backend from the **project root** so that `core/` and `solver/` are on the Python path (e.g. `./run_backend.sh` from `Timetable app`).

- **“No module named 'backend'”**  
  Run with: `./backend/venv/bin/python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000` from the project root.

### Can’t log in (web app)

- Run the seed script: `./backend/venv/bin/python -m backend.scripts.seed_dev`
- Reset password: `./backend/venv/bin/python -m backend.scripts.reset_dev_password`
- Use **http://localhost:3987** (not 127.0.0.1) so the frontend and cookies work as expected.

### Frontend shows “Cannot GET /” or wrong port

- Use **http://localhost:3987** (Vite is set to port 3987 in `web/vite.config.ts`).
- Ensure the backend is running on port 8000; the frontend proxies `/api` and `/health` to it.

### Desktop app: “No module named 'PySide6'”

- Install deps: `pip install -r requirements.txt` from the project root.

---

## 4. Summary

| Product        | Run from   | Command / link |
|----------------|------------|----------------|
| **Online (web)** | Project root | Backend: `./run_backend.sh` → API: http://127.0.0.1:8000, docs: http://127.0.0.1:8000/docs |
| **Online (web)** | Project root | Frontend: `./run_web.sh` → App: **http://localhost:3987** |
| **Offline (Mac)** | Project root | `python main.py` or `./offline/run.sh` |

**Login (web):** **http://localhost:3987** → **`admin@school.demo`** / **`demo123`**
