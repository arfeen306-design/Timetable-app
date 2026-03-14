# School Timetable Application — Summary & International Standard Roadmap

---

## Part 1: What This Timetable Application Contains

### 1.1 Overview

This is a **desktop school timetable generator** built with Python (PySide6), SQLite, and Google OR-Tools. It runs offline, stores each project as a single `.ttb` file (SQLite), and guides users through a 10-step wizard to configure school data and generate clash-free timetables.

---

### 1.2 Core Capabilities

| Area | What it contains |
|------|------------------|
| **Project & startup** | Create new project, open existing (.ttb), **open recent** (persisted list), **duplicate project** (copy .ttb and open), load demo data. Save / Save As. |
| **School setup** | School name, academic year, working days per week, periods per day, weekend days (Mon–Sun checkboxes). **Bell schedule**: period duration (minutes), first period start time, zero-period checkbox. Stored in `bell_schedule_json`. |
| **Subjects** | CRUD, subject library (default subjects: MAT, PHY, CHEM, etc.), import from library (checkbox select), **import from Excel**, download template. Fields: name, code, category, color, max per day, double allowed, preferred room type. |
| **Classes** | CRUD, **import from Excel**, download template. Grade, section, stream, name, code, color, **class teacher** (linked teacher), home room, strength. |
| **Classrooms** | CRUD. Name, code, type, capacity, color, home class. |
| **Teachers** | CRUD, **import from Excel**, download template. First/last name, code, title, color, max periods/day and week. **Email** and **WhatsApp** fields. **Delete warning** when teacher has lessons assigned. |
| **Lessons** | Single lesson (searchable teacher/subject/class combos), **bulk assign** (one teacher+subject to many classes), **copy from class**. Periods per week, lesson length (periods), importance (Normal/High/Flexible), locked, preferred room, allowed rooms, notes. Validation to avoid None selection crash. |
| **Constraints** | Time constraints per entity (teacher/class/room): day, period, type (unavailable etc.), hard/soft, weight. |
| **Generation** | Pre-generation **validation** (school, subjects, classes, teachers, lessons, load vs slots, teacher max). **OR-Tools CP-SAT solver**: no double-booking, locked slots, room availability, subject max/day, teacher max/day; soft: spread days, preferred/home rooms. Configurable time limit. On failure: **grouped messages** (Missing data, Teacher overload, Class overload, etc.). **Unscheduled lesson report** after success. |
| **Review & export** | Tabs: **Class / Teacher / Room** timetable with selectors and grid. Lock/unlock entries. **Excel**: per-class sheets, per-teacher sheets (with total weekly workload), **Master Timetable** (all classes), Teacher Load sheet. **PDF**: class timetables; **teacher PDF** (one page per teacher with workload). **CSV** export. **Communication-ready**: export all teacher PDFs to folder, export class timetables for class teachers to folder (for email/WhatsApp). |
| **UI/UX** | Scroll areas on School and Review pages when window is minimized. **Default color fallback**: white background, black text when no color set (grid, Excel, PDF, table cells). Searchable combos with readable dropdown styling. |

---

### 1.3 Technical Architecture

- **Stack**: Python 3.10+, PySide6 (Qt), SQLite (WAL, foreign keys), OR-Tools (CP-SAT), openpyxl, reportlab, pandas.
- **Layers**: UI (wizard pages, dialogs, widgets) → Services (business logic) → Repositories (DB) → SQLite. Solver and **communication module** are separate from core CRUD.
- **Data**: One SQLite file per project (`.ttb`). Tables: school, subject, school_class, teacher, room, lesson, lesson_allowed_room, time_constraint, timetable_entry, project_settings; teacher has email, whatsapp_number.
- **Communication module**: `CommunicationService` for teacher and class-teacher deliverables; single-teacher and single-class PDF exports; no email/WhatsApp API dependency.

---

### 1.4 What Is Not Included (Current Gaps)

