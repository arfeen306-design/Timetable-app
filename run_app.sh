#!/usr/bin/env bash
# Build frontend and start backend. Open http://localhost:8000 in your browser.
set -e
cd "$(dirname "$0")"

echo "Building frontend..."
(cd web && npm run build)

echo ""
echo "  === Open in your browser: http://localhost:8000 ==="
echo "  Login: admin@school.demo / demo123"
echo ""
exec ./run_backend.sh
