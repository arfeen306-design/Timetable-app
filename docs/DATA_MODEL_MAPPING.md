# Data Model Mapping — Desktop to Web

This document describes how the current desktop SQLite schema maps to the PostgreSQL web schema. It is used for migration scripts and for implementing the backend’s PostgresDataProvider.

---

## 1. Desktop schema (single project per file)

Each `.ttb` file is a SQLite database with one logical “project.” There is no concept of school or user; the file itself is the unit of ownership.

| Desktop table | Purpose |
|---------------|--------|
| school | Single row: name, academic_year, days_per_week, periods_per_day, weekend_days, bell_schedule_json |
| subject | name, code, color, category, max_per_day, double_allowed, preferred_room_type |
| school_class | grade, section, stream, name, code, color, class_teacher_id, home_room_id, strength |
| class_group_division | class_id, name |
| class_group | division_id, name, code |
| teacher | first_name, last_name, code, title, color, max_periods_day, max_periods_week, email, whatsapp_number |
| teacher_subject | teacher_id, subject_id |
| room | name, code, room_type, capacity, color, home_class_id |
| lesson | teacher_id, subject_id, class_id, group_id, periods_per_week, duration, priority, locked, preferred_room_id, notes |
| lesson_allowed_room | lesson_id, room_id |
| time_constraint | entity_type, entity_id, day_index, period_index, constraint_type, weight, is_hard |
| timetable_entry | lesson_id, day_index, period_index, room_id, locked |
| project_settings | key-value (optional) |

---

## 2. Web schema (multi-tenant)

- **Tenant:** `schools` (id, name, slug, settings_json).
- **Membership:** `school_memberships` links `users` to `schools`.
- **Project:** `projects` (id, school_id, name, academic_year, archived, last_generated_at). Each project has its own copy of “school settings” and all entity data.

---

## 3. Table mapping

| Desktop | Web | Notes |
|---------|-----|--------|
| school (1 row) | school_settings (1 row per project) + projects.name, projects.academic_year | Web: project has project_id; school_settings.project_id = project.id. |
| subject | subjects | subjects.project_id = project.id. |
| school_class | school_classes | school_classes.project_id = project.id. class_teacher_id, home_room_id reference project-scoped teachers/rooms. |
| class_group_division | class_group_divisions | class_group_divisions.project_id, class_id → school_classes. |
| class_group | class_groups | division_id → class_group_divisions. |
| teacher | teachers | teachers.project_id = project.id. |
| teacher_subject | teacher_subjects | teacher_id → teachers, subject_id → subjects (same project). |
| room | rooms | rooms.project_id = project.id. home_class_id → school_classes. |
| lesson | lessons | lessons.project_id, teacher_id, subject_id, class_id, group_id, preferred_room_id → project-scoped tables. |
| lesson_allowed_room | lesson_allowed_rooms | lesson_id, room_id → lessons, rooms. |
| time_constraint | time_constraints | time_constraints.project_id, entity_type, entity_id. |
| timetable_entry | timetable_entries | timetable_entries.project_id, run_id (optional), lesson_id, day_index, period_index, room_id, locked. |
| (none) | timetable_runs | Web-only: one row per generation run; timetable_entries can reference run_id. |
| (none) | exports | Web-only: stored export files per project/school. |

---

## 4. Column name and type mapping

- **Desktop** uses SQLite types (INTEGER, TEXT). **Web** uses PostgreSQL (BIGINT, VARCHAR, TEXT, JSONB, BOOLEAN, TIMESTAMPTZ).
- **double_allowed:** Desktop INTEGER 0/1 → Web BOOLEAN.
- **locked:** Desktop INTEGER 0/1 → Web BOOLEAN.
- **is_hard:** Desktop INTEGER 0/1 → Web BOOLEAN.
- **bell_schedule_json:** Desktop TEXT (JSON string) → Web TEXT or JSONB; school_settings.bell_schedule_json.
- **New in web:** id as BIGSERIAL; created_at, updated_at on all tables; project_id (and school_id where applicable) on every project-scoped table.

---

## 5. Building a PostgresDataProvider from the web DB

To call the core engine (solver, validators) from the backend:

1. Load one project by `project_id`, ensuring `project.school_id` matches the current user’s school.
2. Query school_settings for that project_id (one row). Map to a dict with keys: id, name, academic_year, days_per_week, periods_per_day, weekend_days, bell_schedule_json (same as desktop “school” row).
3. Query subjects, school_classes, teachers, rooms, lessons, lesson_allowed_rooms, time_constraints, timetable_entries (WHERE project_id = :id). Map each row to a dict with the **same key names** as the desktop schema (e.g. days_per_week, periods_per_day, teacher_id, subject_id).
4. For timetable_entries, include only rows that are part of the “current” run or the latest run; filter locked if needed. For validation/solve, locked_entries = entries WHERE locked = true.
5. Implement `TimetableDataProvider` with these dicts (or on-the-fly queries returning dicts). Pass this provider to `validate_for_generation(provider)` and `TimetableSolver(provider).solve()`.
6. After solve, map returned TimetableEntry objects to rows for timetable_entries (and optionally create a new timetable_runs row); persist with the same project_id.

This mapping keeps the core engine unchanged; only the data source (SQLite file vs PostgreSQL project) changes.
