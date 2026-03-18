import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  listTeachers,
  getSubstitutionHistory,
  exportHistoryPDF,
  type HistoryRecord,
} from "../api";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function thirtyDaysAgo() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }

type Teacher = { id: number; first_name: string; last_name: string; code: string };

export default function SubstitutionRecords() {
  const { projectId } = useParams();
  const pid = Number(projectId);

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo());
  const [dateTo, setDateTo] = useState(todayStr());
  const [teacherId, setTeacherId] = useState<number>(0);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    listTeachers(pid).then(setTeachers).catch(() => {});
  }, [pid]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubstitutionHistory(pid, dateFrom, dateTo, teacherId || undefined);
      setRecords(data);
      setLastFetched({ from: dateFrom, to: dateTo });
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [pid, dateFrom, dateTo, teacherId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  function handleExport() {
    exportHistoryPDF(pid, dateFrom, dateTo, teacherId || undefined);
  }

  // Group by date for display
  const byDate: Record<string, HistoryRecord[]> = {};
  for (const r of records) {
    (byDate[r.date] ??= []).push(r);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // Calculate actual data range
  const earliestDate = dates.length > 0 ? dates[dates.length - 1] : null;
  const latestDate = dates.length > 0 ? dates[0] : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Back link */}
      <p style={{ marginBottom: "0.5rem" }}>
        <Link to={`/project/${pid}/substitutions`} style={{ color: "#3b82f6", textDecoration: "none", fontSize: "0.85rem" }}>
          ← Back to Substitution Manager
        </Link>
      </p>

      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.25rem" }}>
        📋 Substitution Records
      </h1>
      <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "1.25rem" }}>
        Complete history of all substitution assignments. Filter by date range or teacher.
      </p>

      {/* Filters */}
      <div style={{
        display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end",
        background: "#f8fafc", padding: "1rem 1.25rem", borderRadius: 10, border: "1px solid #e2e8f0",
        marginBottom: "1.25rem",
      }}>
        <div>
          <label style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem" }} />
        </div>
        <div>
          <label style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem" }} />
        </div>
        <div>
          <label style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>Teacher</label>
          <select value={teacherId} onChange={e => setTeacherId(Number(e.target.value))}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", minWidth: 180 }}>
            <option value={0}>All Teachers</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button onClick={loadRecords} className="btn btn-secondary"
            style={{ fontSize: "0.78rem", fontWeight: 600, padding: "0.4rem 1rem" }}>
            🔄 Refresh
          </button>
          <button onClick={handleExport} className="btn"
            style={{ fontSize: "0.78rem", fontWeight: 700, padding: "0.4rem 1rem", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6 }}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Active filter indicator */}
      {lastFetched && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem",
          fontSize: "0.72rem", color: "#64748b", flexWrap: "wrap",
        }}>
          <span style={{ background: "#e0e7ff", color: "#4338ca", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
            Showing: {formatDate(lastFetched.from)} → {formatDate(lastFetched.to)}
          </span>
          {teacherId > 0 && (
            <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
              Teacher: {teachers.find(t => t.id === teacherId)?.first_name ?? "Selected"}
            </span>
          )}
          {records.length > 0 && earliestDate && latestDate && (
            <span style={{ color: "#94a3b8" }}>
              · Data spans {formatDate(earliestDate)} to {formatDate(latestDate)}
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
        <div style={{
          flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span style={{ fontSize: "1.5rem" }}>📊</span>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>{records.length}</div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Total Records</div>
          </div>
        </div>
        <div style={{
          flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span style={{ fontSize: "1.5rem" }}>📅</span>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>{dates.length}</div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Days with subs</div>
          </div>
        </div>
        <div style={{
          flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span style={{ fontSize: "1.5rem" }}>⚠️</span>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#dc2626" }}>{records.filter(r => r.is_override).length}</div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Overrides</div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>Loading records...</div>
      ) : records.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "3rem", color: "#94a3b8", background: "#f8fafc",
          borderRadius: 10, border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No substitution records found</div>
          <div style={{ fontSize: "0.78rem" }}>
            No records exist between {formatDate(dateFrom)} and {formatDate(dateTo)}.
            {teacherId > 0 && " Try selecting 'All Teachers'."}
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", fontSize: "0.8rem",
            background: "#fff", borderRadius: 10, overflow: "hidden",
            border: "1px solid #e2e8f0",
          }}>
            <thead>
              <tr style={{ background: "#4f46e5", color: "#fff" }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Lesson</th>
                <th style={thStyle}>Absent Teacher</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Substitute</th>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Class</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{formatDate(r.date)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#4f46e5" }}>Lesson {r.period_index + 1}</td>
                  <td style={tdStyle}>{r.absent_teacher_name}</td>
                  <td style={{ ...tdStyle, color: "#94a3b8", fontStyle: "italic", fontSize: "0.72rem" }}>{r.reason || "—"}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.sub_teacher_name}</td>
                  <td style={tdStyle}>{r.subject_name || "—"}</td>
                  <td style={tdStyle}>{r.class_name || "—"}</td>
                  <td style={tdStyle}>
                    {r.is_override ? (
                      <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 12, fontSize: "0.68rem", fontWeight: 700 }}>Override</span>
                    ) : (
                      <span style={{ background: "#f0fdf4", color: "#16a34a", padding: "2px 8px", borderRadius: 12, fontSize: "0.68rem", fontWeight: 700 }}>Assigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700, fontSize: "0.72rem",
  letterSpacing: "0.03em", textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem", verticalAlign: "middle",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
