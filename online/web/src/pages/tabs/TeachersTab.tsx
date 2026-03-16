import React, { useState, useEffect } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";
import { TITLE_OPTIONS } from "../../constants";
import BulkDeleteModal from "../../components/BulkDeleteModal";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type Subject = Awaited<ReturnType<typeof api.listSubjects>>[0];
type SchoolClass = api.SchoolClass;

const COLOR_PALETTE = ['#4F46E5','#0891B2','#16A34A','#D97706','#DC2626','#7C3AED','#0F766E','#B45309','#9333EA','#0369A1','#15803D','#C2410C'];

function nextAvailableColor(usedColors: string[]): string {
  const available = COLOR_PALETTE.find(c => !usedColors.includes(c));
  return available || COLOR_PALETTE[usedColors.length % COLOR_PALETTE.length];
}

function generateCode(name: string, existingCodes: string[]): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.map(p => p[0]?.toUpperCase() || "").join("");
  if (!initials) return "";
  if (!existingCodes.includes(initials)) return initials;
  // Try adding more letters
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

function TeachersTab({ pid, teachers, subjects, onChange, onNext }: Props) {
  const toast = useToast();
  const list = Array.isArray(teachers) ? teachers : [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const importRef = React.createRef<HTMLInputElement>();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; errors: { row: number; message: string }[] } | null>(null);

  // Inline single-delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Teacher → assigned subject IDs map (loaded on mount and after saves)
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<Map<number, number[]>>(new Map());

  // Teacher form fields
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fCodeEditable, setFCodeEditable] = useState(false);
  const [fTitle, setFTitle] = useState("Mr.");
  const [fColor, setFColor] = useState("#E8725A");
  const [fSubjectId, setFSubjectId] = useState<number | null>(null);
  const [fSubjects, setFSubjects] = useState<number[]>([]);
  const [fMaxDay, setFMaxDay] = useState(6);
  const [fMaxWeek, setFMaxWeek] = useState(30);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [fClassIds, setFClassIds] = useState<number[]>([]);

  // Exam duty summary (lazy-loaded per teacher on select)
  const [examSummary, setExamSummary] = useState<api.TeacherExamSummary | null>(null);
  const [examSummaryLoading, setExamSummaryLoading] = useState(false);

  // Subject lookup by id
  const subjectMap = new Map(subjects.map(s => [s.id, s]));

  // ── Load classes on mount ──
  useEffect(() => {
    api.listClasses(pid).then(setClasses).catch(() => setClasses([]));
  }, [pid]);

  // ── Load subject assignments for all teachers on mount / when teacher list changes ──

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
    // Run when pid or teacher IDs change (not on every object reference change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, list.map(t => t.id).join(",")]);

  // ── Fetch exam duty summary for selected teacher ──

  useEffect(() => {
    if (selectedId == null) { setExamSummary(null); return; }
    setExamSummaryLoading(true);
    api.getTeacherExamSummary(pid, selectedId)
      .then(s => setExamSummary(s))
      .catch(() => setExamSummary(null))
      .finally(() => setExamSummaryLoading(false));
  }, [pid, selectedId]);

  // ── Checkbox helpers ──

  function toggleCheck(id: number, e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    setCheckedIds(e.target.checked ? new Set(list.map(t => t.id)) : new Set());
  }

  // ── Modal open helpers ──

  function openAdd() {
    setEditTeacher(null);
    setFName(""); setFCode(""); setFCodeEditable(false); setFTitle("Mr.");
    const usedColors = list.map(t => t.color).filter(Boolean) as string[];
    setFColor(nextAvailableColor(usedColors));
    setFSubjectId(null); setFSubjects([]); setFMaxDay(6); setFMaxWeek(30); setFClassIds([]);
    setModalOpen(true);
  }

  function openEdit(t?: Teacher) {
    const teacher = t || list.find(x => x.id === selectedId);
    if (!teacher) return;
    setEditTeacher(teacher);
    setFName(`${teacher.first_name} ${teacher.last_name}`.trim());
    setFCode(teacher.code); setFCodeEditable(false);
    setFTitle(teacher.title); setFColor(teacher.color || "#E8725A");
    const assignedSubjectIds = teacherSubjectIds.get(teacher.id) || [];
    setFSubjects(assignedSubjectIds);
    setFSubjectId(assignedSubjectIds.length > 0 ? assignedSubjectIds[0] : null);
    setFMaxDay(teacher.max_periods_day ?? 6);
    setFMaxWeek(teacher.max_periods_week ?? 30);
    setFClassIds([]);
    setModalOpen(true);
  }

  // ── Save (create / update) ──

  function handleNameBlur() {
    if (!fCodeEditable && fName.trim()) {
      const existingCodes = list
        .filter(t => !editTeacher || t.id !== editTeacher.id)
        .map(t => t.code);
      setFCode(generateCode(fName, existingCodes));
    }
  }

  async function saveTeacher() {
    if (!fName.trim()) return;
    const nameParts = fName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");
    // Sync fSubjects from fSubjectId for the subject assignment API
    const subjectsToSave = fSubjectId != null ? [fSubjectId] : fSubjects;
    const data = {
      first_name: firstName, last_name: lastName, code: fCode.trim(),
      title: fTitle, color: fColor, max_periods_day: fMaxDay, max_periods_week: fMaxWeek,
    };
    try {
      if (editTeacher) {
        await api.updateTeacher(pid, editTeacher.id, data);
        await api.setTeacherSubjects(pid, editTeacher.id, subjectsToSave);
        onChange(list.map(t => t.id === editTeacher.id ? { ...t, ...data } : t));
        setTeacherSubjectIds(prev => new Map(prev).set(editTeacher.id, subjectsToSave));
        toast("success", "Teacher updated.");
      } else {
        const created = await api.createTeacher(pid, data);
        await api.setTeacherSubjects(pid, created.id, subjectsToSave);
        onChange([...list, { ...created, ...data } as Teacher]);
        setTeacherSubjectIds(prev => new Map(prev).set(created.id, subjectsToSave));
        toast("success", "Teacher added.");
      }
      setModalOpen(false);
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
  }

  // ── Delete (single, inline confirm) ──

  async function confirmAndDelete(id: number) {
    try {
      await api.deleteTeacher(pid, id);
      onChange(list.filter(t => t.id !== id));
      if (selectedId === id) setSelectedId(null);
      setConfirmDeleteId(null);
      toast("success", "Teacher deleted.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Delete failed"); }
  }

  // ── Bulk delete ──

  async function handleBulkDelete(ids: number[]) {
    const result = await api.bulkDeleteTeachers(pid, ids);
    onChange(list.filter(t => !ids.includes(t.id)));
    setCheckedIds(new Set());
    setBulkDeleteOpen(false);
    const msg = `${result.deleted} teacher${result.deleted !== 1 ? "s" : ""} deleted.` +
      (result.failed.length > 0 ? ` ${result.failed.length} could not be removed.` : "");
    toast("success", msg);
  }

  // ── Excel import ──

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

  const allChecked = list.length > 0 && checkedIds.size === list.length;
  const someChecked = checkedIds.size > 0 && !allChecked;
  const checkedItems = list
    .filter(t => checkedIds.has(t.id))
    .map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}`.trim() }));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Teachers</h2>
      <p className="subheading">Add and manage teaching staff. Assign subjects to each teacher.</p>

      {/* ── Toolbar ── */}
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" onClick={openAdd}>+ Add Teacher</button>
        <input type="file" ref={importRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => importRef.current?.click()} disabled={importing}>{importing ? "Importing…" : "Import from Excel"}</button>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("teachers")}>Download Template</button>
        <button type="button" className="btn" onClick={() => openEdit()} disabled={selectedId == null}>Edit</button>
        <button
          type="button" className="btn btn-danger"
          disabled={selectedId == null}
          onClick={() => selectedId != null && setConfirmDeleteId(selectedId)}
        >Delete</button>
        {checkedIds.size > 0 && (
          <button type="button" className="btn btn-danger" onClick={() => setBulkDeleteOpen(true)}>
            Delete selected ({checkedIds.size})
          </button>
        )}
      </div>

      {/* ── Import result ── */}
      {importResult && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          Imported {importResult.success_count} teacher(s).{importResult.errors.length > 0 && ` Errors: ${importResult.errors.map(e => `Row ${e.row}: ${e.message}`).join("; ")}`}
        </div>
      )}

      {list.length === 0 && (
        <p className="subheading" style={{ textAlign: "center" }}>No teachers added yet. Add at least one teacher before creating lessons.</p>
      )}

      {/* ── Teachers table ── */}
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={toggleAll}
                  title="Select all"
                />
              </th>
              <th style={{ width: 36 }}>#</th>
              <th>Name</th>
              <th>Code</th>
              <th>Title</th>
              <th style={{ width: 50 }}>Color</th>
              <th>Max/Day</th>
              <th>Max/Week</th>
              <th>Subjects</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => {
              const assignedIds = teacherSubjectIds.get(t.id) || [];
              return (
                <React.Fragment key={t.id}>
                  <tr
                    className={selectedId === t.id ? "selected" : ""}
                    onClick={() => setSelectedId(prev => prev === t.id ? null : t.id)}
                    onDoubleClick={() => openEdit(t)}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checkedIds.has(t.id)} onChange={e => toggleCheck(t.id, e)} />
                    </td>
                    <td>{i + 1}</td>
                    <td>{t.first_name} {t.last_name}</td>
                    <td>{t.code}</td>
                    <td>{t.title}</td>
                    <td><span className="color-swatch" style={{ backgroundColor: t.color || "#E8725A" }} /></td>
                    <td>{t.max_periods_day}</td>
                    <td>{t.max_periods_week}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, minWidth: 80 }}>
                        {assignedIds.length === 0
                          ? <span style={{ fontSize: "0.7rem", color: "var(--slate-400)", fontStyle: "italic" }}>—</span>
                          : assignedIds.map(sid => {
                              const subj = subjectMap.get(sid);
                              if (!subj) return null;
                              return (
                                <span
                                  key={sid}
                                  title={subj.name}
                                  style={{
                                    display: "inline-block",
                                    background: subj.color,
                                    color: "#fff",
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: "var(--radius-sm)",
                                  }}
                                >
                                  {subj.code || subj.name.slice(0, 4)}
                                </span>
                              );
                            })
                        }
                      </div>
                    </td>
                  </tr>

                  {/* ── Exam duty summary detail strip ── */}
                  {selectedId === t.id && !confirmDeleteId && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <div style={{
                          background: "var(--surface-card)", border: "1px solid var(--primary-100)",
                          borderRadius: "var(--radius-sm)", padding: "0.6rem 1rem",
                          display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap",
                          fontSize: "0.78rem", color: "var(--slate-600)",
                          animation: "slideUp var(--duration-normal) var(--ease-out)",
                        }}>
                          <strong style={{ color: "var(--slate-700)", fontSize: "0.82rem" }}>
                            {t.first_name} {t.last_name}
                          </strong>
                          <span>
                            Subjects: {(teacherSubjectIds.get(t.id) || []).map(sid => subjectMap.get(sid)?.name).filter(Boolean).join(", ") || "—"}
                          </span>
                          {examSummaryLoading ? (
                            <span style={{ color: "var(--slate-400)" }}>Loading exam data…</span>
                          ) : examSummary && examSummary.teacher_id === t.id ? (
                            <>
                              <span>Exam duties: <strong>{examSummary.sessions_assigned}</strong> sessions</span>
                              <span>Total: <strong>{examSummary.duty_minutes_total}</strong> min</span>
                              <span>
                                Exempted: <strong style={{ color: examSummary.exempt ? "var(--warning-600)" : "var(--success-600)" }}>
                                  {examSummary.exempt ? "Yes" : "No"}
                                </strong>
                              </span>
                              {examSummary.excluded_subjects.length > 0 && (
                                <span>
                                  Excluded on: {examSummary.excluded_subjects.map(s => s.name).join(", ")}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: "var(--slate-400)" }}>No exam duty data</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* ── Inline delete confirmation strip ── */}
                  {confirmDeleteId === t.id && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <div style={{
                          background: "var(--danger-50)", border: "1px solid var(--danger-200)",
                          borderRadius: "var(--radius-sm)", padding: "0.6rem 1rem",
                          display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
                        }}>
                          <span style={{ fontSize: "0.85rem", color: "var(--danger-700)", fontWeight: 500 }}>
                            Delete "{t.first_name} {t.last_name}"? This cannot be undone.
                          </span>
                          <button
                            type="button" className="btn btn-danger"
                            style={{ fontSize: "0.78rem" }}
                            onClick={() => confirmAndDelete(t.id)}
                          >Yes, delete</button>
                          <button
                            type="button" className="btn"
                            style={{ fontSize: "0.78rem" }}
                            onClick={() => setConfirmDeleteId(null)}
                          >Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Lessons →</button>
      </div>

      {/* ── Add / Edit modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <h3 style={{ marginTop: 0 }}>{editTeacher ? "Edit Teacher" : "New Teacher"}</h3>
            <div className="modal-form">
              {/* ── Teacher Name ── */}
              <div className="modal-field">
                <label className="modal-label required">Teacher Name:</label>
                <input
                  value={fName}
                  onChange={e => setFName(e.target.value)}
                  onBlur={handleNameBlur}
                  placeholder="e.g., Ahmed Ali"
                  autoFocus
                />
              </div>

              {/* ── Auto-generated Code (read-only chip) ── */}
              <div className="modal-field" style={{ alignItems: "center" }}>
                <label className="modal-label">Code:</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {fCodeEditable ? (
                    <input
                      value={fCode}
                      onChange={e => setFCode(e.target.value)}
                      maxLength={6}
                      style={{ width: 80 }}
                    />
                  ) : (
                    <span style={{
                      display: "inline-block", background: "var(--primary-100)", color: "var(--primary-700)",
                      fontWeight: 700, fontSize: "0.82rem", padding: "3px 10px",
                      borderRadius: "var(--radius-sm)", minWidth: 30, textAlign: "center",
                    }}>
                      {fCode || "—"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setFCodeEditable(!fCodeEditable)}
                    style={{
                      fontSize: "0.72rem", padding: "2px 8px", cursor: "pointer",
                      background: "transparent", border: "1px solid var(--slate-300)",
                      borderRadius: "var(--radius-sm)", color: "var(--primary-600)",
                    }}
                  >
                    {fCodeEditable ? "Auto" : "Edit"}
                  </button>
                </div>
              </div>

              {/* ── Subject (single select, searchable dropdown) ── */}
              {subjects.length > 0 && (
                <div className="modal-field">
                  <label className="modal-label required">Subject:</label>
                  <select
                    value={fSubjectId ?? ""}
                    onChange={e => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setFSubjectId(val);
                      if (val != null) setFSubjects([val]);
                      else setFSubjects([]);
                    }}
                  >
                    <option value="">— Select subject —</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Max Lessons / Day + Week ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="modal-field">
                  <label className="modal-label">Max Lessons / Day:</label>
                  <input
                    type="number"
                    value={fMaxDay}
                    onChange={e => setFMaxDay(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    min={1}
                    max={10}
                    style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.88rem", fontWeight: 600 }}
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Max Lessons / Week:</label>
                  <input
                    type="number"
                    value={fMaxWeek}
                    onChange={e => setFMaxWeek(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    min={1}
                    max={50}
                    style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.88rem", fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* ── Assign Grades (multi-select checkboxes) ── */}
              {classes.length > 0 && (
                <div className="modal-field" style={{ alignItems: "flex-start" }}>
                  <label className="modal-label" style={{ paddingTop: 4 }}>Assign Grades:</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 140, overflowY: "auto" }}>
                    {[...classes].sort((a, b) => {
                      const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
                      const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
                      if (numA !== numB) return numA - numB;
                      return a.name.localeCompare(b.name, undefined, { numeric: true });
                    }).map(cls => {
                      const checked = fClassIds.includes(cls.id);
                      return (
                        <label
                          key={cls.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            fontSize: "0.78rem", cursor: "pointer",
                            padding: "2px 8px", borderRadius: "var(--radius-sm)",
                            border: `1px solid ${checked ? "var(--primary-400)" : "var(--slate-200)"}`,
                            background: checked ? "var(--primary-50)" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setFClassIds(prev =>
                              prev.includes(cls.id) ? prev.filter(id => id !== cls.id) : [...prev, cls.id]
                            )}
                            style={{ margin: 0 }}
                          />
                          {cls.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Title ── */}
              <div className="modal-field">
                <label className="modal-label">Title:</label>
                <select value={fTitle} onChange={e => setFTitle(e.target.value)}>
                  {TITLE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* ── Auto-generated Color (click swatch to cycle) ── */}
              <div className="modal-field" style={{ alignItems: "center" }}>
                <label className="modal-label">Color:</label>
                <div
                  title="Click to cycle color"
                  onClick={() => {
                    const idx = COLOR_PALETTE.indexOf(fColor);
                    setFColor(COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length]);
                  }}
                  style={{
                    width: 32, height: 32, borderRadius: "var(--radius-sm)",
                    backgroundColor: fColor, cursor: "pointer",
                    border: "2px solid var(--slate-300)", transition: "background-color 0.15s",
                  }}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveTeacher}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk delete modal ── */}
      {bulkDeleteOpen && (
        <BulkDeleteModal
          items={checkedItems}
          entityLabel="teacher"
          onConfirm={handleBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}
    </div>
  );
}

// React.memo prevents re-renders when ProjectEditor re-fetches unrelated data (e.g. rooms, subjects)
export default React.memo(TeachersTab);
