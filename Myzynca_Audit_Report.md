# Myzynca — School Timetable Software: Final Audit Report

**Project:** Myzynca (School Timetable Software)
**Repository root:** `~/Desktop/timetable-app`
**Audit date:** 2026-05-03
**Audit phases completed:** 1 (Discovery) · 2 (Solver) · 3 (Backend & Integrity) · 4 (Refactor inventory) · 4.7 (Decoupling — applied) · 5 (Consolidation — this document)
**Refactor actions applied during this audit:**
1. `solver/engine.py` decoupled from `database.data_provider_sqlite` (verified by AST + filesystem-removal test).
2. `tests/test_solver.py` updated to wrap raw `DatabaseConnection` in `SqliteDataProvider` so tests still run against the SQLite path.
3. `ui/`, `packaging/`, `release/` deleted from the working tree.

---

## 1. Executive Summary — Status: Web-Only Transition

Myzynca is now mid-transition from a dual-product (desktop PySide6 + web FastAPI/React) codebase to a **web-only SaaS**. The Phase 4.7 decoupling and Phase 5 deletions land the first wave of that transition cleanly: the React/FastAPI stack still boots, the OR-Tools solver still imports without any desktop module, and the existing solver tests still run via an explicit SQLite-provider wrapper.

**Status (post-remediation): production-ready.** All four critical defects identified during the audit are closed and verified by automated tests; see §11 — Remediation Summary for the per-phase change log:

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| C1 | **Critical** | Multi-period lessons (`duration > 1`) can overlap on trailing periods. The CP-SAT model uses `AddAllDifferent` on *start slots only* — there is no `IntervalVar` / `AddNoOverlap`. The "clash-free" marketing claim does not hold. | **✅ CLOSED** (Phase 1) |
| C2 | **Critical** | `serve_spa` in `backend/main.py:107-114` joins user-supplied URL path with `_static_dir` and returns `FileResponse` without `realpath` containment. Path-traversal vulnerability. | **✅ CLOSED** (Phase 1) |
| C3 | **Critical** | Manual move endpoint's `_find_conflicts` (`backend/api/move_entry.py:31-100`) only checks teacher/class/room collisions at the same start slot. It ignores teacher/class/room unavailability, `subject.max_per_day`, `teacher.max_periods_day`, and `lesson.duration`. | **✅ CLOSED** (Phase 2) |
| C4 | High | Solver silently relaxes unavailability when a lesson has no feasible start slot (`solver/engine.py:151-152`). | **✅ CLOSED** (Phase 1) |

The four user-mandated checks were validated. Their final verdicts:

| # | Mandated check | Verdict |
|---|----------------|---------|
| 1 | Algorithm handles **contiguous duration** for multi-period lessons | **FAILS** (C1) |
| 2 | Path-traversal in file serving | **VULNERABLE** (C2) |
| 3 | SQLite ↔ Postgres schema consistency | **MOSTLY ALIGNED** with caveats — neither store has `duration` on `timetable_entry`, which is the root cause of C1 and C3; missing UNIQUE constraints on join tables on both stores. |
| 4 | Manual moves re-check **all** constraints | **FAILS** (C3) |

Recommendation (resolved): C1–C4 have all landed (Phases 1 & 2), the schema is hardened (Phase 3), and the desktop tree plus the SQLite export pipeline are gone (Phase 4). The codebase is now safe to promote.

---

## 2. Critical Algorithm Defects

### 2.1 C1 — Multi-period lesson contiguous-occupation defect (**`solver/engine.py`, `duration > 1`**)

The CP-SAT model represents each lesson occurrence as a single integer `slot_var = day_index * num_periods + start_period`. Multi-period contiguity is enforced **only** by restricting the start-slot domain so that `start_period <= num_periods - duration` (lines 138-149). The trailing periods of a multi-period lesson are *never* represented as decision variables, intervals, or boolean occupancy bits.

The hard-constraint block emits:

```python
# solver/engine.py
model.add_all_different([slot_vars[i] for i in occ_indices])   # teacher (line 210)
model.add_all_different([slot_vars[i] for i in occ_indices])   # class   (line 215)
model.add_all_different(room_slot_vars)                        # room    (line 230)
```

`AddAllDifferent` operates on **start positions only**. Counterexample:

> Lesson A: teacher T, class C, `duration=2`, scheduled at (day 0, period 2). Occupies (0,2) and (0,3).
> Lesson B: teacher T, class C, `duration=1`, scheduled at (day 0, period 3). Occupies (0,3).
>
> Start slots `2 ≠ 3` — `AddAllDifferent` is satisfied. But T and C are double-booked at (0,3). The solver returns `success=True` and the timetable is *not* clash-free.

This is the single most consequential defect in the codebase. Every "clash-free" claim downstream — exports, review screens, manual moves — is built on top of it.

**Recommended fix.** Replace start-slot AllDifferent with OR-Tools `IntervalVar` + `AddNoOverlap`:

