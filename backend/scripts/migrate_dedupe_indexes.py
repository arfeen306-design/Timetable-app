"""One-shot Postgres migration for the Phase-3 integrity hardening.

This script is the Postgres equivalent of the SQLite migration in
database/connection.py:_ensure_phase3_integrity. Run it manually once per
environment after deploying the new model definitions:

    PYTHONPATH=. python -m backend.scripts.migrate_dedupe_indexes

It is idempotent: re-running it on an already-migrated database is a no-op
because every step uses IF NOT EXISTS / ON CONFLICT semantics.

Steps (order matters — UNIQUE constraint creation fails on existing dupes):
  1. Add denormalised teacher_id / class_id columns to timetable_entries
     and backfill them from the parent lessons row.
  2. Dedupe rows in teacher_subjects, lesson_allowed_rooms, time_constraints,
     and per-(slot, resource) on timetable_entries.
  3. Run Base.metadata.create_all() to lay down any new tables, then issue
     CREATE UNIQUE INDEX / CREATE INDEX statements for the new constraints
     (SQLAlchemy create_all does not retro-add constraints to existing tables).
"""
from __future__ import annotations
import sys

from sqlalchemy import text

from backend.models.base import Base, engine, SessionLocal


# CREATE statements are written explicitly so they apply even when the parent
# table already exists. Using IF NOT EXISTS / IF EXISTS keeps each step
# safe to re-run.
DDL_STATEMENTS = [
    # 1. Denormalised columns on timetable_entries.
    "ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS teacher_id INTEGER",
    "ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS class_id INTEGER",
    # Backfill from the parent lesson.
    """UPDATE timetable_entries te
          SET teacher_id = l.teacher_id,
              class_id   = l.class_id
         FROM lessons l
        WHERE te.lesson_id = l.id
          AND (te.teacher_id IS NULL OR te.class_id IS NULL)""",
    # FK constraints on the denormalised columns. Wrap in DO blocks so they
    # don't error on re-run.
    """DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_te_teacher') THEN
            ALTER TABLE timetable_entries
                ADD CONSTRAINT fk_te_teacher FOREIGN KEY (teacher_id)
                REFERENCES teachers(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_te_class') THEN
            ALTER TABLE timetable_entries
                ADD CONSTRAINT fk_te_class FOREIGN KEY (class_id)
                REFERENCES school_classes(id) ON DELETE CASCADE;
        END IF;
    END$$""",

    # 2. Dedupe before unique constraints.
    """DELETE FROM teacher_subjects
        WHERE id NOT IN (
            SELECT MIN(id) FROM teacher_subjects
             GROUP BY teacher_id, subject_id
        )""",
    """DELETE FROM lesson_allowed_rooms
        WHERE id NOT IN (
            SELECT MIN(id) FROM lesson_allowed_rooms
             GROUP BY lesson_id, room_id
        )""",
    """DELETE FROM time_constraints
        WHERE id NOT IN (
            SELECT MIN(id) FROM time_constraints
             GROUP BY project_id, entity_type, entity_id, day_index, period_index
        )""",
    # Slot-uniqueness dedupe — keep the lowest-id row per resource per slot.
    """DELETE FROM timetable_entries te
        USING timetable_entries other
       WHERE te.id > other.id
         AND te.project_id = other.project_id
         AND te.run_id IS NOT DISTINCT FROM other.run_id
         AND te.day_index = other.day_index
         AND te.period_index = other.period_index
         AND te.teacher_id IS NOT NULL
         AND other.teacher_id IS NOT NULL
         AND te.teacher_id = other.teacher_id""",
    """DELETE FROM timetable_entries te
        USING timetable_entries other
       WHERE te.id > other.id
         AND te.project_id = other.project_id
         AND te.run_id IS NOT DISTINCT FROM other.run_id
         AND te.day_index = other.day_index
         AND te.period_index = other.period_index
         AND te.class_id IS NOT NULL
         AND other.class_id IS NOT NULL
         AND te.class_id = other.class_id""",
    """DELETE FROM timetable_entries te
        USING timetable_entries other
       WHERE te.id > other.id
         AND te.project_id = other.project_id
         AND te.run_id IS NOT DISTINCT FROM other.run_id
         AND te.day_index = other.day_index
         AND te.period_index = other.period_index
         AND te.room_id IS NOT NULL
         AND other.room_id IS NOT NULL
         AND te.room_id = other.room_id""",

    # 3. UNIQUE indexes (Postgres treats UNIQUE INDEX and UNIQUE CONSTRAINT
    # interchangeably for enforcement; UNIQUE INDEX supports IF NOT EXISTS).
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_teacher_subjects
        ON teacher_subjects(teacher_id, subject_id)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_lesson_allowed_rooms
        ON lesson_allowed_rooms(lesson_id, room_id)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_time_constraints
        ON time_constraints(project_id, entity_type, entity_id, day_index, period_index)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_timetable_entries_teacher_slot
        ON timetable_entries(project_id, run_id, day_index, period_index, teacher_id)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_timetable_entries_class_slot
        ON timetable_entries(project_id, run_id, day_index, period_index, class_id)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_timetable_entries_room_slot
        ON timetable_entries(project_id, run_id, day_index, period_index, room_id)""",
    # Hot-path lookups.
    "CREATE INDEX IF NOT EXISTS ix_time_constraints_entity ON time_constraints(entity_type, entity_id)",
    "CREATE INDEX IF NOT EXISTS ix_teacher_subjects_teacher ON teacher_subjects(teacher_id)",
    "CREATE INDEX IF NOT EXISTS ix_teacher_subjects_subject ON teacher_subjects(subject_id)",
    "CREATE INDEX IF NOT EXISTS ix_timetable_entries_lesson ON timetable_entries(lesson_id)",
    "CREATE INDEX IF NOT EXISTS ix_timetable_entries_room ON timetable_entries(room_id)",
]


def run() -> int:
    print("Running Phase-3 Postgres migration...")
    # Make sure all model-defined tables exist.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        for sql in DDL_STATEMENTS:
            label = sql.strip().split("\n", 1)[0][:80]
            print(f"  > {label}")
            db.execute(text(sql))
        db.commit()
        print("Migration complete.")
        return 0
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(run())
