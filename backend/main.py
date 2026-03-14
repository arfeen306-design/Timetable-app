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

app.include_router(api_router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug/db")
def debug_db():
    """Safe debug endpoint: shows DB type without exposing credentials."""
    import os
    raw_url = os.environ.get("DATABASE_URL", "NOT_SET")
    settings_url = settings.database_url
    # Show only type, not credentials
    def classify(url):
        if "sqlite" in url: return "sqlite"
        if "postgres" in url or "supabase" in url: return "postgresql"
        return url[:30] if url != "NOT_SET" else "NOT_SET"
    return {
        "os_environ_DATABASE_URL": classify(raw_url),
        "pydantic_settings_url": classify(settings_url),
        "connected_to_postgres": "postgres" in settings_url or "supabase" in settings_url,
    }


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
