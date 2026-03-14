#!/usr/bin/env bash
# Run the desktop (offline) School Timetable Generator. Executes from project root.
set -e
cd "$(dirname "$0")/.."
if [ -x "./venv/bin/python" ]; then
  exec ./venv/bin/python main.py
else
  exec python main.py
fi
