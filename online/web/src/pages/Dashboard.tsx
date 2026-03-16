import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../api";

type Project = { id: number; name: string; academic_year: string };

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Auto-redirect to first project's colorful dashboard when projects exist
  useEffect(() => {
    if (!loading && projects.length > 0) {
      navigate(`/project/${projects[0].id}/dashboard`, { replace: true });
    }
  }, [loading, projects, navigate]);

  async function handleLoadDemo() {
    setError(""); setDemoLoading(true);
    try {
      const p = await api.createDemoProject();
      setProjects((prev) => [...prev, p]);
      navigate(`/project/${p.id}/settings`);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load demo school"); }
    finally { setDemoLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(""); setCreating(true);
    try {
      const p = await api.createProject({ name: name.trim(), academic_year: academicYear.trim() || new Date().getFullYear().toString() });
      setProjects((prev) => [...prev, p]);
      setName(""); setAcademicYear(""); setShowCreateForm(false);
      navigate(`/project/${p.id}/settings`);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create project"); }
    finally { setCreating(false); }
  }

  async function handleDelete(p: Project) {
    setDeleting(p.id); setError("");
    try { await api.deleteProject(p.id); setProjects(prev => prev.filter(x => x.id !== p.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); setConfirmDeleteId(null); }
  }

  async function handleExport(p: Project) {
    setExporting(p.id); setError("");
    try { await api.exportProject(p.id, `${p.name.replace(/\s/g, "_")}_${p.academic_year || "project"}.timetable.json`); }
    catch (err) { setError(err instanceof Error ? err.message : "Export failed"); }
    finally { setExporting(null); }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setError("");
    try { const p = await api.importProject(file); setProjects(prev => [...prev, p]); }
    catch (err) { setError(err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  /* ── Loading skeleton ── */
  if (loading) return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem 0" }}>
      <div className="skeleton skeleton-title" style={{ width: "40%" }} />
      <div className="skeleton skeleton-text" style={{ width: "55%", marginBottom: 24 }} />
      <div className="stat-cards">
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 90 }} />)}
      </div>
      <div className="skeleton skeleton-card" style={{ height: 200 }} />
    </div>
  );

  const actionBtn = (bg: string, fg: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "0.3rem 0.65rem", borderRadius: "var(--radius-sm)",
    background: bg, color: fg, border: "none",
    fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "all 0.12s ease", whiteSpace: "nowrap",
  });

  /* ═══════════════════════════════════════════════════════════
     EMPTY STATE — full-page hero when no projects exist
     ═══════════════════════════════════════════════════════════ */
  if (projects.length === 0 && !showCreateForm) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem 0" }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", padding: "2.5rem 2rem",
          borderRadius: "var(--radius-lg, 16px)",
          background: "linear-gradient(135deg, var(--surface-card, #fff) 0%, #f0f0ff 50%, #eef2ff 100%)",
          border: "1px solid var(--border-default, var(--slate-200))",
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative bg circles */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(99,102,241,0.06)" }} />
          <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(20,184,166,0.06)" }} />
          <div style={{ position: "absolute", top: 20, left: 40, width: 60, height: 60, borderRadius: "50%", background: "rgba(245,158,11,0.05)" }} />

          {/* Calendar illustration */}
          <div style={{
            width: 100, height: 100, borderRadius: 20, position: "relative",
            background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
            boxShadow: "0 12px 32px rgba(99,102,241,0.25)",
            display: "flex", flexDirection: "column", alignItems: "center",
            marginBottom: 24, animation: "fadeInUp 0.6s ease",
          }}>
            {/* Calendar top bar */}
            <div style={{
              width: "100%", height: 28, borderRadius: "20px 20px 0 0",
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.7)" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.5)" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
            </div>
            {/* Calendar grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
              padding: "10px 12px", flex: 1, width: "100%", boxSizing: "border-box",
            }}>
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{
                  borderRadius: 3, background: i === 3 ? "#fff" : "rgba(255,255,255,0.2)",
                  height: 12,
                  animation: i === 3 ? "livePulse 2s infinite" : undefined,
                }} />
              ))}
            </div>
          </div>

          <h1 style={{
            margin: 0, fontSize: "1.6rem", fontWeight: 800,
            color: "var(--slate-900)", letterSpacing: "-0.02em",
            animation: "fadeInUp 0.6s ease 0.1s both",
          }}>
            Welcome to Myzynca
          </h1>
          <p style={{
            margin: "0.5rem 0 0", fontSize: "0.92rem", color: "var(--slate-500)",
            maxWidth: 380, lineHeight: 1.5,
            animation: "fadeInUp 0.6s ease 0.2s both",
          }}>
            Generate clash-free timetables for any school in seconds. Create your first project to get started.
          </p>

          {/* CTA buttons */}
          <div style={{
            display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap", justifyContent: "center",
            animation: "fadeInUp 0.6s ease 0.3s both",
          }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(true)}
              style={{
                fontSize: "0.95rem", padding: "0.7rem 1.5rem", fontWeight: 700,
                borderRadius: "var(--radius-md, 8px)",
                boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
              }}>
              ✨ Create Your First Timetable
            </button>
            <button type="button" className="btn" onClick={handleLoadDemo} disabled={demoLoading}
              style={{ fontSize: "0.85rem", padding: "0.6rem 1.2rem", fontWeight: 600 }}>
              {demoLoading ? "⏳ Loading…" : "🧪 Try Demo School"}
            </button>
          </div>

          <div style={{
            display: "flex", gap: 16, marginTop: 16,
            animation: "fadeInUp 0.6s ease 0.4s both",
          }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "0.78rem", fontWeight: 600, color: "var(--slate-400)",
                fontFamily: "var(--font-sans)", textDecoration: "underline", textUnderlineOffset: 2,
              }}>
              {importing ? "⏳ Importing…" : "📂 Or upload an existing project"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json,.timetable.json" style={{ display: "none" }} onChange={handleImportFile} />

          {/* Feature highlights */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
            marginTop: 32, width: "100%",
            animation: "fadeInUp 0.6s ease 0.5s both",
          }}>
            {[
              { icon: "⚡", title: "Instant Generation", desc: "AI-powered engine creates timetables in seconds" },
              { icon: "🔄", title: "Smart Substitutions", desc: "Auto-assign substitutes when teachers are absent" },
              { icon: "📊", title: "Live Dashboard", desc: "Real-time stats, workload tracking, and insights" },
            ].map((f, i) => (
              <div key={i} style={{
                padding: "0.75rem", borderRadius: "var(--radius-md, 8px)",
                background: "rgba(255,255,255,0.7)", border: "1px solid rgba(99,102,241,0.08)",
              }}>
                <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.72rem", color: "var(--slate-800)", marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--slate-400)", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     NORMAL STATE — project list with actions
     ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--slate-900)", letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "var(--slate-400)" }}>
            Clash-free timetables for any school, generated in seconds.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Quick actions ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(true)}
          style={{ fontSize: "0.82rem", padding: "0.5rem 1rem" }}>
          + New Project
        </button>
        <button type="button" className="btn" onClick={handleLoadDemo} disabled={demoLoading}
          style={{ fontSize: "0.82rem", padding: "0.5rem 1rem" }}>
          {demoLoading ? "⏳ Loading…" : "🧪 Demo School"}
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={importing}
          style={{ fontSize: "0.82rem", padding: "0.5rem 1rem" }}>
          {importing ? "⏳ Importing…" : "📂 Upload Project"}
        </button>
        <input ref={fileRef} type="file" accept=".json,.timetable.json" style={{ display: "none" }} onChange={handleImportFile} />
      </div>

      {/* ── Create form ── */}
      {showCreateForm && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Create New Project</h3>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The City School" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Academic Year</label>
              <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="e.g. 2024-25" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </button>
            <button type="button" className="btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {/* ── Projects list ── */}
      <div className="card">
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "var(--slate-900)" }}>Your Projects</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {projects.map((p) => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.65rem 0.85rem", borderRadius: "var(--radius-md)",
              border: "1px solid var(--slate-200)", background: "#fff",
              transition: "all 0.12s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary-400)"; e.currentTarget.style.boxShadow = "0 1px 6px rgba(99,102,241,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--slate-200)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Icon */}
              <div style={{
                width: 34, height: 34, borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, var(--primary-50), var(--primary-100))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.85rem", flexShrink: 0,
              }}>📅</div>

              {/* Name + year */}
              <Link to={`/project/${p.id}/settings`} style={{
                flex: 1, fontWeight: 600, fontSize: "0.88rem", color: "var(--primary-700)",
                textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {p.name}
                {p.academic_year && <span style={{ fontWeight: 400, color: "var(--slate-400)", fontSize: "0.78rem", marginLeft: 8 }}>— {p.academic_year}</span>}
              </Link>

              {/* Inline delete confirm row */}
              {confirmDeleteId === p.id && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--danger-50)", border: "1px solid var(--danger-200)",
                  borderRadius: "var(--radius-sm)", padding: "4px 10px",
                  fontSize: "0.72rem", fontWeight: 600, color: "var(--danger-700)",
                }}>
                  Delete "{p.name}"? This cannot be undone.
                  <button type="button" style={{ ...actionBtn("var(--danger-500)", "#fff"), marginLeft: 4 }}
                    disabled={deleting === p.id}
                    onClick={() => handleDelete(p)}>
                    {deleting === p.id ? "⏳" : "Yes, delete"}
                  </button>
                  <button type="button" style={actionBtn("var(--slate-100)", "var(--slate-700)")}
                    onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                </div>
              )}

              {/* Actions */}
              {confirmDeleteId !== p.id && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <Link to={`/project/${p.id}/settings`}
                    style={{ ...actionBtn("var(--primary-50)", "var(--primary-700)"), textDecoration: "none" }}
                    title="Edit project"
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-100)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--primary-50)"; }}
                  >✏️ Edit</Link>
                  <button type="button"
                    style={actionBtn("var(--success-50)", "var(--success-700)")}
                    disabled={exporting === p.id}
                    onClick={() => handleExport(p)}
                    title="Download project file"
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--success-100)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--success-50)"; }}
                  >{exporting === p.id ? "⏳" : "💾"} Save</button>
                  <button type="button"
                    style={actionBtn("var(--danger-50)", "var(--danger-700)")}
                    onClick={() => setConfirmDeleteId(p.id)}
                    title="Delete project permanently"
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-100)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--danger-50)"; }}
                  >🗑️ Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.7rem", color: "var(--slate-400)", marginTop: "1rem", marginBottom: 0 }}>
          💡 Save projects as <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>.timetable.json</code> for local backup. Upload anytime to restore.
        </p>
      </div>
    </div>
  );
}
