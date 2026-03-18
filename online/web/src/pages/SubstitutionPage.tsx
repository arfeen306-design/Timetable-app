import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import SearchableSelect from "../components/SearchableSelect";
import {
  listTeachers, listAcademicWeeks,
  markAbsent, getFreeTeachers, assignSubstitute,
  listSubstitutions, listAbsences, deleteSubstitution, removeAbsence,
  getTeacherSlots, listPendingWithSuggestions, exportSubstitutionsPDF,
  type AbsentSlot, type FreeTeacher, type SubstitutionRecord, type AbsenceRecord, type AcademicWeekInfo,
  type SuggestionTeacher,
} from "../api";
import { cachedFetch, invalidateCachePrefix } from "../hooks/prefetchCache";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function fmtShort(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }

type Teacher = { id: number; first_name: string; last_name: string; code: string };

const AVATAR_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#22c55e"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

function Initials({ name, color, size }: { name: string; color: string; size?: number }) {
  const s = size || 36;
  const init = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: s, height: s, borderRadius: "50%",
      background: color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: `${s * 0.38}px`, fontWeight: 700, flexShrink: 0,
    }}>{init}</div>
  );
}

function SubBadge({ count, max }: { count: number; max: number }) {
  const isFull = count >= max;
  const isNear = count === max - 1;
  const cfg = isFull
    ? { bg: "var(--danger-50)", color: "var(--danger-600)", border: "var(--danger-200)", label: `${count} / ${max} FULL` }
    : isNear
      ? { bg: "var(--warning-50)", color: "var(--warning-600)", border: "var(--warning-100)", label: `${count} / ${max} subs` }
      : { bg: "var(--success-50)", color: "var(--success-600)", border: "var(--success-100)", label: `${count} / ${max} subs` };
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "var(--radius-full)",
      fontSize: "0.68rem", fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}

