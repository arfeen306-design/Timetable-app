# Next Steps — Pilot and Beyond

Use this as your runbook after the pilot-readiness phase.

---

## 1. Run a real pilot

- [ ] **Checklist** — Work through **PILOT_READINESS_CHECKLIST.md** section by section (school setup, master data, lessons, constraints, validation, generation, exports).
- [ ] **Import** — Use **REAL_SCHOOL_IMPORT_GUIDE.md** to prepare data and import one real-school dataset (teachers, classes, subjects, lessons). Use the import preview and fix row errors before confirming.
- [ ] **Scenarios** — Use **PILOT_TEST_SCENARIOS.md** while testing (small school, medium school, large school, Friday timing, real dataset, checklist run-through).

---

## 2. Record issues

- [ ] Log anything odd or broken using **PILOT_ISSUE_TEMPLATE.md**: title, screen/workflow, steps to reproduce, expected vs actual, priority, status.
- [ ] Keep a running list (e.g. `PILOT_ISSUES.md` or a spreadsheet) during the pilot.

---

## 3. Revisit limitations before full production

- [ ] Skim **KNOWN_LIMITATIONS.md** (import behaviour, solver, exports, features out of scope).
- [ ] Skim **PILOT_READINESS_AUDIT.md** Part 8 (remaining limitations) so you know what’s still out of scope or risky.

---

## 4. Optional later polish (not done yet)

| Item | Description |
|------|-------------|
| **Focus shortcuts** | e.g. Ctrl+F focuses the filter field in Bulk Assign and Copy from Class dialogs. |
| **Export error list** | From the import preview dialog, allow exporting the list of row errors to a file. |
| **Keyboard / tab** | Review Enter and Escape behaviour and tab order in key dialogs. |
| **Tests** | Add or extend tests for: import preview/dry-run, export academic order, teacher workload in exports, zero period/breaks/Friday in export, generation readiness and post-generation summary. |

---

## Quick links

| Doc | Purpose |
|-----|---------|
| `PILOT_READINESS_CHECKLIST.md` | Confirm project is ready before pilot. |
| `REAL_SCHOOL_IMPORT_GUIDE.md` | Prepare data, import order, validate, handle errors. |
| `PILOT_TEST_SCENARIOS.md` | Test scenarios (small/medium/large, Friday, real data). |
| `PILOT_ISSUE_TEMPLATE.md` | Log pilot issues. |
| `KNOWN_LIMITATIONS.md` | Current limits before full production. |
| `PILOT_READINESS_AUDIT.md` | Audit, gaps, plan, files changed, Part 8 limitations. |
