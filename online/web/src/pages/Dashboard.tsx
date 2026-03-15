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
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Auto-redirect to first project's dashboard if projects exist
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
    if (!confirm(`Delete "${p.name}"? This will remove ALL data. This cannot be undone.`)) return;
    setDeleting(p.id); setError("");
    try { await api.deleteProject(p.id); setProjects(prev => prev.filter(x => x.id !== p.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
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

  const actionBtn = (bg: string, fg: string, _hoverBg?: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "0.3rem 0.65rem", borderRadius: "var(--radius-sm)",
    background: bg, color: fg, border: "none",
    fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "all 0.12s ease", whiteSpace: "nowrap",
  });

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
        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No projects yet</div>
            <div className="empty-state-desc">Create a new project or load the demo school to get started.</div>
          </div>
        ) : (
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

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <Link to={`/project/${p.id}/settings`}
                    style={{ ...actionBtn("var(--primary-50)", "var(--primary-700)", "var(--primary-100)"), textDecoration: "none" }}
                    title="Edit project"
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-100)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--primary-50)"; }}
                  >✏️ Edit</Link>
                  <button type="button"
                    style={actionBtn("var(--success-50)", "var(--success-700)", "var(--success-100)")}
                    disabled={exporting === p.id}
                    onClick={() => handleExport(p)}
                    title="Download project file"
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--success-100)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--success-50)"; }}
                  >{exporting === p.id ? "⏳" : "💾"} Save</button>
                  <button type="button"
                    style={actionBtn("var(--danger-50)", "var(--danger-700)", "var(--danger-100)")}
                    disabled={deleting === p.id}
                    onClick={() => handleDelete(p)}
                    title="Delete project permanently"
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-100)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--danger-50)"; }}
                  >{deleting === p.id ? "⏳" : "🗑️"} Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: "0.7rem", color: "var(--slate-400)", marginTop: "1rem", marginBottom: 0 }}>
          💡 Save projects as <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>.timetable.json</code> for local backup. Upload anytime to restore.
        </p>
      </div>
    </div>
  );
}