// Confirmation state
type ConfirmState = {
  period: number; absentTeacherId: number; absentTeacherName: string;
  subTeacher: FreeTeacher; lessonId: number; roomId: number | null;
  subjectName: string; className: string; roomName: string;
};

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
  const [freeCount, setFreeCount] = useState<Record<string, number>>({});
  const [suggestionsMap, setSuggestionsMap] = useState<Record<string, SuggestionTeacher[]>>({});
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [removingChips, setRemovingChips] = useState<Set<number>>(new Set());
  const [assigningKeys, setAssigningKeys] = useState<Set<string>>(new Set());
  const msgTimer = useRef<ReturnType<typeof setTimeout>>();
  // Confirmation step
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // Override warning
  const [overrideWarning, setOverrideWarning] = useState<{
    teacherName: string; subCount: number;
    period: number; absentTeacherId: number; subTeacherId: number; lessonId: number; roomId: number | null;
  } | null>(null);
  // Cover specific lesson (busy teacher)
  const [showCoverLesson, setShowCoverLesson] = useState(false);
  const [coverTeacherId, setCoverTeacherId] = useState<number | null>(null);
  const [coverSlots, setCoverSlots] = useState<AbsentSlot[]>([]);
  const [coverLoading, setCoverLoading] = useState(false);

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
    // Use stale-while-revalidate cache — instant tab switches
    cachedFetch(`abs-${pid}-${date}`, () => listAbsences(pid, date), 30_000).then(setAbsences).catch(console.error);
    cachedFetch(`subs-${pid}-${date}`, () => listSubstitutions(pid, date), 30_000).then(setSubs).catch(console.error);
    // Batch: pending slots + top-3 suggestions per slot in ONE call
    cachedFetch(`pending-${pid}-${date}`, () => listPendingWithSuggestions(pid, date), 30_000)
      .then(res => {
        setAbsentSlots(res.slots);
        setSuggestionsMap(res.suggestions);
      })
      .catch(console.error);
  }, [pid, date]);

  useEffect(() => { loadDayData(); }, [loadDayData]);

  /** Invalidate cache and reload fresh data */
  const refreshData = useCallback(() => {
    invalidateCachePrefix(`abs-${pid}`);
    invalidateCachePrefix(`subs-${pid}`);
    invalidateCachePrefix(`pending-${pid}`);
    loadDayData();
  }, [pid, loadDayData]);

  /** Flash a message that auto-clears */
  const flash = useCallback((m: string) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 4000);
  }, []);

  const teacherName = (id: number) => {
    const t = teachers.find(t => t.id === id);
    return t ? `${t.first_name} ${t.last_name}`.trim() : `#${id}`;
  };

  async function handleMarkAbsent() {
    if (!selectedAbsent.length) return;
    setLoading(true); setMsg("");
    try {
      const res = await markAbsent(pid, { date, teacher_ids: selectedAbsent, reason });
      // Merge new slots into existing (de-duplicate by teacher_id + period_index)
      setAbsentSlots(prev => {
        const existing = new Set(prev.map(s => `${s.teacher_id}-${s.period_index}`));
        const newOnes = res.slots.filter(s => !existing.has(`${s.teacher_id}-${s.period_index}`));
        return [...prev, ...newOnes];
      });
      flash(`✅ ${res.absences_created.length} teacher(s) marked absent. ${res.slots.length} period(s) need coverage.`);
      setSelectedAbsent([]); setReason("");
      refreshData();
    } catch (e) { flash(`❌ ${e instanceof Error ? e.message : "Error"}`); }
    finally { setLoading(false); }
  }

  /** Optimistic one-click assign: UI updates instantly, API in background */
  async function handleDirectAssign(slot: AbsentSlot, teacher: { teacher_id: number; teacher_name: string }, force = false) {
    const slotKey = `${slot.teacher_id}-${slot.period_index}`;
    // 1. Optimistic: remove slot from pending immediately
    setAssigningKeys(prev => new Set(prev).add(slotKey));
    const prevSlots = absentSlots;
    setAbsentSlots(prev => prev.filter(s => !(s.teacher_id === slot.teacher_id && s.period_index === slot.period_index)));
    setExpandedSlot(null); setConfirm(null);
    flash(`⚡ Assigning ${teacher.teacher_name} to L${slot.period_index + 1}...`);

    try {
      const res = await assignSubstitute(pid, {
        date, period_index: slot.period_index, absent_teacher_id: slot.teacher_id,
        sub_teacher_id: teacher.teacher_id, lesson_id: slot.lesson_id, room_id: slot.room_id,
        force_override: force,
      });
      flash(`✅ ${res.message}`);
      refreshData();
    } catch (e: unknown) {
      // Rollback on error
      setAbsentSlots(prevSlots);
      const err = e as { status?: number; detail?: { code?: string; teacher_name?: string; sub_count?: number } };
      if (err.status === 409 && err.detail?.code === "LIMIT_EXCEEDED") {
        if (window.confirm(`${err.detail.teacher_name} has ${err.detail.sub_count} subs this week (limit 2). Override?`)) {
          await handleDirectAssign(slot, teacher, true);
        }
      } else {
        flash(`❌ ${e instanceof Error ? e.message : "Assignment failed"}`);
      }
    } finally {
      setAssigningKeys(prev => { const s = new Set(prev); s.delete(slotKey); return s; });
    }
  }

  async function handleFindFree(period: number, absentTeacherId: number) {
    const key = `${absentTeacherId}-${period}`;
    if (expandedSlot === key) { setExpandedSlot(null); return; }
    const absentIds = absences.map(a => a.teacher_id);
    try {
      const free = await getFreeTeachers(pid, date, period, absentIds);
      setFreeMap(prev => ({ ...prev, [key]: free }));
      setFreeCount(prev => ({ ...prev, [key]: free.length }));
      setExpandedSlot(key);
      setConfirm(null);
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
  }

  function handleSelectTeacher(slot: AbsentSlot, ft: FreeTeacher) {
    setConfirm({
      period: slot.period_index,
      absentTeacherId: slot.teacher_id,
      absentTeacherName: teacherName(slot.teacher_id),
      subTeacher: ft,
      lessonId: slot.lesson_id,
      roomId: slot.room_id,
      subjectName: slot.subject_name || "",
      className: slot.class_name || "",
      roomName: slot.room_name || "",
    });
    setOverrideWarning(null);
  }

  async function handleConfirmAssign(forceOverride = false) {
    if (!confirm) return;
    try {
      const res = await assignSubstitute(pid, {
        date, period_index: confirm.period, absent_teacher_id: confirm.absentTeacherId,
        sub_teacher_id: confirm.subTeacher.teacher_id, lesson_id: confirm.lessonId, room_id: confirm.roomId,
        force_override: forceOverride,
      });
      flash(`✅ ${res.message}`);
      // Remove the assigned slot from absentSlots in-place
      setAbsentSlots(prev => prev.filter(
        s => !(s.teacher_id === confirm.absentTeacherId && s.period_index === confirm.period)
      ));
      setExpandedSlot(null); setConfirm(null); setOverrideWarning(null);
      refreshData();
    } catch (e: unknown) {
      const err = e as { status?: number; detail?: { code?: string; teacher_name?: string; sub_count?: number } };
      if (err.status === 409 && err.detail?.code === "LIMIT_EXCEEDED") {
        setOverrideWarning({
          teacherName: err.detail.teacher_name || "Teacher",
          subCount: err.detail.sub_count || 2,
          period: confirm.period, absentTeacherId: confirm.absentTeacherId,
          subTeacherId: confirm.subTeacher.teacher_id, lessonId: confirm.lessonId, roomId: confirm.roomId,
        });
      } else {
        setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`);
      }
    }
  }

  async function handleExportPDF() {
    try {
      await exportSubstitutionsPDF(pid, date);
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF export failed. Please log in again.");
    }
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
            <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--slate-400)", display: "flex", alignItems: "center", gap: 6 }}>
              <span className="live-indicator" /> Week {selectedWeek.week_number}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {weeks.length > 0 && (
            <select value={selectedWeek?.id || ""} onChange={e => { const w = weeks.find(wk => wk.id === Number(e.target.value)); if (w) setSelectedWeek(w); }}
              style={{ padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--slate-300)", fontSize: "0.78rem", background: "#fff", fontWeight: 600, maxWidth: 260 }}>
              {weeks.map(w => (
                <option key={w.id} value={w.id}>Week {w.week_number} · {fmtShort(w.start_date)}–{fmtShort(w.end_date)}{w.is_current ? " (current)" : ""}</option>
              ))}
            </select>
          )}
          <button onClick={handleExportPDF} className="btn btn-secondary" style={{ fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>Export PDF</button>
          <a href={`/project/${pid}/substitution-records`} className="btn btn-secondary"
            style={{ fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap", textDecoration: "none" }}>
            📋 Records
          </a>
        </div>
      </div>

      {msg && <div className={msg.startsWith("✅") ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: 12 }}>{msg}</div>}

      {/* ── Absent Today ── */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
          ABSENT TODAY — {fmtDate(date).toUpperCase()}
        </div>
        <div className="card" style={{ padding: "0.65rem 1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {absences.map(a => (
              <span key={a.id} className={removingChips.has(a.id) ? "chip-removing" : ""} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px 4px 8px", borderRadius: "var(--radius-full)",
                background: "var(--danger-50)", border: "1px solid var(--danger-100)",
                fontSize: "0.78rem", fontWeight: 600, color: "var(--danger-600)",
                transformOrigin: "center left",
              }}>
                {a.teacher_name}
                <button onClick={() => {
                  const removed = a;
                  setRemovingChips(prev => new Set(prev).add(a.id));
                  setTimeout(() => {
                    setAbsences(prev => prev.filter(x => x.id !== a.id));
                    setRemovingChips(prev => { const s = new Set(prev); s.delete(a.id); return s; });
                  }, 150);
                  removeAbsence(pid, a.id).catch(() => {
                    setAbsences(prev => [...prev, removed]);
                  });
                }}
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
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setAbsentSlots([]); setConfirm(null); }} style={{ maxWidth: 160 }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 600 }}>Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Sick leave" />
          </div>
        </div>
        {/* Search teachers */}
        <div style={{ position: "relative", marginBottom: 6 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.82rem", color: "var(--slate-400)", pointerEvents: "none" }}>🔍</span>
          <input
            value={teacherSearch}
            onChange={e => setTeacherSearch(e.target.value)}
            placeholder="Search by name or code…"
            style={{ paddingLeft: 32, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--slate-200)", borderRadius: "var(--radius-md)", padding: 4, marginBottom: 8 }}>
          {teachers
            .filter(t => {
              if (!teacherSearch.trim()) return true;
              const q = teacherSearch.toLowerCase();
              const full = `${t.first_name} ${t.last_name} ${t.code}`.toLowerCase();
              return full.includes(q);
            })
            .map(t => {
            const checked = selectedAbsent.includes(t.id);
            const alreadyAbsent = absences.some(a => a.teacher_id === t.id);
            return (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                background: alreadyAbsent ? "var(--danger-50)" : checked ? "var(--primary-50)" : "transparent", opacity: alreadyAbsent ? 0.5 : 1,
              }}>
                <input type="checkbox" checked={checked || alreadyAbsent} disabled={alreadyAbsent}
                  onChange={() => setSelectedAbsent(prev => checked ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  style={{ accentColor: "var(--primary-500)", width: 15, height: 15 }} />
                <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{t.first_name} {t.last_name}</span>
                <span style={{ color: "var(--slate-400)", fontSize: "0.68rem", fontFamily: "var(--font-mono)" }}>{t.code}</span>
              </label>
            );
          })}
        </div>
        <button onClick={handleMarkAbsent} disabled={loading || !selectedAbsent.length} className="btn btn-danger" style={{ fontSize: "0.82rem" }}>
          {loading ? "⏳ Processing…" : `Mark ${selectedAbsent.length} Teacher(s) Absent`}
        </button>
      </div>

      {/* ── Cover Specific Lesson (busy teacher) ── */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 1rem", borderBottom: showCoverLesson ? "1px solid var(--slate-200)" : "none" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-900)" }}>Cover Specific Lesson</div>
            <div style={{ fontSize: "0.65rem", color: "var(--slate-400)" }}>For teachers who are present but busy or unavailable for a specific lesson</div>
          </div>
          <button onClick={() => setShowCoverLesson(!showCoverLesson)} className="btn" style={{ fontSize: "0.72rem", padding: "3px 12px" }}>
            {showCoverLesson ? "Hide" : "Show"}
          </button>
        </div>
        {showCoverLesson && (
          <div style={{ padding: "0.65rem 1rem" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, display: "block", marginBottom: 4 }}>Select Teacher</label>
                <SearchableSelect
                  value={coverTeacherId || ""}
                  onChange={v => {
                    const id = v ? Number(v) : null;
                    setCoverTeacherId(id);
                    setCoverSlots([]);
                  }}
                  options={teachers.filter(t => !absences.some(a => a.teacher_id === t.id)).map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name} (${t.code})` }))}
                  placeholder="— Choose a teacher —"
                  style={{ width: "100%" }}
                />
              </div>
              <button
                disabled={!coverTeacherId || coverLoading}
                onClick={async () => {
                  if (!coverTeacherId) return;
                  setCoverLoading(true);
                  try {
                    const slots = await getTeacherSlots(pid, date, coverTeacherId);
                    setCoverSlots(slots);
                    if (slots.length === 0) setMsg("ℹ️ This teacher has no scheduled lessons on this day.");
                  } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
                  finally { setCoverLoading(false); }
                }}
                className="btn btn-primary" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                {coverLoading ? "⏳…" : "Load Schedule"}
              </button>
            </div>

            {/* Show the teacher's lessons for the day */}
            {coverSlots.length > 0 && (
              <div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", marginBottom: 6 }}>
                  {teacherName(coverTeacherId!).toUpperCase()} — LESSONS TO COVER
                </div>
                {coverSlots.sort((a, b) => a.period_index - b.period_index).map(slot => {
                  const key = `cover-${coverTeacherId}-${slot.period_index}`;
                  const isExpanded = expandedSlot === key;
                  const freeTeachers = freeMap[key] || [];
                  const assigned = subs.find(s => s.absent_teacher_id === coverTeacherId && s.period_index === slot.period_index);
                  const isConfirming = confirm?.period === slot.period_index && confirm?.absentTeacherId === coverTeacherId;

                  return (
                    <div key={slot.period_index} className="card" style={{ padding: 0, marginBottom: 8, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.65rem 1rem", cursor: !assigned ? "pointer" : undefined }}
                        onClick={() => {
                          if (assigned) return;
                          const coverKey = `cover-${coverTeacherId}-${slot.period_index}`;
                          if (expandedSlot === coverKey) { setExpandedSlot(null); return; }
                          const absentIds = absences.map(a => a.teacher_id).concat([coverTeacherId!]);
                          getFreeTeachers(pid, date, slot.period_index, absentIds).then(free => {
                            setFreeMap(prev => ({ ...prev, [coverKey]: free }));
                            setFreeCount(prev => ({ ...prev, [coverKey]: free.length }));
                            setExpandedSlot(coverKey);
                            setConfirm(null);
                          }).catch(e => setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`));
                        }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%",
                          background: assigned ? "var(--success-50)" : "var(--primary-50)",
                          color: assigned ? "var(--success-600)" : "var(--primary-600)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
                        }}>L{slot.period_index + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-900)" }}>
                            {slot.subject_name || "Lesson"} · {slot.class_name || "Class"}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                            {slot.room_name && <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--slate-100)", fontSize: "0.65rem", fontWeight: 600, color: "var(--slate-600)" }}>{slot.room_name}</span>}
                            <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--warning-50)", border: "1px solid var(--warning-100)", fontSize: "0.62rem", fontWeight: 700, color: "var(--warning-600)" }}>
                              {teacherName(coverTeacherId!)} busy
                            </span>
                          </div>
                        </div>
                        {assigned ? (
                          <span style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", background: "var(--success-50)", border: "1px solid var(--success-100)", fontSize: "0.72rem", fontWeight: 700, color: "var(--success-600)" }}>Covered</span>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", background: "var(--warning-50)", border: "1px solid var(--warning-100)", fontSize: "0.72rem", fontWeight: 700, color: "var(--warning-600)" }}>Needs Cover</span>
                        )}
                      </div>

                      {/* Free teachers list */}
                      {isExpanded && !isConfirming && (
                        <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid var(--slate-200)", background: "var(--slate-50)" }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--slate-500)", marginBottom: 6 }}>Available teachers ({freeTeachers.length})</div>
                          {freeTeachers.length === 0 && <div style={{ fontSize: "0.78rem", color: "var(--slate-400)", padding: "4px 0" }}>No free teachers available</div>}
                          {freeTeachers.map(ft => (
                            <div key={ft.teacher_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", cursor: "pointer" }}
                              onClick={() => handleSelectTeacher(slot, ft)}>
                              <Initials name={ft.teacher_name} color={avatarColor(ft.teacher_id)} size={28} />
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{ft.teacher_name}</span>
                                <span style={{ fontSize: "0.65rem", color: "var(--slate-400)", marginLeft: 6 }}>{ft.periods_today} lessons today</span>
                              </div>
                              {ft.subs_this_week !== undefined && <SubBadge count={ft.subs_this_week} max={2} />}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Confirmation */}
                      {isConfirming && confirm && !overrideWarning && (
                        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--slate-200)", background: "var(--slate-50)" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 8 }}>Confirm: Assign {confirm.subTeacher.teacher_name}?</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handleConfirmAssign()} className="btn btn-primary" style={{ fontSize: "0.78rem" }}>✓ Assign</button>
                            <button onClick={() => { setConfirm(null); setExpandedSlot(null); }} className="btn" style={{ fontSize: "0.78rem" }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* Assigned row */}
                      {assigned && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.55rem 1rem", borderTop: "1px solid var(--success-100)", background: "var(--success-50)" }}>
                          <Initials name={assigned.sub_teacher_name} color={avatarColor(assigned.sub_teacher_id)} size={30} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--success-700)" }}>
                              {assigned.sub_teacher_name} covering Lesson {assigned.period_index + 1}
                            </span>
                          </div>
                          <span style={{ color: "var(--success-600)", fontSize: "1.1rem" }}>✓</span>
                          <button onClick={async () => { await deleteSubstitution(pid, assigned.id); loadDayData(); const coverKey2 = `cover-${coverTeacherId}-${slot.period_index}`; setExpandedSlot(coverKey2); const absentIds2 = absences.map(a => a.teacher_id).concat([coverTeacherId!]); const free = await getFreeTeachers(pid, date, slot.period_index, absentIds2); setFreeMap(prev => ({ ...prev, [coverKey2]: free })); setFreeCount(prev => ({ ...prev, [coverKey2]: free.length })); }}
                            className="btn" style={{ fontSize: "0.68rem", padding: "3px 10px", background: "var(--primary-50)", color: "var(--primary-600)", border: "1px solid var(--primary-200)" }}>🔄 Reassign</button>
                          <button onClick={async () => { if (window.confirm(`Unassign ${assigned.sub_teacher_name}?`)) { await deleteSubstitution(pid, assigned.id); loadDayData(); } }}
                            className="btn" style={{ fontSize: "0.68rem", padding: "3px 10px", background: "var(--danger-50)", color: "var(--danger-600)", border: "1px solid var(--danger-200)" }}>✕ Unassign</button>
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
            const numFree = freeCount[key] || 0;
            const assigned = subs.find(s => s.absent_teacher_id === Number(tId) && s.period_index === slot.period_index);
            const isConfirming = confirm?.period === slot.period_index && confirm?.absentTeacherId === Number(tId);
            const suggested = suggestionsMap[key] || [];
            const bestFit = suggested.find(s => s.best_fit) || suggested[0];
            const isAssigning = assigningKeys.has(key);

            return (
              <div key={slot.period_index} className="card" style={{ padding: 0, marginBottom: 8, overflow: "hidden" }}>
                {/* Period header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.75rem 1rem", cursor: !assigned ? "pointer" : undefined }}
                  onClick={() => !assigned && handleFindFree(slot.period_index, Number(tId))}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: assigned ? "var(--success-50)" : isAssigning ? "var(--primary-100)" : isConfirming ? "var(--warning-50)" : "var(--primary-50)",
                    color: assigned ? "var(--success-600)" : isConfirming ? "var(--warning-600)" : "var(--primary-600)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
                  }}>P{slot.period_index + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-900)" }}>
                      {slot.subject_name || "Lesson"} · {slot.class_name || "Class"}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                      {slot.class_name && <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--slate-100)", fontSize: "0.65rem", fontWeight: 600, color: "var(--slate-600)" }}>{slot.class_name}</span>}
                      {slot.room_name && <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--slate-100)", fontSize: "0.65rem", fontWeight: 600, color: "var(--slate-600)" }}>{slot.room_name}</span>}
                      <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--danger-50)", border: "1px solid var(--danger-100)", fontSize: "0.62rem", fontWeight: 700, color: "var(--danger-600)" }}>
                        {teacherName(Number(tId))} absent
                      </span>
                    </div>
                  </div>
                  {assigned ? (
                    <span style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", background: "var(--success-50)", border: "1px solid var(--success-100)", fontSize: "0.72rem", fontWeight: 700, color: "var(--success-600)" }}>Assigned</span>
                  ) : isAssigning ? (
                    <span style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", background: "var(--primary-50)", border: "1px solid var(--primary-200)", fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-600)" }}>⚡ Assigning…</span>
                  ) : bestFit && !isExpanded && !isConfirming ? (
                    /* ★ Inline auto-suggest: one-click assign */
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDirectAssign(slot, bestFit); }}
                        style={{
                          padding: "5px 14px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer",
                          background: "var(--primary-500)", color: "#fff", fontSize: "0.72rem", fontWeight: 700,
                          display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                        }}
                      >
                        ⚡ Assign {bestFit.teacher_name.split(" ")[0]}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFindFree(slot.period_index, Number(tId)); }}
                        style={{
                          padding: "5px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--slate-300)",
                          background: "var(--slate-50)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600,
                          color: "var(--slate-500)", whiteSpace: "nowrap",
                        }}
                      >More ▾</button>
                    </div>
                  ) : isConfirming ? (
                    <span style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", background: "var(--warning-50)", border: "1px solid var(--warning-200)", fontSize: "0.72rem", fontWeight: 700, color: "var(--warning-600)" }}>Confirming…</span>
                  ) : (
                    <span style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", background: "var(--warning-50)", border: "1px solid var(--warning-100)", fontSize: "0.72rem", fontWeight: 700, color: "var(--warning-600)" }}>Unassigned</span>
                  )}
                </div>

                {/* ── Confirmation panel ── */}
                {isConfirming && confirm && !overrideWarning && (
                  <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--slate-200)", background: "var(--slate-50)" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-900)", marginBottom: 10 }}>Confirm substitution assignment</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: "0.78rem", marginBottom: 12 }}>
                      <div><span style={{ color: "var(--slate-400)", display: "block", fontSize: "0.65rem" }}>Assigned teacher</span><strong>{confirm.subTeacher.teacher_name}</strong></div>
                      <div><span style={{ color: "var(--slate-400)", display: "block", fontSize: "0.65rem" }}>Covering for</span><strong>{confirm.absentTeacherName}</strong></div>
                      <div><span style={{ color: "var(--slate-400)", display: "block", fontSize: "0.65rem" }}>Class</span><strong>{confirm.className}</strong></div>
                      <div><span style={{ color: "var(--slate-400)", display: "block", fontSize: "0.65rem" }}>Period & time</span><strong>Period {confirm.period + 1}</strong></div>
                      <div><span style={{ color: "var(--slate-400)", display: "block", fontSize: "0.65rem" }}>Room</span><strong>{confirm.roomName || "—"}</strong></div>
                      <div><span style={{ color: "var(--slate-400)", display: "block", fontSize: "0.65rem" }}>Subject</span><strong>{confirm.subjectName || confirm.subTeacher.subject || "—"}</strong></div>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--slate-500)", marginBottom: 12 }}>
                      After confirming, {confirm.subTeacher.teacher_name}'s week {selectedWeek?.week_number || ""} workload will update to {confirm.subTeacher.scheduled} + {confirm.subTeacher.subs_this_week + 1} subs = {confirm.subTeacher.total + 1} total.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleConfirmAssign(false)} className="btn" style={{ fontWeight: 700, fontSize: "0.82rem" }}>Confirm assignment</button>
                      <button onClick={() => setConfirm(null)} className="btn btn-secondary" style={{ fontSize: "0.78rem" }}>Change teacher</button>
                    </div>
                  </div>
                )}

                {/* ── Override warning ── */}
                {isConfirming && overrideWarning && (
                  <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--warning-200)", background: "var(--warning-50)" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--warning-700)", marginBottom: 4 }}>
                      ⚠ {overrideWarning.teacherName} has already taken {overrideWarning.subCount} substitutions this week
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--slate-600)", marginBottom: 10 }}>
                      Assigning another will exceed the weekly limit of 2. This will be flagged in the workload report as an excess substitution.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleConfirmAssign(true)} className="btn btn-danger" style={{ fontSize: "0.78rem", fontWeight: 700 }}>Yes, assign anyway</button>
                      <button onClick={() => { setOverrideWarning(null); setConfirm(null); }} className="btn btn-secondary" style={{ fontSize: "0.78rem" }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* ── Free teacher candidates ── */}
                {isExpanded && !isConfirming && (
                  <div style={{ padding: "0.65rem 1rem", borderTop: "1px solid var(--slate-200)" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--slate-400)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary-500)", display: "inline-block" }} />
                      Only showing teachers with no class in Period {slot.period_index + 1} on {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}s · <strong>{numFree} teachers free</strong>
                    </div>

                    {freeTeachers.length === 0 ? (
                      <div style={{ color: "var(--slate-400)", fontSize: "0.82rem", padding: "0.5rem 0" }}>No free teachers available for this period.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {freeTeachers.map(ft => (
                          <div key={ft.teacher_id} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)",
                            border: ft.best_fit ? "1.5px solid var(--primary-300)" : ft.sub_limit_reached ? "1.5px solid var(--danger-200)" : "1px solid var(--slate-200)",
                            background: ft.best_fit ? "var(--primary-50)" : ft.sub_limit_reached ? "var(--danger-50)" : "var(--slate-50)",
                          }}>
                            <Initials name={ft.teacher_name} color={avatarColor(ft.teacher_id)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--slate-900)" }}>{ft.teacher_name}</span>
                                {ft.best_fit && <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--primary-500)", color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>Best fit</span>}
                                {ft.sub_limit_reached && <span style={{ padding: "1px 8px", borderRadius: "var(--radius-full)", background: "var(--danger-100)", color: "var(--danger-600)", fontSize: "0.6rem", fontWeight: 700 }}>At limit</span>}
                              </div>
                              <div style={{ fontSize: "0.68rem", color: "var(--slate-500)", display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                                {ft.subject && <span>{ft.subject}</span>}
                                {/* Free period badge */}
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 3,
                                  padding: "1px 6px", borderRadius: "var(--radius-full)",
                                  background: "var(--success-50)", border: "1px solid var(--success-200)",
                                  fontSize: "0.6rem", fontWeight: 700, color: "var(--success-600)",
                                }}>
                                  🟢 {ft.free_period_label}
                                </span>
                                <span style={{ color: "var(--slate-400)" }}>{ft.periods_today} periods today</span>
                              </div>
                            </div>

                            {/* Workload bar */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                              {selectedWeek && <span style={{ fontSize: "0.62rem", color: "var(--slate-400)", whiteSpace: "nowrap" }}>Wk {selectedWeek.week_number}</span>}
                              <div style={{ width: 70, height: 5, background: "var(--slate-200)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                  width: `${Math.min(ft.utilization_pct, 100)}%`, height: "100%", borderRadius: 3,
                                  background: ft.utilization_pct > 100 ? "var(--danger-500)" : ft.utilization_pct > 85 ? "var(--warning-500)" : "var(--primary-500)",
                                  transition: "width 0.3s",
                                }} />
                              </div>
                              <span style={{ fontSize: "0.62rem", color: "var(--slate-400)", whiteSpace: "nowrap" }}>{ft.scheduled} + {ft.subs_this_week}</span>
                            </div>

                            <SubBadge count={ft.subs_this_week} max={2} />

                            {ft.sub_limit_reached ? (
                              <button onClick={() => handleSelectTeacher(slot, ft)} className="btn btn-danger"
                                style={{ padding: "0.35rem 1rem", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>Override</button>
                            ) : (
                              <button onClick={() => handleSelectTeacher(slot, ft)} className="btn"
                                style={{ padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>Assign</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Assigned summary row ── */}
                {assigned && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "0.55rem 1rem", borderTop: "1px solid var(--success-100)",
                    background: "var(--success-50)",
                  }}>
                    <Initials name={assigned.sub_teacher_name} color={avatarColor(assigned.sub_teacher_id)} size={30} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--success-700)" }}>
                        {assigned.sub_teacher_name} covering Lesson {assigned.period_index + 1}
                      </span>
                      <div style={{ fontSize: "0.68rem", color: "var(--slate-500)" }}>
                        {slot.class_name} · {slot.room_name || ""} · In place of {teacherName(Number(tId))}
                      </div>
                    </div>
                    <span style={{ color: "var(--success-600)", fontSize: "1.1rem" }}>✓</span>
                    <button onClick={async () => {
                      await deleteSubstitution(pid, assigned.id);
                      loadDayData();
                      // Immediately open the free teacher list to reassign
                      handleFindFree(slot.period_index, Number(tId));
                    }}
                      className="btn" style={{
                        fontSize: "0.68rem", padding: "3px 10px", fontWeight: 700,
                        background: "var(--primary-50)", color: "var(--primary-600)",
                        border: "1px solid var(--primary-200)",
                      }}
                      title="Remove current substitute and pick a new one">🔄 Reassign</button>
                    <button onClick={async () => {
                      if (!confirm || window.confirm(`Unassign ${assigned.sub_teacher_name} from Lesson ${assigned.period_index + 1}?`)) {
                        await deleteSubstitution(pid, assigned.id);
                        loadDayData();
                      }
                    }}
                      className="btn" style={{
                        fontSize: "0.68rem", padding: "3px 10px", fontWeight: 700,
                        background: "var(--danger-50)", color: "var(--danger-600)",
                        border: "1px solid var(--danger-200)",
                      }}
                      title="Remove this substitute assignment">✕ Unassign</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
