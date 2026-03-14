import { useState } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";

type Lesson = Awaited<ReturnType<typeof api.listLessons>>[0];
type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type SchoolClass = Awaited<ReturnType<typeof api.listClasses>>[0];
import type { Subject } from "../../api";

interface Props {
  pid: number;
  lessons: Lesson[];
  subjects: Subject[];
  classes: SchoolClass[];
  teachers: Teacher[];
  onChange: (l: Lesson[]) => void;
  onNext: () => void;
}

export default function LessonsTab({ pid, lessons, subjects, classes, teachers, onChange, onNext }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  /* Single lesson form */
  const [fTeacher, setFTeacher] = useState(0);
  const [fSubject, setFSubject] = useState(0);
  const [fClass, setFClass] = useState(0);
  const [fPeriods, setFPeriods] = useState(1);
  const [saving, setSaving] = useState(false);

  /* Bulk assign */
  const [bulkTeacher, setBulkTeacher] = useState(0);
  const [bulkSubject, setBulkSubject] = useState(0);
  const [bulkPeriods, setBulkPeriods] = useState<Record<number, number>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  /* Copy from class */
  const [copySource, setCopySource] = useState(0);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);
  const [copySaving, setCopySaving] = useState(false);

  function nameTeacher(id: number) { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name}` : `#${id}`; }
  function nameSubject(id: number) { return subjects.find(x => x.id === id)?.name ?? `#${id}`; }
  function nameClass(id: number) { return classes.find(x => x.id === id)?.name ?? `#${id}`; }

  const totalPeriods = lessons.reduce((s, l) => s + l.periods_per_week, 0);

  /* Check prerequisites */
  const missing: string[] = [];
  if (teachers.length === 0) missing.push("Teachers");
  if (subjects.length === 0) missing.push("Subjects");
  if (classes.length === 0) missing.push("Classes");

  function openAddModal() {
    setFTeacher(0); setFSubject(0); setFClass(0); setFPeriods(1);
    setModalOpen(true);
  }

  async function addLesson() {
    if (!fTeacher || !fSubject || !fClass) return;
    setSaving(true);
    try {
      const l = await api.createLesson(pid, { teacher_id: fTeacher, subject_id: fSubject, class_id: fClass, periods_per_week: fPeriods });
      onChange([...lessons, { id: l.id, teacher_id: fTeacher, subject_id: fSubject, class_id: fClass, periods_per_week: fPeriods } as Lesson]);
      setModalOpen(false);
      toast("success", "Lesson added.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function deleteSelected() {
    if (selectedId == null) return;
    if (!confirm("Delete this lesson assignment?")) return;
    try {
      await api.deleteLesson(pid, selectedId);
      onChange(lessons.filter(l => l.id !== selectedId));
      setSelectedId(null);
      toast("success", "Lesson deleted.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Delete failed"); }
  }

  async function doBulkAssign() {
    if (!bulkTeacher || !bulkSubject) return;
    const selected = classes.map(c => c.id).filter(id => (bulkPeriods[id] ?? 0) > 0);
    if (selected.length === 0) { toast("info", "Select at least one class and set periods."); return; }
    setBulkSaving(true);
    try {
      const res = await api.bulkCreateLessons(pid, {
        teacher_id: bulkTeacher, subject_id: bulkSubject,
        classes: selected.map(class_id => ({ class_id, periods_per_week: bulkPeriods[class_id] ?? 1 })),
      });
      if (res.created > 0) { const list = await api.listLessons(pid); onChange(list); setBulkOpen(false); toast("success", `Created ${res.created} lesson(s).`); }
      if (res.errors.length > 0) toast("error", "Some rows failed: " + res.errors.map(e => e.message).join("; "));
    } catch (err) { toast("error", err instanceof Error ? err.message : "Bulk assign failed"); }
    finally { setBulkSaving(false); }
  }

  async function doCopy() {
    if (!copySource || copyTargets.length === 0) return;
    setCopySaving(true);
    try {
      const res = await api.copyLessonsFromClass(pid, copySource, copyTargets);
      if (res.copied > 0) { const list = await api.listLessons(pid); onChange(list); setCopyOpen(false); toast("success", `Copied ${res.copied} lesson(s).`); }
    } catch (err) { toast("error", err instanceof Error ? err.message : "Copy failed"); }
    finally { setCopySaving(false); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Lesson Assignments</h2>
      <p className="subheading">Assign teachers to subjects and classes with weekly period counts.</p>

      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn" onClick={openAddModal}>+ Add Single Lesson</button>
        <button type="button" className="btn btn-primary" onClick={() => { setBulkTeacher(0); setBulkSubject(0); setBulkPeriods({}); setBulkOpen(true); }}>+ Bulk Assign (1 Teacher → Many Classes)</button>
        <button type="button" className="btn" onClick={() => { setCopySource(0); setCopyTargets([]); setCopyOpen(true); }}>Copy from Class</button>
        <button type="button" className="btn btn-danger" onClick={deleteSelected} disabled={selectedId == null}>Delete</button>
        <span style={{ marginLeft: "auto", color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>{lessons.length} lessons, {totalPeriods} total periods/week</span>
      </div>

      {missing.length > 0 && (
        <div className="warning-banner">⚠ You must add {missing.join(", ")} before creating lessons. Go back and fill those tabs first.</div>
      )}

      {lessons.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No lessons added yet.</p>}
      <table className="data-table">
        <thead><tr><th style={{ width: 40 }}>#</th><th>Teacher</th><th>Subject</th><th>Class</th><th>Periods/Week</th></tr></thead>
        <tbody>
          {lessons.map((l, i) => (
            <tr key={l.id} className={selectedId === l.id ? "selected" : ""} onClick={() => setSelectedId(l.id)}>
              <td>{i + 1}</td><td>{nameTeacher(l.teacher_id)}</td><td>{nameSubject(l.subject_id)}</td><td>{nameClass(l.class_id)}</td><td>{l.periods_per_week}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Constraints →</button>
      </div>

      {/* Add Single Lesson Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Lesson</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Teacher:</label>
                <select value={fTeacher} onChange={e => setFTeacher(Number(e.target.value))}>
                  <option value={0}>Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label required">Subject:</label>
                <select value={fSubject} onChange={e => setFSubject(Number(e.target.value))}>
                  <option value={0}>Select subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label required">Class:</label>
                <select value={fClass} onChange={e => setFClass(Number(e.target.value))}>
                  <option value={0}>Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="modal-field"><label className="modal-label">Periods/Week:</label><input type="number" min={1} value={fPeriods} onChange={e => setFPeriods(Number(e.target.value))} style={{ width: 80 }} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={addLesson} disabled={saving}>{saving ? "Saving…" : "OK"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {bulkOpen && (
        <div className="modal-overlay" onClick={() => setBulkOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ marginTop: 0 }}>Bulk Assign</h3>
            <p className="subheading">Assign one teacher and one subject to multiple classes. Set periods per week for each class.</p>
            <div className="modal-form">
              <div className="modal-field"><label className="modal-label">Teacher:</label>
                <select value={bulkTeacher} onChange={e => setBulkTeacher(Number(e.target.value))} style={{ maxWidth: "100%" }}>
                  <option value={0}>Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div className="modal-field"><label className="modal-label">Subject:</label>
                <select value={bulkSubject} onChange={e => setBulkSubject(Number(e.target.value))} style={{ maxWidth: "100%" }}>
                  <option value={0}>Select subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <table className="data-table" style={{ marginTop: "0.75rem" }}>
              <thead><tr><th>Class</th><th>Periods / Week</th></tr></thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c.id}><td>{c.name}</td>
                    <td><input type="number" min={0} value={bulkPeriods[c.id] ?? 0} onChange={e => setBulkPeriods(prev => ({ ...prev, [c.id]: Number(e.target.value) || 0 }))} style={{ width: 80 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setBulkOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={doBulkAssign} disabled={bulkSaving}>{bulkSaving ? "Creating…" : "Create Lessons"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Copy from Class Modal */}
      {copyOpen && (
        <div className="modal-overlay" onClick={() => setCopyOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>Copy from Class</h3>
            <p className="subheading">Copy all lesson assignments from one class to other classes.</p>
            <div className="modal-form">
              <div className="modal-field"><label className="modal-label">Copy from:</label>
                <select value={copySource} onChange={e => setCopySource(Number(e.target.value))} style={{ maxWidth: "100%" }}>
                  <option value={0}>Select source class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label className="modal-label" style={{ display: "block", marginBottom: 4 }}>To classes (select one or more):</label>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                {classes.filter(c => c.id !== copySource).map(c => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={copyTargets.includes(c.id)} onChange={() => setCopyTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} style={{ width: "auto" }} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setCopyOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={doCopy} disabled={copySaving || !copySource || copyTargets.length === 0}>{copySaving ? "Copying…" : "Copy"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
