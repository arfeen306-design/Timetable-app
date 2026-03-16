import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

type Teacher    = Awaited<ReturnType<typeof api.listTeachers>>[0];
type Subject    = Awaited<ReturnType<typeof api.listSubjects>>[0];
type Room       = Awaited<ReturnType<typeof api.listRooms>>[0];
type ExamSession = api.ExamSession;
type ExamSlot    = api.ExamSlot;

type Tab = "setup" | "datesheet" | "assignments";

// ── helpers ───────────────────────────────────────────────────────────────────

function badge(txt: string, bg: string, fg: string) {
  return (
    <span style={{
      display: "inline-block", fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px",
      borderRadius: "var(--radius-full)", background: bg, color: fg, whiteSpace: "nowrap",
    }}>{txt}</span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETUP TAB
// ══════════════════════════════════════════════════════════════════════════════

function SetupTab({ pid, teachers }: { pid: number; teachers: Teacher[] }) {
  const toast = useToast();
  const [_cfg,    setCfg]     = useState<api.ExamDutyConfig | null>(null);
  const [rooms,   setRooms]   = useState(10);
  const [dur,     setDur]     = useState(90);
  const [invPR,   setInvPR]   = useState(1);
  const [exempts, setExempts] = useState<number[]>([]);
  const [addExId, setAddExId] = useState<number | "">("");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.getExamDutyConfig(pid).then(c => {
      setCfg(c);
      setRooms(c.total_exam_rooms);
      setDur(c.duty_duration_minutes);
      setInvPR(c.invigilators_per_room);
      setExempts(c.exempt_teacher_ids);
    }).catch(() => {/* no config yet — defaults */});
  }, [pid]);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.saveExamDutyConfig(pid, {
        total_exam_rooms:      rooms,
        duty_duration_minutes: dur,
        invigilators_per_room: invPR,
        exempt_teacher_ids:    exempts,
      });
      setCfg(updated);
      toast("success", "Configuration saved.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addExempt() {
    if (addExId === "" || exempts.includes(addExId as number)) return;
    setExempts(prev => [...prev, addExId as number]);
    setAddExId("");
  }

  const nonExemptTeachers = teachers.filter(t => !exempts.includes(t.id));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      {/* Config column */}
      <div className="card" style={{ margin: 0 }}>
        <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.9rem", color: "var(--slate-700)" }}>EXAM CONFIGURATION</h4>
        {(["Total exam rooms", "Invigilators / room", "Duty duration (min)"] as const).map((label, i) => {
          const [val, setter] = [
            [rooms, setRooms], [invPR, setInvPR], [dur, setDur],
          ][i] as [number, React.Dispatch<React.SetStateAction<number>>];
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <label style={{ flex: 1, fontSize: "0.82rem", color: "var(--slate-600)" }}>{label}</label>
              <input
                type="number" min={1} value={val}
                onChange={e => setter(Number(e.target.value))}
                style={{ width: 70, textAlign: "center", fontSize: "0.85rem" }}
              />
            </div>
          );
        })}
        <button type="button" className="btn btn-primary" style={{ marginTop: "0.5rem", fontSize: "0.82rem" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      {/* Exempted teachers column */}
      <div className="card" style={{ margin: 0 }}>
        <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.9rem", color: "var(--slate-700)" }}>EXEMPTED TEACHERS</h4>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <select value={addExId} onChange={e => setAddExId(Number(e.target.value))} style={{ flex: 1, fontSize: "0.82rem" }}>
            <option value="">— add exempt teacher —</option>
            {nonExemptTeachers.map(t => (
              <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
            ))}
          </select>
          <button type="button" className="btn" style={{ fontSize: "0.8rem" }} onClick={addExempt} disabled={addExId === ""}>Add</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {exempts.length === 0 && <p style={{ color: "var(--slate-400)", fontSize: "0.8rem", margin: 0 }}>No exemptions set.</p>}
          {exempts.map(id => {
            const t = teachers.find(x => x.id === id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                <span style={{ flex: 1 }}>{t ? `${t.first_name} ${t.last_name}` : `Teacher #${id}`}</span>
                <button type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-400)", fontSize: "0.9rem", padding: "2px 4px" }}
                  onClick={() => setExempts(prev => prev.filter(x => x !== id))}>✕</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DATE SHEET TAB
// ══════════════════════════════════════════════════════════════════════════════

function DateSheetTab({
  pid, sessions, subjects, rooms,
  onCreated, onDeleted,
}: {
  pid: number;
  sessions: ExamSession[];
  subjects: Subject[];
  rooms: Room[];
  onCreated: (s: ExamSession) => void;
  onDeleted: (id: number) => void;
}) {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [fSubject,  setFSubject]  = useState<number | "">("");
  const [fDate,     setFDate]     = useState("");
  const [fStart,    setFStart]    = useState("09:00");
  const [fEnd,      setFEnd]      = useState("12:00");
  const [fRooms,    setFRooms]    = useState<number[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  // Which subject teacher would be excluded
  const subjectTeacherNote = fSubject !== "" ? `Subject: ${subjects.find(s => s.id === fSubject)?.name ?? ""}` : "";

  async function create() {
    if (fSubject === "" || !fDate || !fStart || !fEnd) {
      setFormError("Subject, date, start and end time are required.");
      return;
    }
    if (fEnd <= fStart) { setFormError("End time must be after start time."); return; }
    setFormError(""); setSaving(true);
    try {
      const created = await api.createExamSession(pid, {
        subject_id: fSubject as number, date: fDate,
        start_time: fStart, end_time: fEnd, room_ids: fRooms,
      });
      onCreated(created);
      toast("success", "Exam session added.");
      setShowAdd(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    try {
      await api.deleteExamSession(pid, id);
      onDeleted(id);
      setConfirmDel(null);
      toast("success", "Session removed.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
        <button type="button" className="btn btn-primary" style={{ fontSize: "0.82rem" }} onClick={() => setShowAdd(true)}>
          + Add Paper
        </button>
      </div>

      {sessions.length === 0 && !showAdd && (
        <p className="subheading" style={{ textAlign: "center", padding: "2rem 0" }}>No exam sessions yet. Add a paper to get started.</p>
      )}

      {sessions.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Subject</th><th>Start</th><th>End</th><th>Rooms</th><th>Assigned</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id}>
                <td>{new Date(s.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
                <td>
                  <span style={{ fontWeight: 600, color: s.subject_color || "var(--primary-600)" }}>{s.subject_name}</span>
                </td>
                <td>{s.start_time}</td>
                <td>{s.end_time}</td>
                <td>{s.room_ids.length > 0 ? `${s.room_ids.length} room${s.room_ids.length !== 1 ? "s" : ""}` : "—"}</td>
                <td>
                  {s.slot_count >= s.slots_needed && s.slots_needed > 0
                    ? badge("Full", "var(--success-100)", "var(--success-700)")
                    : s.slot_count > 0
                      ? badge(`${s.slot_count}/${s.slots_needed}`, "var(--warning-100)", "var(--warning-700)")
                      : badge("Unassigned", "var(--slate-100)", "var(--slate-500)")}
                </td>
                <td>
                  {confirmDel === s.id ? (
                    <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: "0.75rem" }}>
                      Remove?
                      <button type="button" className="btn btn-danger" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => del(s.id)}>Yes</button>
                      <button type="button" className="btn" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => setConfirmDel(null)}>No</button>
                    </span>
                  ) : (
                    <button type="button" className="btn" style={{ fontSize: "0.72rem", padding: "2px 8px", color: "var(--danger-500)" }}
                      onClick={() => setConfirmDel(s.id)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Paper modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => !saving && setShowAdd(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Exam Paper</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Subject:</label>
                <select value={fSubject} onChange={e => { setFSubject(Number(e.target.value)); setFormError(""); }} autoFocus>
                  <option value="">— select subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label required">Date:</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
              <div className="modal-field">
                <label className="modal-label required">Start time:</label>
                <input type="time" value={fStart} onChange={e => setFStart(e.target.value)} />
              </div>
              <div className="modal-field">
                <label className="modal-label required">End time:</label>
                <input type="time" value={fEnd} onChange={e => setFEnd(e.target.value)} />
              </div>
              <div className="modal-field" style={{ alignItems: "flex-start" }}>
                <label className="modal-label" style={{ paddingTop: 4 }}>Rooms:</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {rooms.map(r => {
                    const sel = fRooms.includes(r.id);
                    return (
                      <button
                        key={r.id} type="button"
                        style={{
                          fontSize: "0.72rem", padding: "3px 8px", borderRadius: "var(--radius-sm)",
                          border: "1px solid", cursor: "pointer",
                          background: sel ? "var(--primary-500)" : "var(--slate-50)",
                          color: sel ? "#fff" : "var(--slate-600)",
                          borderColor: sel ? "var(--primary-500)" : "var(--slate-200)",
                          transition: "all var(--t-fast)",
                        }}
                        onClick={() => setFRooms(prev => sel ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                      >{r.name}</button>
                    );
                  })}
                  {rooms.length === 0 && <span style={{ color: "var(--slate-400)", fontSize: "0.78rem" }}>No rooms in project.</span>}
                </div>
              </div>
              {fSubject !== "" && (
                <p style={{ margin: "0.25rem 0 0 160px", fontSize: "0.75rem", color: "var(--warning-600)" }}>
                  ⚠ Teachers who teach {subjectTeacherNote} will be excluded automatically on this date.
                </p>
              )}
              {formError && <p style={{ color: "var(--danger-600)", fontSize: "0.8rem", margin: "0.25rem 0 0 160px" }}>{formError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={create} disabled={saving || fSubject === "" || !fDate}>
                {saving ? "Adding…" : "Add to Sheet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════

function AssignmentsTab({
  pid, sessions, teachers, rooms,
}: {
  pid: number;
  sessions: ExamSession[];
  teachers: Teacher[];
  rooms: Room[];
}) {
  const toast = useToast();
  const [slots,       setSlots]       = useState<Record<number, ExamSlot[]>>({});
  const [loading,     setLoading]     = useState<Set<number>>(new Set());
  const [autoRunning, setAutoRunning] = useState<Set<number>>(new Set());
  const [assignModal, setAssignModal] = useState<{ session: ExamSession; roomId: number | null } | null>(null);
  const [aTeacher,    setATeacher]    = useState<number | "">("");
  const [aError,      setAError]      = useState("");
  const [aSaving,     setASaving]     = useState(false);
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  const loadSlots = useCallback(async (sessionId: number) => {
    setLoading(prev => new Set([...prev, sessionId]));
    try {
      const s = await api.listExamSlots(pid, sessionId);
      setSlots(prev => ({ ...prev, [sessionId]: s }));
    } catch { /* silent */ }
    finally { setLoading(prev => { const n = new Set(prev); n.delete(sessionId); return n; }); }
  }, [pid]);

  useEffect(() => {
    sessions.forEach(s => loadSlots(s.id));
  }, [sessions, loadSlots]);

  async function removeSlot(sessionId: number, slotId: number) {
    try {
      await api.removeExamSlot(pid, sessionId, slotId);
      setSlots(prev => ({ ...prev, [sessionId]: (prev[sessionId] || []).filter(sl => sl.id !== slotId) }));
      toast("success", "Assignment removed.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Remove failed");
    }
  }

  async function autoAssign(sessionId: number) {
    setAutoRunning(prev => new Set([...prev, sessionId]));
    try {
      const res = await api.autoAssignExamDuties(pid, sessionId);
      if (res.assigned.length > 0) {
        toast("success", `Auto-assigned ${res.assigned.length} teacher${res.assigned.length !== 1 ? "s" : ""}.`);
        await loadSlots(sessionId);
      }
      if (res.warnings.length > 0) {
        res.warnings.forEach(w => toast("error", w));
      }
      if (res.assigned.length === 0 && res.warnings.length === 0) {
        toast("success", "All rooms already assigned.");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Auto-assign failed");
    } finally {
      setAutoRunning(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
    }
  }

  async function manualAssign() {
    if (!assignModal || aTeacher === "") return;
    setAError(""); setASaving(true);
    try {
      const slot = await api.assignExamSlot(pid, assignModal.session.id, {
        teacher_id: aTeacher as number,
        room_id: assignModal.roomId ?? undefined,
      });
      setSlots(prev => ({ ...prev, [assignModal.session.id]: [...(prev[assignModal.session.id] || []), slot] }));
      toast("success", "Teacher assigned.");
      setAssignModal(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Assign failed";
      if (msg.includes("409") || msg.toLowerCase().includes("exempt") || msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("subject")) {
        setAError(msg);
      } else {
        setAError(msg);
      }
    } finally { setASaving(false); }
  }

  if (sessions.length === 0) {
    return <p className="subheading" style={{ textAlign: "center", padding: "2rem 0" }}>Add exam sessions in the Date Sheet tab first.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {sessions.map(sess => {
        const sessSlots = slots[sess.id] || [];
        const isLoading = loading.has(sess.id);
        const isAuto    = autoRunning.has(sess.id);
        const assignedRoomIds = new Set(sessSlots.map(s => s.room_id));
        const unassignedRoomIds = sess.room_ids.filter(rid => !assignedRoomIds.has(rid));

        // Available teachers: not already in this session
        const assignedTeacherIds = new Set(sessSlots.map(s => s.teacher_id));
        const availableTeachers  = teachers.filter(t => !assignedTeacherIds.has(t.id));

        return (
          <div key={sess.id} style={{
            border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)",
            overflow: "hidden", background: "var(--surface-card)",
          }}>
            {/* Session header */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-subtle)",
              background: "var(--surface-raised)",
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: sess.subject_color || "var(--primary-600)" }}>
                  {sess.subject_name}
                </span>
                <span style={{ marginLeft: 10, fontSize: "0.8rem", color: "var(--slate-500)" }}>
                  {new Date(sess.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}{sess.start_time}–{sess.end_time}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>
                {sess.room_ids.length} room{sess.room_ids.length !== 1 ? "s" : ""} · {sessSlots.length}/{sess.room_ids.length} assigned
              </span>
              <button type="button" className="btn btn-primary" style={{ fontSize: "0.75rem" }}
                disabled={isAuto || unassignedRoomIds.length === 0}
                onClick={() => autoAssign(sess.id)}>
                {isAuto ? "Assigning…" : "Auto-assign remaining"}
              </button>
            </div>

            <div style={{ padding: "0.75rem 1rem" }}>
              {isLoading && <p style={{ color: "var(--slate-400)", fontSize: "0.8rem" }}>Loading…</p>}

              {/* Assigned slots */}
              {sessSlots.length > 0 && (
                <div style={{ marginBottom: "0.6rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>ASSIGNED</div>
                  {sessSlots.map(sl => (
                    <div key={sl.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--slate-500)", minWidth: 70 }}>{sl.room_name || `Room #${sl.room_id}`}</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>→ {sl.teacher_name}</span>
                      <span style={{ color: "var(--slate-400)", fontSize: "0.72rem" }}>{sl.duty_start}–{sl.duty_end}</span>
                      <button type="button"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-400)", fontSize: "0.9rem", padding: "0 3px" }}
                        onClick={() => removeSlot(sess.id, sl.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Unassigned rooms */}
              {unassignedRoomIds.length > 0 && (
                <div style={{ marginBottom: "0.6rem" }}>
                  {unassignedRoomIds.map(rid => {
                    const r = roomMap.get(rid);
                    return (
                      <div key={rid} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", fontSize: "0.82rem" }}>
                        <span style={{ color: "var(--slate-500)", minWidth: 70 }}>{r?.name ?? `Room #${rid}`}</span>
                        <span style={{ flex: 1, color: "var(--slate-400)" }}>(unassigned)</span>
                        <button type="button" className="btn" style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                          onClick={() => { setAssignModal({ session: sess, roomId: rid }); setATeacher(""); setAError(""); }}>
                          Assign
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Available teachers preview */}
              {availableTeachers.length > 0 && unassignedRoomIds.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>AVAILABLE TEACHERS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {availableTeachers.slice(0, 6).map(t => (
                      <button key={t.id} type="button"
                        style={{
                          fontSize: "0.72rem", padding: "3px 9px", borderRadius: "var(--radius-sm)",
                          background: "var(--primary-50)", color: "var(--primary-700)",
                          border: "1px solid var(--primary-200)", cursor: "pointer",
                          transition: "all var(--t-fast)",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-100)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--primary-50)"; }}
                        onClick={() => { setAssignModal({ session: sess, roomId: unassignedRoomIds[0] ?? null }); setATeacher(t.id); setAError(""); }}
                      >
                        {t.first_name} {t.last_name}
                      </button>
                    ))}
                    {availableTeachers.length > 6 && (
                      <span style={{ fontSize: "0.72rem", color: "var(--slate-400)", padding: "3px 4px" }}>
                        +{availableTeachers.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Manual assign modal */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => !aSaving && setAssignModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Assign Teacher
              <span style={{ marginLeft: 8, fontSize: "0.8rem", fontWeight: 400, color: "var(--slate-500)" }}>
                {assignModal.session.subject_name} · {assignModal.roomId ? (roomMap.get(assignModal.roomId)?.name ?? `Room #${assignModal.roomId}`) : "No room"}
              </span>
            </h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Teacher:</label>
                <select value={aTeacher} onChange={e => { setATeacher(Number(e.target.value)); setAError(""); }} autoFocus>
                  <option value="">— select teacher —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.code})</option>)}
                </select>
              </div>
              {aError && <p style={{ color: "var(--danger-600)", fontSize: "0.8rem", margin: "0.25rem 0 0 160px" }}>{aError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setAssignModal(null)} disabled={aSaving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={manualAssign} disabled={aSaving || aTeacher === ""}>
                {aSaving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function ExamDutiesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid   = Number(projectId);
  const toast = useToast();

  const [tab,      setTab]      = useState<Tab>("setup");
  const [loading,  setLoading]  = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms,    setRooms]    = useState<Room[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);

  useEffect(() => {
    Promise.all([
      api.listTeachers(pid),
      api.listSubjects(pid),
      api.listRooms(pid),
      api.listExamSessions(pid),
    ]).then(([t, s, r, sess]) => {
      setTeachers(t); setSubjects(s); setRooms(r); setSessions(sess);
    }).catch(err => {
      toast("error", err instanceof Error ? err.message : "Failed to load exam duties");
    }).finally(() => setLoading(false));
  }, [pid, toast]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "setup",       label: "⚙️ Setup" },
    { key: "datesheet",   label: "📋 Date Sheet" },
    { key: "assignments", label: "👤 Assignments" },
  ];

  if (loading) return <div className="card"><p className="subheading">Loading…</p></div>;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Exam Duties</h2>
          <p className="subheading" style={{ margin: 0 }}>Schedule exam invigilators with conflict-free auto-assignment.</p>
        </div>
        <button type="button" className="btn" style={{ fontSize: "0.78rem" }}
          onClick={() => {
            const date = sessions.length > 0 ? sessions[0].date : new Date().toISOString().slice(0, 10);
            window.open(`/api/projects/${pid}/exam-duties/export-pdf?date=${date}`, "_blank");
          }}>
          📄 Export PDF
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "0" }}>
        {TABS.map(t => (
          <button key={t.key} type="button"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.5rem 1rem", fontSize: "0.84rem", fontWeight: 600,
              fontFamily: "var(--font-sans)",
              color: tab === t.key ? "var(--primary-600)" : "var(--slate-500)",
              borderBottom: tab === t.key ? "2px solid var(--primary-500)" : "2px solid transparent",
              transition: "all var(--t-fast)", marginBottom: "-1px",
            }}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "setup"       && <SetupTab pid={pid} teachers={teachers} />}
      {tab === "datesheet"   && (
        <DateSheetTab
          pid={pid} sessions={sessions} subjects={subjects} rooms={rooms}
          onCreated={s => {
            const subj = subjects.find(x => x.id === s.subject_id);
            setSessions(prev => [...prev, {
              ...s,
              subject_name: subj?.name ?? "",
              subject_color: subj?.color ?? "",
              slot_count: 0,
              slots_needed: s.room_ids.length,
            }]);
          }}
          onDeleted={id => setSessions(prev => prev.filter(s => s.id !== id))}
        />
      )}
      {tab === "assignments" && (
        <AssignmentsTab pid={pid} sessions={sessions} teachers={teachers} rooms={rooms} />
      )}
    </div>
  );
}