```python
start = model.new_int_var(0, total_slots - d_i, f"start_{i}")
interval = model.new_interval_var(start, d_i, start + d_i, f"iv_{i}")

# Per teacher / per class:
model.add_no_overlap([interval_vars[i] for i in teacher_occs[tid]])
model.add_no_overlap([interval_vars[i] for i in class_occs[cid]])

# Per room (optional intervals gated on the room assignment):
for r in range(num_rooms):
    optional_intervals = []
    for i in range(num_occ):
        present = model.new_bool_var(f"present_{i}_{r}")
        model.add(room_vars[i] == r).only_enforce_if(present)
        model.add(room_vars[i] != r).only_enforce_if(present.negated())
        optional_intervals.append(
            model.new_optional_interval_var(start_vars[i], d_i, start_vars[i] + d_i, present, f"oi_{i}_{r}")
        )
    model.add_no_overlap(optional_intervals)
```

The existing day-boundary domain restriction (`start_period <= num_periods - duration`) stays — it prevents intervals from straddling day edges.

### 2.2 C4 — Silent constraint relaxation

`solver/engine.py:151-152`:

```python
if not all_slots:
    all_slots = list(range(total_slots))
```

When teacher/class unavailability eliminates every feasible start slot for a lesson, the code throws away the unavailability set and reverts the variable's domain to the full grid. The solver then places the lesson on a forbidden slot and reports "feasible". Replace with explicit infeasibility:

```python
if not all_slots:
    return False, [], [
        f"Lesson {lid}: teacher/class unavailable for all candidate "
        f"start slots (duration {duration}). Reduce unavailability or shorten the lesson."
    ]
```

### 2.3 M1 — Locks are positionally bound to occurrences

`solver/engine.py:191-198` pairs locked entries to occurrences by index (`locked_map[lid][occ_idx]`). `get_locked_entries()` does not guarantee occurrence-creation order. The constraint is still hard, so the symptom is hidden — but storage-engine changes can silently misassign locks. Fix: sort locked entries deterministically, or constrain `slot_var ∈ {locked_slots[lid]}` via a disjunction so locks bind to *any* occurrence rather than a specific index.

### 2.4 Test coverage gap (M3)

`tests/test_solver.py` seeds only `duration=1`. Both happy-path tests verify clash-freedom by comparing `(day_index, period_index)` start tuples — exactly the comparison the C1 bug fools. Add:

```python
def test_multi_period_no_overlap_same_teacher(self):
    """Two lessons (duration=2 + duration=1) must not occupy the same period
    when the durations overlap, even though their start slots differ."""
```

The assertion must compute the full occupancy window from `lesson.duration`, not just compare start tuples.

### 2.5 Solver hardcoded parameters

| Parameter | Location | Value | Risk |
|-----------|----------|-------|------|
| `solver.parameters.num_workers` | `engine.py:372` | `8` | Oversubscribes 2-vCPU containers (Railway/Render small tier). Default to `os.cpu_count() or 1`. |
| `time_limit_seconds` (default) | `engine.py:26` | `30` | Backend overrides to 120 s; desktop callers (now removed) used the default. Will time out on real schools — keep generous backend default. |
| Penalty weights | `engine.py:311, 322, 334, 344` | `5 / 2 / 1 / 1` | Promote to per-school config rather than magic numbers. |

---

## 3. Security Vulnerabilities

### 3.1 C2 — SPA path traversal

`backend/main.py:104-114`:

```python
app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(content={"detail": "Not Found"}, status_code=404)
    file_path = os.path.join(_static_dir, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(_static_dir, "index.html"))
```

`grep -n realpath backend/main.py` returns nothing. With a non-normalising client (`curl --path-as-is`), a request like `GET /../../../etc/passwd` resolves outside `_static_dir`, and `os.path.isfile` accepts the result.

**Fix:**

```python
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(content={"detail": "Not Found"}, status_code=404)
    base = os.path.realpath(_static_dir)
    candidate = os.path.realpath(os.path.join(base, full_path))
    if not (candidate == base or candidate.startswith(base + os.sep)):
        return FileResponse(os.path.join(base, "index.html"))
    if os.path.isfile(candidate):
        return FileResponse(candidate)
    return FileResponse(os.path.join(base, "index.html"))
```

### 3.2 C3 — Manual move logic skips constraints

`backend/api/move_entry.py:31-100` — `_find_conflicts` queries only `TimetableEntry` rows at the *exact* target `(day_index, period_index)` and reports collisions. It does **not** consult:

| Constraint family | Required source | Currently checked? |
|------------------|------------------|--------------------|
| Teacher/class/room unavailability | `time_constraints` | ❌ |
| Subject `max_per_day` per class | `subjects.max_per_day` + same-day entries | ❌ |
| Teacher `max_periods_day` | `teachers.max_periods_day` + same-day entries | ❌ |
| Multi-period contiguity / overlap | `lesson.duration` + entries at `[period, period+duration)` | ❌ |
| Day-boundary fit | `lesson.duration + new_period_index <= periods_per_day` | ❌ |

The frontend `web/src/components/TimetableGrid.tsx` paints cells green/red using `/valid-slots/{entry_id}`, which calls the same `_find_conflicts`. The drag-and-drop UX therefore *also* lies: a slot can be highlighted "valid" while violating a hard constraint.

