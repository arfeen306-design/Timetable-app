import React, { useState } from "react";
import * as api from "../../api";
import type { SchoolClass, Room } from "../../api";
import { useToast } from "../../context/ToastContext";
import BulkDeleteModal from "../../components/BulkDeleteModal";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];

interface Props {
  pid: number;
  classes: SchoolClass[];
  teachers: Teacher[];
  rooms: Room[];
  onChange: (c: SchoolClass[]) => void;
  onNext: () => void;
}

function ClassesTab({ pid, classes, teachers, rooms, onChange, onNext }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editClass, setEditClass] = useState<SchoolClass | null>(null);
  const importRef = React.createRef<HTMLInputElement>();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; errors: { row: number; message: string }[] } | null>(null);

  /* Form state */
  const [fGrade, setFGrade] = useState("");
  const [fSection, setFSection] = useState("");
  const [fStream, setFStream] = useState("");
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fColor, setFColor] = useState("#50C878");
  const [fStrength, setFStrength] = useState(30);
  const [fTeacherId, setFTeacherId] = useState<number | null>(null);
  const [fRoomId, setFRoomId] = useState<number | null>(null);

  function toggleCheck(id: number, e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    setCheckedIds(e.target.checked ? new Set(classes.map(c => c.id)) : new Set());
  }

  /* ── Auto-generate display name and code from grade/section/stream ── */
  function autoName(grade: string, section: string, stream: string): string {
    const parts = [`Grade ${grade.trim()}`];
    if (section.trim()) parts.push(section.trim());
    if (stream.trim()) parts.push(stream.trim());
    return parts.join(" ");
  }

  function autoCode(grade: string, section: string): string {
    return `${grade.trim()}-${section.trim() || "X"}`.toUpperCase();
  }

  function openAdd() {
    setEditClass(null);
    setFGrade(""); setFSection(""); setFStream(""); setFName(""); setFCode("");
    setFColor("#50C878"); setFStrength(30); setFTeacherId(null); setFRoomId(null);
    setModalOpen(true);
  }

  function openEdit(c?: SchoolClass) {
    const cls = c || classes.find(x => x.id === selectedId);
    if (!cls) return;
    setEditClass(cls);
    setFGrade(cls.grade); setFSection(cls.section); setFStream(cls.stream);
    setFName(cls.name); setFCode(cls.code); setFColor(cls.color || "#50C878");
    setFStrength(cls.strength);
    setFTeacherId(cls.class_teacher_id ?? null);
    setFRoomId(cls.home_room_id ?? null);
    setModalOpen(true);
  }

  async function saveClass() {
    if (!fGrade.trim()) {
      toast("error", "Grade is required.");
      return;
    }

    const displayName = fName.trim() || autoName(fGrade, fSection, fStream);
    const code = fCode.trim() || autoCode(fGrade, fSection);

    const data = {
      grade: fGrade.trim(),
      section: fSection.trim(),
      stream: fStream.trim(),
      name: displayName,
      code,
      color: fColor,
      strength: fStrength,
      class_teacher_id: fTeacherId || null,
      home_room_id: fRoomId || null,
    };

    try {
      if (editClass) {
        const updated = await api.updateClass(pid, editClass.id, data);
        onChange(classes.map(c => c.id === editClass.id ? updated : c));
        toast("success", "Class updated.");
      } else {
        const created = await api.createClass(pid, data);
        onChange([...classes, created]);
        toast("success", "Class added.");
      }
      setModalOpen(false);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteSelected() {
    if (selectedId == null) return;
    const name = classes.find(c => c.id === selectedId)?.name ?? "";
    if (!confirm(`Delete class "${name}"? This will also remove related lessons.`)) return;
    try {
      await api.deleteClass(pid, selectedId);
      onChange(classes.filter(c => c.id !== selectedId));
      setSelectedId(null);
      toast("success", "Class deleted.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleBulkDelete(ids: number[]) {
    const result = await api.bulkDeleteClasses(pid, ids);
    onChange(classes.filter(c => !ids.includes(c.id)));
    setCheckedIds(new Set());
    setBulkDeleteOpen(false);
    const msg = `${result.deleted} class${result.deleted !== 1 ? "es" : ""} deleted.` +
      (result.failed.length > 0 ? ` ${result.failed.length} could not be removed.` : "");
    toast("success", msg);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const res = await api.importClassesExcel(pid, file);
      setImportResult(res);
      if (res.success_count > 0) { const list = await api.listClasses(pid); onChange(list); }
    } catch (err) { toast("error", err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  }

  const allChecked = classes.length > 0 && checkedIds.size === classes.length;
  const someChecked = checkedIds.size > 0 && !allChecked;
  const checkedItems = classes
    .filter(c => checkedIds.has(c.id))
    .map(c => ({ id: c.id, name: c.name }));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Classes &amp; Sections</h2>
      <p className="subheading">Add and manage classes, sections, and streams.</p>

      {/* ── Toolbar ── */}
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" onClick={openAdd}>+ Add Class</button>
        <input type="file" ref={importRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => importRef.current?.click()} disabled={importing}>{importing ? "Importing…" : "Import from Excel"}</button>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("classes")}>Download Template</button>
        <button type="button" className="btn" onClick={() => openEdit()} disabled={selectedId == null}>Edit</button>
        <button type="button" className="btn btn-danger" onClick={deleteSelected} disabled={selectedId == null}>Delete</button>
        {checkedIds.size > 0 && (
          <button type="button" className="btn btn-danger" onClick={() => setBulkDeleteOpen(true)}>
            Delete selected ({checkedIds.size})
          </button>
        )}
      </div>

      {/* ── Import Result ── */}
      {importResult && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          Imported {importResult.success_count} class(es).
          {importResult.errors.length > 0 && ` Errors: ${importResult.errors.map(e => `Row ${e.row}: ${e.message}`).join("; ")}`}
        </div>
      )}

      {/* ── Data Table ── */}
      {classes.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No classes added yet. Import from Excel or add manually.</p>}
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
            <th style={{ width: 40 }}>#</th>
            <th>Name</th><th>Grade</th><th>Section</th><th>Stream</th><th>Code</th>
            <th style={{ width: 60 }}>Color</th><th>Strength</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c, i) => (
            <tr
              key={c.id}
              className={selectedId === c.id ? "selected" : ""}
              onClick={() => setSelectedId(c.id)}
              onDoubleClick={() => openEdit(c)}
            >
              <td onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={checkedIds.has(c.id)} onChange={e => toggleCheck(c.id, e)} />
              </td>
              <td>{i + 1}</td>
              <td>{c.name}</td>
              <td>{c.grade}</td>
              <td>{c.section}</td>
              <td>{c.stream}</td>
              <td>{c.code}</td>
              <td><span className="color-swatch" style={{ backgroundColor: c.color || "#50C878" }} /></td>
              <td>{c.strength}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Footer nav ── */}
      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Classrooms →</button>
      </div>

      {/* ── Add/Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{editClass ? "Edit Class" : "New Class"}</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Grade:</label>
                <input value={fGrade} onChange={e => setFGrade(e.target.value)} placeholder="e.g. 9, 10, 11" autoFocus />
              </div>
              <div className="modal-field">
                <label className="modal-label">Section:</label>
                <input value={fSection} onChange={e => setFSection(e.target.value)} placeholder="e.g. A, B, Science" />
              </div>
              <div className="modal-field">
                <label className="modal-label">Stream:</label>
                <input value={fStream} onChange={e => setFStream(e.target.value)} placeholder="e.g. Science, Co..." />
              </div>
              <div className="modal-field">
                <label className="modal-label">Display Name:</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder={`e.g. ${autoName(fGrade || "9", fSection || "Scie...", "")}`} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Code:</label>
                <input value={fCode} onChange={e => setFCode(e.target.value)} placeholder={`e.g. ${autoCode(fGrade || "9", fSection || "SCI")}`} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Color:</label>
                <input type="color" value={fColor} onChange={e => setFColor(e.target.value)} style={{ width: 48, height: 36, padding: 0, border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer" }} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Student Strength:</label>
                <input type="number" min={1} max={500} value={fStrength} onChange={e => setFStrength(Number(e.target.value))} style={{ width: 80 }} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Class Teacher:</label>
                <select value={fTeacherId ?? 0} onChange={e => setFTeacherId(Number(e.target.value) || null)}>
                  <option value={0}>(None)</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.title} {t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Home Room:</label>
                <select value={fRoomId ?? 0} onChange={e => setFRoomId(Number(e.target.value) || null)}>
                  <option value={0}>(None)</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveClass}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Modal ── */}
      {bulkDeleteOpen && (
        <BulkDeleteModal
          items={checkedItems}
          entityLabel="class"
          onConfirm={handleBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}
    </div>
  );
}

// React.memo prevents re-renders when ProjectEditor re-fetches unrelated data (e.g. teachers list changes)
export default React.memo(ClassesTab);
