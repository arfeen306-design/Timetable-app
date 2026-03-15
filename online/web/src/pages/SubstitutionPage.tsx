import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  listTeachers,
  markAbsent, getFreeTeachers, assignSubstitute,
  listSubstitutions, listAbsences, deleteSubstitution, removeAbsence,
  type AbsentSlot, type FreeTeacher, type SubstitutionRecord, type AbsenceRecord,
} from "../api";

function todayStr() { return new Date().toISOString().slice(0, 10); }

type Teacher = { id: number; first_name: string; last_name: string; code: string };

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
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Load teachers, subjects, classes
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

  // Mark absent
  async function handleMarkAbsent() {
    if (!selectedAbsent.length) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await markAbsent(pid, { date, teacher_ids: selectedAbsent, reason });
      setAbsentSlots(res.slots);
      setMsg(`✅ ${res.absences_created.length} teacher(s) marked absent. ${res.slots.length} lesson(s) need coverage.`);
      setSelectedAbsent([]);
      setReason("");
      loadDayData();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  // Find free teachers for a period
  async function handleFindFree(period: number, absentTeacherId: number) {
    const key = `${absentTeacherId}-${period}`;
    if (expandedPeriod === key) { setExpandedPeriod(null); return; }
    const absentIds = absences.map(a => a.teacher_id);
    try {
      const free = await getFreeTeachers(pid, date, period, absentIds);
      setFreeMap(prev => ({ ...prev, [key]: free }));
      setExpandedPeriod(key);
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`);
    }
  }

  // Assign substitute
  async function handleAssign(period: number, absentTeacherId: number, subTeacherId: number, lessonId: number, roomId: number | null) {
    try {
      await assignSubstitute(pid, {
        date, period_index: period,
        absent_teacher_id: absentTeacherId,
        sub_teacher_id: subTeacherId,
        lesson_id: lessonId,
        room_id: roomId,
      });
      setMsg("✅ Substitute assigned!");
      setExpandedPeriod(null);
      loadDayData();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`);
    }
  }

  // Group absent slots by teacher
  const slotsByTeacher: Record<number, AbsentSlot[]> = {};
  for (const s of absentSlots) {
    (slotsByTeacher[s.teacher_id] ??= []).push(s);
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>🔄 Substitution Management</h2>

      {msg && (
        <div style={{
          padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "1rem", fontSize: "0.82rem",
          background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
          border: msg.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fecaca",
          color: msg.startsWith("✅") ? "#166534" : "#dc2626",
        }}>{msg}</div>
      )}

      {/* Step 1: Select date + absent teachers */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Step 1: Mark Teachers Absent</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 }}>Date</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setAbsentSlots([]); }}
              style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 }}>Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Sick leave"
              style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Teacher multi-select */}
        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 4 }}>
          {teachers.map(t => {
            const checked = selectedAbsent.includes(t.id);
            const alreadyAbsent = absences.some(a => a.teacher_id === t.id);
            return (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "0.35rem 0.5rem", borderRadius: 6, cursor: "pointer",
                background: alreadyAbsent ? "#fef2f2" : checked ? "#eff6ff" : "transparent",
                opacity: alreadyAbsent ? 0.5 : 1,
              }}>
                <input type="checkbox" checked={checked || alreadyAbsent} disabled={alreadyAbsent}
                  onChange={() => setSelectedAbsent(prev => checked ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                />
                <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{t.first_name} {t.last_name}</span>
                <span style={{ color: "#94a3b8", fontSize: "0.72rem", fontFamily: "monospace" }}>{t.code}</span>
                {alreadyAbsent && <span style={{ color: "#ef4444", fontSize: "0.7rem", marginLeft: "auto" }}>Already absent</span>}
              </label>
            );
          })}
        </div>

        <button onClick={handleMarkAbsent} disabled={loading || !selectedAbsent.length}
          style={{
            marginTop: 10, padding: "0.5rem 1.2rem", borderRadius: 8, border: "none",
            background: selectedAbsent.length ? "linear-gradient(135deg, #ef4444, #dc2626)" : "#e2e8f0",
            color: selectedAbsent.length ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: "0.82rem",
            cursor: selectedAbsent.length ? "pointer" : "default", fontFamily: "inherit",
          }}
        >
          {loading ? "⏳ Processing…" : `Mark ${selectedAbsent.length} Teacher(s) Absent`}
        </button>
      </div>

      {/* Step 2: Absent teachers' periods needing coverage */}
      {absentSlots.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Step 2: Assign Substitutes</h3>
          {Object.entries(slotsByTeacher).map(([tId, slots]) => (
            <div key={tId} style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem", marginBottom: 6 }}>
                🧑‍🏫 {teacherName(Number(tId))}
              </div>
              {slots.sort((a, b) => a.period_index - b.period_index).map(slot => {
                const key = `${tId}-${slot.period_index}`;
                const isExpanded = expandedPeriod === key;
                const freeTeachers = freeMap[key] || [];
                const alreadyAssigned = subs.find(s => s.absent_teacher_id === Number(tId) && s.period_index === slot.period_index);
                return (
                  <div key={slot.period_index} style={{ marginLeft: "1rem", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.8rem", minWidth: 80 }}>Lesson {slot.period_index + 1}</span>
                      {alreadyAssigned ? (
                        <span style={{ fontSize: "0.78rem", color: "#10b981", fontWeight: 600 }}>
                          ✅ Covered by {alreadyAssigned.sub_teacher_name}
                        </span>
                      ) : (
                        <button onClick={() => handleFindFree(slot.period_index, Number(tId))}
                          style={{
                            padding: "0.3rem 0.8rem", borderRadius: 6, border: "1px solid #3b82f6",
                            background: isExpanded ? "#3b82f6" : "transparent", color: isExpanded ? "#fff" : "#3b82f6",
                            fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          }}>
                          {isExpanded ? "▲ Hide" : "🔍 Find Substitute"}
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 6, marginLeft: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
                        {freeTeachers.length === 0 ? (
                          <div style={{ color: "#94a3b8", fontSize: "0.78rem", gridColumn: "1/-1" }}>No free teachers available for this lesson.</div>
                        ) : freeTeachers.map(ft => {
                          const pct = ft.utilization_pct;
                          const borderColor = pct > 100 ? "#ef4444" : pct > 85 ? "#f59e0b" : "#10b981";
                          return (
                            <button key={ft.teacher_id} onClick={() => handleAssign(slot.period_index, Number(tId), ft.teacher_id, slot.lesson_id, slot.room_id)}
                              style={{
                                padding: "0.5rem", borderRadius: 8, border: `2px solid ${borderColor}40`,
                                background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.transform = "translateY(-1px)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = `${borderColor}40`; e.currentTarget.style.transform = "none"; }}
                            >
                              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a" }}>{ft.teacher_name}</div>
                              <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: 2 }}>
                                Load: {ft.total}/{ft.max} ({ft.utilization_pct}%) · Subs: {ft.substitutions}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Today's absences + substitutions */}
      {(absences.length > 0 || subs.length > 0) && (
        <div className="card">
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>📋 Today's Summary</h3>

          {absences.length > 0 && (
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#ef4444", marginBottom: 6 }}>Absent Teachers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {absences.map(a => (
                  <span key={a.id} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca",
                    fontSize: "0.78rem", fontWeight: 600, color: "#dc2626",
                  }}>
                    {a.teacher_name}
                    {a.reason && <span style={{ color: "#f87171", fontWeight: 400 }}>({a.reason})</span>}
                    <button onClick={async () => { await removeAbsence(pid, a.id); loadDayData(); }}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.9rem", padding: 0 }}
                      title="Remove absence">✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {subs.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#10b981", marginBottom: 6 }}>Assigned Substitutions</div>
              <table style={{ width: "100%", fontSize: "0.78rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Lesson", "Absent", "Substitute", ""].map(h => (
                      <th key={h} style={{ padding: "0.4rem 0.6rem", textAlign: "left", fontWeight: 700, color: "#334155", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>Lesson {s.period_index + 1}</td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "#ef4444" }}>{s.absent_teacher_name}</td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "#10b981", fontWeight: 600 }}>{s.sub_teacher_name}</td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <button onClick={async () => { await deleteSubstitution(pid, s.id); loadDayData(); }}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.82rem" }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
