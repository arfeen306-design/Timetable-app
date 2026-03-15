import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  listTeachers, listAcademicWeeks,
  markAbsent, getFreeTeachers, assignSubstitute,
  listSubstitutions, listAbsences, deleteSubstitution, removeAbsence,
  type AbsentSlot, type FreeTeacher, type SubstitutionRecord, type AbsenceRecord, type AcademicWeekInfo,
} from "../api";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function fmtShort(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }

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

function SubBadge({ count, max }: { count: number; max: number }) {
  const isFull = count >= max;
  const isNear = count === max - 1;
  const cfg = isFull
    ? { bg: "var(--danger-50)", color: "var(--danger-600)", border: "var(--danger-200)", label: `${count}/${max} — FULL` }
    : isNear
      ? { bg: "var(--warning-50)", color: "var(--warning-600)", border: "var(--warning-100)", label: `${count}/${max} subs` }
      : { bg: "var(--success-50)", color: "var(--success-600)", border: "var(--success-100)", label: `${count}/${max} subs` };
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "var(--radius-full)",
      fontSize: "0.68rem", fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}

export default function SubstitutionPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);

  const [date, setDate] = useState(todayStr());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [weeks, setWeeks] = useState<AcademicWeekInfo[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<AcademicWeekInfo | null>(null);
  const [selectedAbsent, setSelectedAbsent] = useState<number[]>([]);
  const [absentSlots, setAbsentSlots] = useState<AbsentSlot[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [subs, setSubs] = useState<SubstitutionRecord[]>([]);
  const [freeMap, setFreeMap] = useState<Record<string, FreeTeacher[]>>({});
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  // Override warning state
  const [overrideWarning, setOverrideWarning] = useState<{
    teacherName: string; subCount: number;
    period: number; absentTeacherId: number; subTeacherId: number; lessonId: number; roomId: number | null;
  } | null>(null);

  useEffect(() => {
    if (!pid) return;
    listTeachers(pid).then(t => setTeachers(t as unknown as Teacher[])).catch(console.error);
    listAcademicWeeks(pid).then(w => {
      setWeeks(w);
      const current = w.find(wk => wk.is_current);
      if (current) setSelectedWeek(current);
    }).catch(console.error);
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

  async function handleAssign(period: number, absentTeacherId: number, subTeacherId: number, lessonId: number, roomId: number | null, forceOverride = false) {
    try {
      const res = await assignSubstitute(pid, {
        date, period_index: period, absent_teacher_id: absentTeacherId,
        sub_teacher_id: subTeacherId, lesson_id: lessonId, room_id: roomId,
        force_override: forceOverride,
      });
      setMsg(`✅ ${res.message}`);
      setExpandedSlot(null);
      setOverrideWarning(null);
      loadDayData();
    } catch (e: unknown) {
      // Handle 409 LIMIT_EXCEEDED
      const err = e as { status?: number; detail?: { code?: string; teacher_name?: string; sub_count?: number } };
      if (err.status === 409 && err.detail?.code === "LIMIT_EXCEEDED") {
        setOverrideWarning({
          teacherName: err.detail.teacher_name || "Teacher",
          subCount: err.detail.sub_count || 2,
          period, absentTeacherId, subTeacherId: subTeacherId, lessonId, roomId,
        });
      } else {
        setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`);
      }
    }
  }

  async function handleExportPDF() {
    const url = `/api/projects/${pid}/substitutions/export-pdf?date=${date}`;
    window.open(url, "_blank");
  }

  // Group absent slots by teacher
  const slotsByTeacher: Record<number, AbsentSlot[]> = {};
  for (const s of absentSlots) { (slotsByTeacher[s.teacher_id] ??= []).push(s); }

  return (
    <div style={{ maxWidth: 740, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--slate-900)" }}>Substitution Manager</h1>
          {selectedWeek && (
            <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--slate-400)" }}>
              Academic Year {weeks.length > 0 ? "Active" : ""}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Week dropdown */}
          {weeks.length > 0 && (
            <select
              value={selectedWeek?.id || ""}
              onChange={e => {
                const w = weeks.find(wk => wk.id === Number(e.target.value));
                if (w) setSelectedWeek(w);
              }}
              style={{
                padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--slate-300)", fontSize: "0.78rem",
                background: "#fff", fontWeight: 600, maxWidth: 260,
              }}
            >
              {weeks.map(w => (
                <option key={w.id} value={w.id}>
                  Week {w.week_number} · {fmtShort(w.start_date)}–{fmtShort(w.end_date)}{w.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          )}
          <button onClick={handleExportPDF} className="btn btn-secondary" style={{ fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
            Export PDF
          </button>
        </div>
      </div>

      {msg && <div className={msg.startsWith("✅") ? "alert alert-success" : "alert alert-error"}>{msg}</div>}

      {/* ── Absent Today ── */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
          ABSENT TODAY — {fmtDate(date).toUpperCase()}
        </div>
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
            {teacherName(Number(tId)).toUpperCase()} — PERIODS TO COVER
          </div>

          {slots.sort((a, b) => a.period_index - b.period_index).map(slot => {
            const key = `${tId}-${slot.period_index}`;
            const isExpanded = expandedSlot === key;
            const freeTeachers = freeMap[key] || [];
            const assigned = subs.find(s => s.absent_teacher_id === Number(tId) && s.period_index === slot.period_index);

            return (
              <div key={slot.period_index} className="card" style={{ padding: "0.75rem 1rem", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: assigned ? "var(--success-50)" : "var(--primary-50)",
                    color: assigned ? "var(--success-600)" : "var(--primary-600)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
                  }}>P{slot.period_index + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-900)" }}>
                      {slot.subject_name || "Lesson"} · {slot.class_name || "Class"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>
                      {slot.room_name ? `${slot.room_name} · ` : ""}{teacherName(Number(tId))} is absent
                    </div>
                  </div>
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
                  {!assigned && (
                    <button onClick={() => handleFindFree(slot.period_index, Number(tId))}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", color: "var(--slate-400)", padding: 2 }}>
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {/* Free teacher candidates */}
                {isExpanded && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--slate-400)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary-500)", display: "inline-block" }} />
                      Sorted: fewest periods today → fewest subs this week. Max 2 subs per teacher.
                    </div>

                    {freeTeachers.length === 0 ? (
                      <div style={{ color: "var(--slate-400)", fontSize: "0.82rem", padding: "0.5rem 0" }}>No free teachers available.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {freeTeachers.map(ft => {
                          const isFull = ft.subs_this_week >= 2;
                          const isActiveOverride = overrideWarning && overrideWarning.subTeacherId === ft.teacher_id && overrideWarning.period === slot.period_index;
                          return (
                            <div key={ft.teacher_id}>
                              <div style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)",
                                border: ft.best_fit ? "1.5px solid var(--primary-300)" : isFull ? "1.5px solid var(--danger-200)" : "1px solid var(--slate-200)",
                                background: ft.best_fit ? "var(--primary-50)" : isFull ? "var(--danger-50)" : "var(--slate-50)",
                              }}>
                                <Initials name={ft.teacher_name} color={avatarColor(ft.teacher_id)} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--slate-900)" }}>{ft.teacher_name}</span>
                                    {ft.best_fit && (
                                      <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--primary-500)", color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>Best fit</span>
                                    )}
                                    {isFull && (
                                      <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--danger-100)", color: "var(--danger-600)", fontSize: "0.6rem", fontWeight: 700 }}>At limit</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "0.68rem", color: "var(--slate-400)" }}>
                                    {ft.periods_today} periods today
                                  </div>
                                </div>

                                {/* Workload bar + sub badge */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                                  {selectedWeek && <span style={{ fontSize: "0.62rem", color: "var(--slate-400)", whiteSpace: "nowrap" }}>Week {selectedWeek.week_number}</span>}
                                  <div style={{ width: 80, height: 5, background: "var(--slate-200)", borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{
                                      width: `${Math.min(ft.utilization_pct, 100)}%`, height: "100%", borderRadius: 3,
                                      background: ft.utilization_pct > 100 ? "var(--danger-500)" : ft.utilization_pct > 85 ? "var(--warning-500)" : "var(--primary-500)",
                                      transition: "width 0.3s",
                                    }} />
                                  </div>
                                  <span style={{ fontSize: "0.62rem", color: "var(--slate-400)", whiteSpace: "nowrap" }}>{ft.scheduled} + {ft.subs_this_week} sub{ft.subs_this_week !== 1 ? "s" : ""}</span>
                                </div>

                                <SubBadge count={ft.subs_this_week} max={2} />

                                {/* Assign or Override button */}
                                {isFull ? (
                                  <button onClick={() => handleAssign(slot.period_index, Number(tId), ft.teacher_id, slot.lesson_id, slot.room_id)}
                                    className="btn btn-danger" style={{ padding: "0.35rem 1rem", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                    Override
                                  </button>
                                ) : (
                                  <button onClick={() => handleAssign(slot.period_index, Number(tId), ft.teacher_id, slot.lesson_id, slot.room_id)}
                                    className="btn" style={{ padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                    Assign
                                  </button>
                                )}
                              </div>

                              {/* Inline override warning */}
                              {isActiveOverride && (
                                <div style={{
                                  marginTop: 8, padding: "0.65rem 1rem", borderRadius: "var(--radius-md)",
                                  background: "var(--warning-50)", border: "1px solid var(--warning-200)",
                                }}>
                                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--warning-700)", marginBottom: 4 }}>
                                    ⚠ {overrideWarning.teacherName} has already taken {overrideWarning.subCount} substitutions this week
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--slate-600)", marginBottom: 10 }}>
                                    Assigning another will exceed the weekly limit of 2. This will be flagged in his workload report as an excess substitution.
                                  </div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={() => handleAssign(overrideWarning.period, overrideWarning.absentTeacherId, overrideWarning.subTeacherId, overrideWarning.lessonId, overrideWarning.roomId, true)}
                                      className="btn btn-danger" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                                      Yes, assign anyway
                                    </button>
                                    <button onClick={() => setOverrideWarning(null)}
                                      className="btn btn-secondary" style={{ fontSize: "0.78rem" }}>Cancel</button>
                                  </div>
                                </div>
                              )}
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
