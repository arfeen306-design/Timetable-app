# Pilot Test Scenarios

Use these scenarios when testing the timetable application in a real school pilot.

## 1. Small school (quick smoke test)
- **Setup:** 3–5 teachers, 4–6 classes, 4–6 subjects, 1–2 rooms, ~20–30 lessons.
- **Steps:** Create project → School setup → Bell schedule (no zero period) → Add teachers/classes/subjects/rooms → Add lessons (single + bulk) → Validate → Generate (time limit 30 s).
- **Check:** No errors; all lessons scheduled; export class and teacher Excel/PDF; print master timetable.
- **Focus:** Basic flow, export order (academic), workload label consistency.

## 2. Medium school (typical pilot)
- **Setup:** 15–25 teachers, 20–30 classes, 10–12 subjects, 15–20 rooms, 150–250 lessons.
- **Steps:** Use Excel import for teachers, classes, subjects; use **Import preview** and fix any row errors; import lessons; set constraints if needed; Validate → check readiness summary → Generate (60 s).
- **Check:** Readiness summary shows correct counts; post-generation summary shows scheduled/unscheduled/conflicts; teacher workload same in Excel and PDF; Friday timing if different.
- **Focus:** Import preview (valid/invalid/duplicate), generation summary, export consistency.

## 3. Large school (stress)
- **Setup:** 40+ teachers, 50+ classes, 15+ subjects, 25+ rooms, 400+ lessons.
- **Steps:** Import all from Excel with preview; Validate; increase time limit if needed (e.g. 120 s); Generate.
- **Check:** UI remains responsive; generation completes or fails with clear messages; export completes; master timetable readable (academic order).
- **Focus:** Performance, clear failure reasons, no silent data loss.

## 4. Friday timing
- **Setup:** Bell schedule with Friday having different start/end or break times.
- **Steps:** Configure Friday in bell schedule; generate; export class and teacher timetables.
- **Check:** Friday column shows correct times and breaks in Excel and PDF.
- **Focus:** Time display consistency, zero period and breaks on Friday.

## 5. Real school dataset
- **Setup:** One real school's data (teachers, classes, subjects, lessons) in Excel.
- **Steps:** Prepare data per REAL_SCHOOL_IMPORT_GUIDE.md; import with preview; fix duplicates/invalid rows; validate; generate.
- **Check:** No hidden duplicates; conflict report and unscheduled report understandable; exports match expectations.
- **Focus:** Import safety, validation before generation, interpretable failure reports.

## 6. Pilot readiness checklist run-through
- **Steps:** Complete PILOT_READINESS_CHECKLIST.md item by item for one project.
- **Check:** Every box can be checked after following the app and docs; any blocker documented in PILOT_ISSUE_TEMPLATE.md.
- **Focus:** Checklist accuracy and completeness.

---

**Reporting:** Log any issue using the structure in **PILOT_ISSUE_TEMPLATE.md**. See **KNOWN_LIMITATIONS.md** for current limits.
