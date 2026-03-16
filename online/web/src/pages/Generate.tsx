import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import * as api from "../api";
import { useProjectProgress } from "../hooks/useProjectProgress";
import "./Generate.css";

export default function Generate() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const navigate = useNavigate();
  const progress = useProjectProgress(pid);

  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof api.validateProject>> | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.generateTimetable>> | null>(null);
  const [error, setError] = useState("");
  const [genPhase, setGenPhase] = useState(0); // 0=idle, 1-5=animation phases
  const genLock = useRef(false);

  // Auto-validate on mount to show summary
  useEffect(() => {
    if (!isNaN(pid)) {
      api.validateProject(pid).then(setValidation).catch(() => {});
    }
  }, [pid]);

  async function handleValidate() {
    if (isNaN(pid)) return;
    setError(""); setValidation(null); setValidating(true);
    try {
      const v = await api.validateProject(pid);
      setValidation(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally { setValidating(false); }
  }

  async function handleGenerate() {
    if (isNaN(pid) || genLock.current) return;
    genLock.current = true;
    setError(""); setResult(null); setGenerating(true);
    setGenPhase(1);
    try {
      // Auto-validate
      const v = await api.validateProject(pid);
      setValidation(v);
      if (!v.is_valid) {
        setError("Please fix validation errors before generating.");
        setGenPhase(0);
        return;
      }
      // Animate through phases
      setGenPhase(2);
      await new Promise(r => setTimeout(r, 800));
      setGenPhase(3);
      const r = await api.generateTimetable(pid);
      setGenPhase(4);
      await new Promise(r2 => setTimeout(r2, 600));
      setResult(r);
      if (r.success) {
        setGenPhase(5); // success
        progress.refresh(); // refresh to unlock tabs
      } else {
        setGenPhase(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setGenPhase(0);
    } finally {
      setGenerating(false);
      setTimeout(() => { genLock.current = false; }, 1000);
    }
  }

  if (isNaN(pid)) return <div>Invalid project</div>;

  const summary = validation?.readiness_summary as Record<string, number> | undefined;
  const hasErrors = validation && !validation.is_valid;
  const hasWarnings = validation && validation.warnings.length > 0;

  // Stats for summary cards
  const stats = [
    { label: "Teachers", count: progress.teachers, icon: "👨‍🏫", color: "#6366F1", ok: progress.teachers > 0 },
    { label: "Subjects", count: progress.subjects, icon: "📚", color: "#0EA5E9", ok: progress.subjects > 0 },
    { label: "Classes", count: progress.classes, icon: "🎓", color: "#8B5CF6", ok: progress.classes > 0 },
    { label: "Lessons", count: progress.lessons, icon: "📖", color: "#F59E0B", ok: progress.lessons > 0 },
  ];

  // Donut chart data
  const total = stats.reduce((s, c) => s + c.count, 0);

  return (
    <div className="gen-page">
      <style>{`
        @keyframes genSlide { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes genPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes genSpin { to{transform:rotate(360deg)} }
        @keyframes cellDraw { 0%{transform:scale(0);opacity:0} 50%{transform:scale(1.1);opacity:0.8} 100%{transform:scale(1);opacity:1} }
        @keyframes rowSlide { from{transform:translateX(-100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes colGrow { from{height:0} to{height:100%} }
        @keyframes fillCell { from{background:transparent} to{background:var(--fill)} }
        @keyframes successBounce { 0%{transform:scale(0)} 50%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @keyframes confetti { 0%{transform:translateY(0) rotate(0)} 100%{transform:translateY(300px) rotate(720deg)} }
        @keyframes barGrow { from{width:0} }
      `}</style>

      {/* ── HEADER ── */}
      <div className="gen-header" style={{ animation: "genSlide 0.5s ease" }}>
        <div>
          <h1 className="gen-title">Generate Timetable</h1>
          <p className="gen-subtitle">Review your setup data, then generate a clash-free timetable</p>
        </div>
        <Link to={`/project/${pid}/settings`} className="gen-back-link">← Back to Setup</Link>
      </div>

      {/* ═══ DATA SUMMARY DASHBOARD ═══ */}
      <div className="gen-summary" style={{ animation: "genSlide 0.5s ease 0.1s both" }}>
        <h2 className="gen-section-title">📋 Data Summary</h2>

        {/* Stat cards */}
        <div className="gen-stat-grid">
          {stats.map((s, i) => (
            <div key={s.label} className={`gen-stat-card ${!s.ok ? "gen-stat-error" : ""}`}
              style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              onClick={() => navigate(`/project/${pid}/${s.label.toLowerCase()}`)}
            >
              <div className="gen-stat-icon">{s.icon}</div>
              <div className="gen-stat-count" style={{ color: s.ok ? s.color : "#EF4444" }}>{s.count}</div>
              <div className="gen-stat-label">{s.label}</div>
              {!s.ok && <div className="gen-stat-warning">⚠️ None added</div>}
            </div>
          ))}
        </div>

        {/* Visual: mini donut + bars */}
        <div className="gen-visual-row">
          {/* Donut chart */}
          <div className="gen-donut-wrap">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-default, #E2E8F0)" strokeWidth="10" />
              {(() => {
                let offset = 0;
                const circ = 2 * Math.PI * 50;
                return stats.map(s => {
                  const pct = total > 0 ? s.count / total : 0;
                  const dash = pct * circ;
                  const el = (
                    <circle key={s.label} cx="60" cy="60" r="50" fill="none"
                      stroke={s.ok ? s.color : "#EF4444"} strokeWidth="10"
                      strokeDasharray={`${dash} ${circ - dash}`}
                      strokeDashoffset={-offset} transform="rotate(-90 60 60)"
                      style={{ transition: "all 0.8s ease" }} />
                  );
                  offset += dash;
                  return el;
                });
              })()}
              <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="800"
                fill="var(--slate-900)" fontFamily="var(--font-mono)">{total}</text>
              <text x="60" y="72" textAnchor="middle" fontSize="9"
                fill="var(--slate-400)">total items</text>
            </svg>
          </div>

          {/* Bar chart */}
          <div className="gen-bar-chart">
            {stats.map(s => (
              <div key={s.label} className="gen-bar-row">
                <span className="gen-bar-label">{s.icon} {s.label}</span>
                <div className="gen-bar-track">
                  <div className="gen-bar-fill"
                    style={{
                      width: total > 0 ? `${(s.count / Math.max(...stats.map(x => x.count), 1)) * 100}%` : "0%",
                      background: s.ok ? s.color : "#EF4444",
                      animation: "barGrow 1s ease",
                    }} />
                </div>
                <span className="gen-bar-count" style={{ color: s.ok ? s.color : "#EF4444" }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Readiness summary from validation API */}
        {summary && Object.keys(summary).length > 0 && (
          <div className="gen-readiness">
            <h3 className="gen-readiness-title">Readiness Check</h3>
            <div className="gen-readiness-grid">
              {Object.entries(summary).map(([k, v]) => {
                const val = Number(v);
                const isOk = val > 0;
                return (
                  <div key={k} className={`gen-readiness-item ${isOk ? "" : "gen-readiness-bad"}`}>
                    <span className="gen-readiness-icon">{isOk ? "✅" : "❌"}</span>
                    <span className="gen-readiness-key">{k.replace(/_/g, " ")}</span>
                    <span className="gen-readiness-val" style={{ color: isOk ? "#16A34A" : "#EF4444" }}>{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ VALIDATION ISSUES ═══ */}
      {validation && (hasErrors || hasWarnings) && (
        <div className="gen-issues" style={{ animation: "genSlide 0.5s ease 0.2s both" }}>
          <h2 className="gen-section-title" style={{ color: hasErrors ? "#EF4444" : "#F59E0B" }}>
            {hasErrors ? "🚫 Issues Found" : "⚠️ Warnings"}
          </h2>
          {validation.errors.length > 0 && (
            <div className="gen-error-box">
              {validation.errors.map((e, i) => (
                <div key={i} className="gen-error-item">
                  <span className="gen-error-dot" />
                  {e}
                </div>
              ))}
            </div>
          )}
          {Object.entries(validation.grouped_errors as Record<string, string[]>).map(([cat, msgs]) => (
            <div key={cat} className="gen-error-box" style={{ marginTop: 8 }}>
              <div className="gen-error-cat">{cat}</div>
              {msgs.map((m, i) => (
                <div key={i} className="gen-error-item">
                  <span className="gen-error-dot" />
                  {m}
                </div>
              ))}
            </div>
          ))}
          {validation.warnings.length > 0 && (
            <div className="gen-warning-box">
              {validation.warnings.map((w, i) => (
                <div key={i} className="gen-warning-item">
                  <span className="gen-warning-dot" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ACTION BAR ═══ */}
      <div className="gen-actions" style={{ animation: "genSlide 0.5s ease 0.25s both" }}>
        <button type="button" className="gen-btn-validate" onClick={handleValidate} disabled={validating}>
          {validating ? "⏳ Validating…" : "🔍 Re-Validate"}
        </button>
        <button type="button" className="gen-btn-generate" onClick={handleGenerate}
          disabled={generating || genLock.current || (hasErrors === true)}>
          {generating ? "⏳ Generating…" : "🚀 Generate Timetable"}
        </button>
        {hasErrors && (
          <span className="gen-action-hint">Fix errors above before generating</span>
        )}
      </div>

      {error && <div className="gen-error-banner">{error}</div>}

      {/* ═══ GENERATION ANIMATION ═══ */}
      {generating && genPhase > 0 && (
        <div className="gen-animation-wrap">
          <div className="gen-anim-title">
            {genPhase === 1 && "🔍 Validating data..."}
            {genPhase === 2 && "📐 Building timetable structure..."}
            {genPhase === 3 && "🧩 Solving constraints & placing lessons..."}
            {genPhase === 4 && "✨ Finalizing..."}
          </div>

          {/* Animated grid */}
          <div className="gen-anim-grid">
            {Array.from({ length: 6 }).map((_, r) => (
              <div key={r} className="gen-anim-row"
                style={{ animation: `rowSlide 0.4s ease ${r * 0.15}s both` }}>
                {Array.from({ length: 8 }).map((_, c) => {
                  const delay = r * 0.1 + c * 0.08;
                  const active = genPhase >= 3;
                  const filled = active && Math.random() > 0.3;
                  const colors = ["#6366F1", "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899"];
                  const bg = filled ? colors[Math.floor(Math.random() * colors.length)] : "transparent";
                  return (
                    <div key={c} className="gen-anim-cell"
                      style={{
                        animation: active ? `cellDraw 0.3s ease ${delay}s both` : undefined,
                        background: bg,
                        opacity: active ? 0.85 : 0.15,
                      }} />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="gen-anim-progress">
            <div className="gen-anim-bar"
              style={{
                width: `${genPhase * 25}%`,
                transition: "width 0.8s ease",
              }} />
          </div>
          <div className="gen-anim-phase-text">
            Phase {genPhase} of 4
          </div>
        </div>
      )}

      {/* ═══ SUCCESS STATE ═══ */}
      {result && result.success && genPhase === 5 && (
        <div className="gen-success-wrap">
          <div className="gen-success-icon" style={{ animation: "successBounce 0.6s ease" }}>✅</div>
          <h2 className="gen-success-title">Timetable Generated Successfully!</h2>
          <p className="gen-success-desc">
            {result.entries_count} entries placed • Zero clashes • All constraints satisfied
          </p>
          {result.messages && result.messages.length > 0 && (
            <div className="gen-success-msgs">
              {result.messages.map((m, i) => (
                <div key={i} className="gen-success-msg">✓ {m}</div>
              ))}
            </div>
          )}
          <div className="gen-success-actions">
            <Link to={`/project/${pid}/review`} className="gen-btn-review">
              📊 View Timetable →
            </Link>
            <Link to={`/project/${pid}/dashboard`} className="gen-btn-dash">
              🏠 Go to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* FAIL STATE */}
      {result && !result.success && (
        <div className="gen-fail-wrap">
          <div className="gen-fail-icon">❌</div>
          <h2 className="gen-fail-title">Generation Failed</h2>
          <p className="gen-fail-desc">{result.message}</p>
          {result.messages && result.messages.length > 0 && (
            <ul className="gen-fail-msgs">
              {result.messages.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
