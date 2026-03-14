# PostgresDataProvider — Backend Data for the Core Engine

The backend uses **PostgresDataProvider** to feed project data into the reusable core timetable engine (validators and solver) without the engine knowing about FastAPI or SQLAlchemy.

## Role

- **Implements** the same logical interface as the desktop’s `TimetableDataProvider`: `get_school()`, `get_subjects()`, `get_classes()`, `get_teachers()`, `get_rooms()`, `get_lessons()`, `get_constraints()`, `get_locked_entries()`, `get_lesson_allowed_rooms()`.
- **Loads** all data from PostgreSQL, scoped by `project_id`.
- **Returns** plain dicts (and lists of dicts) whose **keys match the desktop SQLite schema** so the core engine can run unchanged.

## Construction

```python
from core.postgres_data_provider import PostgresDataProvider

provider = PostgresDataProvider(db_session, project_id=123)
```

- `db_session`: SQLAlchemy `Session` (e.g. from `get_db()`).
- `project_id`: ID of the project whose data to load.

## Returned Data Shapes

- **get_school()** → `dict | None`  
  Keys: `id`, `name`, `academic_year`, `days_per_week`, `periods_per_day`, `weekend_days`, `bell_schedule_json`.  
  From `SchoolSettings` for the project; `None` if no settings.

- **get_subjects()** → `list[dict]`  
  Keys: `id`, `name`, `code`, `color`, `category`, `max_per_day`, `double_allowed`, `preferred_room_type`.  
  `double_allowed` is normalized to `0`/`1` for core compatibility.

- **get_classes()** → `list[dict]`  
  Keys: `id`, `grade`, `section`, `stream`, `name`, `code`, `color`, `class_teacher_id`, `home_room_id`, `strength`.

- **get_teachers()** → `list[dict]`  
  Keys: `id`, `first_name`, `last_name`, `code`, `title`, `color`, `max_periods_day`, `max_periods_week`, `email`, `whatsapp_number`.

- **get_rooms()** → `list[dict]`  
  Keys: `id`, `name`, `code`, `room_type`, `capacity`, `color`, `home_class_id`.

- **get_lessons()** → `list[dict]`  
  Keys: `id`, `teacher_id`, `subject_id`, `class_id`, `group_id`, `periods_per_week`, `duration`, `priority`, `locked`, `preferred_room_id`, `notes`.  
  `locked` is normalized to `0`/`1`.

- **get_constraints()** → `list[dict]`  
  Keys: `id`, `entity_type`, `entity_id`, `day_index`, `period_index`, `constraint_type`, `weight`, `is_hard`.  
  `is_hard` is normalized to `0`/`1`.

- **get_locked_entries()** → `list[dict]`  
  Keys: `id`, `lesson_id`, `day_index`, `period_index`, `room_id`, `locked`.  
  Only entries with `locked=True` for the project.

- **get_lesson_allowed_rooms()** → `list[dict]`  
  Keys: `id`, `lesson_id`, `room_id`.  
  Only for lessons in this project (joined through `Lesson`).

## Usage in Backend

- **Validation:** Build `PostgresDataProvider(db, project_id)`, pass to `validate_for_generation(provider)` (from `core.validators` when PYTHONPATH includes project root).
- **Generation:** Same provider is passed to `TimetableSolver(provider).solve(...)`; solver returns entries that are then persisted to `timetable_entries` and `timetable_runs`.
- **Export:** Export adapter builds a temp SQLite from the same provider plus latest run entries, then calls desktop export functions with that DB.

## Files

- **Provider:** `backend/core/postgres_data_provider.py`
- **Models:** `backend/models/school_settings.py`, `class_model.py`, `teacher_model.py`, `room_model.py`, `lesson_model.py`, `constraint_model.py`, `timetable_model.py`, and `project.py` (Subject).
