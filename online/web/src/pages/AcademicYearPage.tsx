import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { createAcademicYear, getAcademicYear, createProject, createDemoProject, importProject, exportProject, type AcademicYearData, type AcademicWeekInfo } from "../api";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type ProjectSummary = { id: number; name: string; academic_year: string; created_at: string };

export default function AcademicYearPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);

  const [data, setData] = useState<AcademicYearData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Form state
  const [name, setName] = useState("2025-26");
  const [startDate, setStartDate] = useState("2025-08-04");
  const [w1Label, setW1Label] = useState("Week 1 · Orientation");
  const [totalWeeks, setTotalWeeks] = useState(40);

  // Quick action state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState("");
  const [creating, setCreating] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Projects sidebar
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    getAcademicYear(pid).then(d => {
      setData(d);
      if (d.year) {
        setName(d.year.name);
        setStartDate(d.year.week_1_start_date);
        setW1Label(d.year.week_1_label);
        setTotalWeeks(d.year.total_weeks);
      }
    }).catch(console.error).finally(() => setLoading(false));

    // Load projects list
    fetch("/api/projects").then(r => r.json()).then(p => setProjects(p)).catch(console.error);
  }, [pid]);

  async function handleSave() {
    setSaving(true); setMsg("");
    try {
      const res = await createAcademicYear(pid, { name, week_1_start_date: startDate, week_1_label: w1Label, total_weeks: totalWeeks });
      setMsg(`✅ Academic year "${res.name}" activated — ${res.weeks_created} weeks generated.`);
      getAcademicYear(pid).then(setData);
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
    finally { setSaving(false); }
  }

  // Quick action handlers
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true); setActionMsg("");
    try {
      const p = await createProject({ name: newName.trim(), academic_year: newYear.trim() || new Date().getFullYear().toString() });
      setShowCreate(false); setNewName(""); setNewYear("");
      setActionMsg("✅ Project created! Redirecting…");
      window.location.href = `/project/${p.id}/settings`;
    } catch (err) { setActionMsg(`❌ ${err instanceof Error ? err.message : "Failed"}`); }
    finally { setCreating(false); }
  }

  async function handleDemo() {
    setDemoLoading(true); setActionMsg("");
    try {
      const p = await createDemoProject();
      setActionMsg("✅ Demo project created! Redirecting…");
      setTimeout(() => { window.location.href = `/project/${p.id}/dashboard`; }, 500);
    } catch (err) { setActionMsg(`❌ ${err instanceof Error ? err.message : "Failed"}`); }
    finally { setDemoLoading(false); }
  }

  async function handleImportFile(file: File) {
    setImporting(true); setActionMsg("");
    try {
      const p = await importProject(file);
      setActionMsg(`✅ Imported "${p.name}"! Redirecting…`);
      setTimeout(() => { window.location.href = `/project/${p.id}/dashboard`; }, 500);
    } catch (err) { setActionMsg(`❌ ${err instanceof Error ? err.message : "Import failed"}`); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleExport() {
    setExporting(true); setActionMsg("");
    try {
      await exportProject(pid, "timetable_export.json");
      setActionMsg("✅ Project saved to file!");
    } catch (err) { setActionMsg(`❌ ${err instanceof Error ? err.message : "Export failed"}`); }
    finally { setExporting(false); }
  }

  // Generate preview weeks from form fields
  function previewWeeks(): AcademicWeekInfo[] {
    const start = new Date(startDate + "T00:00:00");
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(start);
    monday.setDate(monday.getDate() + mondayOffset);
    const todayMonday = new Date();
    todayMonday.setDate(todayMonday.getDate() - ((todayMonday.getDay() + 6) % 7));
    todayMonday.setHours(0, 0, 0, 0);

    const weeks: AcademicWeekInfo[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      const wMonday = new Date(monday);
      wMonday.setDate(monday.getDate() + i * 7);
      const wFriday = new Date(wMonday);
      wFriday.setDate(wMonday.getDate() + 4);

      const isCurrent = wMonday.getTime() === todayMonday.getTime();
      const isPast = wFriday < new Date();

      weeks.push({
        id: i + 1,
        week_number: i + 1,
        label: i === 0 && w1Label ? w1Label : `Week ${i + 1}`,
        start_date: wMonday.toISOString().slice(0, 10),
        end_date: wFriday.toISOString().slice(0, 10),
        is_current: isCurrent,
        status: isCurrent ? "Current" : isPast ? "Past" : "Upcoming",
      });
    }
    return weeks;
  }

  const weeks = data?.active ? data.weeks : previewWeeks();
  const currentWeekIdx = weeks.findIndex(w => w.is_current || w.status === "Current");

  // Show: first 4 + separator + current week
  const displayWeeks: (AcademicWeekInfo | "separator")[] = [];
  const first4 = weeks.slice(0, 4);
  first4.forEach(w => displayWeeks.push(w));
  if (currentWeekIdx > 4) {
    displayWeeks.push("separator");
    displayWeeks.push(weeks[currentWeekIdx]);
  }

  function statusBadge(status?: string) {
    const cfg = status === "Current"
      ? { bg: "var(--primary-50)", color: "var(--primary-600)", border: "var(--primary-200)" }
      : status === "Past"
        ? { bg: "var(--slate-100)", color: "var(--slate-500)", border: "var(--slate-200)" }
        : { bg: "var(--success-50)", color: "var(--success-600)", border: "var(--success-200)" };
    return (
      <span style={{
        padding: "2px 10px", borderRadius: "var(--radius-full)",
        fontSize: "0.68rem", fontWeight: 700,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      }}>{status}</span>
    );
  }

  if (loading) return <div style={{ maxWidth: 900, margin: "0 auto" }}><div className="skeleton skeleton-card" style={{ height: 300 }} /></div>;

  return (
    <div style={{ display: "flex", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
      {/* ═══ Main content (left) ═══ */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* ── Academic Year Configuration Card ── */}
        <div className="card" style={{ padding: "1.5rem", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--slate-900)" }}>Academic Year Configuration</h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--slate-400)" }}>
                Set the year start — all {totalWeeks} weeks are generated automatically
              </p>
            </div>
            {data?.active && (
              <span style={{
                padding: "4px 14px", borderRadius: "var(--radius-full)",
                background: "var(--success-50)", border: "1px solid var(--success-200)",
                fontSize: "0.72rem", fontWeight: 700, color: "var(--success-600)",
              }}>{data.year?.name} active</span>
            )}
          </div>

          {msg && <div className={msg.startsWith("✅") ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: "1rem" }}>{msg}</div>}

          {/* Form */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--slate-700)" }}>Year name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="2025-26" />
              <div style={{ fontSize: "0.62rem", color: "var(--slate-400)", marginTop: 2 }}>Displayed in dropdowns and PDF headers</div>
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--slate-700)" }}>Week 1 start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <div style={{ fontSize: "0.62rem", color: "var(--slate-400)", marginTop: 2 }}>Usually first Monday of August</div>
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--slate-700)" }}>Week 1 label (optional)</label>
              <input value={w1Label} onChange={e => setW1Label(e.target.value)} placeholder="Week 1 · Orientation" />
              <div style={{ fontSize: "0.62rem", color: "var(--slate-400)", marginTop: 2 }}>Custom name shown in the week picker</div>
            </div>
          </div>

          {/* Info banner */}
          <div style={{
            padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)",
            background: "var(--primary-50)", border: "1px solid var(--primary-200)",
            fontSize: "0.75rem", color: "var(--slate-700)", lineHeight: 1.6,
            marginBottom: "1.25rem",
          }}>
            <span style={{ fontWeight: 700, color: "var(--primary-600)" }}>ℹ </span>
            Weeks are Monday–Friday. Each week's sub count resets automatically every Monday at midnight.
            Max substitutions per teacher per week is <strong>2</strong> — the manager can override with a warning recorded.
          </div>

          {/* Preview table */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--slate-700)", marginBottom: "0.5rem" }}>
              Preview — first 4 and current week
            </div>
            <div style={{ border: "1px solid var(--slate-200)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <table style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>WEEK</th>
                    <th style={{ textAlign: "left" }}>LABEL</th>
                    <th>DATES</th>
                    <th style={{ width: 90 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {displayWeeks.map((item) => {
                    if (item === "separator") {
                      return (
                        <tr key="sep">
                          <td colSpan={4} style={{ textAlign: "center", color: "var(--slate-400)", fontSize: "0.72rem", padding: "0.4rem", letterSpacing: "0.2em" }}>
                            · · · {currentWeekIdx - 4} weeks passed · · ·
                          </td>
                        </tr>
                      );
                    }
                    const w = item;
                    return (
                      <tr key={w.week_number} style={{ background: w.is_current ? "var(--primary-50)" : undefined }}>
                        <td style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--primary-600)", fontSize: "0.78rem" }}>W{w.week_number}</td>
                        <td style={{ textAlign: "left", fontWeight: 600, fontSize: "0.82rem" }}>{w.label}</td>
                        <td style={{ fontSize: "0.78rem", color: "var(--slate-500)" }}>{fmtDate(w.start_date)} – {fmtDate(w.end_date)}</td>
                        <td>{statusBadge(w.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSave} disabled={saving} className="btn" style={{ fontWeight: 700, fontSize: "0.85rem" }}>
              {saving ? "⏳ Saving…" : "Save & Activate"}
            </button>
            {data?.active && (
              <button onClick={() => { setData(null); setName(""); setStartDate(""); setW1Label("Week 1"); }}
                className="btn btn-secondary" style={{ fontSize: "0.82rem" }}>
                New year setup
              </button>
            )}
          </div>
        </div>

        {/* ── New Timetable Setup Card ── */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "var(--slate-900)" }}>Timetable Setup</h2>
          <p style={{ margin: "0 0 1rem", fontSize: "0.72rem", color: "var(--slate-400)" }}>
            Create a new timetable project, import an existing one, or load demo data
          </p>

          {actionMsg && <div className={actionMsg.startsWith("✅") ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: 12 }}>{actionMsg}</div>}

          {/* Quick action buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: showCreate ? 16 : 0 }}>
            <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary" style={{ fontSize: "0.82rem", fontWeight: 700 }}>
              + New Timetable
            </button>
            <button onClick={handleDemo} disabled={demoLoading} className="btn" style={{ fontSize: "0.82rem", fontWeight: 700, background: "var(--success-50)", color: "var(--success-700)", border: "1px solid var(--success-200)" }}>
              {demoLoading ? "⏳ Loading…" : "🧪 Load Demo Data"}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn btn-secondary" style={{ fontSize: "0.82rem", fontWeight: 700 }}>
              {importing ? "⏳ Importing…" : "📂 Upload Project"}
            </button>
            <input ref={fileRef} type="file" accept=".json,.timetable.json"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
            <button onClick={handleExport} disabled={exporting} className="btn btn-secondary" style={{ fontSize: "0.82rem", fontWeight: 700 }}>
              {exporting ? "⏳…" : "💾 Save Project"}
            </button>
          </div>

          {/* Inline create form */}
          {showCreate && (
            <form onSubmit={handleCreate} style={{
              padding: "1rem", borderRadius: "var(--radius-md)",
              background: "var(--slate-50)", border: "1px solid var(--slate-200)",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--slate-700)", textTransform: "uppercase", letterSpacing: "0.04em" }}>School / Project Name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. The City School" autoFocus />
                </div>
                <div style={{ minWidth: 120 }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--slate-700)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Academic Year</label>
                  <input value={newYear} onChange={e => setNewYear(e.target.value)} placeholder="e.g. 2025-26" />
                </div>
                <button type="submit" disabled={creating || !newName.trim()} className="btn btn-primary" style={{ fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {creating ? "⏳…" : "Create & Open"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary" style={{ fontSize: "0.82rem" }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ═══ Right sidebar — existing projects ═══ */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <div className="card" style={{ padding: "1rem", position: "sticky", top: 20 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Your Projects
          </div>
          {projects.length === 0 && (
            <div style={{ fontSize: "0.78rem", color: "var(--slate-400)", padding: "0.5rem 0" }}>No projects yet — create one above</div>
          )}
          {projects.map((p, i) => (
            <Link key={p.id} to={`/project/${p.id}/dashboard`}
              style={{
                display: "block", padding: "0.6rem 0.75rem", marginBottom: 6,
                borderRadius: "var(--radius-md)", textDecoration: "none",
                background: p.id === pid ? "var(--primary-50)" : "var(--slate-50)",
                border: `1px solid ${p.id === pid ? "var(--primary-200)" : "var(--slate-200)"}`,
                transition: "all 0.15s",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `hsl(${(i * 67) % 360}, 60%, 55%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.6rem", fontWeight: 700, color: "#fff",
                }}>
                  {p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: "0.78rem",
                    color: p.id === pid ? "var(--primary-700)" : "var(--slate-800)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{p.name}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--slate-400)" }}>{p.academic_year}</div>
                </div>
                {p.id === pid && (
                  <span style={{
                    fontSize: "0.55rem", fontWeight: 700, padding: "1px 6px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--primary-100)", color: "var(--primary-600)",
                  }}>Current</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
