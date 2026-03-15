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

  async function handleLoadDemo() {
    setError("");
    setDemoLoading(true);
    try {
      const p = await api.createDemoProject();
      setProjects((prev) => [...prev, p]);
      navigate(`/project/${p.id}/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo school");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setCreating(true);
    try {
      const p = await api.createProject({ name: name.trim(), academic_year: academicYear.trim() || new Date().getFullYear().toString() });
      setProjects((prev) => [...prev, p]);
      setName("");
      setAcademicYear("");
      setShowCreateForm(false);
      navigate(`/project/${p.id}/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete "${p.name}"? This will remove ALL data (classes, teachers, lessons, timetable). This cannot be undone.`)) return;
    setDeleting(p.id);
    setError("");
    try {
      await api.deleteProject(p.id);
      setProjects(prev => prev.filter(x => x.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  async function handleExport(p: Project) {
    setExporting(p.id);
    setError("");
    try {
      const fname = `${p.name.replace(/\s/g, "_")}_${p.academic_year || "project"}.timetable.json`;
      await api.exportProject(p.id, fname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const p = await api.importProject(file);
      setProjects(prev => [...prev, p]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) return <div className="intro-loading">Loading…</div>;

  // Styles
  const actionBtn = (bg: string, fg: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "0.3rem 0.6rem", borderRadius: 6,
    background: bg, color: fg, border: "none",
    fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s ease", whiteSpace: "nowrap",
  });

  return (
    <div className="intro-page">
      <h1 className="intro-title">School Timetable Generator</h1>
      <p className="intro-subtitle">Create professional, clash-free timetables for your school.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="intro-actions">
        <button type="button" className="btn btn-intro btn-primary" onClick={() => setShowCreateForm(true)}>
          Create New Project
        </button>
        <button type="button" className="btn btn-intro" onClick={() => setShowCreateForm(false)}>
          Open Existing Project
        </button>
        <button type="button" className="btn btn-intro"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          title="Upload a .timetable.json file"
        >
          {importing ? "⏳ Importing…" : "📂 Upload Project File"}
        </button>
        <input ref={fileRef} type="file" accept=".json,.timetable.json" style={{ display: "none" }} onChange={handleImportFile} />
        <button
          type="button"
          className="btn btn-intro"
          onClick={handleLoadDemo}
          disabled={demoLoading}
          title="Create a sample school with demo data"
        >
          {demoLoading ? "Loading…" : "Load Demo School"}
        </button>
      </div>

      {showCreateForm && (
        <div className="card intro-create-card">
          <h2 style={{ marginTop: 0 }}>Create New Project</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall 2024" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Academic year</label>
              <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="e.g. 2024" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </button>
            <button type="button" className="btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      <div className="card intro-list-card">
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Your projects</h2>
        {projects.length === 0 ? (
          <p style={{ color: "#64748b" }}>No projects yet. Click &quot;Create New Project&quot; above, or upload a saved project file.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {projects.map((p) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.6rem 0.85rem", borderRadius: 8,
                border: "1px solid #e2e8f0", background: "#fff",
                transition: "all 0.12s ease",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(59,130,246,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {/* Project name + year */}
                <Link to={`/project/${p.id}/settings`} style={{
                  flex: 1, fontWeight: 600, fontSize: "0.95rem", color: "#1e40af",
                  textDecoration: "none",
                }}>
                  {p.name}
                  {p.academic_year && <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.82rem", marginLeft: 8 }}>({p.academic_year})</span>}
                </Link>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                  <Link to={`/project/${p.id}/settings`}
                    style={{ ...actionBtn("#eff6ff", "#1e40af"), textDecoration: "none", borderRadius: 6, padding: "0.3rem 0.6rem" }}
                    title="Edit project"
                  >
                    ✏️ Edit
                  </Link>
                  <button type="button"
                    style={actionBtn("#f0fdf4", "#166534")}
                    disabled={exporting === p.id}
                    onClick={() => handleExport(p)}
                    title="Download project as .timetable.json file"
                    onMouseEnter={e => { e.currentTarget.style.background = "#dcfce7"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#f0fdf4"; }}
                  >
                    {exporting === p.id ? "⏳" : "💾"} Save
                  </button>
                  <button type="button"
                    style={actionBtn("#fef2f2", "#991b1b")}
                    disabled={deleting === p.id}
                    onClick={() => handleDelete(p)}
                    title="Delete project permanently"
                    onMouseEnter={e => { e.currentTarget.style.background = "#fecaca"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fef2f2"; }}
                  >
                    {deleting === p.id ? "⏳" : "🗑️"} Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "1rem", marginBottom: 0 }}>
          💡 Tip: Save a project as <code>.timetable.json</code> to back it up locally. You can upload it anytime to restore or continue editing.
        </p>
      </div>
    </div>
  );
}
