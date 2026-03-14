# Part 1: Audit — Class, Teacher, and Subject Selection

## 1.1 Where selection happens

### Class selection
| Location | Control | Data source | Sort order | Search |
|----------|---------|-------------|------------|--------|
| `ui/dialogs/lesson_dialog.py` | `class_combo` (QComboBox) | `ClassService(db).get_all()` | Repo: `ORDER BY grade, section` | `make_searchable(class_combo)` |
| `ui/dialogs/bulk_lesson_dialog.py` | `class_table` (QTableWidget, rows = classes) | `ClassService(db).get_all()` | Repo order | **None** (no filter) |
| `ui/dialogs/copy_lessons_dialog.py` | `source_combo` (QComboBox) | `ClassService(db).get_all()` | Repo order | `make_searchable(source_combo)` |
| `ui/dialogs/copy_lessons_dialog.py` | `target_list` (QListWidget, multi-select) | `ClassService(db).get_all()` | Repo order | **None** |
| `ui/wizard/review_page.py` | `class_combo` | `ClassService(db).get_all()` | Repo order | `make_searchable(class_combo)` |
| `ui/wizard/constraints_page.py` | `entity_combo` (when type=Class) | `ClassService(db).get_all()` | Repo order | `make_searchable(entity_combo)` |
| `ui/dialogs/class_dialog.py` | `teacher_combo`, `room_combo` (not class) | TeacherService, RoomService | — | make_searchable on both |

### Teacher selection
| Location | Control | Data source | Sort order | Search |
|----------|---------|-------------|------------|--------|
| `ui/dialogs/lesson_dialog.py` | `teacher_combo` | `TeacherService(db).get_all()` | Repo: `ORDER BY first_name, last_name` | `make_searchable(teacher_combo)` |
| `ui/dialogs/bulk_lesson_dialog.py` | `teacher_combo` | `TeacherService(db).get_all()` | Repo order | `make_searchable(teacher_combo)` |
| `ui/dialogs/class_dialog.py` | `teacher_combo` | `TeacherService(db).get_all()` | Repo order | `make_searchable(teacher_combo)` |
| `ui/wizard/review_page.py` | `teacher_combo` | `TeacherService(db).get_all()` | Repo order | `make_searchable(teacher_combo)` |
| `ui/wizard/constraints_page.py` | `entity_combo` (when type=Teacher) | `TeacherService(db).get_all()` | Repo order | `make_searchable(entity_combo)` |

### Subject selection
| Location | Control | Data source | Sort order | Search |
|----------|---------|-------------|------------|--------|
| `ui/dialogs/lesson_dialog.py` | `subject_combo` | `SubjectService(db).get_all()` | Repo: `ORDER BY name` | `make_searchable(subject_combo)` |
| `ui/dialogs/bulk_lesson_dialog.py` | `subject_combo` | `SubjectService(db).get_all()` | Repo order | `make_searchable(subject_combo)` |

---

## 1.2 Current sort and display

### Classes
- **Repository** (`repositories/class_repo.py`): `get_all()` uses `ORDER BY grade, section`. **Stream is not in ORDER BY.** Grade is stored as TEXT; string sort gives "10", "11", "9" (lexicographic), not numeric 9, 10, 11.
- **Display**: Everywhere classes are shown by `c.name` (e.g. "Grade 9 Silver") or plain `c.name`. No shared helper for "Grade X Section" or "Grade X Section (Stream)".
- **Domain** (`models/domain.py`): `SchoolClass` has `grade`, `section`, `stream`, `name`, `code`. No `display_name` or sort-key property.

### Teachers
- **Repository** (`repositories/teacher_repo.py`): `get_all()` uses `ORDER BY first_name, last_name`. Order is consistent.
- **Display**: Lesson/Bulk use `f"{t.title} {t.display_name}"`; Review/Constraints use `t.display_name`. Teacher has `display_name` = first + last.

### Subjects
- **Repository** (`repositories/subject_repo.py`): `get_all()` uses `ORDER BY name`. Order is consistent.
- **Display**: Everywhere `s.name` only. Code (e.g. MAT) is not shown in combo text, so search-by-code only works if the completer filters on the single display string.

---

## 1.3 Searchable combo behavior

