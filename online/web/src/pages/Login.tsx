import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ─── Animated Pie Chart ────────────────────────────────────────────────── */
function AnimatedPie({ segments, size = 120, label }: { segments: { pct: number; color: string }[]; size?: number; label: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 300); return () => clearTimeout(t); }, []);
  const r = size / 2 - 4;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
        {segments.map((seg, i) => {
          const dash = (seg.pct / 100) * circ;
          const el = (
            <circle key={i} cx={c} cy={c} r={r} fill="none"
              stroke={seg.color} strokeWidth={8} strokeLinecap="round"
              strokeDasharray={`${mounted ? dash : 0} ${circ}`}
              strokeDashoffset={-offset}
              style={{ transition: `stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1) ${i * 0.2}s` }}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/* ─── Floating Timetable Grid ───────────────────────────────────────────── */
function FloatingGrid() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const periods = [1, 2, 3, 4, 5];
  const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];
  return (
    <div style={{ opacity: 0.85 }}>
      <div style={{ display: "grid", gridTemplateColumns: "40px repeat(5, 1fr)", gap: 3, fontSize: "0.6rem" }}>
        <div />
        {days.map(d => <div key={d} style={{ textAlign: "center", color: "#64748b", fontWeight: 700, fontSize: "0.6rem" }}>{d}</div>)}
        {periods.map(p => (
          <>
            <div key={`l${p}`} style={{ color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", fontSize: "0.58rem" }}>L{p}</div>
            {days.map((d, di) => {
              const ci = (p * 3 + di) % colors.length;
              return (
                <div key={`${d}-${p}`} className="login-grid-cell" style={{
                  background: colors[ci], borderRadius: 4, padding: "4px 2px",
                  textAlign: "center", color: "#fff", fontWeight: 600,
                  fontSize: "0.52rem", lineHeight: 1.3,
                  animation: `loginFadeIn 0.6s ease ${(p * 5 + di) * 0.06}s both`,
                  boxShadow: `0 1px 4px ${colors[ci]}40`,
                }}>
                  {["Math", "Eng", "Sci", "Urdu", "Art", "Phy", "Chem"][(p + di) % 7]}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

/* ─── Stat Counter ──────────────────────────────────────────────────────── */
function StatCounter({ value, label, delay }: { value: string; label: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      textAlign: "center", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "all 0.6s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#e2e8f0", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ─── Main Login Page ───────────────────────────────────────────────────── */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpName, setSignUpName] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, name: signUpName.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
        }
      }
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes loginFadeIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes loginSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes loginPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes loginFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes loginGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .login-split { display: flex; min-height: 100vh; }
        .login-hero {
          flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2rem; padding: 2rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%);
          background-size: 200% 200%; animation: loginGradient 8s ease infinite;
          position: relative; overflow: hidden;
        }
        .login-hero::before {
          content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle at 30% 40%, rgba(59,130,246,0.08) 0%, transparent 50%),
                      radial-gradient(circle at 70% 60%, rgba(139,92,246,0.06) 0%, transparent 50%);
          animation: loginPulse 6s ease-in-out infinite;
        }
        .login-form-side {
          flex: 0 0 440px; display: flex; flex-direction: column; justify-content: center; padding: 3rem;
          background: #fff; box-shadow: -8px 0 40px rgba(0,0,0,0.08);
        }
        .login-input {
          width: 100%; padding: 0.7rem 0.9rem; border: 1.5px solid #e2e8f0; border-radius: 10px;
          font-size: 0.88rem; background: #f8fafc; transition: all 0.2s ease; outline: none;
          font-family: inherit;
        }
        .login-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); background: #fff; }
        .login-btn {
          width: 100%; padding: 0.75rem; border: none; border-radius: 10px; font-size: 0.92rem; font-weight: 700;
          background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; cursor: pointer;
          transition: all 0.2s ease; font-family: inherit; letter-spacing: 0.02em;
        }
        .login-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59,130,246,0.35); }
        .login-btn:disabled { opacity: 0.6; transform: none; box-shadow: none; }
        .login-toggle { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 0.82rem; font-weight: 600; padding: 0; font-family: inherit; }
        .login-toggle:hover { text-decoration: underline; }
        .login-feature {
          display: flex; align-items: center; gap: 10px; padding: 0.55rem 0.8rem;
          background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);
          animation: loginSlideUp 0.5s ease both;
        }
        .login-feature-icon { font-size: 1.1rem; width: 28px; text-align: center; }
        .login-feature-text { font-size: 0.75rem; color: #cbd5e1; font-weight: 500; }
        @media (max-width: 860px) {
          .login-split { flex-direction: column; }
          .login-hero { flex: none; min-height: 40vh; padding: 1.5rem; }
          .login-form-side { flex: 1; padding: 2rem; }
        }
      `}</style>

      <div className="login-split">
        {/* ─── Left Hero ─── */}
        <div className="login-hero">
          <div style={{ position: "relative", zIndex: 1, maxWidth: 420, width: "100%" }}>
            {/* Logo + tagline */}
            <div style={{ animation: "loginSlideUp 0.6s ease both", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem", boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
                }}>📅</div>
                <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                  SchoolScheduler
                </span>
              </div>
              <p style={{ color: "#94a3b8", fontSize: "0.82rem", lineHeight: 1.6, margin: 0 }}>
                Generate clash-free timetables in minutes.
                <br />Trusted by schools for professional scheduling.
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", marginBottom: "1.5rem" }}>
              <StatCounter value="100%" label="Clash-free" delay={400} />
              <StatCounter value="5 min" label="Setup time" delay={600} />
              <StatCounter value="∞" label="Projects" delay={800} />
            </div>

            {/* Pie charts */}
            <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", marginBottom: "1.5rem", animation: "loginFloat 4s ease-in-out infinite" }}>
              <AnimatedPie size={90} label="Subjects" segments={[
                { pct: 25, color: "#3b82f6" }, { pct: 20, color: "#8b5cf6" },
                { pct: 18, color: "#06b6d4" }, { pct: 15, color: "#f59e0b" },
                { pct: 12, color: "#10b981" }, { pct: 10, color: "#ef4444" },
              ]} />
              <AnimatedPie size={90} label="Teachers" segments={[
                { pct: 30, color: "#ec4899" }, { pct: 25, color: "#6366f1" },
                { pct: 22, color: "#14b8a6" }, { pct: 23, color: "#f97316" },
              ]} />
              <AnimatedPie size={90} label="Rooms" segments={[
                { pct: 40, color: "#22c55e" }, { pct: 35, color: "#0ea5e9" },
                { pct: 25, color: "#a855f7" },
              ]} />
            </div>

            {/* Mini timetable */}
            <div style={{ animation: "loginSlideUp 0.8s ease 0.4s both" }}>
              <FloatingGrid />
            </div>

            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "1.2rem" }}>
              {[
                { icon: "⚡", text: "AI-powered scheduling engine" },
                { icon: "📊", text: "Export PDF, Excel, CSV reports" },
                { icon: "🔄", text: "Drag & drop lesson editing" },
                { icon: "💾", text: "Save & upload project files" },
              ].map((f, i) => (
                <div key={i} className="login-feature" style={{ animationDelay: `${0.6 + i * 0.12}s` }}>
                  <span className="login-feature-icon">{f.icon}</span>
                  <span className="login-feature-text">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Right Form ─── */}
        <div className="login-form-side">
          <div style={{ maxWidth: 340, margin: "0 auto", width: "100%" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>
              {isSignUp ? "Create account" : "Welcome back"}
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 1.5rem 0" }}>
              {isSignUp ? "Start building your timetable today." : "Sign in to continue managing your timetable."}
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {isSignUp && (
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>School name</label>
                  <input className="login-input" value={signUpName} onChange={e => setSignUpName(e.target.value)} placeholder="e.g. City Public School" required />
                </div>
              )}
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Email address</label>
                <input className="login-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.demo" required autoComplete="email" />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Password</label>
                <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
              </div>
              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#dc2626" }}>
                  {error}
                </div>
              )}
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "⏳ Please wait…" : isSignUp ? "Create account" : "Sign in"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "1.2rem" }}>
              <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
              </span>
              <button type="button" className="login-toggle" onClick={() => { setIsSignUp(!isSignUp); setError(""); }}>
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "1.5rem", paddingTop: "1rem", textAlign: "center" }}>
              <p style={{ color: "#cbd5e1", fontSize: "0.68rem", margin: 0 }}>
                Demo: <strong>admin@school.demo</strong> / <strong>admin123</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
