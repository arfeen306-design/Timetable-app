# Myzynca — School Timetable SaaS

Web-only timetable generator for schools. FastAPI backend with a CP-SAT
constraint solver, React + Vite frontend, PostgreSQL in production.

## Architecture

| Layer | Path | Notes |
|-------|------|-------|
| Frontend | `web/` | React + Vite + TypeScript SPA |
| API / orchestration | `backend/` | FastAPI · SQLAlchemy 2.0 · JWT auth |
| CP-SAT solver | `solver/engine.py` | Google OR-Tools; `IntervalVar` + `AddNoOverlap` for clash-free multi-period scheduling |
| Domain types | `models/domain.py` | Pure dataclasses, no ORM |
| Shared validation | `core/` | Provider-agnostic pre-generation checks |
| Postgres adapter | `backend/core/postgres_data_provider.py` | Adapts SQLAlchemy rows to the solver's `TimetableDataProvider` interface |

There is **no desktop product** in this repository. SQLite remains only as a
schema reference for the regression test suite under `tests/`.

## Running locally

```bash
# Backend (port 3987 by default)
./run_backend.sh

# Frontend (port 5173 via Vite)
./run_web.sh
```

Set `DATABASE_URL` to your Postgres connection string. For local development
you can fall back to `sqlite:///./timetable.db`, but production is Postgres.

## Tests

```bash
PYTHONPATH=. python -m pytest tests/ backend/tests/ -v
# 45 tests covering: solver multi-period correctness, manual-move validator,
# schema integrity (UNIQUE constraints + triggers), validators, models.
```

## Notable production-relevant properties

- **Diskless exports.** Excel / PDF / CSV downloads stream from in-memory
  `io.BytesIO` via FastAPI `StreamingResponse`. The backend never writes
  export artefacts to disk and does not require write permission outside the
  database. Export engine: `backend/services/export_engine.py`. Endpoints:
  `backend/api/exports.py`.
- **Path-traversal-safe SPA routing.** The `serve_spa` fallback in
  `backend/main.py` resolves the candidate path with `os.path.realpath` and
  enforces containment under the static root before serving any file.
  Anything resolving outside the root is silently routed to `index.html`.
- **Clash-free multi-period scheduling.** The CP-SAT model uses interval
  variables and `AddNoOverlap` per teacher / per class / per room, so
  duration-2 (or longer) lessons cannot overlap with other lessons on
  trailing periods.
- **Hard manual-move validation.** `/move-entry` and `/valid-slots` reuse a
  shared `validate_move()` service that mirrors the solver's hard-constraint
  set: bounds, teacher/class/room unavailability, multi-period overlap on
  both sides, subject `max_per_day`, teacher `max_periods_day`, and
  non-overridable `locked_target`. The validator is `O(1)` queries — no
  N+1 — and the same path drives the green/red drag-and-drop grid in the UI.
- **Database integrity at the schema layer.** UNIQUE constraints on every
  join table (teacher_subject, lesson_allowed_room, time_constraint) and
  partial UNIQUE indexes on `timetable_entry` for `(slot, teacher)`,
  `(slot, class)`, `(slot, room)`. SQLite uses triggers to keep the
  denormalised columns in sync; Postgres has an idempotent migration script
  at `backend/scripts/migrate_dedupe_indexes.py`.

## Deployment

Vercel-compatible:

- `Dockerfile`, `docker-compose.yml` — container build for any Docker host.
- `railway.toml`, `render.yaml` — managed-platform configs.

After deploying the new model definitions to a fresh environment, run the
Postgres migration once:

```bash
PYTHONPATH=. python -m backend.scripts.migrate_dedupe_indexes
```

It is idempotent — re-running on an already-migrated database is a no-op.

## Audit history

A full security and correctness audit was performed and remediated across
four phases. See [`myzynca_audit_report.md`](./myzynca_audit_report.md) for
the per-defect resolution log and the final test status (45/45 passing).
