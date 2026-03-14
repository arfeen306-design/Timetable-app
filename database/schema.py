"""SQLite schema definition for the timetable project database."""

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS school (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    days_per_week INTEGER NOT NULL DEFAULT 5,
    periods_per_day INTEGER NOT NULL DEFAULT 7,
    weekend_days TEXT NOT NULL DEFAULT '5,6',
    bell_schedule_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#4A90D9',
    category TEXT NOT NULL DEFAULT 'Core',
    max_per_day INTEGER NOT NULL DEFAULT 2,
    double_allowed INTEGER NOT NULL DEFAULT 0,
    preferred_room_type TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS school_class (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT '',
    stream TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#50C878',
    class_teacher_id INTEGER,
    home_room_id INTEGER,
    strength INTEGER NOT NULL DEFAULT 30,
    FOREIGN KEY (class_teacher_id) REFERENCES teacher(id) ON DELETE SET NULL,
    FOREIGN KEY (home_room_id) REFERENCES room(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS class_group_division (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES school_class(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS class_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    division_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (division_id) REFERENCES class_group_division(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teacher (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    code TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT 'Mr.',
    color TEXT NOT NULL DEFAULT '#E8725A',
    max_periods_day INTEGER NOT NULL DEFAULT 6,
    max_periods_week INTEGER NOT NULL DEFAULT 30,
    email TEXT NOT NULL DEFAULT '',
    whatsapp_number TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS teacher_subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teacher(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subject(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    room_type TEXT NOT NULL DEFAULT 'Classroom',
    capacity INTEGER NOT NULL DEFAULT 40,
    color TEXT NOT NULL DEFAULT '#9B59B6',
    home_class_id INTEGER,
    FOREIGN KEY (home_class_id) REFERENCES school_class(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lesson (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    group_id INTEGER,
    periods_per_week INTEGER NOT NULL DEFAULT 1,
    duration INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 5,
    locked INTEGER NOT NULL DEFAULT 0,
    preferred_room_id INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (teacher_id) REFERENCES teacher(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subject(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES school_class(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES class_group(id) ON DELETE SET NULL,
    FOREIGN KEY (preferred_room_id) REFERENCES room(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lesson_allowed_room (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    FOREIGN KEY (lesson_id) REFERENCES lesson(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS time_constraint (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    day_index INTEGER NOT NULL,
    period_index INTEGER NOT NULL,
    constraint_type TEXT NOT NULL DEFAULT 'unavailable',
    weight INTEGER NOT NULL DEFAULT 10,
    is_hard INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS timetable_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    day_index INTEGER NOT NULL,
    period_index INTEGER NOT NULL,
    room_id INTEGER,
    locked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (lesson_id) REFERENCES lesson(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);
"""
