import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getWorkloadOverview, getYearlyWorkload, exportWorkloadPDF, type WorkloadEntry, type YearlyWorkload } from "../api";
import YearlyWorkloadChart from "../components/YearlyWorkloadChart";

function isoWeek(d: Date): string {
  const tmp = new Date(d.getTime());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((tmp.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function weekLabel(w: string): string {
  const parts = w.split("-W");
  if (parts.length !== 2) return w;
  const year = parseInt(parts[0]);
  const week = parseInt(parts[1]);
  const d = new Date(year, 0, 4 + (week - 1) * 7);
  d.setDate(d.getDate() - d.getDay() + 1); // monday
  const end = new Date(d); end.setDate(d.getDate() + 4); // friday
  const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `Week ${week} · ${fmt(d)}–${fmt(end)} ${year}`;
}

const AVATAR_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#22c55e"];



function LoadBar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min((value / max) * 100, 120) : 0;
  const color = pct > 100 ? "var(--danger-500)" : pct > 85 ? "var(--warning-500)" : "var(--primary-500)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "var(--slate-200)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: pct > 100 ? "var(--danger-600)" : "var(--slate-600)", minWidth: 36, textAlign: "right" }}>
        {Math.round(pct)}%
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
  const [selectedTeacher, setSelectedTeacher] = useState<number | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyWorkload | null>(null);
  const [yearlyLoading, setYearlyLoading] = useState(false);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    getWorkloadOverview(pid, week).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [pid, week]);

  function handleSelectTeacher(tid: number) {
    if (selectedTeacher === tid) { setSelectedTeacher(null); setYearlyData(null); return; }
    setSelectedTeacher(tid);
    setYearlyLoading(true);
    getYearlyWorkload(pid, tid).then(setYearlyData).catch(console.error).finally(() => setYearlyLoading(false));
  }

  function changeWeek(delta: number) {
    const parts = week.split("-W");
    if (parts.length !== 2) return;
    let y = parseInt(parts[0]), w = parseInt(parts[1]) + delta;
    if (w < 1) { y--; w = 52; } else if (w > 52) { y++; w = 1; }
    setWeek(`${y}-W${String(w).padStart(2, "0")}`);
  }

  const overloaded = data.filter(d => d.utilization_pct > 100).length;
  const totalSubs = data.reduce((s, d) => s + d.substitutions, 0);
  const avgLoad = data.length ? Math.round(data.reduce((s, d) => s + d.total, 0) / data.length) : 0;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header with week nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--slate-900)" }}>Workload Tracker</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => changeWeek(-1)} style={{
            width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--slate-200)",
            background: "#fff", cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center",
          }}>‹</button>
          <div style={{
            padding: "0.35rem 0.85rem", borderRadius: "var(--radius-full)",
            background: "var(--primary-50)", border: "1px solid var(--primary-200)",
            fontSize: "0.75rem", fontWeight: 600, color: "var(--primary-600)", whiteSpace: "nowrap",
          }}>{weekLabel(week)}</div>
          <button onClick={() => changeWeek(1)} style={{
            width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--slate-200)",
            background: "#fff", cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center",
          }}>›</button>
          <button onClick={() => exportWorkloadPDF(pid, week)} className="btn btn-secondary" style={{ fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap", marginLeft: 6 }}>Export PDF</button>
        </div>
      </div>

      {/* Stat cards */}
      {!loading && data.length > 0 && (
        <div className="stat-cards" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="stat-card anim-card" style={{ animationDelay: "0ms" }}>
            <div className="stat-card-label">TEACHERS TRACKED</div>
            <div className="stat-card-value">{data.length}</div>
          </div>
          <div className="stat-card anim-card" style={{ animationDelay: "50ms" }}>
            <div className="stat-card-label">TOTAL SUBSTITUTIONS</div>
            <div className="stat-card-value">{totalSubs}</div>
            {totalSubs > 0 && <div className="stat-card-badge stat-card-badge--warning">across absences</div>}
          </div>
          <div className="stat-card anim-card" style={{ animationDelay: "100ms" }}>
            <div className="stat-card-label">OVER LIMIT</div>
            <div className="stat-card-value" style={{ color: overloaded ? "var(--danger-500)" : "var(--success-500)" }}>{overloaded}</div>
            {overloaded > 0 && <div className="stat-card-badge stat-card-badge--danger">needs attention</div>}
          </div>
          <div className="stat-card anim-card" style={{ animationDelay: "150ms" }}>
            <div className="stat-card-label">AVG. TOTAL LOAD</div>
            <div className="stat-card-value">{avgLoad}</div>
            <div className="stat-card-badge stat-card-badge--success">within bounds</div>
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
        <>
          {/* Yearly chart (when teacher selected) */}
          {selectedTeacher && yearlyData && !yearlyLoading && (
            <div style={{ marginBottom: "1rem" }}>
              <YearlyWorkloadChart weeks={yearlyData.weeks} max={yearlyData.max} teacherName={yearlyData.teacher_name} />
            </div>
          )}
          {yearlyLoading && <div className="skeleton skeleton-card" style={{ height: 240, marginBottom: "1rem" }} />}

          {/* Teacher table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>TEACHER</th>
                  <th>SCHEDULED</th>
                  <th>SUBS TAKEN</th>
                  <th>TOTAL</th>
                  <th>MAX</th>
                  <th style={{ minWidth: 130 }}>LOAD BAR</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => {
                  const isSelected = selectedTeacher === t.teacher_id;
                  const initials = t.teacher_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  const color = AVATAR_COLORS[t.teacher_id % AVATAR_COLORS.length];
                  return (
                    <tr key={t.teacher_id}
                      onClick={() => handleSelectTeacher(t.teacher_id)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "var(--primary-50)" : undefined,
                        borderLeft: isSelected ? "3px solid var(--primary-500)" : "3px solid transparent",
                      }}
                    >
                      <td style={{ textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: color, color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                          }}>{initials}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--slate-900)" }}>{t.teacher_name}</div>
                            <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", fontFamily: "var(--font-mono)" }}>{t.teacher_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>{t.scheduled}</td>
                      <td style={{ color: t.substitutions > 0 ? "var(--warning-600)" : "var(--slate-400)", fontWeight: t.substitutions > 0 ? 700 : 400 }}>
                        {t.substitutions}
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: t.utilization_pct > 100 ? "var(--danger-600)" : "var(--slate-900)" }}>
                        {t.total}
                      </td>
                      <td>{t.max}</td>
                      <td><LoadBar value={t.total} max={t.max} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
