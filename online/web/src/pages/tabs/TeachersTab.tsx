import React, { useState } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";
import { TITLE_OPTIONS } from "../../constants";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];

interface Props {
  pid: number;
  teachers: Teacher[];
  onChange: (t: Teacher[]) => void;
  onNext: () => void;
}

function TeachersTab({ pid, teachers, onChange, onNext }: Props) {
  const toast = useToast();
  const list = Array.isArray(teachers) ? teachers : [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const importRef = React.createRef<HTMLInputElement>();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; errors: { row: number; message: string }[] } | null>(null);

  const [fFirst, setFFirst] = useState("");
  const [fLast, setFLast] = useState("");
  const [fCode, setFCode] = useState("");
  const [fTitle, setFTitle] = useState("Mr.");
  const [fColor, setFColor] = useState("#E8725A");
  const [fMaxDay, setFMaxDay] = useState(6);
  const [fMaxWeek, setFMaxWeek] = useState(30);

  function openAdd() {
    setEditTeacher(null);
    setFFirst(""); setFLast(""); setFCode(""); setFTitle("Mr."); setFColor("#E8725A"); setFMaxDay(6); setFMaxWeek(30);
    setModalOpen(true);
  }

  function openEdit(t?: Teacher) {
    const teacher = t || list.find(x => x.id === selectedId);
    if (!teacher) return;
    setEditTeacher(teacher);
    setFFirst(teacher.first_name); setFLast(teacher.last_name); setFCode(teacher.code);
    setFTitle(teacher.title); setFColor(teacher.color || "#E8725A");
    setFMaxDay(teacher.max_periods_day); setFMaxWeek(teacher.max_periods_week);
    setModalOpen(true);
  }

  async function saveTeacher() {
    if (!fFirst.trim()) return;
    const data = { first_name: fFirst.trim(), last_name: fLast.trim(), code: fCode.trim(), title: fTitle, color: fColor, max_periods_day: fMaxDay, max_periods_week: fMaxWeek };
    try {
      if (editTeacher) {
        await api.updateTeacher(pid, editTeacher.id, data);
        onChange(list.map(t => t.id === editTeacher.id ? { ...t, ...data } : t));
        toast("success", "Teacher updated.");
      } else {
        const created = await api.createTeacher(pid, data);
        onChange([...list, { ...created, ...data } as Teacher]);
        toast("success", "Teacher added.");
      }
      setModalOpen(false);
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
  }

  async function deleteSelected() {
    if (selectedId == null) return;
    const name = list.find(t => t.id === selectedId);
    const displayName = name ? `${name.first_name} ${name.last_name}` : "";
    if (!confirm(`Delete teacher "${displayName}"?`)) return;
    try {
      await api.deleteTeacher(pid, selectedId);
      onChange(list.filter(t => t.id !== selectedId));
      setSelectedId(null);
      toast("success", "Teacher deleted.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Delete failed"); }
  }

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

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Teachers</h2>
      <p className="subheading">Add and manage teaching staff.</p>

      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" onClick={openAdd}>+ Add Teacher</button>
        <input type="file" ref={importRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => importRef.current?.click()} disabled={importing}>{importing ? "Importing…" : "Import from Excel"}</button>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("teachers")}>Download Template</button>
        <button type="button" className="btn" onClick={() => openEdit()} disabled={selectedId == null}>Edit</button>
        <button type="button" className="btn btn-danger" onClick={deleteSelected} disabled={selectedId == null}>Delete</button>
      </div>

      {importResult && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          Imported {importResult.success_count} teacher(s).{importResult.errors.length > 0 && ` Errors: ${importResult.errors.map(e => `Row ${e.row}: ${e.message}`).join("; ")}`}
        </div>
      )}

      {list.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No teachers added yet. Add at least one teacher before creating lessons.</p>}
      <table className="data-table">
        <thead><tr><th style={{ width: 40 }}>#</th><th>Name</th><th>Code</th><th>Title</th><th style={{ width: 60 }}>Color</th><th>Max/Day</th><th>Max/Week</th></tr></thead>
        <tbody>
          {list.map((t, i) => (
            <tr key={t.id} className={selectedId === t.id ? "selected" : ""} onClick={() => setSelectedId(t.id)} onDoubleClick={() => openEdit(t)}>
              <td>{i + 1}</td><td>{t.first_name} {t.last_name}</td><td>{t.code}</td><td>{t.title}</td>
              <td><span className="color-swatch" style={{ backgroundColor: t.color || "#E8725A" }} /></td>
              <td>{t.max_periods_day}</td><td>{t.max_periods_week}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Lessons →</button>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
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
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveTeacher}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// React.memo prevents re-renders when ProjectEditor re-fetches unrelated data (e.g. rooms, subjects)
export default React.memo(TeachersTab);