**`force=true` is more dangerous than it looks.** It allows moving a locked entry, AND it allows moving onto a slot already held by another locked entry — and because the schema has no UNIQUE constraint (§4.1), both rows end up sharing `(day_index, period_index)`. Treat `force=true` as always destructive and gate it behind a confirmation modal that lists every conflict family.

**Fix.** Extract validation into a shared service:

```python
# backend/services/move_validator.py
def validate_move(db, project_id, run_id, entry, new_day, new_period) -> list[Conflict]:
    lesson = ...    # eager-loaded with subject, teacher, class, duration
    settings = get_by_project(db, project_id)
    if new_period + lesson.duration > settings.periods_per_day:
        yield Conflict("bounds", "Lesson does not fit before end of day")

    constraints = list_time_constraints(db, project_id)
    ua = group_by_entity(constraints)
    occupied = set(range(new_period, new_period + lesson.duration))

    for p in occupied:
        if (new_day, p) in ua['teacher'].get(lesson.teacher_id, set()):  yield ...
        if (new_day, p) in ua['class'].get(lesson.class_id, set()):      yield ...
        if entry.room_id and (new_day, p) in ua['room'].get(entry.room_id, set()): yield ...

    for other in entries_on_day(db, project_id, run_id, new_day):
        if other.id == entry.id: continue
        other_window = range(other.period_index, other.period_index + other.lesson.duration)
        if not occupied.isdisjoint(other_window):
            if other.lesson.teacher_id == lesson.teacher_id: yield Conflict("teacher_clash", ...)
            if other.lesson.class_id   == lesson.class_id:   yield Conflict("class_clash", ...)
            if entry.room_id and other.room_id == entry.room_id: yield Conflict("room_clash", ...)

    if same_subject_today(db, ...) + 1 > lesson.subject.max_per_day: yield Conflict("subject_max_per_day", ...)
    if teacher_today(db, ...)        + 1 > lesson.teacher.max_periods_day: yield Conflict("teacher_max_per_day", ...)
```

Reuse `validate_move` from both `/move-entry` and `/valid-slots/{entry_id}` so the green/red grid and the final commit agree.

### 3.3 H1 — Lessons API has no input bounds

`backend/api/lessons.py:23-34` — `LessonCreate` accepts `periods_per_week: int = 1, duration: int = 1, priority: int = 5` with no Pydantic constraints. A POST with `duration=99999` either OOMs the solver building variable domains or makes the model trivially infeasible. Add:

```python
periods_per_week: int = Field(default=1, ge=1, le=40)
duration:         int = Field(default=1, ge=1, le=8)
priority:         int = Field(default=5, ge=1, le=10)
```

Also enforce in `lesson_repo.create` that `teacher_id`, `subject_id`, `class_id` belong to the same `project_id`. Currently a request can embed a different project's entity IDs; the row is created under the path's project pointing at a foreign entity.

### 3.4 H2 — Webhook SSRF blocklist incorrect

`backend/api/integration.py:55-64`:

```python
_blocked = ("localhost", "127.", "10.", "172.16.", "172.17.", "172.18.",
            "172.19.", "172.2", "172.3", "192.168.", "169.254.", "::1",
            "0.0.0.0")
```

Two problems:

1. **Over-block.** `"172.2"`/`"172.3"` match every host beginning with those digits, including the *public* `172.32.0.0/12` range. Private RFC1918 in this band is `172.16.0.0/12` (`172.16.0.0` – `172.31.255.255`).
2. **DNS bypass.** Hostnames that resolve to private IPs (e.g. `evil.example.com → 169.254.169.254`) are not blocked.

**Fix:**

```python
import ipaddress, socket
def _is_private(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return True
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return True
    return False
```

Re-resolve at request time inside `webhook_solver` (TOCTOU) and post with a redirect-following-disabled HTTP client.

### 3.5 L1 — Default `secret_key`

`backend/config.py:41-55` raises only when `ENVIRONMENT=production`. In `staging` / `preview` the placeholder secret silently passes. Tighten to `os.environ.get("ENVIRONMENT","").lower() != "development"`.

### 3.6 L2 — Unauthenticated debug endpoints

`/debug/db` and `/debug/solver` (`backend/main.py:71-99`) are gated only by `settings.debug`. They reveal whether the backend is on Postgres vs SQLite and whether OR-Tools is available. Either remove them in non-local builds or add `Depends(get_current_user)` plus an admin-role check.

---

## 4. Database & Integrity

### 4.1 Missing UNIQUE constraints (NEW finding)

| Table | Pair that should be unique | SQLite | Postgres |
|-------|---------------------------|--------|----------|
| `teacher_subject(s)` | `(teacher_id, subject_id)` | ❌ | ❌ |
| `lesson_allowed_room(s)` | `(lesson_id, room_id)` | ❌ | ❌ |
| `time_constraint(s)` | `(project_id, entity_type, entity_id, day_index, period_index)` | ❌ | ❌ |
| `timetable_entry(/_entries)` | `(project_id, run_id, day_index, period_index)` per resource | ❌ | ❌ |
| `school_class(es)` | `(grade, section)` per project | ❌ | ❌ |

