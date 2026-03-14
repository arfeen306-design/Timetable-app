# Real School Import Guide

How to prepare and import real school data for pilot testing.

## 1. Prepare your data

### Teachers
- **Required:** First name, last name.  
- **Recommended:** Abbreviation/code (e.g. ZAI), title (Mr./Ms.), max periods per day, max periods per week.  
- **Duplicate rule:** One row per teacher; same first + last name is treated as duplicate and skipped.  
- Use the **Download Template** on the Teachers page to get the exact column headers and one sample row.

### Classes
- **Required:** Grade, Section, Name.  
- **Optional:** Stream (e.g. Science, Commerce).  
- **Duplicate rule:** Same grade + section + stream is treated as duplicate and skipped.  
- Template: **Download Template** on the Classes page.

### Subjects
- **Required:** Name.  
- **Recommended:** Code (e.g. MAT), category (Core, Elective, etc.), max per day.  
- **Duplicate rule:** Same name or same code is treated as duplicate and skipped.  
- Template: **Download Template** on the Subjects page.

### Lessons (teacher–subject–class mappings)
- **Required columns:** Teacher, Subject, Class, Periods Per Week.  
- **Optional:** Duration (lesson length in periods; default 1).  
- Teacher/Subject/Class can be **name or code**; the importer matches the first found.  
- Add one row per assignment (e.g. Mr. Khan – Mathematics – Grade 10-A – 5 periods/week).  
- Template: **Download Template** on the Lessons page.

## 2. Import order

1. **School** — Configure in the app (name, days, periods, bell schedule).  
2. **Teachers** — Import or add manually.  
3. **Subjects** — Import or add manually.  
4. **Classes** — Import or add manually.  
5. **Rooms** — Add or import if you use room assignment.  
6. **Lessons** — Import or add via Single/Bulk/Copy. Lessons refer to existing teachers, subjects, and classes.

## 3. Validate before generation

- After import, open **Generate** and click **Validate Data**.  
- Fix any errors (missing data, teacher/class overload, invalid references).  
- Resolve warnings if possible (e.g. class near full capacity).  
- Use the **Pilot Readiness Checklist** to confirm bell schedule, Friday timing, and exports.

## 4. If import shows errors

- **Row N: …** — Each line is one Excel row. Fix that row in the file and re-import, or add/correct data manually in the app.  
- **Duplicate** — The row was skipped because a matching teacher/class/subject already exists. Remove the duplicate from the file or leave as-is if you intended to skip.  
- **Not found** — Teacher/Subject/Class text did not match any existing record. Check spelling and codes; import masters first, then lessons.

## 5. Handling larger schools

- Use **filter** and **Select visible only** in Bulk Assign and Copy from Class to work with one grade or section at a time.  
- Use **recent selections** (top of dropdowns) to reuse the same teachers/classes quickly.  
- **Copy from Class** → “Copy to other classes in same grade” speeds up copying one section’s plan to others.

---

For pilot readiness, see **PILOT_READINESS_CHECKLIST.md**. For reporting issues, use **PILOT_ISSUE_TEMPLATE.md**.
