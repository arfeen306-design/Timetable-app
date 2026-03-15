import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getWorkloadOverview, type WorkloadEntry } from "../api";

function isoWeek(d: Date): string {
  const tmp = new Date(d.getTime());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((tmp.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function StatusBadge({ pct }: { pct: number }) {
  const cfg = pct > 100
    ? { bg: "var(--danger-50)", color: "var(--danger-600)", border: "var(--danger-100)", label: "Overloaded" }
    : pct > 85
      ? { bg: "var(--warning-50)", color: "var(--warning-600)", border: "var(--warning-100)", label: "Near max" }
      : { bg: "var(--success-50)", color: "var(--success-600)", border: "var(--success-100)", label: "OK" };
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "var(--radius-full)",
      fontSize: "0.68rem", fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}

function LoadBar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min((value / max) * 100, 120) : 0;
  const color = pct > 100 ? "var(--danger-500)" : pct > 85 ? "var(--warning-500)" : "var(--success-500)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "var(--slate-200)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--slate-600)", minWidth: 46, textAlign: "right" }}>
        {value}/{max}
      </span>
    </div>
  );
}

export default function WorkloadPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const [week, setWeek] = useState(isoWeek(new Date()));
  const [data, setData] = useState<WorkloadEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    getWorkloadOverview(pid, week).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [pid, week]);

  const overloaded = data.filter(d => d.utilization_pct > 100).length;
  const nearMax = data.filter(d => d.utilization_pct > 85 && d.utilization_pct <= 100).length;
  const available = data.filter(d => d.utilization_pct <= 85).length;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--slate-900)" }}>📊 Teacher Workload</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: "0.75rem", color: "var(--slate-500)", fontWeight: 600 }}>Week:</label>
          <input type="week" value={week} onChange={e => setWeek(e.target.value)}
            style={{ maxWidth: 180 }}
          />
        </div>
      </div>

      {/* Stat cards */}
      {data.length > 0 && (
        <div className="stat-cards" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: "var(--primary-600)" }}>{data.length}</div>
            <div className="stat-card-label">Total Teachers</div>
            <div className="stat-card-badge stat-card-badge--success">All scheduled</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: "var(--danger-500)" }}>{overloaded}</div>
            <div className="stat-card-label">Overloaded</div>
            {overloaded > 0 && <div className="stat-card-badge stat-card-badge--danger">{overloaded} over limit</div>}
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: "var(--warning-500)" }}>{nearMax}</div>
            <div className="stat-card-label">Near Max</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: "var(--success-500)" }}>{available}</div>
            <div className="stat-card-label">Available</div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div>
          <div className="stat-cards" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 85 }} />)}
          </div>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No workload data</div>
          <div className="empty-state-desc">Generate a timetable first to see teacher workload analysis.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                {["Teacher", "Code", "Scheduled", "Subs", "Total", "Load", "Status"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(t => (
                <tr key={t.teacher_id}>
                  <td style={{ fontWeight: 600, color: "var(--slate-900)" }}>{t.teacher_name}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--slate-400)" }}>{t.teacher_code}</td>
                  <td>{t.scheduled}</td>
                  <td style={{ color: t.substitutions > 0 ? "var(--warning-500)" : "var(--slate-400)", fontWeight: t.substitutions > 0 ? 700 : 400 }}>{t.substitutions}</td>
                  <td style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{t.total}</td>
                  <td style={{ minWidth: 130 }}><LoadBar value={t.total} max={t.max} /></td>
                  <td><StatusBadge pct={t.utilization_pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