- No **multi-language / localization** (UI is single-language).
- No **per-period start/end times** or break/lunch slots in the bell schedule (only global duration and first start).
- No **lesson-mapping Excel import** (only teachers, classes, subjects).
- No **actual email or WhatsApp sending** (only export-to-folder and contact storage).
- No **reuse previous year** or copy-from-another-project flow.
- No **cloud sync**, **multi-school**, or **role-based access**.
- No **standard data interchange format** (e.g. UNL, SchoolTool, or custom JSON/XML schema) for interoperability.

---

## Part 2: Taking It to International Standard — Roadmap

To bring the timetable application to **international standard**, consider the following dimensions and concrete steps.

---

### 2.1 Internationalization (i18n) and Localization (l10n)

**Goal**: Support multiple languages and regional formats so schools in different countries can use the app in their language and conventions.

| Priority | Action |
|----------|--------|
| High | Introduce **Qt Linguist / tr()** for all user-visible strings (labels, buttons, messages, wizard step names). Extract strings to `.ts` files, translate to at least one additional language (e.g. Urdu, Arabic, Spanish). |
| High | **Locale-aware formatting**: date/time (first period start), numbers (period duration, counts), and list separators. Use `QLocale` and avoid hard-coded "Mon"/"Tue" where possible (e.g. from locale or config). |
| Medium | **Week start**: Allow configurable first day of week (e.g. Sunday in some regions, Monday in others) for display and weekend logic. |
| Medium | **RTL (right-to-left)** readiness: Use Qt layout direction and logical properties so that a future RTL locale does not break layout. |
| Lower | **Currency/region**: Not critical for timetables; add only if you introduce fees or regional reports. |

---

### 2.2 Accessibility (a11y)

**Goal**: Meet WCAG-style expectations so users with disabilities can use the application.

| Priority | Action |
|----------|--------|
| High | **Keyboard navigation**: All actions reachable via keyboard; logical tab order on every page; no mouse-only operations. |
| High | **Screen reader support**: Meaningful names and roles for widgets (`setAccessibleName`, `setAccessibleDescription`); announce errors and status (e.g. generation result). |
| Medium | **Focus indicators**: Visible focus rectangle on all focusable controls; sufficient contrast. |
| Medium | **Color**: Do not rely on color alone (e.g. status); keep default white/black fallback; consider high-contrast theme option. |
| Lower | **Resize and zoom**: Support system font scaling; scroll areas already help when window is small. |

---

### 2.3 Data Standards and Interoperability

**Goal**: Align with common education data models and formats so timetables can be exchanged with other systems (SIS, LMS, ministry systems).

| Priority | Action |
|----------|--------|
| High | **Export/import schema**: Define a clear **JSON or XML schema** for “timetable project” (school, terms, subjects, staff, classes, lessons, constraints, assignments). Document it and support export/import of full or partial data. |
| High | **Structured export**: In addition to Excel/PDF, offer **machine-readable export** (e.g. JSON/XML) of the generated timetable (assignments, slots, room, teacher, class) for integration. |
| Medium | **Align with existing standards**: Review **UNL (Universal Networking Language)**-style timetabling concepts, **IMS LTI** or **OneRoster**-style roster data, or **national curriculum codes** (e.g. subject codes) and map your model to standard identifiers where useful. |
| Medium | **Version and metadata**: Store schema version and export date in project and in exports so consumers can interpret format. |
| Lower | **APIs**: If you later add a server component, REST/GraphQL APIs for “get timetable”, “get teacher schedule” with a stable contract. |

---

### 2.4 Multi-School and Scalability

**Goal**: Support districts or organizations with multiple schools and larger datasets.

| Priority | Action |
|----------|--------|
| Medium | **Multi-school in one install**: Optional “school selector” or multiple project files per organization; shared subject/room type catalogs if desired. |
| Medium | **Performance**: For large schools (e.g. 50+ teachers, 1000+ lessons), profile solver and UI (grid rendering, combo population); add pagination or lazy loading where needed. |
| Lower | **Concurrent users**: If moving to server: authentication, roles (admin, scheduler, viewer), and conflict-free editing (e.g. lock project or merge rules). |

---

### 2.5 Communication and Distribution

**Goal**: Reliable, auditable distribution of timetables to teachers and class teachers.

