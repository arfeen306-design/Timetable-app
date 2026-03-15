import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DUTY_TYPES = ["Gate", "Canteen", "Library", "Hall", "Break", "Corridor", "Other"];

const DUTY_COLORS: Record<string, string> = {
  Gate:     "#e74c3c",
  Canteen:  "#f39c12",
  Library:  "#8e44ad",
  Hall:     "#2980b9",
  Break:    "#27ae60",
  Corridor: "#16a085",
  Other:    "#7f8c8d",
};

function dutyColor(type: string): string {
  return DUTY_COLORS[type] ?? "#7f8c8d";
}

interface DrawerState {
  day:    number;
  period: number;
  entry?: api.DutyEntry;
}

export default function DutyRosterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid     = Number(projectId);
  const toast   = useToast();

  const [loading,  setLoading]  = useState(true);
  const [days,     setDays]     = useState(5);
  const [periods,  setPeriods]  = useState(8);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [entries,  setEntries]  = useState<api.DutyEntry[]>([]);

  // Drawer / modal state
  const [drawer,   setDrawer]   = useState<DrawerState | null>(null);
  const [fTeacher, setFTeacher] = useState<number | "">("");
  const [fType,    setFType]    = useState(DUTY_TYPES[0]);
  const [fNotes,   setFNotes]   = useState("");
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [settings, tList, eList] = await Promise.all([
        api.getSchoolSettings(pid),
        api.listTeachers(pid),
        api.listDutyRoster(pid),
      ]);
      setDays(settings.days_per_week || 5);
      setPeriods(settings.periods_per_day || 8);
      setTeachers(tList);
      setEntries(eList);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to load duty roster");
    } finally {
      setLoading(false);
    }
  }, [pid, toast]);

  useEffect(() => { load(); }, [load]);

  // Build a fast cell lookup: "day-period" → entry
  const cellMap = new Map<string, api.DutyEntry>();
  for (const e of entries) {
    cellMap.set(`${e.day_of_week}-${e.period_index}`, e);
  }

  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  function openCell(day: number, period: number) {
    const entry = cellMap.get(`${day}-${period}`);
    setDrawer({ day, period, entry });
    if (entry) {
      setFTeacher(entry.teacher_id);
      setFType(entry.duty_type);
      setFNotes(entry.notes || "");
    } else {
      setFTeacher("");
      setFType(DUTY_TYPES[0]);
      setFNotes("");
    }
  }

  async function handleSave() {
    if (!drawer || fTeacher === "") return;
    setSaving(true);
    try {
      if (drawer.entry) {
        const updated = await api.updateDutyEntry(pid, drawer.entry.id, {
          teacher_id: fTeacher as number,
          duty_type:  fType,
          notes:      fNotes.trim() || undefined,
        });
        setEntries(prev => prev.map(e => e.id === drawer.entry!.id ? updated : e));
        toast("success", "Duty updated.");
      } else {
        const created = await api.createDutyEntry(pid, {
          teacher_id:   fTeacher as number,
          duty_type:    fType,
          day_of_week:  drawer.day,
          period_index: drawer.period,
          notes:        fNotes.trim() || undefined,
        });
        setEntries(prev => [...prev, created]);
        toast("success", "Duty assigned.");
      }
      setDrawer(null);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!drawer?.entry) return;
    setSaving(true);
    try {
      await api.deleteDutyEntry(pid, drawer.entry.id);
      setEntries(prev => prev.filter(e => e.id !== drawer.entry!.id));
      toast("success", "Duty removed.");
      setDrawer(null);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card"><p className="subheading">Loading…</p></div>;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Duty Roster</h2>
      <p className="subheading">Assign teacher duties per period. Click any cell to assign or edit.</p>

      {/* Grid */}
      <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
        <table className="data-table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ width: 64, textAlign: "center" }}>Period</th>
              {Array.from({ length: days }, (_, d) => (
                <th key={d} style={{ textAlign: "center" }}>{DAY_NAMES[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periods }, (_, p) => (
              <tr key={p}>
                <td style={{ fontWeight: 700, color: "#64748b", fontSize: "0.78rem", textAlign: "center" }}>
                  P{p + 1}
                </td>
                {Array.from({ length: days }, (_, d) => {
                  const entry   = cellMap.get(`${d}-${p}`);
                  const teacher = entry ? teacherMap.get(entry.teacher_id) : null;
                  return (
                    <td
                      key={d}
                      style={{ padding: "5px 6px", textAlign: "center", verticalAlign: "middle", cursor: "pointer" }}
                      onClick={() => openCell(d, p)}
                    >
                      {entry && teacher ? (
                        <span
                          title={`${teacher.first_name} ${teacher.last_name} — ${entry.duty_type}${entry.notes ? "\n" + entry.notes : ""}`}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            background: dutyColor(entry.duty_type), color: "#fff",
                            borderRadius: 6, padding: "3px 7px",
                            fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", userSelect: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {teacher.code || (teacher.first_name[0] + (teacher.last_name?.[0] ?? "")).toUpperCase()}
                          <span style={{ opacity: 0.85, fontWeight: 400, fontSize: "0.65rem" }}>{entry.duty_type}</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 26, height: 26, borderRadius: 6,
                            border: "1.5px dashed rgba(99,102,241,0.25)",
                            color: "rgba(99,102,241,0.35)", fontSize: "0.95rem", cursor: "pointer",
                          }}
                        >+</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Duty-type legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "1.25rem" }}>
        {DUTY_TYPES.map(t => (
          <span
            key={t}
            style={{
              display: "inline-flex", alignItems: "center",
              fontSize: "0.68rem", fontWeight: 700, color: "#fff",
              background: dutyColor(t), borderRadius: 5, padding: "2px 8px",
            }}
          >{t}</span>
        ))}
      </div>

      {/* Assign / Edit drawer (modal) */}
      {drawer && (
        <div className="modal-overlay" onClick={() => !saving && setDrawer(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {drawer.entry ? "Edit Duty" : "Assign Duty"}
              <span style={{ marginLeft: 8, fontSize: "0.8rem", fontWeight: 400, color: "#64748b" }}>
                {DAY_NAMES[drawer.day]} · Period {drawer.period + 1}
              </span>
            </h3>

            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Teacher:</label>
                <select value={fTeacher} onChange={e => setFTeacher(Number(e.target.value))} autoFocus>
                  <option value="">— select teacher —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label required">Duty Type:</label>
                <select value={fType} onChange={e => setFType(e.target.value)}>
                  {DUTY_TYPES.map(dt => <option key={dt}>{dt}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Notes:</label>
                <input
                  value={fNotes}
                  onChange={e => setFNotes(e.target.value)}
                  placeholder="Optional notes…"
                />
              </div>
            </div>

            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <div>
                {drawer.entry && (
                  <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                    {saving ? "…" : "Remove"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn" onClick={() => setDrawer(null)} disabled={saving}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || fTeacher === ""}
                >
                  {saving ? "Saving…" : drawer.entry ? "Update" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
