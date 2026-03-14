# Qt Combo Box Dropdown Arrow (Stylesheet Fix)

## Problem
- QComboBox dropdowns had no visible arrow, so users couldn’t tell they were clickable.
- Qt stylesheet was customizing `QComboBox::drop-down` and `QComboBox::down-arrow` but the arrow image didn’t show.

## Causes
1. **File path with spaces**  
   Project path like `.../Timetable app/...` was used in `image: url(...)`. Qt’s stylesheet parser treated the URL as relative and prepended the app’s working directory, producing invalid paths like:  
   `.../Timetable app/file:/var/folders/.../arrow.svg` → “No such file or directory”.

2. **`file://` in URL**  
   Using `file://` or `file:///` in the stylesheet `url()` made Qt resolve the value incorrectly (relative to cwd). Qt expects a normal filesystem path in the stylesheet, not a `file://` URL.

3. **Data URLs not supported**  
   Qt Widgets stylesheets do **not** support `data:image/png;base64,...` or `data:image/svg+xml;base64,...` in `image: url()`. Only file paths (or Qt resources) work.

## Solution (what we did)

1. **Arrow asset**  
   Added a small SVG arrow: `ui/assets/dropdown_arrow.svg` (down-pointing triangle).

2. **Path for stylesheet**  
   - If the project path has **no spaces**: use that path as-is (normalized with `/`).  
   - If the project path **has spaces**: copy the SVG to a **temp file** (e.g. under `/var/folders/...` or `/tmp/`) so the path has no spaces, and use that absolute path in the stylesheet.  
   - Return a **plain absolute path** (e.g. `/var/folders/.../timetable_arrow_xxx.svg`).  
   - **Do not** use a `file://` or `file:///` prefix in the stylesheet.

3. **Stylesheet rules**  
   - `QComboBox::drop-down`: fixed width (e.g. 26px), light background (`#f5f5f5`), border, so the clickable area is visible.  
   - `QComboBox::down-arrow`: `image: url("/absolute/path/to/arrow.svg")` — path in quotes, no `file://`.  
   - Optional: `padding-right` on `QComboBox` so text doesn’t sit under the arrow.

4. **Cleanup**  
   If using a temp copy, register an `atexit` handler to delete the temp file on exit.

## Summary for future prompts

**“To show a clear dropdown arrow on QComboBox in Qt/PySide stylesheet:**  
Use `QComboBox::down-arrow { image: url("/absolute/path/to/arrow.svg"); ... }`. Use a **plain absolute path** (no `file://`). If the project path contains spaces, copy the arrow to a temp file and use that path so the stylesheet parser doesn’t break. Qt does **not** support `data:` URLs in stylesheet `image: url()`.”

## Files changed (this project)
- `ui/assets/dropdown_arrow.svg` — arrow graphic.
- `ui/styles.py` — `_arrow_url()` builds path (temp copy if path has spaces); `MAIN_STYLESHEET` uses that path in `QComboBox::down-arrow` with no `file://` prefix.
