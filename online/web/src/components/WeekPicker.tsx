import { useState, useEffect } from "react";
import { listAcademicWeeks, type AcademicWeekInfo } from "../api";

function fmtShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface Props {
  projectId: number;
  value?: AcademicWeekInfo | null;
  onChange: (week: AcademicWeekInfo) => void;
  /** Also expose the full list of weeks to the parent */
  onWeeksLoaded?: (weeks: AcademicWeekInfo[]) => void;
}

/**
 * Shared week selector used by Workload + Substitution pages.
 * Fetches academic weeks once, pre-selects the current week.
 */
export default function WeekPicker({ projectId, value, onChange, onWeeksLoaded }: Props) {
  const [weeks, setWeeks] = useState<AcademicWeekInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    listAcademicWeeks(projectId)
      .then((w) => {
        setWeeks(w);
        onWeeksLoaded?.(w);
        // Auto-select current week if no value provided
        if (!value) {
          const current = w.find((wk) => wk.is_current);
          if (current) onChange(current);
          else if (w.length > 0) onChange(w[0]);
        }
        setLoaded(true);
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!loaded || weeks.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {value?.is_current && <span className="live-indicator" />}
      <select
        value={value?.id ?? ""}
        onChange={(e) => {
          const w = weeks.find((wk) => wk.id === Number(e.target.value));
          if (w) onChange(w);
        }}
        style={{
          padding: "0.4rem 0.75rem",
          borderRadius: "var(--r-md, var(--radius-md))",
          border: "1px solid var(--border-default, var(--slate-300))",
          fontSize: "0.78rem",
          background: "var(--surface-card, #fff)",
          fontWeight: 600,
          fontFamily: "var(--font-body, inherit)",
          maxWidth: 280,
          cursor: "pointer",
        }}
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            Week {w.week_number} · {fmtShort(w.start_date)}–{fmtShort(w.end_date)}
            {w.is_current ? " (current)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
