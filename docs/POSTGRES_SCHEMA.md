# PostgreSQL Schema — Timetable SaaS

This document defines the web version schema. All school-owned data is scoped by `school_id`; all project-owned data by `project_id`. The backend must always filter by the authenticated user's school and by the requested project belonging to that school.

## Conventions

- Primary keys: `id SERIAL PRIMARY KEY` or `id BIGSERIAL PRIMARY KEY`.
- Timestamps: `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.
- Soft delete: optional `deleted_at TIMESTAMPTZ` where needed.
- All FKs use `ON DELETE CASCADE` or `ON DELETE RESTRICT` as noted.

---

## 1. Auth and tenants

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'school_admin',  -- platform_admin | school_admin
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schools (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT '',
    slug VARCHAR(100) NOT NULL UNIQUE,
    settings_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_memberships (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',  -- admin | member
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(school_id, user_id)
);

CREATE INDEX idx_school_memberships_user ON school_memberships(user_id);
CREATE INDEX idx_school_memberships_school ON school_memberships(school_id);
```

---

## 2. Subscriptions

```sql
CREATE TABLE subscription_plans (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    limits_json JSONB NOT NULL DEFAULT '{}',  -- max_projects, max_classes, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'trial',  -- trial | active | past_due | cancelled
    trial_ends_at TIMESTAMPTZ,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_school ON subscriptions(school_id);
```

---

## 3. Projects and project-scoped data

```sql
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    academic_year VARCHAR(50) NOT NULL DEFAULT '',
    archived BOOLEAN NOT NULL DEFAULT false,
    last_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_school ON projects(school_id);

-- One row per project: school-level settings for that project
CREATE TABLE school_settings (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    academic_year VARCHAR(50) NOT NULL DEFAULT '',
    days_per_week INTEGER NOT NULL DEFAULT 5,
    periods_per_day INTEGER NOT NULL DEFAULT 7,
    weekend_days VARCHAR(50) NOT NULL DEFAULT '5,6',
    bell_schedule_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subjects (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL DEFAULT '',
    color VARCHAR(20) NOT NULL DEFAULT '#4A90D9',
    category VARCHAR(50) NOT NULL DEFAULT 'Core',
    max_per_day INTEGER NOT NULL DEFAULT 2,
    double_allowed BOOLEAN NOT NULL DEFAULT false,
    preferred_room_type VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_classes (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    grade VARCHAR(50) NOT NULL,
    section VARCHAR(50) NOT NULL DEFAULT '',
    stream VARCHAR(50) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL DEFAULT '',
    color VARCHAR(20) NOT NULL DEFAULT '#50C878',
    class_teacher_id BIGINT,
    home_room_id BIGINT,
    strength INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE class_group_divisions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    class_id BIGINT NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE class_groups (
    id BIGSERIAL PRIMARY KEY,
    division_id BIGINT NOT NULL REFERENCES class_group_divisions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teachers (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL DEFAULT '',
    code VARCHAR(50) NOT NULL DEFAULT '',
    title VARCHAR(20) NOT NULL DEFAULT 'Mr.',
    color VARCHAR(20) NOT NULL DEFAULT '#E8725A',
    max_periods_day INTEGER NOT NULL DEFAULT 6,
    max_periods_week INTEGER NOT NULL DEFAULT 30,
    email VARCHAR(255) NOT NULL DEFAULT '',
    whatsapp_number VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add self-referential FKs after tables exist
ALTER TABLE school_classes ADD CONSTRAINT fk_class_teacher
    FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

CREATE TABLE teacher_subjects (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL DEFAULT '',
    room_type VARCHAR(50) NOT NULL DEFAULT 'Classroom',
    capacity INTEGER NOT NULL DEFAULT 40,
    color VARCHAR(20) NOT NULL DEFAULT '#9B59B6',
    home_class_id BIGINT REFERENCES school_classes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE school_classes ADD CONSTRAINT fk_home_room
    FOREIGN KEY (home_room_id) REFERENCES rooms(id) ON DELETE SET NULL;

CREATE TABLE lessons (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id BIGINT NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES class_groups(id) ON DELETE SET NULL,
    periods_per_week INTEGER NOT NULL DEFAULT 1,
    duration INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 5,
    locked BOOLEAN NOT NULL DEFAULT false,
    preferred_room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lesson_allowed_rooms (
    id BIGSERIAL PRIMARY KEY,
    lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE time_constraints (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    day_index INTEGER NOT NULL,
    period_index INTEGER NOT NULL,
    constraint_type VARCHAR(50) NOT NULL DEFAULT 'unavailable',
    weight INTEGER NOT NULL DEFAULT 10,
    is_hard BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE timetable_runs (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',  -- running | completed | failed
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    message TEXT,
    entries_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE timetable_entries (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id BIGINT REFERENCES timetable_runs(id) ON DELETE SET NULL,
    lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    day_index INTEGER NOT NULL,
    period_index INTEGER NOT NULL,
    room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL,
    locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exports (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    run_id BIGINT REFERENCES timetable_runs(id) ON DELETE SET NULL,
    format VARCHAR(20) NOT NULL,  -- excel | pdf | csv
    file_path VARCHAR(512) NOT NULL,
    file_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subjects_project ON subjects(project_id);
CREATE INDEX idx_school_classes_project ON school_classes(project_id);
CREATE INDEX idx_teachers_project ON teachers(project_id);
CREATE INDEX idx_rooms_project ON rooms(project_id);
CREATE INDEX idx_lessons_project ON lessons(project_id);
CREATE INDEX idx_time_constraints_project ON time_constraints(project_id);
CREATE INDEX idx_timetable_entries_project ON timetable_entries(project_id);
CREATE INDEX idx_timetable_runs_project ON timetable_runs(project_id);
CREATE INDEX idx_exports_project ON exports(project_id);
```

