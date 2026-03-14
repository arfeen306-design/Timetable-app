#!/usr/bin/env bash
# Run the frontend dev server (Vite). Proxies /api to backend. Start backend separately with ./run_backend.sh
set -e
cd "$(dirname "$0")/web"
echo ""
echo "  → Open in browser: http://localhost:3987"
echo "  (If 3987 is busy, Vite will show another port in the output below.)"
echo ""
npm run dev
