# Backend Architecture — Phase 1

This document describes the FastAPI backend structure, auth model, school/project ownership, and database design for Phase 1. It does not cover full CRUD, billing, or production deployment.

---

## 1. Backend structure

```
backend/
  main.py              # FastAPI app, CORS, router, health
  config.py            # Settings (env): database_url, secret_key, debug, etc.
  api/
    router.py          # Aggregates all route modules
    auth.py            # Login, me, logout
    projects.py        # List/create/get projects (school-scoped)
    schools.py         # (Optional) School profile
    subjects.py        # Skeletons + one real endpoint
    classes.py         # Skeleton
    teachers.py        # Skeleton
    rooms.py           # Skeleton
    lessons.py         # Skeleton
    constraints.py     # Skeleton
    generation.py      # Skeleton
    review.py          # Skeleton
    exports.py         # Skeleton
  auth/
    jwt.py             # create_access_token, verify_token
    password.py        # get_password_hash, verify_password
    deps.py            # get_current_user_optional, get_current_user
  models/
    base.py            # SQLAlchemy Base, engine, SessionLocal, get_db
    user.py            # User model
    school.py          # School, SchoolMembership
    project.py         # Project (and optionally SchoolSettings)
  schemas/             # Pydantic request/response (auth, project, subject, etc.)
  services/            # Business logic; one service for core engine integration
  repositories/        # Data access (project, subject, etc.)
  db/                  # Optional: migration scripts or Alembic
  core/                # Wrapper or integration point for timetable core engine
  utils/
  tests/               # Backend tests
```

---

## 2. Auth model

- **Users** are stored in PostgreSQL (`users` table): id, email, password_hash, name, role (platform_admin | school_admin), is_active, timestamps.
- **Login:** Client sends email + password; backend verifies password and returns a JWT containing at least sub (email), and optionally id, email, name, role, school_id.
- **Current user:** Protected routes use dependency `get_current_user`, which decodes the Bearer token and returns a dict (id, email, name, role, school_id). If the user has no school (e.g. platform admin), school_id may be null; project endpoints then require an explicit school or use admin override.
- **School linking:** For Phase 1, each school_admin user is linked to exactly one school via `school_memberships`. So `school_id` in the token is the user’s school. Platform admins can have no membership or special handling in a later phase.
- **Password:** Stored as bcrypt hash; no plaintext. Registration can be admin-only or a simple register endpoint; Phase 1 focuses on login + me + school-scoped projects.

---

## 3. School and project ownership

- **Schools** are top-level tenants. Every school-owned record has `school_id`.
- **Projects** belong to a school: `projects.school_id` → `schools.id`. Multiple projects per school; each project has name, academic_year, archived, last_generated_at, timestamps.
- **Project-scoped data** (school_settings, subjects, classes, teachers, rooms, lessons, constraints, timetable_entries, etc.) have `project_id` and belong to one project.
- **Access rule:** A user may only access projects for which `project.school_id` equals the user’s `school_id` (from membership). So:
  - List projects: filter by `school_id = current_user["school_id"]`.
  - Get project by id: load project, then check `project.school_id == current_user["school_id"]`; if not, return 404.
  - Create project: set `school_id = current_user["school_id"]`.
  - All subject/class/teacher/room/lesson/constraint/generation/review/export endpoints are under `/api/projects/{project_id}/...` and must first resolve the project and verify it belongs to the user’s school.

---

## 4. Database design summary (Phase 1)

- **users** — id, email, password_hash, name, role, is_active, created_at, updated_at.
- **schools** — id, name, slug, settings_json, created_at, updated_at.
- **school_memberships** — id, school_id, user_id, role, created_at; UNIQUE(school_id, user_id).
- **projects** — id, school_id, name, academic_year, archived, last_generated_at, created_at, updated_at.
- **school_settings** — id, project_id (unique), name, academic_year, days_per_week, periods_per_day, weekend_days, bell_schedule_json, timestamps.
- **subjects** — id, project_id, name, code, color, category, max_per_day, double_allowed, preferred_room_type, timestamps.
- Further tables (school_classes, teachers, rooms, lessons, time_constraints, timetable_runs, timetable_entries, exports, subscription_plans, subscriptions) as in `docs/POSTGRES_SCHEMA.md`; Phase 1 may implement only users, schools, school_memberships, projects, and optionally school_settings and subjects for the first real endpoint.

---

## 5. Config

- **database_url** — PostgreSQL connection string (e.g. from env).
- **secret_key** — For JWT signing; must be set in production.
- **debug** — Enable docs and verbose errors.
- **allowed_origins** — CORS list for frontend (e.g. http://localhost:3000).

---

## 6. Next implementation phase (Phase 2)

- Full CRUD for school_settings, subjects, classes, teachers, rooms, lessons, constraints.
- Generation endpoint: load project into provider, call solver, persist timetable_entries and timetable_runs.
- Review endpoints: return class/teacher/room/master timetable and workload from DB.
- Export endpoints: generate Excel/PDF/CSV on server, store in school-scoped storage, return download link or stream.
- Optional: multiple users per school, roles (admin vs member), subscription checks before create/generate/export.
