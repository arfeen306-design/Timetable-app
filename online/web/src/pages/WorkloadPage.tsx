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
  const color = pct > 100 ? "#ef4444" : pct > 85 ? "#f59e0b" : "#10b981";
  const label = pct > 100 ? "Overloaded" : pct > 85 ? "Near max" : "OK";
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 12, fontSize: "0.72rem", fontWeight: 700,
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>{label}</span>
  );
}

function BarCell({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min((value / max) * 100, 120) : 0;
  const color = pct > 100 ? "#ef4444" : pct > 85 ? "#f59e0b" : "#3b82f6";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", minWidth: 60, textAlign: "right" }}>
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

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>📊 Teacher Workload</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Week:</label>
          <input type="week" value={week} onChange={e => setWeek(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit" }}
          />
        </div>
      </div>

      {/* Summary cards */}
      {data.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: "1.2rem" }}>
          {[
            { label: "Total Teachers", value: data.length, color: "#3b82f6" },
            { label: "Overloaded", value: data.filter(d => d.utilization_pct > 100).length, color: "#ef4444" },
            { label: "Near Max", value: data.filter(d => d.utilization_pct > 85 && d.utilization_pct <= 100).length, color: "#f59e0b" },
            { label: "Available", value: data.filter(d => d.utilization_pct <= 85).length, color: "#10b981" },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 10, padding: "0.8rem", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>Loading workload data…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>No teachers found. Generate a timetable first.</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Teacher", "Code", "Scheduled", "Subs", "Total", "Load", "Status"].map(h => (
                  <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700, color: "#334155", borderBottom: "1px solid #e2e8f0", fontSize: "0.75rem" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(t => (
                <tr key={t.teacher_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.55rem 0.75rem", fontWeight: 600, color: "#0f172a" }}>{t.teacher_name}</td>
                  <td style={{ padding: "0.55rem 0.75rem", color: "#64748b", fontFamily: "monospace", fontSize: "0.75rem" }}>{t.teacher_code}</td>
                  <td style={{ padding: "0.55rem 0.75rem" }}>{t.scheduled}</td>
                  <td style={{ padding: "0.55rem 0.75rem", color: t.substitutions > 0 ? "#f59e0b" : "#94a3b8", fontWeight: t.substitutions > 0 ? 700 : 400 }}>{t.substitutions}</td>
                  <td style={{ padding: "0.55rem 0.75rem", fontWeight: 700 }}>{t.total}</td>
                  <td style={{ padding: "0.55rem 0.75rem", minWidth: 140 }}><BarCell value={t.total} max={t.max} /></td>
                  <td style={{ padding: "0.55rem 0.75rem" }}><StatusBadge pct={t.utilization_pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
