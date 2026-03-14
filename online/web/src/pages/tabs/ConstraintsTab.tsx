import { useState } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";

type Constraint = Awaited<ReturnType<typeof api.listConstraints>>[0];
type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type SchoolClass = Awaited<ReturnType<typeof api.listClasses>>[0];
import type { Room } from "../../api";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Props {
  pid: number;
  constraints: Constraint[];
  teachers: Teacher[];
  classes: SchoolClass[];
  rooms: Room[];
  settings: { days_per_week: number; periods_per_day: number } | null;
  onChange: (c: Constraint[]) => void;
  onNext: () => void;
}

export default function ConstraintsTab({ pid, constraints, teachers, classes, rooms, settings, onChange, onNext }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [fType, setFType] = useState<"teacher" | "class" | "room">("teacher");
  const [fEntityId, setFEntityId] = useState(0);
  const [fDay, setFDay] = useState(0);
  const [fPeriod, setFPeriod] = useState(0);
  const [saving, setSaving] = useState(false);

  const days = settings?.days_per_week ?? 5;
  const periods = settings?.periods_per_day ?? 7;

  const entities = fType === "teacher" ? teachers.map(t => ({ id: t.id, label: `${t.first_name} ${t.last_name}` }))
    : fType === "class" ? classes.map(c => ({ id: c.id, label: c.name }))
    : rooms.map(r => ({ id: r.id, label: r.name }));

  function nameEntity(c: Constraint) {
    if (c.entity_type === "teacher") { const t = teachers.find(x => x.id === c.entity_id); return t ? `${t.first_name} ${t.last_name}` : `#${c.entity_id}`; }
    if (c.entity_type === "class") return classes.find(x => x.id === c.entity_id)?.name ?? `#${c.entity_id}`;
    return rooms.find(r => r.id === c.entity_id)?.name ?? `#${c.entity_id}`;
  }

  function openAdd() {
    setFType("teacher"); setFEntityId(0); setFDay(0); setFPeriod(0);
    setModalOpen(true);
  }

  async function addConstraint() {
    if (!fEntityId) return;
    setSaving(true);
    try {
      const c = await api.createConstraint(pid, { entity_type: fType, entity_id: fEntityId, day_index: fDay, period_index: fPeriod, is_hard: true });
      onChange([...constraints, { id: c.id, entity_type: fType, entity_id: fEntityId, day_index: fDay, period_index: fPeriod } as Constraint]);
      setModalOpen(false);
      toast("success", "Constraint added.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function deleteSelected() {
    if (selectedId == null) return;
    if (!confirm("Delete this constraint?")) return;
    try {
      await api.deleteConstraint(pid, selectedId);
      onChange(constraints.filter(c => c.id !== selectedId));
      setSelectedId(null);
      toast("success", "Constraint deleted.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Delete failed"); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Constraints (Unavailability)</h2>
      <p className="subheading">Specify when teachers, classes, or rooms are unavailable.</p>

      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" onClick={openAdd}>+ Add Constraint</button>
        <button type="button" className="btn btn-danger" onClick={deleteSelected} disabled={selectedId == null}>Delete</button>
      </div>

      {constraints.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No constraints added yet. The solver will have full freedom to place lessons.</p>}
      <table className="data-table">
        <thead><tr><th style={{ width: 40 }}>#</th><th>Type</th><th>Entity</th><th>Day</th><th>Period</th></tr></thead>
        <tbody>
          {constraints.map((c, i) => (
            <tr key={c.id} className={selectedId === c.id ? "selected" : ""} onClick={() => setSelectedId(c.id)}>
              <td>{i + 1}</td>
              <td style={{ textTransform: "capitalize" }}>{c.entity_type}</td>
              <td>{nameEntity(c)}</td>
              <td>{DAY_NAMES[c.day_index] ?? c.day_index}</td>
              <td>Period {c.period_index + 1}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Generate →</button>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Constraint</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label">Type:</label>
                <select value={fType} onChange={e => { setFType(e.target.value as "teacher" | "class" | "room"); setFEntityId(0); }}>
                  <option value="teacher">Teacher</option>
                  <option value="class">Class</option>
                  <option value="room">Room</option>
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label required">Entity:</label>
                <select value={fEntityId} onChange={e => setFEntityId(Number(e.target.value))}>
                  <option value={0}>Select…</option>
                  {entities.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Day:</label>
                <select value={fDay} onChange={e => setFDay(Number(e.target.value))}>
                  {Array.from({ length: days }, (_, i) => <option key={i} value={i}>{DAY_NAMES[i] ?? `Day ${i}`}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Period:</label>
                <select value={fPeriod} onChange={e => setFPeriod(Number(e.target.value))}>
                  {Array.from({ length: periods }, (_, i) => <option key={i} value={i}>Period {i + 1}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={addConstraint} disabled={saving}>{saving ? "Saving…" : "OK"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