- **Widget** (`ui/widgets/searchable_combo.py`): `make_searchable(combo)` sets combo editable, attaches a `QSortFilterProxyModel` on the combo model, and a `QCompleter` with `MatchContains` and case-insensitive filter. `lineEdit().textChanged` → `proxy.setFilterFixedString`. So **filtering is by the single display string** (column 0). No separate “search text” combining name + code for subjects, or first + last + code for teachers; it works only to the extent that display string contains the typed text.
- **Class**: Display is `c.name`. So “White” works if name is “Grade 9 White”; “9” works if “9” is in the name. If name is “Grade 9 Silver” and user types “Silver”, it works. Typing “9 Silver” works if the name is exactly that. **No explicit search over grade/section/stream/code**; only whatever is in `name`.
- **Teacher**: Display is “Title First Last”. So “Aisha”, “Khan”, “Aisha Khan” work. Code is not in the display string so **search by code does not work** unless we change display or add a separate search field.
- **Subject**: Display is `s.name`. So “Math”, “Mathematics” work. **Code (MAT) is not in display**, so typing “MAT” won’t match unless we include code in display or in a combined search string.

---

## 1.4 Bulk and copy dialogs

- **Bulk lesson** (`ui/dialogs/bulk_lesson_dialog.py`): Teacher and subject are searchable combos. Classes are a **table** (`class_table`) with one row per class (checkbox, class name, periods/week). Classes come from `ClassService(db).get_all()` in repo order. **No search/filter on the class table**; with many sections the list is long and not filterable.
- **Copy lessons** (`ui/dialogs/copy_lessons_dialog.py`): Source class = searchable combo. Target classes = **QListWidget** with one item per class, multi-selection. **No search/filter on the target list**; again long list with no way to narrow by “Grade 10” or “White”.

---

## 1.5 Summary table

| Area | Classes | Teachers | Subjects |
|------|--------|----------|----------|
| **Combo sort** | Repo: grade, section (text; stream not used; grade not numeric) | first_name, last_name | name |
| **Combo display** | `c.name` only | Title + display_name; code not shown | name only; code not shown |
| **Combo search** | By display string only (name) | By display string; code not searchable | By display string; code not searchable |
| **Bulk/Copy class list** | Table / ListWidget, repo order, **no search** | — | — |
| **Reusable display/sort** | None | None | None |

---

## Part 2: Gaps Against Requirements

1. **Class order**
   - Sort is not “logical academic”: grade is text (e.g. "10" before "9"), stream not used in ORDER BY.
   - No shared “class sort key” (e.g. numeric grade then section then stream).

2. **Class search**
   - Combo filters only on the single display string (name). No explicit “search over grade, section, stream, code”.
   - Bulk class table and Copy target list have **no search/filter** at all.

3. **Teacher search**
   - Combo filters on “Title First Last” only. **Teacher code not in display or filter**, so “search by code” fails.

4. **Subject search**
   - Combo filters on name only. **Code/abbreviation not in display**, so “MAT”/“Bio” don’t match unless we add code to display or to a combined search string.

5. **Selector design**
   - Bulk lesson: class list is a long table with no filter.
   - Copy lessons: target class list is a long QListWidget with no filter.
   - No reusable “filtered list” or “search + list” for multi-select classes.

6. **Display/sort helpers**
   - No shared `class_display_label(c)`, `class_sort_key(c)`, `teacher_display_label(t)`, `subject_display_label(s)` or subject/teacher sort keys used everywhere.

7. **Consistency**
   - Class display is sometimes `c.name` only; for “Grade 9 Silver” vs “9-SCI” there’s no standard. Same for teacher (title+name vs name only in different screens) and subject (name vs name+code).

---

## Part 3: Safe Implementation Plan

### Phase A: Helpers and repo sort (no UI behavior change)
1. **`utils/display_utils.py`** (new):  
   - `class_display_label(c: SchoolClass) -> str`  
     e.g. `"Grade {grade} {section}"` with stream if present; fallback to `c.name`.  
   - `class_sort_key(c: SchoolClass) -> tuple`  
     `(numeric_grade, section, stream)` with safe numeric parse for grade.  
   - `teacher_display_label(t: Teacher) -> str`  
     e.g. `"{title} {first} {last}"`; optional `include_code=False`.  
   - `teacher_sort_key(t: Teacher) -> tuple`  
     `(last_name, first_name)` or keep current.  
   - `subject_display_label(s: Subject, include_code: bool = True) -> str`  
     e.g. `"Mathematics (MAT)"` when include_code.  
   - `subject_sort_key(s: Subject)`  
     `(s.name,)` or category then name.  
   - `class_search_text(c)`, `teacher_search_text(t)`, `subject_search_text(s)` for a single string used for filtering (grade, section, stream, code, name for class; first, last, code for teacher; name, code for subject).

