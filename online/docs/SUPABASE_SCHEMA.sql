-- =====================================================
-- Timetable SaaS Full Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- Schools (tenants)
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT '',
    slug VARCHAR(100) NOT NULL UNIQUE,
    api_key VARCHAR(100) UNIQUE,
    settings_json VARCHAR(2048) NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_schools_slug ON schools(slug);
CREATE INDEX IF NOT EXISTS ix_schools_api_key ON schools(api_key);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'school_admin',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- School memberships (users <-> schools)
CREATE TABLE IF NOT EXISTS school_memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'school_admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects (one school can have multiple timetable projects)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    academic_year VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- School settings (per project)
CREATE TABLE IF NOT EXISTS school_settings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    days_of_week VARCHAR(512) NOT NULL DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
    periods_per_day INTEGER NOT NULL DEFAULT 8,
    period_duration_minutes INTEGER NOT NULL DEFAULT 45,
    start_time VARCHAR(10) NOT NULL DEFAULT '08:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    color VARCHAR(20) NOT NULL DEFAULT '#4A90D9',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- School classes / sections
CREATE TABLE IF NOT EXISTS school_classes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    grade VARCHAR(50) NOT NULL DEFAULT '',
    section VARCHAR(50) NOT NULL DEFAULT '',
    student_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    max_periods_per_week INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teacher <-> subjects link
CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, subject_id)
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    capacity INTEGER NOT NULL DEFAULT 30,
    room_type VARCHAR(50) NOT NULL DEFAULT 'classroom',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lessons (the assignment of teacher+subject to class)
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    periods_per_week INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lesson allowed rooms (many-to-many)
CREATE TABLE IF NOT EXISTS lesson_allowed_rooms (
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    PRIMARY KEY (lesson_id, room_id)
);

-- Time constraints
CREATE TABLE IF NOT EXISTS time_constraints (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    constraint_type VARCHAR(100) NOT NULL DEFAULT '',
    entity_type VARCHAR(50) NOT NULL DEFAULT '',
    entity_id INTEGER NOT NULL DEFAULT 0,
    params_json VARCHAR(2048) NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timetable runs
CREATE TABLE IF NOT EXISTS timetable_runs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    solver_status VARCHAR(100),
    solve_time_seconds FLOAT,
    log_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timetable entries (the generated schedule)
CREATE TABLE IF NOT EXISTS timetable_entries (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES timetable_runs(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL DEFAULT '',
    period_number INTEGER NOT NULL DEFAULT 1,
    room_id INTEGER REFERENCES rooms(id)
);

-- Insert a test school + API key for testing
INSERT INTO schools (name, slug, settings_json, api_key, created_at, updated_at)
VALUES ('Test School', 'test-school', '{}', 'live_test_key_abc123', NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET api_key = 'live_test_key_abc123';