| Priority | Action |
|----------|--------|
| High | **Email sending**: Integrate **SMTP or a transactional email API**; use existing CommunicationService and per-teacher / per–class-teacher PDFs; optional “Send to all” with consent and retry. |
| Medium | **WhatsApp**: When ready, use **WhatsApp Business API** (or approved provider) to send PDF or link; use stored `whatsapp_number` and same report generation; keep communication module separate from solver. |
| Medium | **Delivery log**: Record what was sent (e.g. teacher_id, class_id, channel, timestamp) for audit and “already sent” state. |
| Lower | **SMS / in-app notifications**: Optional fallback or reminder channel. |

---

### 2.6 Robustness and Compliance

**Goal**: Behave predictably, protect data, and align with institutional expectations.

| Priority | Action |
|----------|--------|
| High | **Data validation**: Strict validation on import and on save (required fields, ranges, referential integrity); clear, grouped error messages (already started with generation failure grouping). |
| High | **Backup and recovery**: Encourage “Save As” or external backup of `.ttb`; optional “Export full project” (e.g. JSON/archive) for disaster recovery. |
| Medium | **Audit trail**: Optional table or log for “who changed what when” (e.g. lesson added/removed, constraint changed) for accountability. |
| Medium | **Privacy**: If storing personal data (email, phone), document it; support data export/deletion for GDPR-style requests if applicable. |
| Lower | **Certification**: If targeting specific ministries or districts, check if they require particular formats or security certifications. |

---

### 2.7 User Experience and Pedagogy

**Goal**: Match how schools actually plan timetables and comply with local rules.

| Priority | Action |
|----------|--------|
| High | **Per-period times**: Extend bell schedule to **per-period start/end** (and optional break/lunch slots) so exports and reports show real times, not only “Period 1”, “Period 2”. |
| High | **Curriculum alignment**: Optional link to **curriculum or syllabus** (e.g. required hours per subject per grade) and report “met/not met” for compliance. |
| Medium | **Rotation and cycles**: Support **biweekly or multi-week cycles** if some lessons alternate weeks. |
| Medium | **Substitute and cover**: Placeholder for “cover” or “substitute” so absences can be planned without breaking the base timetable. |
| Lower | **Room and equipment**: Richer room attributes (capacity, equipment, accessibility) for better matching. |

---

### 2.8 Summary Table — International Standard Checklist

| Dimension | Current state | Next level (international standard) |
|-----------|----------------|-------------------------------------|
| **Languages** | Single language (English) | Multi-language UI (tr), locale-aware dates/numbers, optional RTL |
| **Accessibility** | Basic keyboard/mouse | Full keyboard nav, screen reader, focus and contrast |
| **Data format** | SQLite + Excel/PDF/CSV | Published schema, JSON/XML export/import, optional standard codes |
| **Scale** | Single school, one project | Multi-school option, large-data performance |
| **Distribution** | Export to folder, contact storage | Email send, WhatsApp send, delivery log |
| **Reliability** | Validation, grouped errors | Audit trail, backup/export, privacy notes |
| **Scheduling** | Periods, zero period, constraints | Per-period times, break/lunch, cycles, curriculum link |

---

## Part 3: Suggested Implementation Order

1. **i18n foundation**: Extract strings to tr(), add one extra language, locale for time/number.
2. **Data schema**: Document and implement JSON/XML export/import for project and timetable.
3. **Per-period bell schedule**: Start/end per period, optional break/lunch in UI and exports.
4. **Email integration**: Use CommunicationService + PDFs; add SMTP (or API) and simple “Send” flow.
5. **Accessibility**: Keyboard and screen reader improvements, focus and contrast.
6. **Week start and RTL**: Configurable first day; layout direction ready for RTL.
7. **Delivery log and audit**: Optional tables for “sent” and “who changed what”.
8. **WhatsApp and multi-school**: When stable; follow same communication pattern and scalability plan above.

This roadmap keeps the current timetable engine and communication design intact while bringing the product toward international standard in language, accessibility, data interchange, distribution, and scheduling depth.
