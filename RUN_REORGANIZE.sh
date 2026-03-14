#!/bin/bash
# Run this script from Terminal inside "Timetable app" folder:
#   cd "/Users/admin/Desktop/Timetable app"
#   chmod +x RUN_REORGANIZE.sh
#   ./RUN_REORGANIZE.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Creating online/ and desktop/..."

mkdir -p online desktop

# --- Copy WEB (online) product into online/ ---
for name in backend web core solver models utils; do
  [ -e "$name" ] && cp -R "$name" "online/$name" && echo "  copied $name -> online/"
done
for name in Dockerfile docker-compose.yml render.yaml test_webhook.py .env.production.example requirements-server.txt; do
  [ -e "$name" ] && cp "$name" "online/$name" && echo "  copied $name -> online/"
done
[ -d docs ] && cp -R docs online/ && echo "  copied docs -> online/"

# --- Copy DESKTOP product into desktop/ ---
[ -f main.py ] && cp main.py desktop/ && echo "  copied main.py -> desktop/"
for name in app ui database repositories services core solver models utils imports exports packaging tests sample_data; do
  [ -e "$name" ] && cp -R "$name" "desktop/$name" && echo "  copied $name -> desktop/"
done
for name in requirements.txt requirements-packaging.txt SchoolTimetable.spec; do
  [ -e "$name" ] && cp "$name" "desktop/$name" && echo "  copied $name -> desktop/"
done
[ -f AUDIT.md ] && cp AUDIT.md desktop/ && echo "  copied AUDIT.md -> desktop/"
[ -f STRUCTURE.md ] && cp STRUCTURE.md desktop/ && echo "  copied STRUCTURE.md -> desktop/"

# --- Remove originals from root (keep .git, .gitignore, online, desktop, this script) ---
echo "Removing original files from root..."
for item in backend web core solver models utils app ui database repositories services imports exports packaging tests sample_data main.py Dockerfile docker-compose.yml render.yaml test_webhook.py .env.production.example requirements-server.txt requirements.txt requirements-packaging.txt SchoolTimetable.spec docs AUDIT.md STRUCTURE.md reorganize.py; do
  if [ "$item" = "online" ] || [ "$item" = "desktop" ]; then
    continue
  fi
  if [ -e "$item" ]; then
    rm -rf "$item" && echo "  removed $item"
  fi
done

echo "Done. You now have: online/ (web) and desktop/ (desktop app)."
echo "  Web:     cd online && (cd backend && python -m uvicorn backend.main:app)"
echo "  Desktop: cd desktop && python main.py"