2. **ClassRepository**: Add `get_all_sorted()` (or change `get_all`) to return list sorted by `class_sort_key` (in Python after fetch), or add SQL ordering that mimics numeric grade (e.g. cast or LPAD). Prefer **Python sort** so one place defines order: fetch `ORDER BY grade, section, stream`, then sort by `class_sort_key` in service/repo.

3. **ClassService**: Add `get_all_sorted()` that returns repo list sorted by `class_sort_key`, and use it everywhere classes are shown in UI. (Alternatively repo returns sorted list and `get_all` becomes “sorted” by default.)

4. **TeacherRepository / SubjectRepository**: Keep current ORDER BY; optionally add Python sort by `teacher_sort_key` / `subject_sort_key` for consistency. Teachers already first_name, last_name; subjects already name. Main gap is **display string** for search (code, etc.).

### Phase B: Display and search text in combos
5. **Populate combos with rich display and search**  
   - **Classes**: Use `class_display_label(c)` for combo item text. For searchable combo, the filter is on that text; ensure display includes grade, section, stream so “9”, “White”, “Business” all match. Optionally store in UserRole a “search string” and use a custom filter — but current completer filters on display only, so **putting grade + section + stream + code into the display** (e.g. “Grade 9 Silver (9-SCI)”) gives one-string search. Simpler: display label = “Grade 9 Silver” and add stream/code in parentheses if present so one string is searchable.  
   - **Teachers**: Use `teacher_display_label(t)` and append `(code)` when code exists so filter matches code.  
   - **Subjects**: Use `subject_display_label(s, include_code=True)` e.g. “Mathematics (MAT)” so “MAT” and “Math” both match.

6. **Where to apply**  
   - Lesson dialog, Bulk lesson (combos), Copy lessons (source combo), Review page (class/teacher combos), Constraints page (entity combo when teacher/class). Use the same display helpers so behavior and order are consistent.

### Phase C: Class list search (Bulk and Copy)
7. **Bulk lesson dialog**: Add a **QLineEdit** “Filter classes” above the class table. On text change, show/hide rows: keep only rows where `class_search_text(class)` contains the typed string (case-insensitive). Optionally “Select all visible” / “Deselect all visible” for the filtered set. Reuse `class_display_label` and `class_search_text` from display_utils.

8. **Copy lessons dialog**: Add a **QLineEdit** “Filter classes” above the target QListWidget. On text change, filter items: set each item’s hidden flag based on whether `class_search_text` for that class contains the filter. Reuse same helpers. Keep multi-selection and existing logic.

### Phase D: Tests
9. Add tests:  
   - `class_sort_key`: numeric grade order (9, 10, 11), then section, then stream.  
   - `class_display_label` / `class_search_text` contain grade, section, stream, code.  
   - Teacher/subject display and search text include code where applicable.  
   - Optional: integration test that ClassService.get_all (or get_all_sorted) returns classes in expected order.

### Phase E: No regressions
10. Do not change lesson/constraint/timetable logic; only selection UX and sort/display.  
11. Keep make_searchable on all existing combos; only change what we put into the combo (display text) and, for class, the order and list filtering.

---

## Part 4–7

Part 4 (code changes), Part 5 (files changed), Part 6 (tests), and Part 7 (optional future) are implemented.

**Part 5 — Files changed:** utils/display_utils.py (new); services/class_service, teacher_service, subject_service (sort in get_all); lesson_dialog, bulk_lesson_dialog, copy_lessons_dialog (display labels + class filter in bulk and copy); review_page, constraints_page, class_dialog (display labels).

**Part 6 — Tests:** tests/test_display_utils.py (new): class/teacher/subject sort key, display label, search text. Lesson tests unchanged and passing.

**Part 7 — Optional:** Room display/sort/search; dedicated search string in combo model; Select all visible in Copy dialog; QSortFilterProxyModel for very large class lists.
