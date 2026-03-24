import React, { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";
import { TITLE_OPTIONS } from "../../constants";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type Subject = Awaited<ReturnType<typeof api.listSubjects>>[0];

const COLOR_PALETTE = ['#4F46E5','#0891B2','#16A34A','#D97706','#B45309','#7C3AED','#0F766E','#B45309','#9333EA','#0369A1','#15803D','#C2410C'];

function nextAvailableColor(usedColors: string[]): string {
  const available = COLOR_PALETTE.find(c => !usedColors.includes(c));
  return available || COLOR_PALETTE[usedColors.length % COLOR_PALETTE.length];
}

function generateCode(name: string, existingCodes: string[]): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.map(p => p[0]?.toUpperCase() || "").join("");
  if (!initials) return "";
  if (!existingCodes.includes(initials)) return initials;
  if (parts.length > 1) {
    const longer = parts[0][0].toUpperCase() + parts[parts.length - 1].slice(0, 2).toUpperCase();
    if (!existingCodes.includes(longer)) return longer;
  }
  for (let i = 1; i <= 99; i++) {
    const candidate = initials + i;
    if (!existingCodes.includes(candidate)) return candidate;
  }
  return initials + Date.now();
}

interface Props {
  pid: number;
  teachers: Teacher[];
  subjects: Subject[];
  onChange: (t: Teacher[]) => void;
  onNext: () => void;
}

