"""SQLite schema definition for the timetable project database.

This schema is also used by backend/services/export_adapter.py to materialise
a temp SQLite from Postgres data, which is why the indexes and constraints
must match the Postgres-side `__table_args__` defined in backend/models/.

Phase-3 additions:
  - UNIQUE indexes on the join tables (teacher_subject, lesson_allowed_room,
    time_constraint).
  - Performance indexes on the hot lookup paths
    (lesson.{teacher,class}_id, timetable_entry.lesson_id,
     time_constraint.entity_type/entity_id).
  - Denormalised `teacher_id` and `class_id` on timetable_entry, plus three
    partial UNIQUE indexes guarding "one entry per (day, period) per
    {teacher, class, room}". Triggers fill the denormalised columns from the
    parent lesson on INSERT / UPDATE so existing writers don't have to.
"""

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
    teacher_id INTEGER,
    class_id INTEGER,
    FOREIGN KEY (lesson_id) REFERENCES lesson(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES teacher(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES school_class(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

-- ----------------------------------------------------------------------------
-- Phase 3: integrity + performance indexes.
-- ----------------------------------------------------------------------------

-- UNIQUE indexes on the join tables (one membership row per pair).
CREATE UNIQUE INDEX IF NOT EXISTS ux_teacher_subject
    ON teacher_subject(teacher_id, subject_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lesson_allowed_room
    ON lesson_allowed_room(lesson_id, room_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_time_constraint
    ON time_constraint(entity_type, entity_id, day_index, period_index);

-- Slot-uniqueness on timetable_entry, partial on the resource being NOT NULL.
-- Catches start-slot collisions per resource. Multi-period overlaps on
-- trailing periods are still defended by the solver (NoOverlap intervals)
-- and the move validator (validate_move in backend/services/move_validator.py).
CREATE UNIQUE INDEX IF NOT EXISTS ux_te_teacher
    ON timetable_entry(day_index, period_index, teacher_id)
    WHERE teacher_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_te_class
    ON timetable_entry(day_index, period_index, class_id)
    WHERE class_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_te_room
    ON timetable_entry(day_index, period_index, room_id)
    WHERE room_id IS NOT NULL;

-- Hot-path lookup indexes.
CREATE INDEX IF NOT EXISTS ix_lesson_class ON lesson(class_id);
CREATE INDEX IF NOT EXISTS ix_lesson_teacher ON lesson(teacher_id);
CREATE INDEX IF NOT EXISTS ix_te_lesson ON timetable_entry(lesson_id);
CREATE INDEX IF NOT EXISTS ix_te_room ON timetable_entry(room_id);
CREATE INDEX IF NOT EXISTS ix_tc_entity
    ON time_constraint(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Triggers: keep timetable_entry.teacher_id and .class_id in sync with
-- the parent lesson, so existing writers (which only set lesson_id) don't
-- need to know about the denormalised columns. The UNIQUE indexes above
-- depend on these columns being populated.
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS timetable_entry_fill_denorm_insert
AFTER INSERT ON timetable_entry
WHEN NEW.teacher_id IS NULL OR NEW.class_id IS NULL
BEGIN
    UPDATE timetable_entry
       SET teacher_id = COALESCE(NEW.teacher_id,
                                 (SELECT teacher_id FROM lesson WHERE lesson.id = NEW.lesson_id)),
           class_id   = COALESCE(NEW.class_id,
                                 (SELECT class_id   FROM lesson WHERE lesson.id = NEW.lesson_id))
     WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS timetable_entry_fill_denorm_update
AFTER UPDATE OF lesson_id ON timetable_entry
BEGIN
    UPDATE timetable_entry
       SET teacher_id = (SELECT teacher_id FROM lesson WHERE lesson.id = NEW.lesson_id),
           class_id   = (SELECT class_id   FROM lesson WHERE lesson.id = NEW.lesson_id)
     WHERE id = NEW.id;
END;
"""
