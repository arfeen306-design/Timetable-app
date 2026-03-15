import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  listTeachers,
  markAbsent, getFreeTeachers, assignSubstitute,
  listSubstitutions, listAbsences, deleteSubstitution, removeAbsence,
  type AbsentSlot, type FreeTeacher, type SubstitutionRecord, type AbsenceRecord,
} from "../api";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }

type Teacher = { id: number; first_name: string; last_name: string; code: string };

const AVATAR_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#22c55e"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

function Initials({ name, color }: { name: string; color: string }) {
  const init = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
    }}>{init}</div>
  );
}

export default function SubstitutionPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);

  const [date, setDate] = useState(todayStr());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedAbsent, setSelectedAbsent] = useState<number[]>([]);
  const [absentSlots, setAbsentSlots] = useState<AbsentSlot[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [subs, setSubs] = useState<SubstitutionRecord[]>([]);
  const [freeMap, setFreeMap] = useState<Record<string, FreeTeacher[]>>({});
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!pid) return;
    listTeachers(pid).then(t => setTeachers(t as unknown as Teacher[])).catch(console.error);
  }, [pid]);

  const loadDayData = useCallback(() => {
    if (!pid) return;
    listAbsences(pid, date).then(setAbsences).catch(console.error);
    listSubstitutions(pid, date).then(setSubs).catch(console.error);
  }, [pid, date]);

  useEffect(() => { loadDayData(); }, [loadDayData]);

  const teacherName = (id: number) => {
    const t = teachers.find(t => t.id === id);
    return t ? `${t.first_name} ${t.last_name}`.trim() : `#${id}`;
  };

  async function handleMarkAbsent() {
    if (!selectedAbsent.length) return;
    setLoading(true); setMsg("");
    try {
      const res = await markAbsent(pid, { date, teacher_ids: selectedAbsent, reason });
      setAbsentSlots(res.slots);
      setMsg(`✅ ${res.absences_created.length} teacher(s) marked absent. ${res.slots.length} lesson(s) need coverage.`);
      setSelectedAbsent([]); setReason("");
      loadDayData();
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
    finally { setLoading(false); }
  }

  async function handleFindFree(period: number, absentTeacherId: number) {
    const key = `${absentTeacherId}-${period}`;
    if (expandedSlot === key) { setExpandedSlot(null); return; }
    const absentIds = absences.map(a => a.teacher_id);
    try {
      const free = await getFreeTeachers(pid, date, period, absentIds);
      setFreeMap(prev => ({ ...prev, [key]: free }));
      setExpandedSlot(key);
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
  }

  async function handleAssign(period: number, absentTeacherId: number, subTeacherId: number, lessonId: number, roomId: number | null) {
    try {
      await assignSubstitute(pid, { date, period_index: period, absent_teacher_id: absentTeacherId, sub_teacher_id: subTeacherId, lesson_id: lessonId, room_id: roomId });
      setMsg("✅ Substitute assigned!");
      setExpandedSlot(null);
      loadDayData();
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
  }

  // Group absent slots by teacher
  const slotsByTeacher: Record<number, AbsentSlot[]> = {};
  for (const s of absentSlots) { (slotsByTeacher[s.teacher_id] ??= []).push(s); }

  return (
    <div style={{ maxWidth: 740, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--slate-900)" }}>Substitution Manager</h1>
        <div style={{
          padding: "0.35rem 0.85rem", borderRadius: "var(--radius-full)",
          background: "var(--primary-50)", border: "1px solid var(--primary-200)",
          fontSize: "0.78rem", fontWeight: 600, color: "var(--primary-600)",
        }}>{fmtDate(date)}</div>
      </div>

      {msg && <div className={msg.startsWith("✅") ? "alert alert-success" : "alert alert-error"}>{msg}</div>}

      {/* ── Absent Today ── */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>ABSENT TODAY</div>
        <div className="card" style={{ padding: "0.65rem 1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {absences.map(a => (
              <span key={a.id} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px 4px 8px", borderRadius: "var(--radius-full)",
                background: "var(--danger-50)", border: "1px solid var(--danger-100)",
                fontSize: "0.78rem", fontWeight: 600, color: "var(--danger-600)",
              }}>
                {a.teacher_name}
                <button onClick={async () => { await removeAbsence(pid, a.id); loadDayData(); }}
                  style={{ background: "none", border: "none", color: "var(--danger-400)", cursor: "pointer", fontSize: "0.82rem", padding: 0, lineHeight: 1 }}
                  title="Remove absence">✕</button>
              </span>
            ))}
            {absences.length === 0 && <span style={{ color: "var(--slate-400)", fontSize: "0.82rem" }}>No absences recorded</span>}
          </div>
        </div>
      </div>

      {/* ── Mark Absent Form ── */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600 }}>Date</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setAbsentSlots([]); }} style={{ maxWidth: 160 }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 600 }}>Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Sick leave" />
          </div>
        </div>

        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--slate-200)", borderRadius: "var(--radius-md)", padding: 4, marginBottom: 8 }}>
          {teachers.map(t => {
            const checked = selectedAbsent.includes(t.id);
            const alreadyAbsent = absences.some(a => a.teacher_id === t.id);
            return (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                background: alreadyAbsent ? "var(--danger-50)" : checked ? "var(--primary-50)" : "transparent",
                opacity: alreadyAbsent ? 0.5 : 1,
              }}>
                <input type="checkbox" checked={checked || alreadyAbsent} disabled={alreadyAbsent}
                  onChange={() => setSelectedAbsent(prev => checked ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  style={{ accentColor: "var(--primary-500)", width: 15, height: 15 }}
                />
                <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{t.first_name} {t.last_name}</span>
                <span style={{ color: "var(--slate-400)", fontSize: "0.68rem", fontFamily: "var(--font-mono)" }}>{t.code}</span>
                {alreadyAbsent && <span style={{ color: "var(--danger-500)", fontSize: "0.65rem", marginLeft: "auto" }}>Already absent</span>}
              </label>
            );
          })}
        </div>

        <button onClick={handleMarkAbsent} disabled={loading || !selectedAbsent.length} className="btn btn-danger" style={{ fontSize: "0.82rem" }}>
          {loading ? "⏳ Processing…" : `Mark ${selectedAbsent.length} Teacher(s) Absent`}
        </button>
      </div>

      {/* ── Periods to Cover ── */}
      {Object.entries(slotsByTeacher).map(([tId, slots]) => (
        <div key={tId} style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
            PERIODS TO COVER — {teacherName(Number(tId)).toUpperCase()}
          </div>

          {slots.sort((a, b) => a.period_index - b.period_index).map(slot => {
            const key = `${tId}-${slot.period_index}`;
            const isExpanded = expandedSlot === key;
            const freeTeachers = freeMap[key] || [];
            const assigned = subs.find(s => s.absent_teacher_id === Number(tId) && s.period_index === slot.period_index);

            return (
              <div key={slot.period_index} className="card" style={{ padding: "0.75rem 1rem", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Period badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: assigned ? "var(--success-50)" : "var(--primary-50)",
                    color: assigned ? "var(--success-600)" : "var(--primary-600)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
                  }}>P{slot.period_index + 1}</div>

                  {/* Slot info — now with subject, class, room */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-900)" }}>
                      {slot.subject_name || "Lesson"} · {slot.class_name || `Class`}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>
                      {slot.room_name ? `${slot.room_name} · ` : ""}{teacherName(Number(tId))} is absent
                    </div>
                  </div>

                  {/* Status badge */}
                  {assigned ? (
                    <span style={{
                      padding: "3px 10px", borderRadius: "var(--radius-full)",
                      background: "var(--success-50)", border: "1px solid var(--success-100)",
                      fontSize: "0.72rem", fontWeight: 700, color: "var(--success-600)",
                    }}>{assigned.sub_teacher_name} assigned</span>
                  ) : (
                    <span style={{
                      padding: "3px 10px", borderRadius: "var(--radius-full)",
                      background: "var(--warning-50)", border: "1px solid var(--warning-100)",
                      fontSize: "0.72rem", fontWeight: 700, color: "var(--warning-600)",
                    }}>Unassigned</span>
                  )}

                  {/* Expand toggle */}
                  {!assigned && (
                    <button onClick={() => handleFindFree(slot.period_index, Number(tId))}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", color: "var(--slate-400)", padding: 2 }}>
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {/* ── Free teacher candidates ── */}
                {isExpanded && (
                  <div style={{ marginTop: 12 }}>
                    {/* Ranking hint */}
                    <div style={{ fontSize: "0.65rem", color: "var(--slate-400)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary-500)", display: "inline-block" }} />
                      Ranked by: fewest periods today, then fewest subs this week
                    </div>

                    {freeTeachers.length === 0 ? (
                      <div style={{ color: "var(--slate-400)", fontSize: "0.82rem", padding: "0.5rem 0" }}>No free teachers available for this period.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {freeTeachers.map(ft => {
                          const pct = ft.utilization_pct;
                          const barColor = pct > 100 ? "var(--danger-500)" : pct > 85 ? "var(--warning-500)" : "var(--primary-500)";
                          return (
                            <div key={ft.teacher_id} style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)",
                              border: ft.best_fit ? "1.5px solid var(--primary-300)" : "1px solid var(--slate-200)",
                              background: ft.best_fit ? "var(--primary-50)" : "var(--slate-50)",
                            }}>
                              <Initials name={ft.teacher_name} color={avatarColor(ft.teacher_id)} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--slate-900)" }}>{ft.teacher_name}</span>
                                  {ft.best_fit && (
                                    <span style={{
                                      padding: "1px 8px", borderRadius: "var(--radius-full)",
                                      background: "var(--primary-500)", color: "#fff",
                                      fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.03em",
                                    }}>Best fit</span>
                                  )}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <span>{ft.periods_today} periods today</span>
                                  <span>·</span>
                                  <span>free P{slot.period_index + 1}</span>
                                </div>
                              </div>

                              {/* Workload mini bar */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 120 }}>
                                <div style={{ fontSize: "0.62rem", color: "var(--slate-400)", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  This week {ft.scheduled} + {ft.subs_this_week} subs = {ft.total}
                                </div>
                                <div style={{ width: "100%", height: 5, background: "var(--slate-200)", borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
                                </div>
                              </div>

                              {/* Periods today + subs badges */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 80 }}>
                                <span style={{
                                  padding: "1px 8px", borderRadius: "var(--radius-full)",
                                  background: ft.periods_today <= 2 ? "var(--success-50)" : ft.periods_today <= 4 ? "var(--warning-50)" : "var(--danger-50)",
                                  color: ft.periods_today <= 2 ? "var(--success-600)" : ft.periods_today <= 4 ? "var(--warning-600)" : "var(--danger-600)",
                                  fontSize: "0.62rem", fontWeight: 700, whiteSpace: "nowrap",
                                }}>{ft.periods_today} periods today</span>
                                <span style={{ fontSize: "0.62rem", color: "var(--slate-400)", whiteSpace: "nowrap" }}>
                                  {ft.subs_this_week} sub{ft.subs_this_week !== 1 ? "s" : ""} this week
                                </span>
                              </div>

                              <button onClick={() => handleAssign(slot.period_index, Number(tId), ft.teacher_id, slot.lesson_id, slot.room_id)}
                                className="btn" style={{ padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                Assign
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Assigned subs summary ── */}
      {subs.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
            ASSIGNED SUBSTITUTIONS
          </div>
          {subs.map(s => (
            <div key={s.id} className="card" style={{ padding: "0.6rem 1rem", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: "var(--success-50)", color: "var(--success-600)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
                }}>P{s.period_index + 1}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--danger-600)" }}>{s.absent_teacher_name}</span>
                  <span style={{ color: "var(--slate-400)", fontSize: "0.78rem" }}> → </span>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--success-600)" }}>{s.sub_teacher_name}</span>
                </div>
                <button onClick={async () => { await deleteSubstitution(pid, s.id); loadDayData(); }}
                  style={{ background: "none", border: "none", color: "var(--danger-400)", cursor: "pointer", fontSize: "0.82rem" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