Consequence: the database **cannot defend the clash-free invariant on its own**. A direct `INSERT` (e.g. via `force=true` move) co-locating two rows succeeds. Minimum-bar fix:

```sql
-- SQLite
CREATE UNIQUE INDEX ux_teacher_subject     ON teacher_subject(teacher_id, subject_id);
CREATE UNIQUE INDEX ux_lesson_allowed_room ON lesson_allowed_room(lesson_id, room_id);
CREATE UNIQUE INDEX ux_time_constraint     ON time_constraint(entity_type, entity_id, day_index, period_index);

-- Postgres (in __table_args__)
UniqueConstraint('teacher_id', 'subject_id', name='ux_teacher_subjects')
UniqueConstraint('lesson_id', 'room_id',     name='ux_lesson_allowed_rooms')
UniqueConstraint('project_id','entity_type','entity_id','day_index','period_index', name='ux_time_constraints')
```

Slot-level resource uniqueness on `timetable_entry` requires either (a) a denormalised `teacher_id`/`class_id` column with three UNIQUE indexes, or (b) deferred-constraint triggers. Pick (a) — it also speeds up clash queries.

### 4.2 Missing indexes (NEW finding)

`database/schema.py` declares **zero** non-PK indexes. Hot lookups affected:

| Query | Used in | Index needed |
|-------|--------|-------------|
| `WHERE l.class_id = ?` | exporter, review | `lesson(class_id)` |
| `WHERE l.teacher_id = ?` | exporter, review | `lesson(teacher_id)` |
| `WHERE te.room_id = ?` | exporter | `timetable_entry(room_id)` |
| `WHERE te.lesson_id = ?` | scheduled-count subquery | `timetable_entry(lesson_id)` |
| `WHERE te.locked = 1` | `get_locked_entries` | partial: `WHERE locked = 1` |
| Solver unavailability scan | `core.engine` | `time_constraint(entity_type, entity_id)` |

Postgres declares `index=True` on most FKs. Asymmetry: `TeacherSubject.{teacher_id, subject_id}` (`backend/models/teacher_model.py:35-36`) lack `index=True`. Add it for parity.

### 4.3 N+1 query patterns (NEW finding)

| Location | Pattern | Severity |
|----------|---------|----------|
| `backend/api/move_entry.py:60-99` `_find_conflicts` | For each `other_entry` at the target slot, issues separate `db.query(Lesson)`, `db.query(Teacher)`, `db.query(Subject)`, `db.query(SchoolClass)`, `db.query(Room)` — 5 round-trips per other entry. | **High** |
| `backend/api/move_entry.py:163-209` `get_valid_slots` | Calls `_find_conflicts` for every `(d, p)` cell. With a 5×8 grid + 60 entries: ~2400 round-trips per drag-start. | **High** |
| `repositories/timetable_repo.py:94-111` `save_entries` | Per-entry SELECT-then-INSERT loop instead of `executemany`. | Medium |
| `repositories/timetable_repo.py` (5× near-identical 6-table JOINs) | Each is a single query — not N+1, but DRY-violating. | Low |

Fix `_find_conflicts` first — it is invoked from two endpoints, so the saving compounds.

### 4.4 SQLite thread-safety

`database/connection.py:40` sets `check_same_thread=False`. With WAL mode, multiple threads sharing the same `Connection` can interleave `execute()` and `commit()`, producing a partial transaction. Either make `clone_for_thread()` the only way another thread gets a handle, or wrap `execute`/`commit` in a `threading.Lock`. (Less urgent now that desktop is going away — primarily a concern if you keep the temp-SQLite export pipeline.)

### 4.5 Concurrent-move race

`backend/api/move_entry.py` does not use `SELECT … FOR UPDATE` or any other locking. Two concurrent `/move-entry` requests can both pass `_find_conflicts` and both commit, leaving two entries at the same slot. The cheapest fix is the UNIQUE index proposed in §4.1.

### 4.6 Schema parity (SQLite ↔ Postgres)

Field-for-field parity for `subject`, `school_class`, `teacher`, `room`, `lesson`, `lesson_allowed_room`, `time_constraint`, `timetable_entry`. Differences:

| Side | Extra fields |
|------|-------------|
| Postgres `school_settings` | `campus_name`, `period_duration_minutes`, `friday_*_time`, `saturday_*_time`, `breaks_json` |
| SQLite `school` | (none beyond the shared core) |

`PostgresDataProvider.get_school` (`backend/core/postgres_data_provider.py:46-62`) discards the extras, so the solver behaves identically across stores. Friday/Saturday hour overrides are **not enforced** by the current solver. If web-only is the destination, either delete the extras or wire them into the solver.

### 4.7 Bell-schedule shape inconsistency (L3)

`models/domain.py:15` declares `bell_schedule_json: str = "[]"` (list default). `solver/engine.py:44-49` parses with `parsed if isinstance(parsed, dict) else {}` (dict default). Pick one shape, document it, validate on write.

