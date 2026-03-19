import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AntiGravityCanvas from "../components/AntiGravityCanvas";
import "./Login.css";

// ── Count-Up hook ─────────────────────────────────────────────
function useCountUp(target: number, duration = 2000, delay = 0) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
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
  const { theme, toggleTheme } = useTheme();

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
  const [searchParams] = useSearchParams();

  // Count-up stats
  const years = useCountUp(12, 2200, 400);
  const weeks = useCountUp(40, 2000, 600);
  const clashes = useCountUp(0, 100, 800);

  // Pick up OAuth error/success from URL params
  useEffect(() => {
    const oauthError = searchParams.get("error");
    const oauthSuccess = searchParams.get("success");
    if (oauthError) setError(oauthError.replace(/\+/g, " "));
    if (oauthSuccess) setSuccess(oauthSuccess.replace(/\+/g, " "));
  }, [searchParams]);

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
        if (data.requires_approval || data.requires_verification) {
          setSuccess(data.message || "Registration successful! Your account is pending admin approval.");
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
      {/* Anti-Gravity particle canvas */}
      <AntiGravityCanvas />

      {/* Gaussian curve watermark */}
      <svg className="ag-watermark" viewBox="0 0 600 200" aria-hidden="true">
        <path d="M0 180 Q50 178 100 170 Q150 150 200 110 Q250 50 300 20 Q350 50 400 110 Q450 150 500 170 Q550 178 600 180"
          fill="none" stroke="rgba(0,206,200,0.04)" strokeWidth="2" />
        <path d="M0 185 Q80 183 160 175 Q240 155 300 80 Q360 155 440 175 Q520 183 600 185"
          fill="none" stroke="rgba(0,206,200,0.025)" strokeWidth="1.5" />
      </svg>

      <div className="login-overlay" />

      {/* Theme Toggle */}
      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <div className="login-content">
        {/* ── Left: product showcase ── */}
        <div className="login-left">
          <div className="login-brand">
            <div className="login-logo-mark">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="46" stroke="#00CEC8" strokeWidth="5" fill="rgba(255,255,255,0.1)" />
                <path d="M50 20L28 32v14c0 12.5 8.3 19.4 18 22.2 1.3.4 2.6.6 4 .8 1.4-.2 2.7-.4 4-.8 9.7-2.8 18-9.7 18-22.2V32L50 20z"
                  fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5" />
                <text x="50" y="52" textAnchor="middle" fontSize="20" fontWeight="800"
                  fill="white" fontFamily="'Sora', sans-serif">Z</text>
              </svg>
            </div>
            <div className="login-brand-text">
              <span className="login-brand-name">Myzynca</span>
              <span className="login-brand-tag">Precision Scheduling</span>
            </div>
          </div>

          <h1 className="login-headline">
            The mathematics of<br />
            <span className="ag-headline-accent">perfect</span> scheduling.
          </h1>
          <p className="login-sub">
            Built for schools worldwide. Powered by constraint-satisfaction<br />
            and mathematical optimization. Zero clashes guaranteed.
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

          {/* Count-up Stats */}
          <div className="login-stats">
            <div className="login-stat">
              <span className="stat-num ag-countup">{years}</span>
              <span className="stat-label">Years Excellence</span>
            </div>
            <div className="stat-divider" />
            <div className="login-stat">
              <span className="stat-num ag-countup">{weeks}</span>
              <span className="stat-label">Weeks Tracked</span>
            </div>
            <div className="stat-divider" />
            <div className="login-stat">
              <span className="stat-num ag-countup">{clashes}</span>
              <span className="stat-label">Clashes guaranteed</span>
            </div>
          </div>

          {/* Founder's Note — Glassmorphism */}
          <div className="ag-founders-note">
            <div className="ag-fn-glow" />
            <div className="ag-fn-quote">"</div>
            <p className="ag-fn-text">
              As a Data Scientist and Mathematics teacher for over a decade,
              I believe school management should be driven by <em>logic</em>, not manual labor.
              Myzynca is the result of 12 years in education meeting modern data engineering.
            </p>
            <div className="ag-fn-author">
              <div className="ag-fn-avatar">ZA</div>
              <div>
                <div className="ag-fn-name">Zain ul Arfeen</div>
                <div className="ag-fn-role">Founder · Data Scientist & Educator</div>
              </div>
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
                  isSignUp ? "Create account" : "Sign in to Myzynca"
                )}
              </button>
            </form>

            {/* ── OAuth divider ── */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              margin: "1rem 0", color: "var(--slate-400, #94A3B8)", fontSize: "0.8rem",
            }}>
              <div style={{ flex: 1, height: 1, background: "var(--border-default, #E2E8F0)" }} />
              or continue with
              <div style={{ flex: 1, height: 1, background: "var(--border-default, #E2E8F0)" }} />
            </div>

            {/* ── OAuth buttons ── */}
            <div style={{ display: "flex", gap: 12 }}>
              <a href="/api/auth/google" className="lf-oauth-btn" style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 16px", borderRadius: 8,
                border: "1px solid var(--border-default, #E2E8F0)",
                background: "var(--surface-card, #fff)",
                color: "var(--slate-700, #334155)",
                fontWeight: 600, fontSize: "0.85rem",
                textDecoration: "none",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </a>

              <a href="/api/auth/microsoft" className="lf-oauth-btn" style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 16px", borderRadius: 8,
                border: "1px solid var(--border-default, #E2E8F0)",
                background: "var(--surface-card, #fff)",
                color: "var(--slate-700, #334155)",
                fontWeight: 600, fontSize: "0.85rem",
                textDecoration: "none",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                </svg>
                Microsoft
              </a>
            </div>

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
