# Online (Web) product

Backend (FastAPI) + frontend (React/Vite). Run backend from here; build and serve the web app.

**Run backend:** From this folder, set `PYTHONPATH` to include this directory and run:
```bash
cd backend && python -m uvicorn backend.main:app --reload
```
Then build the frontend: `cd web && npm install && npm run build`. Open http://localhost:8000

**Contains:** `backend/`, `web/`, `core/`, `solver/`, `models/`, `utils/`, Dockerfile, docker-compose.yml, render.yaml, docs/
