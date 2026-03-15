import React, { useState, useEffect } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";
import { TITLE_OPTIONS } from "../../constants";
import BulkDeleteModal from "../../components/BulkDeleteModal";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type Subject = Awaited<ReturnType<typeof api.listSubjects>>[0];

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
  const [fFirst, setFFirst] = useState("");
  const [fLast, setFLast] = useState("");
  const [fCode, setFCode] = useState("");
  const [fTitle, setFTitle] = useState("Mr.");
  const [fColor, setFColor] = useState("#E8725A");
  const [fMaxDay, setFMaxDay] = useState(6);
  const [fMaxWeek, setFMaxWeek] = useState(30);
  const [fSubjects, setFSubjects] = useState<number[]>([]);

  // Exam duty summary (lazy-loaded per teacher on select)
  const [examSummary, setExamSummary] = useState<api.TeacherExamSummary | null>(null);
  const [examSummaryLoading, setExamSummaryLoading] = useState(false);

  // Subject lookup by id
  const subjectMap = new Map(subjects.map(s => [s.id, s]));

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
    setFFirst(""); setFLast(""); setFCode(""); setFTitle("Mr."); setFColor("#E8725A");
    setFMaxDay(6); setFMaxWeek(30); setFSubjects([]);
    setModalOpen(true);
  }

  function openEdit(t?: Teacher) {
    const teacher = t || list.find(x => x.id === selectedId);
    if (!teacher) return;
    setEditTeacher(teacher);
    setFFirst(teacher.first_name); setFLast(teacher.last_name); setFCode(teacher.code);
    setFTitle(teacher.title); setFColor(teacher.color || "#E8725A");
    setFMaxDay(teacher.max_periods_day); setFMaxWeek(teacher.max_periods_week);
    setFSubjects(teacherSubjectIds.get(teacher.id) || []);
    setModalOpen(true);
  }

  // ── Save (create / update) ──

  async function saveTeacher() {
    if (!fFirst.trim()) return;
    const data = {
      first_name: fFirst.trim(), last_name: fLast.trim(), code: fCode.trim(),
      title: fTitle, color: fColor, max_periods_day: fMaxDay, max_periods_week: fMaxWeek,
    };
    try {
      if (editTeacher) {
        await api.updateTeacher(pid, editTeacher.id, data);
        await api.setTeacherSubjects(pid, editTeacher.id, fSubjects);
        onChange(list.map(t => t.id === editTeacher.id ? { ...t, ...data } : t));
        setTeacherSubjectIds(prev => new Map(prev).set(editTeacher.id, fSubjects));
        toast("success", "Teacher updated.");
      } else {
        const created = await api.createTeacher(pid, data);
        await api.setTeacherSubjects(pid, created.id, fSubjects);
        onChange([...list, { ...created, ...data } as Teacher]);
        setTeacherSubjectIds(prev => new Map(prev).set(created.id, fSubjects));
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
              <div className="modal-field"><label className="modal-label required">First Name:</label><input value={fFirst} onChange={e => setFFirst(e.target.value)} placeholder="e.g., Ali" autoFocus /></div>
              <div className="modal-field"><label className="modal-label">Last Name:</label><input value={fLast} onChange={e => setFLast(e.target.value)} placeholder="e.g., Khan" /></div>
              <div className="modal-field"><label className="modal-label">Code:</label><input value={fCode} onChange={e => setFCode(e.target.value)} placeholder="e.g., AK" maxLength={6} /></div>
              <div className="modal-field">
                <label className="modal-label">Title:</label>
                <select value={fTitle} onChange={e => setFTitle(e.target.value)}>{TITLE_OPTIONS.map(t => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="modal-field"><label className="modal-label">Color:</label><input type="color" value={fColor} onChange={e => setFColor(e.target.value)} style={{ width: 48, height: 32, padding: 0 }} /></div>
              <div className="modal-field"><label className="modal-label">Max Periods/Day:</label><input type="number" min={1} max={15} value={fMaxDay} onChange={e => setFMaxDay(Number(e.target.value))} style={{ width: 80 }} /></div>
              <div className="modal-field"><label className="modal-label">Max Periods/Week:</label><input type="number" min={1} max={60} value={fMaxWeek} onChange={e => setFMaxWeek(Number(e.target.value))} style={{ width: 80 }} /></div>

              {/* ── Subject assignment ── */}
              {subjects.length > 0 && (
                <div className="modal-field" style={{ alignItems: "flex-start" }}>
                  <label className="modal-label" style={{ paddingTop: 4 }}>Subjects:</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {subjects.map(s => {
                      const assigned = fSubjects.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          title={s.name}
                          onClick={() => setFSubjects(prev =>
                            prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          )}
                          style={{
                            fontSize: "0.72rem", fontWeight: 700, padding: "3px 9px",
                            borderRadius: "var(--radius-sm)", cursor: "pointer",
                            border: `1.5px solid ${assigned ? s.color : "var(--slate-300)"}`,
                            background: assigned ? s.color : "transparent",
                            color: assigned ? "#fff" : "var(--slate-600)",
                            transition: "all 0.12s",
                          }}
                        >
                          {s.code || s.name.slice(0, 6)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
