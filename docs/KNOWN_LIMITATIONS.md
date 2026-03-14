# Known Limitations (Pre–Full Production)

This list describes current limitations before a full production rollout. Use it for pilot planning and user expectations.

## Data and import
- **Excel import** — No in-app preview before commit; errors are shown after import runs. Valid rows are already saved when errors appear. Use “Download Template” and fix data in Excel, then re-import if needed.
- **Duplicate handling** — On import, duplicates (same teacher name, same class grade/section/stream, same subject name/code) are skipped and reported as row errors. There is no “block entire file” or “merge” option.
- **Large datasets** — Very large schools (e.g. hundreds of sections) may experience slower UI when filtering or opening dialogs; generation time limit may need to be increased.

## Timetable generation
- **Solver** — Generation is heuristic; it may not find a perfect solution under tight constraints. Increase time limit or relax constraints if many lessons remain unscheduled.
- **Conflicts** — If the solver reports conflicts after generation, resolve by adjusting constraints or lesson assignments and re-generating.

## Exports and print
- **Master timetable** — Exported as one continuous layout; page breaks between classes. For very many classes, consider exporting class timetables separately.
- **Friday timing** — Exports use the same slot sequence as the UI; if Friday has different start/break times, ensure bell schedule is set correctly so exports reflect it.

## Features not in scope (this phase)
- No live email or WhatsApp delivery from the app.
- No multi-school or cloud sync.
- No ERP integration.
- No AI-driven schedule changes.

---

Pilot feedback will help prioritize which limitations to address first.