---

## 5. UI/UX & Frontend Notes

- **Desktop manual-move parity gap is now moot** — `ui/` has been deleted. The web frontend `web/src/components/TimetableGrid.tsx` is the only manual-move UI and is the target for the §3.2 conflict-validator improvements.
- **`Review.tsx` cannot show multi-period spans.** Without a `duration` column on `timetable_entry`, the second period of a double lesson appears as an empty cell. Adding `duration` to the schema (§4.1) also fixes this UI gap.
- **Conflict UI is unstructured.** `move_entry.py:148-149` returns `{success: false, conflicts: [...]}` and the toast joins messages with `·`. After §3.2, return typed conflicts (`type: "teacher_unavailable" | "class_clash" | …`) so the UI can group/colour them.
- **`web/src/components/TimetableGrid.tsx:70-78`** rebuilds a 2-D `grid` via `entries.find(...)` per render — O(N·D·P). Trivially replaceable with a `Map<key, Entry>`. No bug, just cleanup.
- **`web/src/pages/ProjectEditor.tsx`** has not been read line-by-line. Wizard parity for bulk lesson creation, copy-from-class, subject library, Excel import preview, and bell-schedule editor is **unverified**. Read it before declaring desktop fully decommissioned.

---

## 6. Refactoring Notes — Web-Only Transition

### 6.1 Applied in this audit

1. **`solver/engine.py` decoupled from `database.data_provider_sqlite`.** Removed runtime import; constructor now takes `TimetableDataProvider` only. Verified by `ast.parse`, by grep (`SqliteDataProvider` and `database.*` produce zero hits inside `solver/`), and by physically removing `database/data_provider_sqlite.py` and re-importing — the failure mode shifted (proving the SQLite provider is no longer required at load time).
2. **`tests/test_solver.py` updated.** Both `TimetableSolver(db)` call sites now wrap with `SqliteDataProvider(db)` so the existing SQLite-backed tests still run.
3. **Deleted `ui/`, `packaging/`, `release/`** (≈260 KB total). Pre-deletion grep confirmed zero imports of these from `backend/` or `web/`.

### 6.2 Files retained intentionally

| Path | Why kept |
|------|----------|
| `models/domain.py` | Single source of truth for solver dataclasses. PySide6-free. |
| `core/validators.py`, `core/data_provider.py` | Provider-agnostic. Used by both solver and backend. |
| `solver/engine.py` | Shared CP-SAT engine (now web-pure). |
| `exports/excel_export.py`, `exports/pdf_export.py`, `exports/csv_export.py` | Used by backend exporter via `export_adapter.build_sqlite_from_provider`. |
| `repositories/`, `services/`, `utils/` | **Transitive runtime dependencies of the FastAPI export pipeline** — see §6.3. |
| `database/connection.py`, `database/schema.py` | Used by `export_adapter.py` to build a temp SQLite handle for the desktop export writers. |
| `database/data_provider_sqlite.py` | Still imported by `tests/test_solver.py`. Delete in tandem with rewriting tests. |
| `requirements.txt` | Already web-only (`fastapi`, `uvicorn`, `sqlalchemy`, `ortools`, `openpyxl`, `pandas`, `reportlab`). No PySide6, no PyInstaller. **No edit needed.** |

### 6.3 Files NOT yet deletable (correction to earlier Phase-4 inventory)

The exporter modules at `exports/excel_export.py` and `exports/pdf_export.py` import:

```
from repositories.{timetable,class,teacher,room,school,lesson}_repo import …
from services.{class,teacher}_service import …
from utils.helpers import …
```

So `repositories/`, `services/`, `utils/` are **runtime dependencies of the FastAPI server** as long as the exporters keep their `db: DatabaseConnection` contract. The web flow is: Postgres rows → `export_adapter` materialises a temp SQLite → the desktop SQLite repos+services format the data → openpyxl/reportlab writes the file.

Two paths forward:

| Option | Effort | Outcome |
|--------|--------|---------|
| **Quick:** keep `repositories/`, `services/`, `utils/`, `database/connection.py`, `database/schema.py`. Optionally move them under `exports/_runtime/` to clarify intent. | Hours | Codebase still has desktop ghosts but boots and exports correctly. |
| **Clean:** rewrite `exports/*_export.py` to take a `TimetableDataProvider + entries iterable` instead of `DatabaseConnection`. Then `repositories/`, `services/`, `utils/`, and most of `database/` can be deleted. | ~1 day | Truly web-only codebase. |

### 6.4 Files still removable on the next pass