/* ── Inline Subject Picker ── */
function SubjectPicker({ subjectIds, subjects, onAdd, onRemove, onCreateNew }: {
  subjectIds: number[];
  subjects: Subject[];
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  onCreateNew: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const subjectMap = new Map(subjects.map(s => [s.id, s]));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = subjects.filter(s =>
    !subjectIds.includes(s.id) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  // Deduplicate by name
  const seen = new Set<string>();
  const deduped = filtered.filter(s => {
    const k = s.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const exactMatch = subjects.some(s => s.name.trim().toLowerCase() === search.trim().toLowerCase());

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 120 }}>
      {/* Chips */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 3, cursor: "text", minHeight: 26 }}
        onClick={() => setOpen(true)}
      >
        {subjectIds.map(sid => {
          const subj = subjectMap.get(sid);
          if (!subj) return null;
          return (
            <span key={sid} style={{
              display: "inline-flex", alignItems: "center", gap: 2,
              background: subj.color || "#6366f1", color: "#fff",
              fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px",
              borderRadius: 4, whiteSpace: "nowrap",
            }}>
              {subj.code || subj.name.slice(0, 5)}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRemove(sid); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "0.7rem", padding: 0, lineHeight: 1 }}
              >×</button>
            </span>
          );
        })}
        {subjectIds.length === 0 && (
          <span style={{ fontSize: "0.7rem", color: "var(--slate-400)", fontStyle: "italic" }}>+ Add</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 9999,
          background: "var(--surface-card, #fff)", border: "1px solid var(--slate-200)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          minWidth: 220, maxHeight: 240, overflow: "hidden",
          animation: "slideUp 0.15s ease-out",
        }}>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--slate-100)" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or add new…"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && search.trim() && !exactMatch) {
                  onCreateNew(search.trim());
                  setSearch("");
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              style={{ width: "100%", fontSize: "0.78rem", border: "1px solid var(--slate-200)", borderRadius: 4, padding: "4px 8px" }}
            />
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {deduped.map(s => (
              <div
                key={s.id}
                onClick={() => { onAdd(s.id); setSearch(""); }}
                style={{
                  padding: "5px 10px", fontSize: "0.78rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-50)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color || "#94a3b8", flexShrink: 0 }} />
                {s.name}
              </div>
            ))}
            {search.trim() && !exactMatch && (
              <div
                onClick={() => { onCreateNew(search.trim()); setSearch(""); }}
                style={{
                  padding: "5px 10px", fontSize: "0.78rem", cursor: "pointer",
                  fontWeight: 600, color: "var(--primary-600)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-50)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                ＋ Create "{search.trim()}"
              </div>
            )}
            {deduped.length === 0 && !search.trim() && (
              <div style={{ padding: "8px 10px", fontSize: "0.72rem", color: "var(--slate-400)" }}>No subjects available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* ── Inline Color Picker ── */
function InlineColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          width: 22, height: 22, borderRadius: 6, backgroundColor: color || "#E8725A",
          cursor: "pointer", border: "2px solid var(--slate-200)", transition: "transform 0.1s",
        }}
        title="Click to change color"
      />
      {open && (
        <div style={{
          position: "absolute", top: 28, left: -20, zIndex: 100,
          background: "var(--surface-card, #fff)", border: "1px solid var(--slate-200)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          padding: 6, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
        }}>
          {COLOR_PALETTE.map(c => (
            <div
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              style={{
                width: 22, height: 22, borderRadius: 6, backgroundColor: c,
                cursor: "pointer", border: c === color ? "2px solid #1e293b" : "2px solid transparent",
                transition: "transform 0.1s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}


/* ── Editable Row ── */
interface RowData {
  id: number | null; // null = new row
  name: string;
  code: string;
  title: string;
  color: string;
  maxDay: number;
  maxWeek: number;
  subjectIds: number[];
}

function EditableRow({ row, index, existingCodes, subjects, pid, onSave, onDelete, isNew, toast, checked, onCheck }: {
  row: RowData;
  index: number;
  existingCodes: string[];
  subjects: Subject[];
  pid: number;
  onSave: (data: RowData) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isNew: boolean;
  toast: ReturnType<typeof useToast>;
  checked?: boolean;
  onCheck?: (id: number) => void;
}) {
  const [name, setName] = useState(row.name);
  const [code, setCode] = useState(row.code);
  const [codeManual, setCodeManual] = useState(false);
  const [title, setTitle] = useState(row.title);
  const [color, setColor] = useState(row.color);
  const [maxDay, setMaxDay] = useState(row.maxDay);
  const [maxWeek, setMaxWeek] = useState(row.maxWeek);
  const [subjectIds, setSubjectIds] = useState<number[]>(row.subjectIds);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Sync external changes
  useEffect(() => {
    setName(row.name); setCode(row.code); setTitle(row.title);
    setColor(row.color); setMaxDay(row.maxDay); setMaxWeek(row.maxWeek);
    setSubjectIds(row.subjectIds);
    setDirty(false);
  }, [row.id, row.name, row.code, row.title, row.color, row.maxDay, row.maxWeek, row.subjectIds]);

  function markDirty() { setDirty(true); }

  function autoCode(n: string) {
    if (!codeManual && n.trim()) {
      setCode(generateCode(n, existingCodes));
    }
  }

  const doSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: row.id, name: name.trim(), code: code.trim(), title, color, maxDay, maxWeek, subjectIds,
      });
      setDirty(false);
      if (isNew) {
        setName(""); setCode(""); setTitle("Mr."); setMaxDay(6); setMaxWeek(30); setSubjectIds([]);
        setCodeManual(false);
      }
    } catch { /* handled by parent */ }
    setSaving(false);
  }, [name, code, title, color, maxDay, maxWeek, subjectIds, row.id, isNew, onSave]);

  // Auto-save on blur for existing rows
  function handleBlur() {
    if (dirty && !isNew && name.trim()) {
      doSave();
    }
  }

  // Auto-save when subject list changes for existing rows
  useEffect(() => {
    if (row.id && dirty && name.trim()) {
      const timer = setTimeout(() => doSave(), 600);
      return () => clearTimeout(timer);
    }
  }, [subjectIds]);

  function handleSubjectAdd(sid: number) {
    setSubjectIds(prev => [...prev, sid]);
    markDirty();
  }

  function handleSubjectRemove(sid: number) {
    setSubjectIds(prev => prev.filter(id => id !== sid));
    markDirty();
  }

  async function handleSubjectCreate(subjectName: string) {
    try {
      const created = await api.createSubject(pid, { name: subjectName });
      subjects.push(created);
      setSubjectIds(prev => [...prev, created.id]);
      markDirty();
      toast("success", `Subject "${created.name}" created.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create subject");
    }
  }

  function handleColorChange(c: string) {
    setColor(c); markDirty();
    // Auto-save color change for existing rows
    if (row.id && name.trim()) {
      setTimeout(() => doSave(), 100);
    }
  }

  const rowBg = isNew ? "var(--surface-input)" : dirty ? "var(--surface-dirty)" : undefined;

  return (
    <>
      <tr style={{ background: rowBg, transition: "background 0.2s" }}>
        {/* Checkbox */}
        <td style={{ textAlign: "center", width: 36 }} onClick={e => e.stopPropagation()}>
          {!isNew && row.id && onCheck ? (
            <input type="checkbox" checked={!!checked} onChange={() => onCheck(row.id!)} style={{ width: "auto" }} />
          ) : null}
        </td>
        {/* # */}
        <td style={{ textAlign: "center", color: "var(--slate-400)", fontSize: "0.78rem", fontWeight: 500, width: 36 }}>
          {isNew ? "+" : index + 1}
        </td>
        {/* Name */}
        <td>
          <input
            ref={nameRef}
            value={name}
            onChange={e => { setName(e.target.value); markDirty(); }}
            onBlur={() => { autoCode(name); handleBlur(); }}
            placeholder={isNew ? "Type to add new teacher…" : "Teacher name"}
            style={{
              width: "100%", border: "none", background: "transparent",
              fontSize: "0.82rem", fontWeight: 500, padding: "4px 6px",
              outline: "none", borderRadius: 4,
            }}
            onFocus={e => { e.target.style.background = "var(--surface-input, #f8fafc)"; }}
            onKeyDown={e => {
              if (e.key === "Enter" && isNew && name.trim()) { autoCode(name); doSave(); }
              if (e.key === "Tab") autoCode(name);
            }}
          />
        </td>
        {/* Abbreviation */}
        <td>
          <input
            value={code}
            onChange={e => { setCode(e.target.value); setCodeManual(true); markDirty(); }}
            onBlur={handleBlur}
            placeholder="Auto"
            style={{
              width: 60, border: "none", background: "transparent",
              fontSize: "0.78rem", fontWeight: 700, padding: "4px 6px",
              textAlign: "center", outline: "none", borderRadius: 4,
              color: "var(--primary-700)",
            }}
            onFocus={e => { e.target.style.background = "#f8fafc"; }}
          />
        </td>
        {/* Title */}
        <td>
          <select
            value={title}
            onChange={e => { setTitle(e.target.value); markDirty(); if (!isNew) setTimeout(doSave, 100); }}
            style={{
              border: "none", background: "transparent", fontSize: "0.78rem",
              cursor: "pointer", outline: "none", padding: "2px 0",
            }}
          >
            {TITLE_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
        </td>
        {/* Color */}
        <td style={{ width: 40 }}>
          <InlineColorPicker color={color} onChange={handleColorChange} />
        </td>
        {/* Max/Day */}
        <td>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={maxDay}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              if (raw === '') { setMaxDay(0); markDirty(); return; }
              setMaxDay(Math.max(1, Math.min(10, Number(raw)))); markDirty();
            }}
            onKeyDown={e => {
              if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
              if (e.ctrlKey || e.metaKey) return;
              if (!/^[0-9]$/.test(e.key)) e.preventDefault();
            }}
            onBlur={e => {
              if (!e.target.value || Number(e.target.value) < 1) { setMaxDay(6); markDirty(); }
              handleBlur();
            }}
            min={1} max={10}
            style={{
              width: 44, border: "none", background: "transparent",
              textAlign: "center", fontSize: "0.82rem", fontWeight: 600,
              fontFamily: "var(--font-mono)", outline: "none", borderRadius: 4,
            }}
            onFocus={e => { e.target.style.background = "var(--surface-input, #f8fafc)"; }}
          />
        </td>
        {/* Max/Week */}
        <td>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={maxWeek}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              if (raw === '') { setMaxWeek(0); markDirty(); return; }
              setMaxWeek(Math.max(1, Math.min(50, Number(raw)))); markDirty();
            }}
            onKeyDown={e => {
              if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
              if (e.ctrlKey || e.metaKey) return;
              if (!/^[0-9]$/.test(e.key)) e.preventDefault();
            }}
            onBlur={e => {
              if (!e.target.value || Number(e.target.value) < 1) { setMaxWeek(30); markDirty(); }
              handleBlur();
            }}
            min={1} max={50}
            style={{
              width: 44, border: "none", background: "transparent",
              textAlign: "center", fontSize: "0.82rem", fontWeight: 600,
              fontFamily: "var(--font-mono)", outline: "none", borderRadius: 4,
            }}
            onFocus={e => { e.target.style.background = "var(--surface-input, #f8fafc)"; }}
          />
        </td>
        {/* Subjects */}
        <td>
          <SubjectPicker
            subjectIds={subjectIds}
            subjects={subjects}
            onAdd={handleSubjectAdd}
            onRemove={handleSubjectRemove}
            onCreateNew={handleSubjectCreate}
          />
        </td>
        {/* Actions */}
        <td style={{ width: 60, textAlign: "center" }}>
          {isNew ? (
            <button
              type="button"
              onClick={doSave}
              disabled={!name.trim() || saving}
              title="Save new teacher"
              style={{
                background: name.trim() ? "var(--primary-500)" : "var(--slate-200)",
                color: "#fff", border: "none", borderRadius: 6,
                fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px",
                cursor: name.trim() ? "pointer" : "default", transition: "all 0.15s",
              }}
            >{saving ? "…" : "Save"}</button>
          ) : (
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {dirty && (
                <button
                  type="button"
                  onClick={doSave}
                  disabled={saving}
                  title="Save changes"
                  style={{
                    background: "var(--success-500, #16a34a)", color: "#fff",
                    border: "none", borderRadius: 4, fontSize: "0.65rem",
                    fontWeight: 700, padding: "2px 6px", cursor: "pointer",
                  }}
                >{saving ? "…" : "✓"}</button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirmDelete) onDelete(row.id!);
                  else setConfirmDelete(true);
                }}
                title={confirmDelete ? "Click again to confirm" : "Delete"}
                style={{
                  background: confirmDelete ? "var(--danger-500, #dc2626)" : "transparent",
                  color: confirmDelete ? "#fff" : "var(--slate-400)",
                  border: "none", borderRadius: 4, fontSize: "0.72rem",
                  cursor: "pointer", padding: "2px 5px",
                  transition: "all 0.15s",
                }}
                onBlur={() => setConfirmDelete(false)}
              >{confirmDelete ? "Sure?" : "🗑"}</button>
            </div>
          )}
        </td>
      </tr>
    </>
  );
}


/* ── Main Tab ── */
function TeachersTab({ pid, teachers, subjects, onChange, onNext }: Props) {
  const toast = useToast();
  const list = Array.isArray(teachers) ? teachers : [];
  const importRef = React.createRef<HTMLInputElement>();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; total_rows: number; subjects_linked: number; errors: { row: number; message: string }[] } | null>(null);

  // Bulk selection state
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Teacher → assigned subject IDs map
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<Map<number, number[]>>(new Map());


  useEffect(() => {
    if (list.length === 0) return;
    Promise.all(
      list.map(t =>
        api.getTeacherSubjects(pid, t.id)
          .then(ids => ({ id: t.id, ids }))
          .catch(() => ({ id: t.id, ids: [] as number[] }))
      )
    ).then(results => {
      const map = new Map<number, number[]>();
      results.forEach(r => map.set(r.id, r.ids));
      setTeacherSubjectIds(map);
    });
  }, [pid, list.map(t => t.id).join(",")]);

  async function handleSave(data: RowData) {
    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");
    const payload = {
      first_name: firstName, last_name: lastName, code: data.code,
      title: data.title, color: data.color,
      max_periods_day: data.maxDay, max_periods_week: data.maxWeek,
    };
    try {
      if (data.id) {
        await api.updateTeacher(pid, data.id, payload);
        await api.setTeacherSubjects(pid, data.id, data.subjectIds);
        onChange(list.map(t => t.id === data.id ? { ...t, ...payload } : t));
        setTeacherSubjectIds(prev => new Map(prev).set(data.id!, data.subjectIds));
        toast("success", "Saved.");
      } else {
        const created = await api.createTeacher(pid, payload);
        await api.setTeacherSubjects(pid, created.id, data.subjectIds);
        onChange([...list, { ...created, ...payload } as Teacher]);
        setTeacherSubjectIds(prev => new Map(prev).set(created.id, data.subjectIds));
        toast("success", "Teacher added.");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
      throw err;
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteTeacher(pid, id);
      onChange(list.filter(t => t.id !== id));
      setCheckedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast("success", "Teacher deleted.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleBulkDelete() {
    if (checkedIds.size === 0) return;
    if (!confirmDeleteAll) { setConfirmDeleteAll(true); return; }
    setBulkDeleting(true);
    try {
      const ids = Array.from(checkedIds);
      const result = await api.bulkDeleteTeachers(pid, ids);
      onChange(list.filter(t => !ids.includes(t.id)));
      setCheckedIds(new Set());
      setConfirmDeleteAll(false);
      toast("success", `${result.deleted} teacher${result.deleted !== 1 ? "s" : ""} deleted.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Bulk delete failed");
    }
    setBulkDeleting(false);
  }

  function toggleCheckAll(checked: boolean) {
    setCheckedIds(checked ? new Set(list.map(t => t.id)) : new Set());
  }

  const allChecked = list.length > 0 && checkedIds.size === list.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const res = await api.importTeachersExcel(pid, file);
      setImportResult(res);
      if (res.success_count > 0) { const fresh = await api.listTeachers(pid); onChange(fresh); }
    } catch (err) { toast("error", err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  }

  const existingCodes = list.map(t => t.code);
  const usedColors = list.map(t => t.color).filter(Boolean) as string[];

  // Build row data from teacher list
  const rows: RowData[] = list.map(t => ({
    id: t.id,
    name: `${t.first_name} ${t.last_name}`.trim(),
    code: t.code,
    title: t.title,
    color: t.color || "#E8725A",
    maxDay: t.max_periods_day ?? 6,
    maxWeek: t.max_periods_week ?? 30,
    subjectIds: teacherSubjectIds.get(t.id) || [],
  }));

  // Empty "new entry" row
  const newRow: RowData = {
    id: null, name: "", code: "", title: "Mr.",
    color: nextAvailableColor(usedColors),
    maxDay: 6, maxWeek: 30, subjectIds: [],
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Teachers</h2>
      <p className="subheading">Click any cell to edit. Type in the last row to add a new teacher.</p>

      {/* ── Toolbar ── */}
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <input type="file" ref={importRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => importRef.current?.click()} disabled={importing}>
          {importing ? "⏳ Processing…" : "📥 Import from Excel"}
        </button>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("teachers")}>📋 Download Template</button>
        {checkedIds.size > 0 && !confirmDeleteAll && (
          <button type="button" className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
            🗑 Delete ({checkedIds.size})
          </button>
        )}
        {confirmDeleteAll && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 8,
            background: "var(--danger-50, #fef2f2)", border: "1px solid var(--danger-200, #fecaca)",
          }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--danger-700, #b91c1c)" }}>
              Delete {checkedIds.size} teacher{checkedIds.size !== 1 ? "s" : ""}? This cannot be undone.
            </span>
            <button type="button" className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting} style={{ fontSize: "0.72rem", padding: "4px 12px" }}>
              {bulkDeleting ? "Deleting…" : "Yes, Delete"}
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDeleteAll(false)} style={{ fontSize: "0.72rem", padding: "4px 10px" }}>Cancel</button>
          </div>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>
          {list.length} teacher{list.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Import progress ── */}
      {importing && (
        <div style={{ marginBottom: "1rem", borderRadius: 6, overflow: "hidden", height: 4, background: "var(--slate-200)" }}>
          <div style={{ width: "100%", height: "100%", background: "var(--primary-500)", animation: "loadProgress 1.5s ease-in-out infinite" }} />
        </div>
      )}

      {/* ── Import result ── */}
      {importResult && (
        <div style={{
          marginBottom: "1rem", borderRadius: 8, padding: "12px 16px",
          background: importResult.errors.length > 0 ? "var(--warning-50, #FFFBEB)" : "var(--success-50, #F0FDF4)",
          border: `1px solid ${importResult.errors.length > 0 ? "var(--warning-200, #FDE68A)" : "var(--success-200, #BBF7D0)"}`,
        }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-800)", marginBottom: 4 }}>
            ✅ Imported {importResult.success_count} of {importResult.total_rows} teacher(s)
            {importResult.subjects_linked > 0 && (
              <span style={{ fontWeight: 500, marginLeft: 8, color: "var(--primary-600)" }}>📎 {importResult.subjects_linked} subject link(s)</span>
            )}
          </div>
          {importResult.errors.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 100, overflowY: "auto", fontSize: "0.78rem" }}>
              {importResult.errors.map((e, i) => (
                <div key={i} style={{ padding: "2px 0", color: "var(--slate-700)" }}>
                  <span style={{ fontWeight: 600, color: "var(--danger-600)", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>Row {e.row}:</span> {e.message}
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setImportResult(null)} style={{ marginTop: 6, fontSize: "0.72rem", background: "none", border: "none", color: "var(--slate-400)", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
        </div>
      )}

      {/* ── Teachers table ── */}
      <div style={{ overflowX: "auto", overflowY: "visible", position: "relative" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={e => toggleCheckAll(e.target.checked)}
                  title="Select all"
                  style={{ width: "auto" }}
                />
              </th>
              <th style={{ width: 36 }}>#</th>
              <th style={{ minWidth: 160 }}>Name</th>
              <th style={{ width: 80 }}>Abbreviation</th>
              <th style={{ width: 70 }}>Title</th>
              <th style={{ width: 40 }}>Color</th>
              <th style={{ width: 55 }}>Max/Day</th>
              <th style={{ width: 60 }}>Max/Week</th>
              <th style={{ minWidth: 130 }}>Subjects</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <EditableRow
                key={row.id!}
                row={row}
                index={i}
                existingCodes={existingCodes.filter(c => c !== row.code)}
                subjects={subjects}
                pid={pid}
                onSave={handleSave}
                onDelete={handleDelete}
                isNew={false}
                toast={toast}
                checked={checkedIds.has(row.id!)}
                onCheck={(id) => setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              />
            ))}
            {/* Empty "new entry" row */}
            <EditableRow
              key="__new__"
              row={newRow}
              index={list.length}
              existingCodes={existingCodes}
              subjects={subjects}
              pid={pid}
              onSave={handleSave}
              onDelete={async () => {}}
              isNew={true}
              toast={toast}
            />
          </tbody>
        </table>
      </div>

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Classes →</button>
      </div>
    </div>
  );
}

export default React.memo(TeachersTab);
