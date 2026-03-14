# Architecture Notes

## Layer Separation

- **Models**: Pure dataclasses, no database or UI dependencies
- **Repositories**: SQLite access only, return domain models
- **Services**: Orchestrate repositories, contain business logic
- **Solver**: Standalone constraint solving, reads from DB, returns entries
- **UI**: PySide6 widgets, calls services only
- **Exports**: Read from repositories, format output files

## Database

- SQLite with WAL mode for performance
- Foreign keys enforced
- Schema auto-created on new project
- Project files are .ttb (renamed SQLite databases)

## Solver Architecture

- Uses CP-SAT from Google OR-Tools
- Each lesson occurrence is a separate scheduling unit
- Variables: day, period, room per occurrence
- Hard constraints modeled as CP-SAT constraints
- Soft constraints modeled as objective penalties
- Locked entries are fixed as constants

## Migration Readiness

- All SQL is in repositories (swap for ORM/API later)
- Services have no UI dependencies
- Models are framework-agnostic dataclasses
- Solver is independent module
- Export logic is decoupled from UI