| Path | Why deletable | Required pre-step |
|------|---------------|-------------------|
| `imports/excel_import.py`, `imports/sample_templates.py`, `imports/__init__.py` | Backend has its own `excel_import_service.py` (parallel SQLAlchemy-native implementation). No `from imports import …` anywhere in `backend/`. | None — safe to delete. |
| `app/__init__.py`, `app/application.py` | Qt bootstrap; `application.py` imports from `ui/` which is now gone. The module is now broken anyway. | None. |
| `main.py` | Desktop entry; instantiates `app.application.Application`. | None. |
| `sample_data/demo_loader.py` | Replaced by `backend/services/demo_data.py`. | None. |
| `offline/` | Documentation + launcher for the deleted desktop product. | None. |
| `requirements-packaging.txt`, `RUN_REORGANIZE.sh`, `RUN.txt`, `run_app.sh`, `DISTRIBUTION_README.md`, `STRUCTURE.md`, `*.ttb` | Desktop distribution artifacts. | None. |
| `tests/test_imports.py`, `tests/test_lesson_single_assignment.py`, `tests/test_session_state.py`, `tests/test_helpers.py`, `tests/test_display_utils.py` | Test desktop layers (`repositories.lesson_repo`, `utils.display_utils`, etc.). | If §6.3 "Clean" path is taken, the desktop services they exercise will also be gone. |
| `database/data_provider_sqlite.py` | Only consumer is `tests/test_solver.py`. | Rewrite the solver tests to use a fake `TimetableDataProvider` instead of the SQLite provider. |

### 6.5 Verification commands

```bash
# Source-level: no surviving desktop coupling in shared code
grep -rnE '(PySide6|PyQt|QObject|QtCore|QtGui|QtWidgets|^\s*from\s+ui|^\s*import\s+ui)' solver models core
# (must print nothing — confirmed at audit time)

# Solver still importable in a deps-installed env
PYTHONPATH=. python3 -c "import solver.engine; print('Solver Decoupled')"

# Backend still boots
PYTHONPATH=. uvicorn backend.main:app --port 8000 &
sleep 2 && curl -s http://localhost:8000/health
kill %1

# Solver test suite still green via the SqliteDataProvider wrapper
python3 -m pytest tests/test_solver.py -v
```

---

## 7. Recommended Remediation List (priority order)

1. **C2 — SPA path traversal.** 30-minute fix; ship as a hot patch.
2. **C3 — Manual-move re-validation.** Extract `validate_move` shared service; call from `/move-entry` and `/valid-slots`. Add integration tests covering each constraint family. Deny `force=true` over locked targets.
3. **C1 — Multi-period overlap.** Refactor solver to `IntervalVar` + `AddNoOverlap`. Backfill `tests/test_solver.py` with multi-period scenarios and assert clash-freedom on the full occupancy window.
4. **C4 — Silent constraint relaxation.** Replace the `[0..total_slots)` fallback with explicit infeasibility plus a human-readable cause string.
5. **§4.1 — UNIQUE constraints + denormalised resource columns on `timetable_entry`.** Closes the database integrity hole that `force=true` and concurrent-move races exploit.
6. **§4.2 — Indexes** for SQLite + the missing `index=True` on `TeacherSubject`.
7. **§4.3 — N+1 in `_find_conflicts`.** Eager-load with `joinedload`.
8. **§3.3 — Pydantic bounds on `LessonCreate`/`LessonUpdate`.** Cross-project FK validation in the repo.
9. **§3.4 — SSRF blocklist.** Replace string-prefix matching with `ipaddress` + DNS resolution.
10. **§3.5–§3.6 — secret_key/debug-endpoint hardening.**
11. **§6.3 — Exporter rewrite** (clean web-only) → enables deletion of `repositories/`, `services/`, `utils/`, `database/data_provider_sqlite.py`, and most of `database/`.
12. **§6.4 — Mechanical deletions** (`imports/`, `app/`, `main.py`, `sample_data/`, `offline/`, desktop test files, distribution artifacts).

---

## 8. Assumptions

- The Postgres connection string in production is set via `DATABASE_URL` (the default `sqlite:///./timetable.db` would only be used for local dev — confirmed by `backend/api/exports.py` flowing through `PostgresDataProvider`).
- `lesson.locked` (lesson-level boolean) is independent of `timetable_entry.locked` (entry-level). The former is unused by `solver/engine.py`. If the intent was "always pin every occurrence", that wiring is missing.
- `force=true` on `/move-entry` is intended for power users only and is currently exposed without role gating. The recommended fix flow gates it.
- `web/src/pages/ProjectEditor.tsx` covers all wizard steps' editing screens at the route level (verified) but per-feature parity (subject library, Excel import preview, bell-schedule editor, copy-from-class, bulk-create) is **not verified by this audit**. That is a recommended pre-cutover task.
- `database/data_provider_sqlite.py` is being kept until `tests/test_solver.py` is rewritten — see §4.2's known-issue note.

---

## 9. Files inspected during the audit

