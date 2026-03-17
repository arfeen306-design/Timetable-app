import { useState, useEffect, useMemo, useRef } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";

type Constraint = Awaited<ReturnType<typeof api.listConstraints>>[0];
type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type SchoolClass = Awaited<ReturnType<typeof api.listClasses>>[0];
type Room = Awaited<ReturnType<typeof api.listRooms>>[0];
type Subject = Awaited<ReturnType<typeof api.listSubjects>>[0];
type Lesson = Awaited<ReturnType<typeof api.listLessons>>[0];

type DailyLimits = {
  global_max: number;
  overrides: { teacher_id: number; class_id: number; subject_id: number; max_per_day: number }[];
  force_spread: boolean;
  double_period_allowed: { lesson_id: number }[];
};

interface Props {
  pid: number;
  constraints: Constraint[];
  teachers: Teacher[];
  classes: SchoolClass[];
  rooms: Room[];
  subjects: Subject[];
  lessons: Lesson[];
  settings: { days_per_week: number; periods_per_day: number; weekend_days?: string; bell_schedule_json?: string; daily_limits_json?: string } | null;
  onChange: (c: Constraint[]) => void;
  onSettingsRefresh: () => void;
  onNext: () => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ConstraintsTab({ pid, constraints, teachers, classes, rooms, subjects, lessons, settings, onChange, onSettingsRefresh, onNext }: Props) {
  const toast = useToast();
  const [entityType, setEntityType] = useState<"teacher" | "class" | "room">("teacher");
  const [entityId, setEntityId] = useState<number | null>(null);
  const [allMode, setAllMode] = useState(false); // "All Classes" / "All Teachers" mode
  const [saving, setSaving] = useState(false);

  /* LOCAL unavailable set — toggles happen instantly in memory */
  const [localUnavailable, setLocalUnavailable] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const numPeriods = settings?.periods_per_day ?? 7;

  // Compute working day indices: show all 7 days, exclude only weekend days
  const workingDayIndices = useMemo(() => {
    const weekendSet = new Set<number>();
    const wd = settings?.weekend_days || "5,6";
    wd.split(",").filter(Boolean).forEach(d => weekendSet.add(parseInt(d.trim())));
    const indices: number[] = [];
    for (let d = 0; d < 7; d++) {
      if (!weekendSet.has(d)) indices.push(d);
    }
    return indices;
  }, [settings]);

  const days = workingDayIndices.map(i => DAY_NAMES[i] || `Day${i + 1}`);

  /* ── Entity list ── */
  const entityList = useMemo(() => {
    if (entityType === "teacher")
      return teachers.map(t => ({ id: t.id, label: `${t.title || ""} ${t.first_name} ${t.last_name}`.trim() + (t.code ? ` (${t.code})` : "") }));
    if (entityType === "class")
      return classes.map(c => ({ id: c.id, label: c.name + (c.code ? ` (${c.code})` : "") }));
    return rooms.map(r => ({ id: r.id, label: r.name + (r.code ? ` (${r.code})` : "") }));
  }, [entityType, teachers, classes, rooms]);

  /* Auto-select first entity when type changes */
  useEffect(() => {
    setAllMode(false);
    if (entityList.length > 0) {
      setEntityId(prev => entityList.find(e => e.id === prev) ? prev : entityList[0].id);
    } else {
      setEntityId(null);
    }
  }, [entityType, entityList]);

  /* ── Sync local state from server constraints when entity changes ── */
  useEffect(() => {
    if (allMode) {
      const ids = entityList.map(e => e.id);
      if (ids.length === 0) { setLocalUnavailable(new Set()); return; }
      const sets = ids.map(id => {
        const s = new Set<string>();
        constraints.filter(c => c.entity_type === entityType && c.entity_id === id)
          .forEach(c => s.add(`${c.day_index}-${c.period_index}`));
        return s;
      });
      const intersection = new Set<string>();
      if (sets.length > 0) {
        sets[0].forEach(key => {
          if (sets.every(s => s.has(key))) intersection.add(key);
        });
      }
      setLocalUnavailable(intersection);
      setDirty(false);
      return;
    }
    if (entityId == null) { setLocalUnavailable(new Set()); return; }
    const s = new Set<string>();
    constraints
      .filter(c => c.entity_type === entityType && c.entity_id === entityId)
      .forEach(c => s.add(`${c.day_index}-${c.period_index}`));
    setLocalUnavailable(s);
    setDirty(false);
  }, [entityId, entityType, constraints, allMode, entityList]);

  /* ── Toggle a single slot ── */
  function toggleSlot(day: number, period: number) {
    const key = `${day}-${period}`;
    setLocalUnavailable(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setDirty(true);
  }

  /* ── Toggle whole day ── */
  function toggleWholeDay(day: number) {
    setLocalUnavailable(prev => {
      const next = new Set(prev);
      const allUnavail = Array.from({ length: numPeriods }, (_, p) => `${day}-${p}`).every(k => next.has(k));
      for (let p = 0; p < numPeriods; p++) {
        const k = `${day}-${p}`;
        if (allUnavail) next.delete(k); else next.add(k);
      }
      return next;
    });
    setDirty(true);
  }

  function isAvailable(day: number, period: number): boolean {
    return !localUnavailable.has(`${day}-${period}`);
  }
  function isWholeDayUnavailable(day: number): boolean {
    return Array.from({ length: numPeriods }, (_, p) => `${day}-${p}`).every(k => localUnavailable.has(k));
  }

  /* ── SAVE: batch sync to backend ── */
  async function saveConstraints() {
    setSaving(true);
    try {
      if (allMode) {
        const ids = entityList.map(e => e.id);
        let totalAdded = 0, totalRemoved = 0;
        for (const eid of ids) {
          const existing = constraints.filter(c => c.entity_type === entityType && c.entity_id === eid);
          const existingKeys = new Set(existing.map(c => `${c.day_index}-${c.period_index}`));
          const toAdd: { day: number; period: number }[] = [];
          localUnavailable.forEach(key => {
            if (!existingKeys.has(key)) {
              const [d, p] = key.split("-").map(Number);
              toAdd.push({ day: d, period: p });
            }
          });
          const toRemove = existing.filter(c => !localUnavailable.has(`${c.day_index}-${c.period_index}`));
          const delP = toRemove.map(c => api.deleteConstraint(pid, c.id));
          const addP = toAdd.map(a => api.createConstraint(pid, { entity_type: entityType, entity_id: eid, day_index: a.day, period_index: a.period, is_hard: true }));
          await Promise.all([...delP, ...addP]);
          totalAdded += toAdd.length;
          totalRemoved += toRemove.length;
        }
        const fresh = await api.listConstraints(pid);
        onChange(fresh);
        setDirty(false);
        toast("success", `Applied to all ${ids.length} ${entityType}s (${totalAdded} added, ${totalRemoved} removed across all).`);
      } else {
        if (entityId == null) return;
        const existing = constraints.filter(c => c.entity_type === entityType && c.entity_id === entityId);
        const existingKeys = new Set(existing.map(c => `${c.day_index}-${c.period_index}`));
        const toAdd: { day: number; period: number }[] = [];
        localUnavailable.forEach(key => {
          if (!existingKeys.has(key)) {
            const [d, p] = key.split("-").map(Number);
            toAdd.push({ day: d, period: p });
          }
        });
        const toRemove = existing.filter(c => !localUnavailable.has(`${c.day_index}-${c.period_index}`));
        await Promise.all([
          ...toRemove.map(c => api.deleteConstraint(pid, c.id)),
          ...toAdd.map(a => api.createConstraint(pid, { entity_type: entityType, entity_id: entityId, day_index: a.day, period_index: a.period, is_hard: true })),
        ]);
        const fresh = await api.listConstraints(pid);
        onChange(fresh);
        setDirty(false);
        toast("success", `Constraints saved (${toAdd.length} added, ${toRemove.length} removed).`);
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /* ── Auto-save + Next ── */
  async function handleNext() {
    if (dirty) {
      await saveConstraints();
    }
    if (limitsDirty) {
      await saveDailyLimits();
    }
    onNext();
  }

  // ═══════════════════════════════════════════════════════════
  // Daily Subject Limits Section
  // ═══════════════════════════════════════════════════════════
  const [limitsSearch, setLimitsSearch] = useState("");
  const [limitsDirty, setLimitsDirty] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);

  // Parse current daily limits from settings
  const [dailyLimits, setDailyLimits] = useState<DailyLimits>({ global_max: 1, overrides: [], force_spread: true, double_period_allowed: [] });

  useEffect(() => {
    try {
      const raw = settings?.daily_limits_json || "{}";
      const parsed = JSON.parse(raw);
      setDailyLimits({
        global_max: parsed.global_max ?? 1,
        overrides: Array.isArray(parsed.overrides) ? parsed.overrides : [],
        force_spread: parsed.force_spread ?? true,
        double_period_allowed: Array.isArray(parsed.double_period_allowed) ? parsed.double_period_allowed : [],
      });
    } catch {
      setDailyLimits({ global_max: 1, overrides: [], force_spread: true, double_period_allowed: [] });
    }
  }, [settings?.daily_limits_json]);

  // Build teacher/class/subject lookups
  const teacherMap = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, `${t.title || ""} ${t.first_name} ${t.last_name}`.trim()])), [teachers]);
  const classMap = useMemo(() => Object.fromEntries(classes.map(c => [c.id, c.name])), [classes]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, { name: s.name, code: s.code }])), [subjects]);

  // Build assignment rows from lessons
  const assignmentRows = useMemo(() => {
    return lessons.map(l => {
      const override = dailyLimits.overrides.find(
        o => o.teacher_id === l.teacher_id && o.class_id === l.class_id && o.subject_id === l.subject_id
      );
      return {
        teacher_id: l.teacher_id,
        class_id: l.class_id,
        subject_id: l.subject_id,
        periods_per_week: l.periods_per_week,
        teacher_name: teacherMap[l.teacher_id] || `Teacher #${l.teacher_id}`,
        class_name: classMap[l.class_id] || `Class #${l.class_id}`,
        subject_name: subjectMap[l.subject_id]?.name || `Subject #${l.subject_id}`,
        subject_code: subjectMap[l.subject_id]?.code || "",
        max_per_day: override?.max_per_day ?? dailyLimits.global_max,
        has_override: !!override,
      };
    });
  }, [lessons, dailyLimits, teacherMap, classMap, subjectMap]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!limitsSearch.trim()) return assignmentRows;
    const q = limitsSearch.toLowerCase();
    return assignmentRows.filter(
      r => r.teacher_name.toLowerCase().includes(q) || r.class_name.toLowerCase().includes(q) || r.subject_name.toLowerCase().includes(q)
    );
  }, [assignmentRows, limitsSearch]);

  // Warnings: check if lessons can fit
  const numWorkingDays = workingDayIndices.length;
  const warnings = useMemo(() => {
    const w: string[] = [];
    for (const r of assignmentRows) {
      if (r.periods_per_week > r.max_per_day * numWorkingDays) {
        w.push(`${r.subject_name} (${r.class_name}, ${r.teacher_name}): ${r.periods_per_week} lessons/week cannot fit into ${numWorkingDays} days with limit of ${r.max_per_day}/day.`);
      }
    }
    // Spread-specific warnings
    if (dailyLimits.force_spread) {
      const dpSet = new Set(dailyLimits.double_period_allowed.map(d => d.lesson_id));
      for (const l of lessons) {
        if (dpSet.has(l.id)) continue;
        if (l.periods_per_week > numWorkingDays * 2) {
          const sn = subjectMap[l.subject_id]?.name || `Subject #${l.subject_id}`;
          const cn = classMap[l.class_id] || `Class #${l.class_id}`;
          w.push(`⛔ ${sn} (${cn}): ${l.periods_per_week} lessons exceed max capacity of ${numWorkingDays * 2} (${numWorkingDays} days × 2). Generation will fail.`);
        }
      }
    }
    return w;
  }, [assignmentRows, numWorkingDays, dailyLimits.force_spread, dailyLimits.double_period_allowed, lessons, subjectMap, classMap]);

  function setGlobalMax(val: number) {
    setDailyLimits(prev => ({ ...prev, global_max: val }));
    setLimitsDirty(true);
  }

  function setOverride(teacher_id: number, class_id: number, subject_id: number, max_per_day: number) {
    setDailyLimits(prev => {
      const filtered = prev.overrides.filter(
        o => !(o.teacher_id === teacher_id && o.class_id === class_id && o.subject_id === subject_id)
      );
      // Only add override if different from global
      if (max_per_day !== prev.global_max) {
        filtered.push({ teacher_id, class_id, subject_id, max_per_day });
      }
      return { ...prev, overrides: filtered };
    });
    setLimitsDirty(true);
  }

  function toggleForceSpread() {
    setDailyLimits(prev => ({ ...prev, force_spread: !prev.force_spread }));
    setLimitsDirty(true);
  }

  function toggleDoublePeriod(lessonId: number) {
    setDailyLimits(prev => {
      const exists = prev.double_period_allowed.some(d => d.lesson_id === lessonId);
      return {
        ...prev,
        double_period_allowed: exists
          ? prev.double_period_allowed.filter(d => d.lesson_id !== lessonId)
          : [...prev.double_period_allowed, { lesson_id: lessonId }],
      };
    });
    setLimitsDirty(true);
  }

  async function saveDailyLimits() {
    setSavingLimits(true);
    try {
      await api.updateSchoolSettings(pid, {
        daily_limits_json: JSON.stringify(dailyLimits),
      });
      onSettingsRefresh();
      setLimitsDirty(false);
      toast("success", "Daily subject limits saved.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingLimits(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Constraints &amp; Availability</h2>
      <p className="subheading">Set availability for teachers, classes, and rooms.</p>

      {/* ── Entity selector row ── */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600, color: "#475569", fontSize: "0.9rem" }}>Entity Type:</label>
        <select value={entityType} onChange={e => { setEntityType(e.target.value as "teacher" | "class" | "room"); }} style={{ minWidth: 120 }}>
          <option value="teacher">Teacher</option>
          <option value="class">Class</option>
          <option value="room">Room</option>
        </select>

        <label style={{ fontWeight: 600, color: "#475569", fontSize: "0.9rem", marginLeft: "0.5rem" }}>Select:</label>
        <select
          value={allMode ? "__ALL__" : (entityId ?? "")}
          onChange={e => {
            if (e.target.value === "__ALL__") { setAllMode(true); setEntityId(null); }
            else { setAllMode(false); setEntityId(Number(e.target.value)); }
          }}
          style={{ minWidth: 200 }}
        >
          {/* ALL option */}
          <option value="__ALL__" style={{ fontWeight: 700, color: "#3b82f6" }}>
            ★ All {entityType === "teacher" ? "Teachers" : entityType === "class" ? "Classes" : "Rooms"}
          </option>
          {entityList.length === 0 && <option value="" disabled>No {entityType}s added</option>}
          {entityList.map(e => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>

        {allMode && (
          <span style={{ fontSize: "0.8rem", color: "#f59e0b", fontWeight: 600, background: "#fffbeb", padding: "0.2rem 0.6rem", borderRadius: 6 }}>
            ⚡ Bulk mode — changes apply to all {entityList.length} {entityType}s
          </span>
        )}
      </div>

      {/* ── Availability Grid ── */}
      {(entityId != null || allMode) && (
        <>
          <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#64748b", marginBottom: "0.75rem" }}>
            Availability Grid {allMode ? "(shared across all)" : ""} — uncheck to mark unavailable
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", minWidth: 160 }}></th>
                  {workingDayIndices.map((dayIdx, ci) => (
                    <th key={dayIdx} style={{ textAlign: "center", minWidth: 70 }}>{days[ci]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Unavailable whole day row */}
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <td style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Unavailable whole day</td>
                  {workingDayIndices.map((dayIdx) => (
                    <td key={dayIdx} style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={isWholeDayUnavailable(dayIdx)} onChange={() => toggleWholeDay(dayIdx)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#3b82f6" }} />
                    </td>
                  ))}
                </tr>
                {/* Period rows */}
                {Array.from({ length: numPeriods }, (_, pIdx) => (
                  <tr key={pIdx}>
                    <td style={{ fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>Lesson {pIdx + 1}</td>
                    {workingDayIndices.map((dayIdx) => (
                      <td key={dayIdx} style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={isAvailable(dayIdx, pIdx)} onChange={() => toggleSlot(dayIdx, pIdx)}
                          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#3b82f6" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {entityId == null && !allMode && entityList.length === 0 && (
        <div className="warning-banner">
          Please add {entityType}s first before setting constraints.
        </div>
      )}

      {/* ── Save Availability ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" className="btn btn-primary" onClick={saveConstraints} disabled={saving || !dirty}>
            {saving ? "Saving…" : allMode ? `Apply to All ${entityType === "teacher" ? "Teachers" : entityType === "class" ? "Classes" : "Rooms"}` : "Save Constraints"}
          </button>
          {dirty && <span style={{ color: "#e67e22", fontSize: "0.85rem", fontWeight: 500 }}>● Unsaved changes</span>}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* DAILY SUBJECT LIMITS SECTION                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <div style={{ marginTop: "2.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "1.5rem" }}>
        <h3 style={{ margin: "0 0 0.25rem", color: "#1e293b", fontSize: "1.15rem" }}>📊 Daily Subject Limits</h3>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
          Control how many times a subject can appear per day for a given teacher-class assignment. The solver will enforce these limits.
        </p>

        {/* Force Spread Toggle */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem",
          background: dailyLimits.force_spread ? "#ecfdf5" : "#f8fafc",
          border: dailyLimits.force_spread ? "1px solid #6ee7b7" : "1px solid #e2e8f0",
          padding: "0.75rem 1rem", borderRadius: 8,
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={dailyLimits.force_spread}
              onChange={toggleForceSpread}
              style={{ width: 18, height: 18, accentColor: "#10b981", cursor: "pointer" }}
            />
            <span style={{ fontWeight: 600, color: dailyLimits.force_spread ? "#065f46" : "#64748b", fontSize: "0.9rem" }}>
              Force Maximum Spread
            </span>
          </label>
          <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
            {dailyLimits.force_spread
              ? "ON — Lessons will be spread across all working days before doubling. (Hard Constraint)"
              : "OFF — Solver will use soft penalties to encourage spread, but may cluster."}
          </span>
        </div>

        {/* Global default */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", background: "#f1f5f9", padding: "0.75rem 1rem", borderRadius: 8 }}>
          <label style={{ fontWeight: 600, color: "#334155", fontSize: "0.9rem", whiteSpace: "nowrap" }}>
            Default max lessons per subject/day:
          </label>
          <select
            value={dailyLimits.global_max}
            onChange={e => setGlobalMax(Number(e.target.value))}
            style={{ width: 70, fontWeight: 600, fontSize: "1rem" }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            (applies to all assignments unless overridden below)
          </span>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 600, color: "#92400e", margin: 0, fontSize: "0.85rem" }}>⚠️ Scheduling Warnings</p>
            {warnings.map((w, i) => (
              <p key={i} style={{ color: "#78350f", fontSize: "0.8rem", margin: "0.3rem 0 0" }}>• {w}</p>
            ))}
          </div>
        )}

        {/* Search */}
        {lessons.length > 0 && (
          <>
            <div style={{ marginBottom: "0.75rem" }}>
              <input
                type="text"
                placeholder="🔍 Search by teacher, class, or subject..."
                value={limitsSearch}
                onChange={e => setLimitsSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 400, padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
              />
            </div>

            {/* Override table */}
            <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
              <table className="data-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Teacher</th>
                    <th style={{ textAlign: "left" }}>Class</th>
                    <th style={{ textAlign: "left" }}>Subject</th>
                    <th style={{ textAlign: "center" }}>Lessons/Week</th>
                    <th style={{ textAlign: "center" }}>Max/Day</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No assignments found.</td></tr>
                  )}
                  {filteredRows.map((r, i) => {
                    const impossible = r.periods_per_week > r.max_per_day * numWorkingDays;
                    return (
                      <tr key={i} style={impossible ? { background: "#fef2f2" } : r.has_override ? { background: "#eff6ff" } : undefined}>
                        <td style={{ fontSize: "0.85rem" }}>{r.teacher_name}</td>
                        <td style={{ fontSize: "0.85rem" }}>{r.class_name}</td>
                        <td style={{ fontSize: "0.85rem" }}>
                          {r.subject_code ? <span style={{ fontWeight: 600 }}>{r.subject_code}</span> : r.subject_name}
                          {r.subject_code && <span style={{ color: "#94a3b8", marginLeft: 4 }}>({r.subject_name})</span>}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{r.periods_per_week}</td>
                        <td style={{ textAlign: "center" }}>
                          <select
                            value={r.max_per_day}
                            onChange={e => setOverride(r.teacher_id, r.class_id, r.subject_id, Number(e.target.value))}
                            style={{
                              width: 55, fontWeight: 600, fontSize: "0.9rem", textAlign: "center",
                              color: r.has_override ? "#2563eb" : "#334155",
                              border: r.has_override ? "2px solid #3b82f6" : "1px solid #cbd5e1",
                              borderRadius: 4,
                            }}
                          >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save limits */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
              <button type="button" className="btn btn-primary" onClick={saveDailyLimits} disabled={savingLimits || !limitsDirty}>
                {savingLimits ? "Saving…" : "Save Daily Limits"}
              </button>
              {limitsDirty && <span style={{ color: "#e67e22", fontSize: "0.85rem", fontWeight: 500 }}>● Unsaved changes</span>}
              {dailyLimits.overrides.length > 0 && (
                <span style={{ fontSize: "0.8rem", color: "#3b82f6", fontWeight: 500, marginLeft: 8 }}>
                  {dailyLimits.overrides.length} override{dailyLimits.overrides.length > 1 ? "s" : ""} set
                </span>
              )}
            </div>
          </>
        )}
        {lessons.length === 0 && (
          <div style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "0.9rem" }}>
            Add lessons first to configure daily subject limits.
          </div>
        )}

        {/* ── Double Period Override ── */}
        {dailyLimits.force_spread && lessons.length > 0 && (
          <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            <h4 style={{ margin: "0 0 0.25rem", color: "#1e293b", fontSize: "1rem" }}>🔗 Double Period Overrides</h4>
            <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
              Select lessons that are allowed to have back-to-back double periods on the same day, even when spread is forced (e.g., Lab sessions).
            </p>
            <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
              <table className="data-table" style={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "center", width: 50 }}>Allow</th>
                    <th style={{ textAlign: "left" }}>Subject</th>
                    <th style={{ textAlign: "left" }}>Class</th>
                    <th style={{ textAlign: "left" }}>Teacher</th>
                    <th style={{ textAlign: "center" }}>Lessons/Week</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map(l => {
                    const isAllowed = dailyLimits.double_period_allowed.some(d => d.lesson_id === l.id);
                    const sn = subjectMap[l.subject_id]?.name || `Subject #${l.subject_id}`;
                    const cn = classMap[l.class_id] || `Class #${l.class_id}`;
                    const tn = teacherMap[l.teacher_id] || `Teacher #${l.teacher_id}`;
                    return (
                      <tr key={l.id} style={isAllowed ? { background: "#fef3c7" } : undefined}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            onChange={() => toggleDoublePeriod(l.id)}
                            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#f59e0b" }}
                          />
                        </td>
                        <td style={{ fontSize: "0.85rem", fontWeight: isAllowed ? 600 : 400 }}>{sn}</td>
                        <td style={{ fontSize: "0.85rem" }}>{cn}</td>
                        <td style={{ fontSize: "0.85rem" }}>{tn}</td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{l.periods_per_week}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {dailyLimits.double_period_allowed.length > 0 && (
              <p style={{ fontSize: "0.78rem", color: "#b45309", marginTop: "0.5rem" }}>
                ⚠ {dailyLimits.double_period_allowed.length} lesson{dailyLimits.double_period_allowed.length > 1 ? "s" : ""} exempt from forced spread.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Next ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
        <button type="button" className="btn" onClick={handleNext}>Next: Generate →</button>
      </div>
    </div>
  );
}
