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
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "2rem 1rem" }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}

        {/* ── Keyframe animations ── */}
        <style>{`
          @keyframes heroFloat1 { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(12px,-18px) rotate(8deg)} }
          @keyframes heroFloat2 { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(-14px,12px) rotate(-6deg)} }
          @keyframes heroFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(8px,-10px) scale(1.1)} }
          @keyframes heroPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(79,70,229,0.3)} 50%{box-shadow:0 0 0 18px rgba(79,70,229,0)} }
          @keyframes heroSlide  { from{opacity:0;transform:translateY(26px)} to{opacity:1;transform:translateY(0)} }
          @keyframes ringDraw   { from{stroke-dashoffset:314} to{stroke-dashoffset:314} }
          @keyframes cardHover  { 0%{transform:translateY(0)} 50%{transform:translateY(-3px)} 100%{transform:translateY(0)} }
          @keyframes shimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          @keyframes countUp    { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        `}</style>

        {/* ═══ HERO CARD ═══ */}
        <div className="dash-hero" style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", padding: "3rem 2rem 2.5rem",
          borderRadius: 24, position: "relative", overflow: "hidden",
          background: "linear-gradient(145deg, #0F172A 0%, #1E293B 40%, #312E81 100%)",
          border: "1px solid rgba(99,102,241,0.15)",
          boxShadow: "0 20px 60px rgba(15,23,42,0.35)",
        }}>
          {/* Floating shapes */}
          <div style={{ position:"absolute",top:-30,right:-20,width:140,height:140,borderRadius:"50%",
            background:"radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
            animation:"heroFloat1 8s ease-in-out infinite" }} />
          <div style={{ position:"absolute",bottom:-40,left:-30,width:180,height:180,borderRadius:"50%",
            background:"radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)",
            animation:"heroFloat2 10s ease-in-out infinite" }} />
          <div style={{ position:"absolute",top:40,left:"15%",width:60,height:60,borderRadius:16,
            background:"rgba(245,158,11,0.1)", transform:"rotate(20deg)",
            animation:"heroFloat3 6s ease-in-out infinite" }} />
          <div style={{ position:"absolute",bottom:60,right:"12%",width:40,height:40,borderRadius:"50%",
            background:"rgba(236,72,153,0.12)",
            animation:"heroFloat1 7s ease-in-out infinite 1s" }} />

          {/* Shield logo with pulse */}
          <div style={{
            width: 80, height: 80, borderRadius: 20, marginBottom: 24,
            background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 50%, #4338CA 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
            animation: "heroSlide 0.6s ease, heroPulse 3s ease-in-out infinite 1s",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth="1.5"/>
              <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Sora, sans-serif">Z</text>
            </svg>
          </div>

          {/* Title */}
          <h1 style={{
            margin: 0, fontSize: "2rem", fontWeight: 800, color: "#fff",
            letterSpacing: "-0.03em", lineHeight: 1.2,
            animation: "heroSlide 0.6s ease 0.1s both",
          }}>
            Welcome to <span style={{ color:"#818CF8" }}>Myzynca</span>
          </h1>
          <p style={{
            margin: "0.6rem 0 0", fontSize: "1rem", color: "rgba(255,255,255,0.55)",
            maxWidth: 420, lineHeight: 1.6,
            animation: "heroSlide 0.6s ease 0.2s both",
          }}>
            Your school's operating system. Generate clash‑free timetables in seconds — saving hours of manual work.
          </p>

          {/* Progress ring (0%) */}
          <div style={{
            margin: "28px 0 8px", position: "relative",
            animation: "heroSlide 0.6s ease 0.3s both",
          }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#6366F1" strokeWidth="8"
                strokeDasharray="264" strokeDashoffset="264"
                strokeLinecap="round" transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 1.5s ease" }} />
              <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" fontFamily="var(--font-mono)">0%</text>
              <text x="50" y="62" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">setup</text>
            </svg>
          </div>
          <p style={{
            fontSize: "0.72rem", color: "rgba(255,255,255,0.35)",
            animation: "heroSlide 0.6s ease 0.35s both",
          }}>
            Create your first project to begin
          </p>

          {/* CTA buttons */}
          <div style={{
            display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", justifyContent: "center",
            animation: "heroSlide 0.6s ease 0.4s both",
          }}>
            <button type="button" onClick={() => setShowCreateForm(true)}
              style={{
                fontSize: "0.95rem", padding: "0.75rem 1.8rem", fontWeight: 700,
                borderRadius: 12, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                color: "#fff", fontFamily: "var(--font-sans)",
                boxShadow: "0 6px 24px rgba(99,102,241,0.4)",
                transition: "all 0.2s",
              }}>
              ✨ Create Your First Timetable
            </button>
            <button type="button" onClick={handleLoadDemo} disabled={demoLoading}
              style={{
                fontSize: "0.85rem", padding: "0.65rem 1.4rem", fontWeight: 600,
                borderRadius: 12, cursor: "pointer",
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-sans)",
                transition: "all 0.2s",
              }}>
              {demoLoading ? "⏳ Loading…" : "🧪 Try Demo School"}
            </button>
          </div>

          <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}
            style={{
              background: "none", border: "none", cursor: "pointer", marginTop: 14,
              fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.35)",
              fontFamily: "var(--font-sans)", textDecoration: "underline", textUnderlineOffset: 3,
              animation: "heroSlide 0.6s ease 0.45s both",
            }}>
            {importing ? "⏳ Importing…" : "📂 Or upload an existing project"}
          </button>
          <input ref={fileRef} type="file" accept=".json,.timetable.json" style={{ display: "none" }} onChange={handleImportFile} />
        </div>

        {/* ═══ FEATURE CARDS ═══ */}
        <div className="dash-features" style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
          marginTop: 24,
        }}>
          {[
            { icon: "⚡", color: "#6366F1", title: "Instant Generation",
              desc: "AI-powered constraint solver creates your perfect timetable — zero clashes, every time.",
              stat: "< 10s", statLabel: "generation time" },
            { icon: "🔄", color: "#0EA875", title: "Smart Substitutions",
              desc: "Teacher absent? Auto-assign qualified substitutes with one click. No more scrambling.",
              stat: "1-click", statLabel: "auto-assign" },
            { icon: "📊", color: "#E8A020", title: "Live Dashboard",
              desc: "Real-time attendance, workload analytics, and insights. Know your school's pulse.",
              stat: "Real-time", statLabel: "live tracking" },
          ].map((f, i) => (
            <div key={i} style={{
              padding: "1.5rem 1.2rem", borderRadius: 16,
              background: "var(--surface-card, #fff)",
              border: "1px solid var(--border-default, #E2E8F0)",
              position: "relative", overflow: "hidden",
              transition: "all 0.25s ease",
              animation: `heroSlide 0.6s ease ${0.5 + i * 0.1}s both`,
              cursor: "default",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 32px ${f.color}20`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              <div style={{
                position: "absolute", top: -20, right: -20, width: 60, height: 60,
                borderRadius: "50%", background: `${f.color}10`,
              }} />
              <div style={{ fontSize: "1.5rem", marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--slate-900)", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--slate-500)", lineHeight: 1.5, marginBottom: 14 }}>{f.desc}</div>
              <div style={{
                display: "flex", alignItems: "baseline", gap: 6,
                borderTop: "1px solid var(--border-default, #F1F5F9)", paddingTop: 10,
              }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: f.color, fontFamily: "var(--font-mono)" }}>{f.stat}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--slate-400)" }}>{f.statLabel}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ TRUST SIGNALS ═══ */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 28, marginTop: 20,
          animation: "heroSlide 0.6s ease 0.8s both",
        }}>
          {[
            { icon: "🌍", text: "Schools worldwide" },
            { icon: "🛡️", text: "Clash-free guarantee" },
            { icon: "⏱️", text: "Setup under 15 min" },
          ].map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: "0.72rem", color: "var(--slate-400)", fontWeight: 500,
            }}>
              <span>{t.icon}</span> {t.text}
            </div>
          ))}
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
            <div key={p.id} className="dash-project-row" style={{
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
                <div className="dash-project-actions" style={{ display: "flex", gap: 4, flexShrink: 0 }}>
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
