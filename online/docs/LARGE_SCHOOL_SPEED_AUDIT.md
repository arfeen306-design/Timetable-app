# Large-School Speed & Efficiency — Audit and Gaps

## Part 1: Audit of Current Implementation

### 1.1 Search and filter areas
- **Searchable combo** (`ui/widgets/searchable_combo.py`): Used for teacher, class, subject in lesson dialog, bulk lesson, copy lessons (source), review page, constraints page. Uses QCompleter + QSortFilterProxyModel; filters on display string; no highlight of matched text.
- **Bulk lesson** (`ui/dialogs/bulk_lesson_dialog.py`): Class filter QLineEdit; `_filter_class_table` hides rows; Select All only checks visible rows; Deselect All clears all (including hidden). No "Select visible only" / "Clear visible only" labels; no search highlight in table.
- **Copy lessons** (`ui/dialogs/copy_lessons_dialog.py`): Target filter QLineEdit; `_filter_target_list` hides items. No Select visible / Clear visible actions for target list.

### 1.2 Display and sort (existing)
- `utils/display_utils.py`: class_display_label, class_sort_key, class_search_text; teacher_*; subject_*. All combos and class lists use these; ClassService/TeacherService/SubjectService get_all() return sorted lists.

### 1.3 Excel import (existing)
- `imports/excel_import.py`: import_teachers_from_excel, import_classes_from_excel, import_subjects_from_excel, import_lessons_from_excel. RowError, ImportResult; errors shown in message box after import. No preview before commit.
- `imports/sample_templates.py`: write_teachers_template, write_classes_template, write_subjects_template, write_lessons_template. Lessons template: Teacher, Subject, Class, Periods Per Week (no Duration column). Classes template: Grade, Section, Name (no Stream).
- Lesson import: duration fixed to 1; no Duration column in template or import.

### 1.4 Copy and bulk workflows
- Copy: source class → multiple target classes (multi-select list). No "copy to same grade" shortcut.
- Bulk: one teacher + one subject → many classes (table with checkboxes); default periods/week; duration fixed 1. No duration spin in UI.

### 1.5 State and memory
- No remembered filter text across dialog opens.
- No recent teacher/class/subject selections.

---

## Gaps Against This Prompt

| Requirement | Current state | Gap |
|-------------|---------------|-----|
| **1. Search highlight** | Combo filters by substring; list shows plain text | No visual emphasis of matched text (e.g. bold/background) in combo dropdown or in filtered table/list |
| **2. Select visible only** | Bulk: Select All already only checks visible | Copy has no "Select visible". Need explicit "Select visible only" / "Clear visible only" in both dialogs |
| **3. Clear visible only** | Bulk: Deselect All clears all rows | Need "Clear visible only" (deselect only visible) in bulk and copy |
| **4. Remembered filters** | Filter cleared when dialog opens | No persistence of last filter text within session |
| **5. Recent selections** | None | No recent teachers/classes/subjects for quick reuse |
| **6. Excel lesson import** | Teacher, Subject, Class, Periods; duration=1 | Missing Duration column and template; no preview before import |
| **7. Excel class import** | Grade, Section, Name; stream not in template | Stream column missing in template/import |
| **8. Copy from one grade to another** | Copy from one class to many (manual target choice) | No shortcut "copy to other classes in same grade" |
| **9. Mass assign** | Bulk: teacher + subject → classes; duration=1 | Add lesson duration (periods) to bulk dialog |
| **10. Academic ordering** | class_sort_key used in services and dialogs | Verify exports use same order; ensure stream in sort everywhere |

---

## Part 2: Implementation Plan (Safe Order)

1. **Select visible only / Clear visible only** — Add in bulk_lesson_dialog and copy_lessons_dialog (low risk, clear value).
2. **Remembered filters** — Store last class filter text in a small session store; pre-fill bulk and copy dialogs when opened.
3. **Recent selections** — Add recent_teacher_ids, recent_class_ids, recent_subject_ids (e.g. in a state module or main window); prepend to combos or show in a small "Recent" section; push on selection from lesson/bulk/copy.
4. **Bulk dialog: duration** — Add "Lesson length (periods)" spin to bulk dialog; use in create_lessons.
5. **Excel: Duration in lessons** — Add Duration column to write_lessons_template and import_lessons_from_excel; validate and report errors.
6. **Excel: Stream in classes** — Add Stream to write_classes_template and import_classes_from_excel.
7. **Copy to same grade** — In copy dialog: button "Copy to other classes in same grade" that sets filter to source grade and calls "Select visible only", then user can confirm and OK.
8. **Search highlight** — Implement in searchable combo: custom delegate for completer popup that highlights filter substring in item text (rich text or paint).
9. **Preview before import** — Optional: dialog that runs validation-only pass and shows row count + error count + first N errors before "Import" commit.
10. **Exports order** — Ensure class list in Excel/PDF export uses ClassService.get_all() (already sorted).

---

## Part 3–6 (Summary)

Part 4 — Files changed: utils/session_state.py (new); bulk_lesson_dialog (select/clear visible, remembered filter, recent combos, duration); copy_lessons_dialog (select/clear visible, remembered filter, copy to same grade); lesson_dialog (recent-first combos); lessons_page (push recent on add/bulk/copy); searchable_combo (SearchHighlightDelegate); excel_import (Duration in lessons, Stream in classes); sample_templates (Duration, Stream).

Part 5 — Tests: tests/test_session_state.py (new); test_import_lessons_with_duration_column in test_imports.py.

Part 6 — Optional: Preview-before-import; highlight in table cells; export order check.
