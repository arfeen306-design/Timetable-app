import { useState, useEffect } from "react";
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
  const navigate = useNavigate();

  useEffect(() => {
    api.listProjects().then(setProjects).catch(setError).finally(() => setLoading(false));
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

  if (loading) return <div className="intro-loading">Loading…</div>;

  return (
    <div className="intro-page">
      <h1 className="intro-title">School Timetable Generator</h1>
      <p className="intro-subtitle">Create professional, clash-free timetables for your school.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="intro-actions">
        <button
          type="button"
          className="btn btn-intro btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          Create New Project
        </button>
        <button
          type="button"
          className="btn btn-intro"
          onClick={() => setShowCreateForm(false)}
        >
          Open Existing Project
        </button>
        <button type="button" className="btn btn-intro" disabled title="Recent projects list below">
          Open Recent Project
        </button>
        <button type="button" className="btn btn-intro" disabled title="Not implemented in web version">
          Duplicate Project
        </button>
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
        <h2 style={{ marginTop: 0 }}>Your projects</h2>
        {projects.length === 0 ? (
          <p style={{ color: "#64748b" }}>No projects yet. Click &quot;Create New Project&quot; above.</p>
        ) : (
          <ul className="intro-project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/project/${p.id}/settings`}>{p.name}</Link>
                {p.academic_year && <span className="intro-year">({p.academic_year})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
