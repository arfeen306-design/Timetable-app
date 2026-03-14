import { useState, useEffect, useCallback } from "react";
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
  const [saving, setSaving] = useState(false);

  /* ── Derived values ── */
  const numDays = settings?.days_per_week ?? 5;
  const numPeriods = settings?.periods_per_day ?? 7;
  const days = DAY_NAMES.slice(0, numDays);

  /* ── Entity list based on type ── */
  const entityList: { id: number; label: string }[] =
    entityType === "teacher"
      ? teachers.map(t => ({ id: t.id, label: `${t.title || ""} ${t.first_name} ${t.last_name}`.trim() + (t.code ? ` (${t.code})` : "") }))
      : entityType === "class"
        ? classes.map(c => ({ id: c.id, label: c.name + (c.code ? ` (${c.code})` : "") }))
        : rooms.map(r => ({ id: r.id, label: r.name + (r.code ? ` (${r.code})` : "") }));

  /* Auto-select first entity when type changes */
  useEffect(() => {
    if (entityList.length > 0 && !entityList.find(e => e.id === entityId)) {
      setEntityId(entityList[0].id);
    }
  }, [entityType, entityList.length]);

  /* ── Build a set of unavailable (day, period) pairs for current entity ── */
  const unavailableSet = new Set<string>();
  if (entityId != null) {
    constraints
      .filter(c => c.entity_type === entityType && c.entity_id === entityId)
      .forEach(c => unavailableSet.add(`${c.day_index}-${c.period_index}`));
  }

  /* ── Check if a slot is available (checked = available, no constraint) ── */
  const isAvailable = useCallback((day: number, period: number) => {
    return !unavailableSet.has(`${day}-${period}`);
  }, [unavailableSet]);

  /* ── Check if whole day is unavailable (all periods unchecked for a day) ── */
  function isWholeDayUnavailable(day: number): boolean {
    for (let p = 0; p < numPeriods; p++) {
      if (isAvailable(day, p)) return false;
    }
    return true;
  }

  /* ── Toggle a single slot ── */
  async function toggleSlot(day: number, period: number) {
    if (entityId == null) return;
    const key = `${day}-${period}`;
    if (unavailableSet.has(key)) {
      /* Remove constraint — make available */
      const existing = constraints.find(
        c => c.entity_type === entityType && c.entity_id === entityId && c.day_index === day && c.period_index === period
      );
      if (existing) {
        try {
          await api.deleteConstraint(pid, existing.id);
          onChange(constraints.filter(c => c.id !== existing.id));
        } catch (err) { toast("error", err instanceof Error ? err.message : "Failed to remove constraint"); }
      }
    } else {
      /* Add constraint — make unavailable */
      try {
        const created = await api.createConstraint(pid, {
          entity_type: entityType,
          entity_id: entityId,
          day_index: day,
          period_index: period,
          is_hard: true,
        });
        onChange([...constraints, created]);
      } catch (err) { toast("error", err instanceof Error ? err.message : "Failed to add constraint"); }
    }
  }

  /* ── Toggle whole day ── */
  async function toggleWholeDay(day: number) {
    if (entityId == null) return;
    const allUnavailable = isWholeDayUnavailable(day);
    if (allUnavailable) {
      /* Remove all constraints for this day — make whole day available */
      const toRemove = constraints.filter(
        c => c.entity_type === entityType && c.entity_id === entityId && c.day_index === day
      );
      try {
        await Promise.all(toRemove.map(c => api.deleteConstraint(pid, c.id)));
        const removedIds = new Set(toRemove.map(c => c.id));
        onChange(constraints.filter(c => !removedIds.has(c.id)));
      } catch (err) { toast("error", err instanceof Error ? err.message : "Failed"); }
    } else {
      /* Mark whole day unavailable — add missing constraints */
      const newConstraints: Constraint[] = [];
      for (let p = 0; p < numPeriods; p++) {
        if (isAvailable(day, p)) {
          try {
            const created = await api.createConstraint(pid, {
              entity_type: entityType,
              entity_id: entityId,
              day_index: day,
              period_index: p,
              is_hard: true,
            });
            newConstraints.push(created);
          } catch { /* skip */ }
        }
      }
      onChange([...constraints, ...newConstraints]);
    }
  }

  /* ── Save all (re-fetch to confirm sync) ── */
  async function saveAll() {
    setSaving(true);
    try {
      const fresh = await api.listConstraints(pid);
      onChange(fresh);
      toast("success", "Constraints saved successfully.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Constraints &amp; Availability</h2>
      <p className="subheading">Set availability for teachers, classes, and rooms.</p>

      {/* ── Entity selector row ── */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600, color: "#475569", fontSize: "0.9rem" }}>Entity Type:</label>
        <select
          value={entityType}
          onChange={e => { setEntityType(e.target.value as "teacher" | "class" | "room"); setEntityId(null); }}
          style={{ minWidth: 120 }}
        >
          <option value="teacher">Teacher</option>
          <option value="class">Class</option>
          <option value="room">Room</option>
        </select>

        <label style={{ fontWeight: 600, color: "#475569", fontSize: "0.9rem", marginLeft: "0.5rem" }}>Select:</label>
        <select
          value={entityId ?? ""}
          onChange={e => setEntityId(Number(e.target.value))}
          style={{ minWidth: 200 }}
        >
          {entityList.length === 0 && <option value="">No {entityType}s added</option>}
          {entityList.map(e => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* ── Availability Grid ── */}
      {entityId != null && (
        <>
          <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#64748b", marginBottom: "0.75rem" }}>
            Availability Grid (uncheck to mark unavailable)
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
                      <input
                        type="checkbox"
                        checked={isWholeDayUnavailable(dayIdx)}
                        onChange={() => toggleWholeDay(dayIdx)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#3b82f6" }}
                      />
                    </td>
                  ))}
                </tr>
                {/* Period rows */}
                {Array.from({ length: numPeriods }, (_, pIdx) => (
                  <tr key={pIdx}>
                    <td style={{ fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>Period {pIdx + 1}</td>
                    {days.map((_, dayIdx) => (
                      <td key={dayIdx} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isAvailable(dayIdx, pIdx)}
                          onChange={() => toggleSlot(dayIdx, pIdx)}
                          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#3b82f6" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {entityId == null && entityList.length === 0 && (
        <div className="warning-banner">
          Please add {entityType}s first before setting constraints.
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem" }}>
        <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving}>
          {saving ? "Saving…" : "Save Constraints"}
        </button>
        <div className="nav-footer" style={{ margin: 0, borderTop: "none", paddingTop: 0 }}>
          <button type="button" className="btn" onClick={onNext}>Next: Generate →</button>
        </div>
      </div>
    </div>
  );
}
