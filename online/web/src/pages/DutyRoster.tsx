import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];

const DAY_NAMES  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DUTY_TYPES = ["Gate", "Canteen", "Library", "Hall", "Break", "Corridor", "Other"];

/** Map duty type → CSS class (defined in index.css, use token vars) */
function chipClass(type: string): string {
  const key = type.toLowerCase();
  if (DUTY_TYPES.map(d => d.toLowerCase()).includes(key)) return `duty-chip duty-chip-${key}`;
  return "duty-chip duty-chip-other";
}

/** Teacher initials from code or first/last name */
function initials(t: Teacher): string {
  return t.code || (t.first_name[0] + (t.last_name?.[0] ?? "")).toUpperCase();
}

interface ActiveEntry {
  entry: api.DutyEntry;
  teacher: Teacher;
}

export default function DutyRosterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid   = Number(projectId);
  const toast = useToast();

  const [loading,  setLoading]  = useState(true);
  const [days,     setDays]     = useState(5);
  const [periods,  setPeriods]  = useState(8);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [entries,  setEntries]  = useState<api.DutyEntry[]>([]);

  // Assign-new modal state
  const [assignSlot, setAssignSlot] = useState<{ day: number; period: number } | null>(null);
  const [aTeacher,   setATeacher]   = useState<number | "">("");
  const [aType,      setAType]      = useState(DUTY_TYPES[0]);
  const [aNotes,     setANotes]     = useState("");
  const [aError,     setAError]     = useState("");
  const [aSaving,    setASaving]    = useState(false);

  // Inline edit strip (below grid)
  const [active, setActive]    = useState<ActiveEntry | null>(null);
  const [eTeacher, setETeacher] = useState<number>(0);
  const [eType,    setEType]    = useState(DUTY_TYPES[0]);
  const [eNotes,   setENotes]   = useState("");
  const [eError,   setEError]   = useState("");
  const [eSaving,  setESaving]  = useState(false);

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

  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  // Fast lookup: "day-period" → entry
  const cellMap = new Map<string, api.DutyEntry>();
  for (const e of entries) cellMap.set(`${e.day_of_week}-${e.period_index}`, e);

  // ── Assign new entry ───────────────────────────────────────────────────────

  function openAssign(day: number, period: number) {
    setAssignSlot({ day, period });
    setATeacher(""); setAType(DUTY_TYPES[0]); setANotes(""); setAError("");
  }

  async function handleAssign() {
    if (!assignSlot || aTeacher === "") return;
    // Frontend conflict guard — check locally before API round-trip
    const conflict = entries.some(
      e => e.day_of_week === assignSlot.day
        && e.period_index === assignSlot.period
        && e.teacher_id  === (aTeacher as number)
    );
    if (conflict) {
      setAError("This teacher already has a duty in this slot.");
      return;
    }
    setAError(""); setASaving(true);
    try {
      const created = await api.createDutyEntry(pid, {
        teacher_id:   aTeacher as number,
        duty_type:    aType,
        day_of_week:  assignSlot.day,
        period_index: assignSlot.period,
        notes:        aNotes.trim() || undefined,
      });
      setEntries(prev => [...prev, created]);
      toast("success", "Duty assigned.");
      setAssignSlot(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Assign failed";
      if (msg.includes("409") || msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("already")) {
        setAError("This teacher already has a duty in this slot.");
      } else {
        setAError(msg);
      }
    } finally {
      setASaving(false);
    }
  }

  // ── Inline edit strip ──────────────────────────────────────────────────────

  function openEdit(entry: api.DutyEntry) {
    const teacher = teacherMap.get(entry.teacher_id);
    if (!teacher) return;
    setActive({ entry, teacher });
    setETeacher(entry.teacher_id);
    setEType(entry.duty_type);
    setENotes(entry.notes || "");
    setEError("");
  }

  async function handleUpdate() {
    if (!active) return;
    // Frontend conflict guard for update
    const conflict = entries.some(
      e => e.id        !== active.entry.id
        && e.day_of_week  === active.entry.day_of_week
        && e.period_index === active.entry.period_index
        && e.teacher_id   === eTeacher
    );
    if (conflict) { setEError("This teacher already has a duty in this slot."); return; }
    setEError(""); setESaving(true);
    try {
      const updated = await api.updateDutyEntry(pid, active.entry.id, {
        teacher_id: eTeacher,
        duty_type:  eType,
        notes:      eNotes.trim() || undefined,
      });
      setEntries(prev => prev.map(e => e.id === active.entry.id ? updated : e));
      toast("success", "Duty updated.");
      setActive(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      setEError(msg.toLowerCase().includes("conflict") || msg.includes("409") ? "Conflict — this teacher already has a duty in this slot." : msg);
    } finally {
      setESaving(false);
    }
  }

  async function handleRemove() {
    if (!active) return;
    setESaving(true);
    try {
      await api.deleteDutyEntry(pid, active.entry.id);
      setEntries(prev => prev.filter(e => e.id !== active.entry.id));
      toast("success", "Duty removed.");
      setActive(null);
    } catch (err) {
      setEError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setESaving(false);
    }
  }

  if (loading) return <div className="card"><p className="subheading">Loading…</p></div>;

  return (
    <div className="card">
      {/* ── Page header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Duty Roster</h2>
          <p className="subheading" style={{ margin: 0 }}>Click an empty cell to assign a duty. Click a chip to edit or remove.</p>
        </div>
        <button
          type="button" className="btn"
          style={{ fontSize: "0.78rem" }}
          onClick={() => window.open(`/api/projects/${pid}/duty-roster/export-pdf`, "_blank")}
        >📄 Export PDF</button>
      </div>

      {/* ── Grid ── */}
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ width: 58, textAlign: "center", fontSize: "0.72rem" }}>Period</th>
              {Array.from({ length: days }, (_, d) => (
                <th key={d} style={{ textAlign: "center", fontSize: "0.8rem" }}>{DAY_NAMES[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periods }, (_, p) => (
              <tr key={p}>
                <td style={{ fontWeight: 700, color: "var(--slate-500)", fontSize: "0.75rem", textAlign: "center" }}>P{p + 1}</td>
                {Array.from({ length: days }, (_, d) => {
                  const entry   = cellMap.get(`${d}-${p}`);
                  const teacher = entry ? teacherMap.get(entry.teacher_id) : null;
                  const isActive = active?.entry.id === entry?.id;
                  return (
                    <td
                      key={d}
                      style={{ padding: "5px 6px", textAlign: "center", verticalAlign: "middle" }}
                    >
                      {entry && teacher ? (
                        <span
                          className={`${chipClass(entry.duty_type)}${isActive ? " chip-removing" : ""}`}
                          title={`${teacher.first_name} ${teacher.last_name} — ${entry.duty_type}${entry.notes ? "\n" + entry.notes : ""}`}
                          style={isActive ? { outline: "2px solid var(--primary-400)", outlineOffset: 1 } : {}}
                          onClick={() => isActive ? setActive(null) : openEdit(entry)}
                        >
                          {initials(teacher)}
                          <span style={{ opacity: 0.8, fontWeight: 400, fontSize: "0.62rem" }}>{entry.duty_type}</span>
                        </span>
                      ) : (
                        <span className="duty-chip-empty" onClick={() => openAssign(d, p)}>+</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Inline edit strip ── */}
      {active && (
        <div className="duty-edit-strip">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.88rem" }}>
              {DAY_NAMES[active.entry.day_of_week]} · P{active.entry.period_index + 1}
            </strong>

            <select
              value={eTeacher}
              onChange={e => { setETeacher(Number(e.target.value)); setEError(""); }}
              style={{ fontSize: "0.8rem" }}
            >
              {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.code})</option>)}
            </select>

            <select value={eType} onChange={e => setEType(e.target.value)} style={{ fontSize: "0.8rem" }}>
              {DUTY_TYPES.map(dt => <option key={dt}>{dt}</option>)}
            </select>

            <input
              value={eNotes}
              onChange={e => setENotes(e.target.value)}
              placeholder="Notes (optional)"
              style={{ fontSize: "0.8rem", minWidth: 130 }}
            />

            <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto" }}>
              <button type="button" className="btn btn-danger" style={{ fontSize: "0.75rem" }} onClick={handleRemove} disabled={eSaving}>
                {eSaving ? "…" : "Remove Duty"}
              </button>
              <button type="button" className="btn btn-primary" style={{ fontSize: "0.75rem" }} onClick={handleUpdate} disabled={eSaving}>
                {eSaving ? "Saving…" : "Update"}
              </button>
              <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={() => setActive(null)} disabled={eSaving}>
                Close
              </button>
            </div>
          </div>
          {eError && <p style={{ color: "var(--danger-600)", fontSize: "0.78rem", margin: "0.4rem 0 0" }}>{eError}</p>}
        </div>
      )}

      {/* ── Duty-type legend ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "1.1rem" }}>
        {DUTY_TYPES.map(t => (
          <span key={t} className={chipClass(t)} style={{ cursor: "default" }}>{t}</span>
        ))}
      </div>

      {/* ── Assign modal ── */}
      {assignSlot && (
        <div className="modal-overlay" onClick={() => !aSaving && setAssignSlot(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Assign Duty
              <span style={{ marginLeft: 8, fontSize: "0.8rem", fontWeight: 400, color: "var(--slate-500)" }}>
                {DAY_NAMES[assignSlot.day]} · Period {assignSlot.period + 1}
              </span>
            </h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Teacher:</label>
                <select value={aTeacher} onChange={e => { setATeacher(Number(e.target.value)); setAError(""); }} autoFocus>
                  <option value="">— select teacher —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.code})</option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label required">Duty Type:</label>
                <select value={aType} onChange={e => setAType(e.target.value)}>
                  {DUTY_TYPES.map(dt => <option key={dt}>{dt}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Notes:</label>
                <input value={aNotes} onChange={e => setANotes(e.target.value)} placeholder="Optional notes…" />
              </div>
              {aError && <p style={{ color: "var(--danger-600)", fontSize: "0.8rem", margin: "0.25rem 0 0 164px" }}>{aError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setAssignSlot(null)} disabled={aSaving}>Cancel</button>
              <button
                type="button" className="btn btn-primary"
                onClick={handleAssign}
                disabled={aSaving || aTeacher === ""}
              >
                {aSaving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
