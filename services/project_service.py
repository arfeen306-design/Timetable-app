"""Service for project-level operations (save, open, new) and recent projects."""
from __future__ import annotations
import shutil
from pathlib import Path
from typing import Optional

from PySide6.QtCore import QSettings

from database.connection import DatabaseConnection


RECENT_MAX = 10
SETTINGS_ORG = "TimetableApp"
SETTINGS_APP = "TimetableGenerator"
RECENT_KEY = "recentProjectPaths"


class ProjectService:
    """Manages project files (.ttb files are SQLite databases) and recent list."""

    FILE_EXTENSION = ".ttb"

    def __init__(self) -> None:
        self.db: Optional[DatabaseConnection] = None
        self.current_path: Optional[str] = None

    @property
    def is_open(self) -> bool:
        return self.db is not None

    def _settings(self) -> QSettings:
        return QSettings(SETTINGS_ORG, SETTINGS_APP)

    def add_recent(self, path: str) -> None:
        """Add path to recent list (at front), persist."""
        if not path or path == ":memory:":
            return
        path = str(Path(path).resolve())
        raw = self._settings().value(RECENT_KEY, [])
        if isinstance(raw, str):
            paths = [p.strip() for p in raw.split("\n") if p.strip()]
        else:
            paths = list(raw) if raw else []
        if path in paths:
            paths.remove(path)
        paths.insert(0, path)
        paths = paths[:RECENT_MAX]
        self._settings().setValue(RECENT_KEY, paths)
        self._settings().sync()

    def get_recent_list(self) -> list[str]:
        """Return recent paths that still exist (most recent first)."""
        raw = self._settings().value(RECENT_KEY, [])
        if isinstance(raw, str):
            paths = [p.strip() for p in raw.split("\n") if p.strip()]
        else:
            paths = list(raw) if raw else []
        existing = [p for p in paths if Path(p).exists()]
        return existing[:RECENT_MAX]

    def new_project(self, path: str) -> DatabaseConnection:
        if not path.endswith(self.FILE_EXTENSION):
            path += self.FILE_EXTENSION
        self.close()
        self.db = DatabaseConnection.create_new(path)
        self.current_path = path
        self.add_recent(path)
        return self.db

    def open_project(self, path: str) -> DatabaseConnection:
        self.close()
        self.db = DatabaseConnection.open_existing(path)
        self.current_path = path
        self.add_recent(path)
        return self.db

    def save_as(self, new_path: str) -> None:
        if not self.db or not self.current_path:
            raise RuntimeError("No project is open.")
        if not new_path.endswith(self.FILE_EXTENSION):
            new_path += self.FILE_EXTENSION
        self.db.close()
        shutil.copy2(self.current_path, new_path)
        self.db = DatabaseConnection.open_existing(new_path)
        self.current_path = new_path
        self.add_recent(new_path)

    def close(self) -> None:
        if self.db:
            self.db.close()
            self.db = None
            self.current_path = None

    def new_temp_project(self) -> DatabaseConnection:
        """Create an in-memory project for quick use."""
        self.close()
        self.db = DatabaseConnection(":memory:")
        self.db.open()
        self.db.initialize_schema()
        self.db.commit()
        self.current_path = None
        return self.db
