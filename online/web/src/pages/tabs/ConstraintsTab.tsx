import { useState, useEffect, useMemo, useRef } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";

type Constraint = Awaited<ReturnType<typeof api.listConstraints>>[0];
type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type SchoolClass = Awaited<ReturnType<typeof api.listClasses>>[0];
type Room = Awaited<ReturnType<typeof api.listRooms>>[0];

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

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ConstraintsTab({ pid, constraints, teachers, classes, rooms, settings, onChange, onNext }: Props) {
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

  const numDays = settings?.days_per_week ?? 5;
  const numPeriods = settings?.periods_per_day ?? 7;
  const days = DAY_NAMES.slice(0, numDays);

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
      // In "all" mode, show intersection of constraints (what's shared by all entities)
      const ids = entityList.map(e => e.id);
      if (ids.length === 0) { setLocalUnavailable(new Set()); return; }
      // Start with first entity's constraints, then intersect
      const sets = ids.map(id => {
        const s = new Set<string>();
        constraints.filter(c => c.entity_type === entityType && c.entity_id === id)
          .forEach(c => s.add(`${c.day_index}-${c.period_index}`));
        return s;
      });
      // A slot is "unavailable for all" if ALL entities have it marked
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
        // Apply to ALL entities of this type
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
    onNext();
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
                  {days.map((d, i) => (
                    <th key={i} style={{ textAlign: "center", minWidth: 70 }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Unavailable whole day row */}
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <td style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Unavailable whole day</td>
                  {days.map((_, dayIdx) => (
                    <td key={dayIdx} style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={isWholeDayUnavailable(dayIdx)} onChange={() => toggleWholeDay(dayIdx)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#3b82f6" }} />
                    </td>
                  ))}
                </tr>
                {/* Period rows */}
                {Array.from({ length: numPeriods }, (_, pIdx) => (
                  <tr key={pIdx}>
                    <td style={{ fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>Period {pIdx + 1}</td>
                    {days.map((_, dayIdx) => (
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

      {/* ── Actions ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" className="btn btn-primary" onClick={saveConstraints} disabled={saving || !dirty}>
            {saving ? "Saving…" : allMode ? `Apply to All ${entityType === "teacher" ? "Teachers" : entityType === "class" ? "Classes" : "Rooms"}` : "Save Constraints"}
          </button>
          {dirty && <span style={{ color: "#e67e22", fontSize: "0.85rem", fontWeight: 500 }}>● Unsaved changes</span>}
        </div>
        <div>
          <button type="button" className="btn" onClick={handleNext}>Next: Generate →</button>
        </div>
      </div>
    </div>
  );
}
