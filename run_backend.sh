#!/usr/bin/env bash
# Run the FastAPI backend from project root. Use the venv in backend/venv.
set -e
cd "$(dirname "$0")"
exec ./backend/venv/bin/python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