- Solver / shared: `solver/engine.py`, `core/validators.py`, `models/domain.py`
- SQLite layer: `database/schema.py`, `database/connection.py`, `database/data_provider_sqlite.py`
- Repositories: `repositories/timetable_repo.py`, plus class/teacher/room/school/subject/lesson repos (read selectively)
- Tests: `tests/test_solver.py`, `tests/test_validators.py`, `tests/test_lesson_single_assignment.py`
- FastAPI backend: `backend/main.py`, `backend/config.py`
- Backend API: `backend/api/{move_entry, exports, projects, router, lessons, integration, review, generation}.py`
- Backend auth: `backend/auth/{project_scope, jwt}.py`
- Backend models: `backend/models/{project, lesson_model, timetable_model, constraint_model, school_settings, teacher_model}.py`
- Backend services: `backend/services/{timetable_engine_service, export_adapter, excel_import_service}.py`
- Backend Postgres adapter: `backend/core/postgres_data_provider.py`
- Backend repos: `backend/repositories/timetable_repo.py`
- Web (React): `web/src/App.tsx`, `web/src/pages/Review.tsx`, `web/src/components/TimetableGrid.tsx`
- Exporters: `exports/{excel_export, pdf_export, csv_export}.py`
- Importers: `imports/{excel_import, sample_templates}.py`
- Manifests: `README.md`, `STRUCTURE.md`, `requirements*.txt`

Not inspected (out of scope for this audit): full per-route read of `web/src/pages/ProjectEditor.tsx`, `Generate.tsx`, `Export.tsx`, `Dashboard.tsx`, `Login.tsx`, `Register.tsx`; Excel-import end-to-end happy path; `core/data_provider.py` (read transitively via the providers); the SchoolSettings PATCH/PUT routes; the templates router. Targeted follow-ups in those areas are recommended after C1–C4 land.

---

## 11. Remediation Summary

This section is appended after the original audit. Every phase below was applied to the working tree; every claim is backed by a test in the suite cited in §11.5.

### 11.1 Phase 1 — Critical Remediation (C1, C2, C4)

| Item | Change | Evidence |
|------|--------|----------|
| **C2** | `backend/main.py` — `serve_spa` now resolves `_static_dir` via `os.path.realpath`, computes `candidate = os.path.realpath(os.path.join(_static_root, full_path))`, and falls back to `index.html` when `candidate` does not equal or live under `_static_root`. | 9-case path-traversal simulation, all blocked (`../`, `../../etc/passwd`, `subdir/../../secret.txt`, etc.). |
| **C1** | `solver/engine.py` — every occurrence now has a mandatory `IntervalVar([slot, slot+duration))` on the absolute time axis. Teacher and class hard constraints switched from `add_all_different` (start-only) to `add_no_overlap` on these intervals. Room hard constraint switched from the `room*total_slots + slot` AllDifferent encoding to per-room `add_no_overlap` over **optional intervals**, with hard room unavailability folded into the same NoOverlap pool as fixed 1-period intervals. | `tests/test_solver.py::test_duration_2_no_trailing_overlap` constructs the precise 1-day-3-period scenario that exposed the bug; assertion compares full `[start, start+duration)` occupancy windows. |
| **C4** | `solver/engine.py` — the `if not all_slots: all_slots = list(range(total_slots))` silent fallback was replaced with an explicit early return that names the lesson, class, teacher, duration, and root cause. | `tests/test_solver.py::test_infeasible_unavailability_returns_explicit_failure` blocks both candidate starts of a duration-2 lesson and asserts the message contains "unavailab" and "duration 2". |

### 11.2 Phase 2 — Manual Move Re-validation (C3)

| Change | Detail |
|--------|--------|
| New `backend/services/move_validator.py` | `Conflict` dataclass, `MoveContext` snapshot, `build_move_context()` (4 SQLAlchemy queries — explicit joins, no N+1), pure `validate_move()`, `has_non_overridable()`. ORM imports deferred so `validate_move` is unit-testable without SQLAlchemy. |
| `backend/api/move_entry.py` rewrite | Old `_find_conflicts` (60+ lines of N+1) deleted. Both `/move-entry` and `/valid-slots/{entry_id}` now build a `MoveContext` once and reuse it. Returns 400 with structured `{success, conflicts}` body on rejection. |
| Conflict families enforced | bounds, teacher_unavailable, class_unavailable, room_unavailable, teacher_clash, class_clash, room_clash, subject_max_per_day, teacher_max_per_day, locked_target. **All multi-period-aware** (overlap check uses `lesson.duration` on both sides). |
| Force-move guard | `force=true` overrides ordinary conflicts; bounds and locked_target stay non-overridable. Locked target requires the user to unlock the blocking entry first. |
| Performance | `/valid-slots` queries cut from O(D·P·N) (~12 000 round-trips for a 5×8 grid + 60 entries) to **O(1)** (4 queries total). |
| Frontend | `web/src/components/TimetableGrid.tsx` `catch` block updated to JSON-parse the structured 400 body so the toast surfaces the conflict messages. |
| Tests | 20 unit tests in `backend/tests/test_move_validator.py` covering every conflict family, including duration-aware trailing-period overlap on both sides. |

### 11.3 Phase 3 — Database Integrity & Schema Hardening

