import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";
import "./NewTimetableLanding.css";

type Project = { id: number; name: string; academic_year: string; school_id?: number; archived?: boolean; created_at?: string; updated_at?: string };

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function NewTimetableLanding() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = Number(projectId);
  const toast = useToast();

  // ── Projects ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // ── History ──
  const [history, setHistory] = useState<api.HistoryEntry[]>([]);
  const [, setLoadingHistory] = useState(false);

  // ── Cards ──
  const [loading, setLoading] = useState<string | null>(null);

  // ── Upload ──
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [importPreview, setImportPreview] = useState<api.ImportPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Create project ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Load projects ──
  useEffect(() => {
    api.listProjects()
      .then((p) => setProjects(p as Project[]))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

  // ── Load history for active project ──
  const loadHistory = useCallback(() => {
    if (!pid) return;
    setLoadingHistory(true);
    api.getTimetableHistory(pid)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [pid]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const hasHistory = history.length > 0;

  // ── Select project ──
  function handleSelectProject(p: Project) {
    navigate(`/project/${p.id}/new-timetable`);
  }

  // ── Create new project ──
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const p = await api.createProject({
        name: newName.trim(),
        academic_year: newYear.trim() || new Date().getFullYear().toString(),
      });
      setProjects((prev) => [...prev, p as Project]);
      setNewName("");
      setNewYear("");
      setShowCreateForm(false);
      navigate(`/project/${p.id}/settings`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  // ── Card actions ──
  async function handleStartNew() {
    navigate(`/project/${pid}/settings`);
  }

  async function handleLoadDemo() {
    setLoading("demo");
    try {
      const result = await api.loadDemoData(pid);
      toast("success", result.message || "Demo data loaded successfully");
      loadHistory();
      navigate(`/project/${pid}/settings`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to load demo data");
    } finally {
      setLoading(null);
    }
  }

  async function handleAmend() {
    if (!hasHistory) return;
    navigate(`/project/${pid}/review`);
  }

  // ── Upload flow ──
  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["csv", "xlsx", "xls", "pdf"];
    if (!allowed.includes(ext)) {
      setUploadError(`Unsupported format (.${ext}). Use CSV, Excel, or PDF.`);
      return;
    }
    setUploadError("");
    setLoading("upload");
    try {
      const result = await api.importTimetableFile(pid, file);
      setImportPreview(result);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setLoading("confirm");
    try {
      await api.confirmTimetableImport(pid, {
        teachers: importPreview.teachers,
        subjects: importPreview.subjects,
        classes: importPreview.classes,
      });
      toast("success", `Imported ${importPreview.teachers.length} teachers, ${importPreview.subjects.length} subjects, ${importPreview.classes.length} classes`);
      setImportPreview(null);
      setUploadMode(false);
      loadHistory();
      navigate(`/project/${pid}/settings`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(null);
    }
  }

  // ── Import preview overlay ──
  if (importPreview) {
    return (
      <div className="ntl-page">
        <div className="ntl-import-preview">
          <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700 }}>Import Preview</h2>
          {importPreview.warnings.length > 0 && (
            <div className="ntl-import-warnings">
              {importPreview.warnings.map((w, i) => <div key={i}>&#9888; {w}</div>)}
            </div>
          )}
          <div className="ntl-import-grid">
            <div className="ntl-import-col">
              <h4>Teachers ({importPreview.teachers.length})</h4>
              <ul>{importPreview.teachers.slice(0, 20).map((t, i) => <li key={i}>{t.name}</li>)}</ul>
              {importPreview.teachers.length > 20 && <div className="ntl-import-more">+{importPreview.teachers.length - 20} more</div>}
            </div>
            <div className="ntl-import-col">
              <h4>Subjects ({importPreview.subjects.length})</h4>
              <ul>{importPreview.subjects.slice(0, 20).map((s, i) => <li key={i}>{s.name}</li>)}</ul>
              {importPreview.subjects.length > 20 && <div className="ntl-import-more">+{importPreview.subjects.length - 20} more</div>}
            </div>
            <div className="ntl-import-col">
              <h4>Classes ({importPreview.classes.length})</h4>
              <ul>{importPreview.classes.slice(0, 20).map((c, i) => <li key={i}>{c.name}</li>)}</ul>
              {importPreview.classes.length > 20 && <div className="ntl-import-more">+{importPreview.classes.length - 20} more</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn btn-primary" onClick={handleConfirmImport} disabled={loading === "confirm"}>
              {loading === "confirm" ? "Saving..." : "Confirm & Import"}
            </button>
            <button className="btn" onClick={() => setImportPreview(null)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ntl-layout">
      {/* ═══ LEFT COLUMN: Saved Projects ═══ */}
      <aside className="ntl-left">
        <div className="ntl-left-title">Saved Projects</div>

        {loadingProjects ? (
          <div style={{ padding: "20px 8px", color: "var(--text-muted, #94A3B8)", fontSize: 13 }}>Loading...</div>
        ) : (
          <>
            {projects.map((p) => (
              <div key={p.id}>
                <div
                  className={`project-card ${p.id === pid ? "active" : ""}`}
                  onClick={() => handleSelectProject(p)}
                >
                  <div className="project-card-icon">&#127979;</div>
                  <div className="project-card-info">
                    <div className="project-card-name">{p.name}</div>
                    <div className="project-card-year">{p.academic_year || "No year set"}</div>
                  </div>
                  {p.id === pid && (
                    <span className="project-card-active-badge">Active</span>
                  )}
                </div>

                {/* History for active project */}
                {p.id === pid && hasHistory && (
                  <div className="project-history">
                    <div className="history-title">History</div>
                    {history.map((entry) => (
                      <div key={entry.id} className="history-entry">
                        <div className={`history-dot ${entry.action}`} />
                        <div className="history-info">
                          <div className="history-desc">{entry.description}</div>
                          <div className="history-time">
                            {timeAgo(entry.created_at)}
                            {entry.created_by ? ` \u00B7 ${entry.created_by}` : ""}
                          </div>
                        </div>
                        {entry.is_current && <span className="history-current">Current</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* + New Project */}
            {!showCreateForm ? (
              <button className="ntl-new-project-btn" onClick={() => setShowCreateForm(true)}>
                + New Project
              </button>
            ) : (
              <form className="ntl-create-form" onSubmit={handleCreate}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="School name"
                  autoFocus
                  required
                  className="ntl-create-input"
                />
                <input
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="e.g. 2025-26"
                  className="ntl-create-input"
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit" className="btn btn-primary" style={{ fontSize: 12, padding: "5px 12px" }} disabled={creating}>
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button type="button" className="btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </aside>

      {/* ═══ RIGHT COLUMN: Cards ═══ */}
      <div className="ntl-right">
        <div className="ntl-header">
          <h1 className="ntl-title">New Timetable &mdash; Home</h1>
          <p className="ntl-sub">How would you like to get started?</p>
        </div>

        {/* Upload area */}
        {uploadMode && (
          <div className="ntl-upload-area">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              style={{ display: "none" }}
              onChange={handleUploadFile}
            />
            <div
              className="ntl-upload-dropzone"
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize: 32 }}>&#128196;</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Click to select file</div>
              <div style={{ fontSize: 12, color: "var(--text-muted, #94A3B8)" }}>
                Accepts .csv, .xlsx, .xls, .pdf
              </div>
              {loading === "upload" && <div className="ntl-card-spinner" style={{ position: "static", marginTop: 8 }} />}
            </div>
            {uploadError && <div className="ntl-upload-error">{uploadError}</div>}
            <button className="btn" style={{ marginTop: 10, fontSize: 12 }} onClick={() => { setUploadMode(false); setUploadError(""); }}>
              Cancel
            </button>
          </div>
        )}

        <div className="ntl-grid">
          {/* Start New */}
          <button
            className="ntl-card"
            style={{ "--card-color": "#4F46E5", "--card-bg": "#EEF2FF" } as React.CSSProperties}
            onClick={handleStartNew}
          >
            <div className="ntl-card-icon">&#10024;</div>
            <div className="ntl-card-title">Start New Timetable</div>
            <div className="ntl-card-desc">Build a fresh timetable from scratch. Set up school, teachers, and generate.</div>
          </button>

          {/* Upload */}
          <button
            className="ntl-card"
            style={{ "--card-color": "#0891B2", "--card-bg": "#E0F2FE" } as React.CSSProperties}
            onClick={() => { setUploadMode(true); setUploadError(""); }}
          >
            <div className="ntl-card-icon">&#128228;</div>
            <div className="ntl-card-title">Upload Your Timetable</div>
            <div className="ntl-card-desc">Import an existing timetable from Excel or PDF. We'll parse it automatically.</div>
          </button>

          {/* Amend */}
          <button
            className={`ntl-card ${!hasHistory ? "ntl-card-disabled" : ""}`}
            style={{ "--card-color": hasHistory ? "#16A34A" : "#94A3B8", "--card-bg": "#F0FDF4" } as React.CSSProperties}
            onClick={handleAmend}
            disabled={!hasHistory}
            title={!hasHistory ? "Generate a timetable first to enable amendments" : undefined}
          >
            <div className="ntl-card-icon">&#9999;&#65039;</div>
            <div className="ntl-card-title">Amend Current Timetable</div>
            <div className="ntl-card-desc">
              {hasHistory
                ? "Make changes to an already generated timetable without starting over."
                : "No timetable generated yet. Start a new one first."}
            </div>
            {!hasHistory && (
              <div className="ntl-card-locked">&#128274; Generate a timetable first</div>
            )}
          </button>

          {/* Load Demo */}
          <button
            className="ntl-card"
            style={{ "--card-color": "#D97706", "--card-bg": "#FEF3C7" } as React.CSSProperties}
            onClick={handleLoadDemo}
            disabled={loading === "demo"}
          >
            <div className="ntl-card-icon">&#127918;</div>
            <div className="ntl-card-title">Load Demo Data</div>
            <div className="ntl-card-desc">Populate with sample Pakistani O-Level school data to explore all features.</div>
            {loading === "demo" && <div className="ntl-card-spinner" />}
          </button>
        </div>
      </div>
    </div>
  );
}