---

## 4. Circular FKs (school_classes ↔ teachers, rooms)

PostgreSQL allows adding FKs after table creation. Order above:

1. Create `school_classes` without `class_teacher_id`/`home_room_id` FKs, then create `teachers` and `rooms`, then add:
   - `school_classes.class_teacher_id` → `teachers(id)`
   - `school_classes.home_room_id` → `rooms(id)`
   - `rooms.home_class_id` → `school_classes(id)` (optional; can be in initial CREATE)

Alternatively create `school_classes` with nullable `class_teacher_id` and `home_room_id` as plain columns, then add FKs in a second migration after `teachers` and `rooms` exist. The SQL above does this with ALTER TABLE.

---

## 5. Row-level security (optional)

For defence in depth, enable RLS and policies so that:

- `school_memberships` rows are visible only to the user themselves or platform admins.
- `projects`, `school_settings`, `subjects`, etc. are visible only when `project_id` belongs to a project whose `school_id` is in the user's membership.

Example (conceptual):

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_school_member ON projects
    FOR ALL
    USING (
        school_id IN (SELECT school_id FROM school_memberships WHERE user_id = current_setting('app.current_user_id')::BIGINT)
    );
```

Application-level enforcement (always filtering by `school_id` from the JWT/session) is required regardless; RLS adds an extra layer.

---

## 6. Migration from desktop .ttb

A script can:

1. Open a SQLite .ttb file.
2. Read all tables (school → subject → school_class → …).
3. Insert into PostgreSQL with a given `school_id` and a new `project_id` (create project and school_settings first, then subjects, classes, teachers, rooms, lessons, constraints, entries).

The core engine’s `TimetableDataProvider` can be implemented for PostgreSQL by querying these tables with `WHERE project_id = :id`, building dicts with the same keys as the desktop schema (e.g. `days_per_week`, `periods_per_day`), so the solver and exports need no change.