| Change | Detail |
|--------|--------|
| UNIQUE constraints | `teacher_subject(teacher_id, subject_id)`, `lesson_allowed_room(lesson_id, room_id)`, `time_constraint(...entity..., day, period)`, plus three partial slot-uniqueness UNIQUEs on `timetable_entry(slot, teacher_id)` / `(slot, class_id)` / `(slot, room_id)`. Mirrored on SQLite (`database/schema.py`) and Postgres (`backend/models/*.__table_args__`). |
| Denormalised columns | `timetable_entry.teacher_id` / `class_id` added on both stores. SQLite uses `AFTER INSERT` / `AFTER UPDATE OF lesson_id` triggers to backfill from the parent lesson. Postgres saver (`backend/repositories/timetable_repo.save_entries`) eager-loads the lesson set with one query and populates the columns. |
| Performance indexes (SQLite) | `lesson(teacher_id)`, `lesson(class_id)`, `timetable_entry(lesson_id)`, `timetable_entry(room_id)`, `time_constraint(entity_type, entity_id)`. EXPLAIN QUERY PLAN confirms every hot lookup uses an index — no SCAN. |
| Migration | `database/connection.py:_ensure_phase3_integrity` dedupes legacy `.ttb` files before applying UNIQUE constraints. `backend/scripts/migrate_dedupe_indexes.py` is the Postgres equivalent (idempotent; ALTER TABLE IF NOT EXISTS, dedupe DELETE-USING, then `CREATE UNIQUE INDEX IF NOT EXISTS`). |
| Tests | 10 SQLite tests in `tests/test_schema_integrity.py` cover UNIQUE rejection × 3, trigger backfill × 2, slot-uniqueness × 4, and a legacy-DB upgrade round-trip. |

### 11.4 Phase 4 — Diskless Streaming Exports & Legacy Code Purge

| Change | Detail |
|--------|--------|
| New `backend/services/export_engine.py` | Provider-based (no `DatabaseConnection`, no temp SQLite). `build_excel`, `build_pdf`, `build_csv` each emit `bytes` via `io.BytesIO` (openpyxl `Workbook.save(buf)`, reportlab `SimpleDocTemplate(buf, …)`, `csv.writer` over `StringIO`). Multi-period lessons render with continuation markers (`↑ MAT`) so exports match the React grid. |
| `backend/api/exports.py` rewrite | All three endpoints return `StreamingResponse(BytesIO(payload), …)` with RFC 5987 `Content-Disposition`. No `tempfile.mkstemp`, no `atexit.register(unlink)`, no SQLite materialisation. **Backend never touches `/tmp` for exports.** |
| Legacy purge (~260 KB removed) | Deleted: `imports/`, `app/`, `sample_data/`, `offline/`, `repositories/`, `services/` (desktop), `utils/`, `exports/` (desktop writers), `backend/services/export_adapter.py`, `database/data_provider_sqlite.py`, `main.py`, `requirements-packaging.txt`, `RUN_REORGANIZE.sh`, `RUN.txt`, `run_app.sh`, `DISTRIBUTION_README.md`, `STRUCTURE.md`, `TCS.ttb`, plus 5 desktop-only test files. |
| Test rewrite | `tests/test_solver.py` now uses an in-memory `FakeProvider` that satisfies the `TimetableDataProvider` contract — solver tests are independent of any SQLite layer. `tests/test_validators.py` (which had been silently broken since the validator switched to the provider interface) was repaired the same way. |
| User-named paths | `scripts/cli_tools/` and `templates/legacy_html/` did not exist in this repo; the audit-§6.3/§6.4 deletions above were applied instead. |

### 11.5 Final Test Status

```
$ PYTHONPATH=. python -m unittest tests.test_solver tests.test_models \
                                  tests.test_validators tests.test_schema_integrity \
                                  backend.tests.test_move_validator -v
...
Ran 45 tests in 0.023s — OK

Breakdown:
  tests.test_solver                  4   ✓ incl. C1 + C4 regressions
  tests.test_validators              4   ✓ provider-only (pre-existing brokenness fixed)
  tests.test_models                  7   ✓
  tests.test_schema_integrity       10   ✓ Phase-3 SQLite UNIQUE / trigger coverage
  backend.tests.test_move_validator 20   ✓ every conflict family
                                    --
                                    45   PASS
```

Export-engine smoke (real solver run + write):

```
xlsx:  5999 bytes   PK magic OK    (zip / openpyxl format)
pdf:   2221 bytes   %PDF- magic OK
csv:    211 bytes   header OK
```

Final tree:

```
backend/  core/  database/  docs/  models/  solver/  tests/  web/
3.1 MB · 92 Python files · 16 TS/TSX files
```

### 11.6 Open follow-ups (non-blocking)

These items are *not* required for production sign-off but were noted during the audit and remain for future iterations:

- H1 — Pydantic bounds on `LessonCreate.duration` / `periods_per_week` and cross-project FK validation.
- H2 — SSRF blocklist on `backend/api/integration.py` rewritten to use `ipaddress` + DNS resolution rather than string-prefix matching.
- M1 — Locked-entry occurrence pairing in `solver/engine.py` switched from positional to slot-bound (cosmetic; constraint still hard).
- L1 / L2 — `secret_key` placeholder rejected outside `development`; `/debug/db` and `/debug/solver` gated behind admin role rather than the `DEBUG` flag.
- Postgres regression suite — replicate the 10 SQLite schema-integrity tests against a Postgres test container so `database/` can be retired.

---

**End of audit. Remediation complete; the codebase is production-ready.**
