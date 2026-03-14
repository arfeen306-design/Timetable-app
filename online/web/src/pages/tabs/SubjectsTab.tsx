import React, { useState } from "react";
import * as api from "../../api";
import type { Subject } from "../../api";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_SUBJECTS, SUBJECT_CATEGORIES, SUBJECT_COLORS, ROOM_TYPES } from "../../constants";

interface Props {
  pid: number;
  subjects: Subject[];
  rooms: Awaited<ReturnType<typeof api.listRooms>>;
  onChange: (s: Subject[]) => void;
  onNext: () => void;
}

export default function SubjectsTab({ pid, subjects, rooms, onChange, onNext }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [importFileRef] = useState(() => React.createRef<HTMLInputElement>());
  const [importing, setImporting] = useState(false);

  /* ── Modal form state ── */
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fCategory, setFCategory] = useState("Core");
  const [fColor, setFColor] = useState<string>(SUBJECT_COLORS[0]);
  const [fMaxPerDay, setFMaxPerDay] = useState(2);
  const [fDouble, setFDouble] = useState(false);
  const [fPrefRoom, setFPrefRoom] = useState("");

  function openAdd() {
    setEditSubject(null);
    setFName(""); setFCode(""); setFCategory("Core"); setFColor(SUBJECT_COLORS[0]);
    setFMaxPerDay(2); setFDouble(false); setFPrefRoom("");
    setModalOpen(true);
  }

  function openEdit(s?: Subject) {
    const sub = s || subjects.find(x => x.id === selectedId);
    if (!sub) return;
    setEditSubject(sub);
    setFName(sub.name); setFCode(sub.code); setFCategory(sub.category);
    setFColor(sub.color); setFMaxPerDay(sub.max_per_day); setFDouble(sub.double_allowed);
    setFPrefRoom(sub.preferred_room_type);
    setModalOpen(true);
  }

  async function saveSubject() {
    if (!fName.trim()) return;
    const data = {
      name: fName.trim(),
      code: fCode.trim() || fName.trim().slice(0, 3).toUpperCase(),
      color: fColor,
      category: fCategory,
      max_per_day: fMaxPerDay,
      double_allowed: fDouble,
      preferred_room_type: fPrefRoom,
    };
    try {
      if (editSubject) {
        const updated = await api.updateSubject(pid, editSubject.id, data);
        onChange(subjects.map(s => s.id === editSubject.id ? updated : s));
        toast("success", "Subject updated.");
      } else {
        const created = await api.createSubject(pid, data);
        onChange([...subjects, created]);
        toast("success", "Subject added.");
      }
      setModalOpen(false);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteSelected() {
    if (selectedId == null) return;
    const name = subjects.find(s => s.id === selectedId)?.name ?? "";
    if (!confirm(`Delete subject "${name}"? This will also remove related lessons.`)) return;
    try {
      await api.deleteSubject(pid, selectedId);
      onChange(subjects.filter(s => s.id !== selectedId));
      setSelectedId(null);
      toast("success", "Subject deleted.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  /* ── Import from Excel ── */
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      // Use generic upload — backend may or may not support subject Excel import yet
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("timetable_token");
      const res = await fetch(`/api/projects/${pid}/subjects/import-excel`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        toast("success", `Imported ${data.success_count ?? data.created ?? 0} subject(s).`);
        const list = await api.listSubjects(pid);
        onChange(list);
      } else {
        toast("error", "Import failed. Check file format.");
      }
    } catch { toast("error", "Import failed."); }
    finally { setImporting(false); e.target.value = ""; }
  }

  /* ── Download template ── */
  function downloadTemplate() {
    // Create a simple template CSV/XLSX download
    try { api.downloadTemplate("classes" as "classes"); } catch { /* no-op */ }
    toast("info", "Template download started.");
  }

  /* ── Library import state ── */
  const existingCodes = new Set(subjects.map(s => s.code.trim().toUpperCase()));
  const existingNames = new Set(subjects.map(s => s.name.trim().toLowerCase()));
  const [libraryChecked, setLibraryChecked] = useState<Set<number>>(new Set());

  function openLibrary() {
    setLibraryChecked(new Set());
    setLibraryOpen(true);
  }

  async function importFromLibrary() {
    const toAdd = DEFAULT_SUBJECTS.filter((_, i) => libraryChecked.has(i))
      .filter(s => !existingCodes.has(s.code.trim().toUpperCase()) && !existingNames.has(s.name.trim().toLowerCase()));
    if (toAdd.length === 0) { toast("info", "No new subjects to import."); return; }
    let added = 0;
    for (const s of toAdd) {
      try {
        await api.createSubject(pid, { name: s.name, code: s.code, category: s.category, color: s.color, max_per_day: 2 });
        added++;
      } catch { /* skip duplicates */ }
    }
    const list = await api.listSubjects(pid);
    onChange(list);
    setLibraryOpen(false);
    toast("success", `Added ${added} subject(s) from library.`);
  }

  function toggleLibraryAll(checked: boolean) {
    if (checked) {
      const all = new Set<number>();
      DEFAULT_SUBJECTS.forEach((s, i) => {
        const codeKey = s.code.trim().toUpperCase();
        const nameKey = s.name.trim().toLowerCase();
        if (!existingCodes.has(codeKey) && !existingNames.has(nameKey)) all.add(i);
      });
      setLibraryChecked(all);
    } else {
      setLibraryChecked(new Set());
    }
  }

  const roomTypeOptions = Array.from(new Set(rooms.map(r => r.room_type).concat([...ROOM_TYPES])));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Subjects</h2>
      <p className="subheading">Add and manage the subjects taught at your school.</p>

      {/* Toolbar */}
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn" onClick={openAdd}>+ Add Subject</button>
        <button type="button" className="btn btn-primary" onClick={openLibrary}>Import from Library</button>
        <input type="file" ref={importFileRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => importFileRef.current?.click()} disabled={importing}>{importing ? "Importing…" : "Import from Excel"}</button>
        <button type="button" className="btn" onClick={downloadTemplate}>Download Template</button>
        <button type="button" className="btn" onClick={() => openEdit()} disabled={selectedId == null}>Edit</button>
        <button type="button" className="btn btn-danger" onClick={deleteSelected} disabled={selectedId == null}>Delete</button>
      </div>

      {/* Data Table */}
      {subjects.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No subjects added yet. Import from Excel or add manually.</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Name</th><th>Code</th><th>Category</th><th style={{ width: 60 }}>Color</th>
            <th>Max/Day</th><th>Double?</th><th>Pref. Room Type</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s.id} className={selectedId === s.id ? "selected" : ""} onClick={() => setSelectedId(s.id)} onDoubleClick={() => openEdit(s)}>
              <td>{i + 1}</td>
              <td>{s.name}</td><td>{s.code}</td><td>{s.category}</td>
              <td><span className="color-swatch" style={{ backgroundColor: s.color }} /></td>
              <td>{s.max_per_day}</td>
              <td>{s.double_allowed ? "Yes" : "No"}</td>
              <td>{s.preferred_room_type || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer navigation */}
      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Classes →</button>
      </div>

      {/* ── Add/Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{editSubject ? "Edit Subject" : "New Subject"}</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Name:</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g., Mathematics" autoFocus />
              </div>
              <div className="modal-field">
                <label className="modal-label">Code:</label>
                <input value={fCode} onChange={e => setFCode(e.target.value)} placeholder="e.g., MAT (auto-generated if empty)" maxLength={6} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Category:</label>
                <select value={fCategory} onChange={e => setFCategory(e.target.value)}>
                  {SUBJECT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Color:</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 300 }}>
                  {SUBJECT_COLORS.map(c => (
                    <span key={c} onClick={() => setFColor(c)} className="color-swatch-pick" style={{ backgroundColor: c, outline: fColor === c ? "3px solid #1e293b" : "1px solid #e2e8f0", outlineOffset: 1 }} />
                  ))}
                </div>
              </div>
              <div className="modal-field">
                <label className="modal-label">Max Periods/Day:</label>
                <input type="number" min={1} max={10} value={fMaxPerDay} onChange={e => setFMaxPerDay(Number(e.target.value))} style={{ width: 80 }} />
              </div>
              <div className="modal-field">
                <label className="modal-label">&nbsp;</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 400 }}>
                  <input type="checkbox" checked={fDouble} onChange={e => setFDouble(e.target.checked)} style={{ width: "auto" }} />
                  Allow double periods
                </label>
              </div>
              <div className="modal-field">
                <label className="modal-label">Preferred Room Type:</label>
                <select value={fPrefRoom} onChange={e => setFPrefRoom(e.target.value)}>
                  <option value="">(Any)</option>
                  {roomTypeOptions.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveSubject}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import from Library Modal ── */}
      {libraryOpen && (
        <div className="modal-overlay" onClick={() => setLibraryOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>Import from Subject Library</h3>
            <p className="subheading" style={{ marginBottom: "0.75rem" }}>Select subjects to add to your project. You can edit names and codes after import.</p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <button type="button" className="btn" onClick={() => toggleLibraryAll(true)}>Select All</button>
              <button type="button" className="btn" onClick={() => toggleLibraryAll(false)}>Deselect All</button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
              {DEFAULT_SUBJECTS.map((s, i) => {
                const codeKey = s.code.trim().toUpperCase();
                const nameKey = s.name.trim().toLowerCase();
                const already = existingCodes.has(codeKey) || existingNames.has(nameKey);
                return (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: already ? "default" : "pointer", color: already ? "#94a3b8" : undefined }}>
                    <input type="checkbox" disabled={already} checked={libraryChecked.has(i)} onChange={() => {
                      setLibraryChecked(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
                    }} style={{ width: "auto" }} />
                    {s.name} ({s.code}) — {s.category}{already ? " — Already added" : ""}
                  </label>
                );
              })}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setLibraryOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={importFromLibrary}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
