import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

// ── Animated timetable grid ───────────────────────────────────
const DAYS    = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = ["P1", "P2", "P3", "P4", "P5", "P6"];
const SUBJECTS = [
  { name: "Mathematics", color: "#4F46E5" },
  { name: "Physics",     color: "#0891B2" },
  { name: "English",     color: "#D97706" },
  { name: "Biology",     color: "#16A34A" },
  { name: "History",     color: "#7C3AED" },
  { name: "Chemistry",   color: "#DC2626" },
  { name: "Comp Sci",    color: "#0F766E" },
];

const GRID = PERIODS.map(() =>
  DAYS.map(() => Math.random() > 0.25 ? SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)] : null)
);

function AnimatedGrid() {
  return (
    <div className="bg-grid" aria-hidden="true">
      <div className="bg-grid-inner">
        <div className="bg-grid-header">
          <div className="bg-grid-corner" />
          {DAYS.map(d => <div key={d} className="bg-grid-day">{d}</div>)}
        </div>
        {GRID.map((row, pi) => (
          <div key={pi} className="bg-grid-row">
            <div className="bg-grid-period">{PERIODS[pi]}</div>
            {row.map((cell, di) => (
              <div
                key={di}
                className={`bg-grid-cell ${cell ? "filled" : "empty"}`}
                style={cell ? {
                  "--cell-color": cell.color,
                  animationDelay: `${(pi * 5 + di) * 0.08}s`,
                } as React.CSSProperties : undefined}
              >
                {cell && <span className="bg-cell-label">{cell.name}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature callouts ──────────────────────────────────────────
const FEATURES = [
  { icon: "⚡", title: "Clash-free in seconds",
    desc: "OR-Tools solver generates complete, conflict-free timetables automatically." },
  { icon: "🔄", title: "Smart substitutions",
    desc: "When a teacher is absent, the system finds free teachers instantly." },
  { icon: "📊", title: "Workload intelligence",
    desc: "Track every teacher's load across 40 weeks. Spot burnout before it happens." },
  { icon: "📋", title: "Exam duties & committees",
    desc: "Auto-assign invigilators. Manage school committees with one click." },
];

// ── Main component ────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [isSignUp,     setIsSignUp]     = useState(false);
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirmPwd,   setConfirmPwd]   = useState("");
  const [schoolName,   setSchoolName]   = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [activeFeature, setActiveFeature] = useState(0);

  // Auto-cycle feature callouts
  useEffect(() => {
    const t = setInterval(() => setActiveFeature(f => (f + 1) % FEATURES.length), 3000);
    return () => clearInterval(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (isSignUp) {
      if (password !== confirmPwd) { setError("Passwords do not match"); return; }
      if (password.length < 6)     { setError("Password must be at least 6 characters"); return; }
      if (!schoolName.trim())      { setError("School name is required"); return; }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ school_name: schoolName.trim(), email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        if (data.requires_verification) {
          setSuccess(data.message || "Account created! Check your email to verify.");
          setIsSignUp(false);
        } else if (data.access_token) {
          localStorage.setItem("timetable_token", data.access_token);
          window.location.href = "/";
        }
      } else {
        await login(email.trim(), password);
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(signUp: boolean) {
    setIsSignUp(signUp);
    setError(""); setSuccess("");
  }

  const pwdMismatch = isSignUp && !!confirmPwd && confirmPwd !== password;

  return (
    <div className="login-page">
      <AnimatedGrid />
      <div className="login-overlay" />

      <div className="login-content">
        {/* ── Left: product showcase ── */}
        <div className="login-left">
          <div className="login-brand">
            <div className="login-logo-mark">
              <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="2" width="7" height="7" rx="1.5" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <div className="login-brand-text">
              <span className="login-brand-name">Schedulr</span>
              <span className="login-brand-tag">School OS</span>
            </div>
          </div>

          <h1 className="login-headline">
            The last timetable<br />
            software your school<br />
            will ever need.
          </h1>
          <p className="login-sub">
            Built for Pakistani schools. Powered by constraint solving.<br />
            Zero clashes guaranteed.
          </p>

          <div className="feature-showcase">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`feature-item ${i === activeFeature ? "active" : ""}`}
                onClick={() => setActiveFeature(i)}
              >
                <div className="feature-icon">{f.icon}</div>
                <div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="login-stats">
            <div className="login-stat">
              <span className="stat-num">40</span>
              <span className="stat-label">weeks tracked</span>
            </div>
            <div className="stat-divider" />
            <div className="login-stat">
              <span className="stat-num">0</span>
              <span className="stat-label">clashes guaranteed</span>
            </div>
            <div className="stat-divider" />
            <div className="login-stat">
              <span className="stat-num">∞</span>
              <span className="stat-label">schools supported</span>
            </div>
          </div>
        </div>

        {/* ── Right: login / sign-up form ── */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-header">
              <h2 className="login-card-title">{isSignUp ? "Create account" : "Welcome back"}</h2>
              <p className="login-card-sub">
                {isSignUp ? "Start building your timetable today." : "Sign in to your school dashboard"}
              </p>
            </div>

            <form className="lf-form" onSubmit={handleSubmit} noValidate>
              {isSignUp && (
                <div className="lf-field">
                  <label className="lf-label">School name</label>
                  <div className="lf-input-wrap">
                    <input className="lf-input no-icon" type="text" placeholder="e.g. City Public School"
                      value={schoolName} onChange={e => { setSchoolName(e.target.value); setError(""); }}
                      disabled={loading} required />
                  </div>
                </div>
              )}

              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-email">Email address</label>
                <div className="lf-input-wrap">
                  <svg className="lf-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="4" width="12" height="9" rx="1" />
                    <path d="M2 4l6 5 6-5" />
                  </svg>
                  <input id="lf-email" className="lf-input" type="email"
                    placeholder="admin@yourschool.edu" autoComplete="email"
                    value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                    disabled={loading} required />
                </div>
              </div>

              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-password">Password</label>
                <div className="lf-input-wrap">
                  <svg className="lf-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="7" width="10" height="7" rx="1" />
                    <path d="M5 7V5a3 3 0 016 0v2" />
                  </svg>
                  <input id="lf-password" className="lf-input"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                    disabled={loading} required />
                  <button type="button" className="lf-toggle-pass"
                    onClick={() => setShowPass(s => !s)} tabIndex={-1}
                    aria-label={showPass ? "Hide password" : "Show password"}>
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="lf-field">
                  <label className="lf-label" htmlFor="lf-confirm">Confirm password</label>
                  <div className="lf-input-wrap">
                    <svg className="lf-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="7" width="10" height="7" rx="1" />
                      <path d="M5 7V5a3 3 0 016 0v2" />
                    </svg>
                    <input id="lf-confirm" className="lf-input"
                      type="password" placeholder="••••••••"
                      autoComplete="new-password"
                      value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setError(""); }}
                      disabled={loading} required
                      style={{ borderColor: pwdMismatch ? "rgba(239,68,68,0.6)" : undefined }} />
                  </div>
                  {pwdMismatch && <div className="lf-input-err">Passwords do not match</div>}
                </div>
              )}

              {error   && <div className="lf-error" role="alert">{error}</div>}
              {success && <div className="lf-success">✅ {success}</div>}

              <button type="submit" className="lf-btn"
                disabled={loading || pwdMismatch}>
                {loading ? (
                  <><span className="lf-btn-spinner" />{isSignUp ? "Creating account…" : "Signing in…"}</>
                ) : (
                  isSignUp ? "Create account" : "Sign in to Schedulr"
                )}
              </button>
            </form>

            <div className="lf-footer-row">
              <span>{isSignUp ? "Already have an account?" : "Don't have an account?"}</span>
              <button type="button" className="lf-toggle-link" onClick={() => switchMode(!isSignUp)}>
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </div>

            <div className="lf-demo-hint">
              Demo: <strong>admin@school.demo</strong> / <strong>admin123</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
