"""FastAPI application entry point."""
from __future__ import annotations
import os
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.api.router import api_router
from backend.models.base import init_db

settings = get_settings()
_script_dir = os.path.dirname(os.path.abspath(__file__))
_static_dir = os.path.join(_script_dir, "..", "web", "dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup so the app works without running migrations."""
    try:
        init_db()
    except Exception as e:
        print(f"Warning: init_db failed: {e}")

    # Auto-migrate: add is_approved column if it doesn't exist
    try:
        from backend.models.base import engine
        from sqlalchemy import text, inspect
        insp = inspect(engine)
        cols = [c["name"] for c in insp.get_columns("users")]
        if "is_approved" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT true"))
            print("Migration: added is_approved column to users table.")
        else:
            # Auto-approve all existing pending users
            with engine.begin() as conn:
                conn.execute(text("UPDATE users SET is_approved = true WHERE is_approved = false"))
    except Exception as e:
        print(f"Warning: is_approved migration skipped: {e}")

    # Auto-migrate: add daily_limits_json column to school_settings if missing
    try:
        from backend.models.base import engine
        from sqlalchemy import text, inspect as sa_inspect
        insp2 = sa_inspect(engine)
        if "school_settings" in insp2.get_table_names():
            cols2 = [c["name"] for c in insp2.get_columns("school_settings")]
            if "daily_limits_json" not in cols2:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE school_settings ADD COLUMN daily_limits_json TEXT NOT NULL DEFAULT '{}'"))
                print("Migration: added daily_limits_json column to school_settings table.")
    except Exception as e:
        print(f"Warning: daily_limits_json migration skipped: {e}")

    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)


@app.exception_handler(Exception)
def catch_all_exception_handler(request: Request, exc: Exception):
    """Log and return 500 with error detail when debug is on."""
    tb = traceback.format_exc()
    print(tb)  # Always log to server console
    detail = str(exc)
    if settings.debug:
        detail = f"{detail}\n\n{tb}"
    return JSONResponse(
        status_code=500,
        content={"detail": detail},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression — reduces JSON response sizes by 3-5×
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)

app.include_router(api_router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug/db")
def debug_db():
    """Debug endpoint (disabled in production). Shows DB type without credentials."""
    if not settings.debug:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    raw_url = os.environ.get("DATABASE_URL", "NOT_SET")
    settings_url = settings.database_url
    def classify(url):
        if "sqlite" in url: return "sqlite"
        if "postgres" in url or "supabase" in url: return "postgresql"
        return url[:30] if url != "NOT_SET" else "NOT_SET"
    return {
        "os_environ_DATABASE_URL": classify(raw_url),
        "pydantic_settings_url": classify(settings_url),
        "connected_to_postgres": "postgres" in settings_url or "supabase" in settings_url,
    }

@app.get("/debug/solver")
def debug_solver():
    """Debug endpoint (disabled in production). Checks CP-SAT solver import."""
    if not settings.debug:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    try:
        from solver.engine import TimetableSolver
        from core.validators import validate_for_generation
        return {"solver_available": True, "engine": "OR-Tools CP-SAT (original solver/engine.py)"}
    except ImportError as e:
        return {"solver_available": False, "error": str(e)}



# Serve built frontend so you only need backend + http://localhost:8000
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            return JSONResponse(content={"detail": "Not Found"}, status_code=404)
        file_path = os.path.join(_static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_static_dir, "index.html"))
else:

    @app.get("/")
    def root():
        return {"message": "Timetable API", "health": "/health", "docs": "/docs" if settings.debug else None, "hint": "Run: cd web && npm run build, then restart backend. Then open http://localhost:8000"}
