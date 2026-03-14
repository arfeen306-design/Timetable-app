"""Application configuration from environment."""
from __future__ import annotations
import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


def _default_database_url() -> str:
    """On macOS, default PostgreSQL role is often the current user, not 'postgres'."""
    user = os.environ.get("USER", "postgres")
    return f"postgresql://{user}@localhost:5432/timetable_saas"


class Settings(BaseSettings):
    app_name: str = "Timetable SaaS API"
    debug: bool = False  # Set DEBUG=true for local dev; false is secure default

    # Database: set DATABASE_URL in .env to override.
    database_url: str = "sqlite:///./timetable.db"

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # CORS: comma-separated list of allowed origins.
    # e.g. ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com
    # Defaults to localhost for local development.
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3987,http://127.0.0.1:3987"

    # Storage (exports)
    storage_path: str = "./storage"
    storage_url_prefix: str = "/files"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @field_validator("database_url", mode="before")
    @classmethod
    def coerce_sqlite_path(cls, v: str) -> str:
        # Strip whitespace/newlines (common when copy-pasting from Supabase)
        if isinstance(v, str):
            v = v.strip()
        if isinstance(v, str) and v.startswith("sqlite:///./"):
            return v
        if v == "postgresql://postgres:postgres@localhost:5432/timetable_saas":
            return _default_database_url()
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
