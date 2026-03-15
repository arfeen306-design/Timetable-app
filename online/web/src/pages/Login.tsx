import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATED PIE CHART
   ═══════════════════════════════════════════════════════════════════════════ */
function AnimatedPie({ segments, size = 90, label }: { segments: { pct: number; color: string }[]; size?: number; label: string }) {
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
            <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={seg.color} strokeWidth={8} strokeLinecap="round"
              strokeDasharray={`${mounted ? dash : 0} ${circ}`} strokeDashoffset={-offset}
              style={{ transition: `stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1) ${i * 0.2}s` }} />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATED TAB SLIDES — shows each software tab preview
   ═══════════════════════════════════════════════════════════════════════════ */
const TAB_SLIDES = [
  {
    title: "🏫 School Setup",
    desc: "Configure school name, days, lessons per day, break timings, and bell schedule with separate Friday timing support.",
    visual: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: "0.6rem" }}>
        {[["School", "City Public School"], ["Days/Week", "6"], ["Lessons/Day", "7"], ["Break After", "Lesson 3"]].map(([k, v]) => (
          <div key={k} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ color: "#64748b", fontSize: "0.5rem" }}>{k}</div>
            <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
    ),
    color: "#3b82f6",
  },
  {
    title: "📚 Subjects & Teachers",
    desc: "Add all subjects with codes and weekly hours. Assign teachers to subjects with availability constraints.",
    visual: (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.58rem" }}>
        {[
          { sub: "Mathematics", code: "MATH", color: "#3b82f6" },
          { sub: "English", code: "ENG", color: "#10b981" },
          { sub: "Science", code: "SCI", color: "#f59e0b" },
          { sub: "Urdu", code: "URD", color: "#8b5cf6" },
        ].map(s => (
          <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 5, padding: "4px 8px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ color: "#e2e8f0", fontWeight: 600, flex: 1 }}>{s.sub}</span>
            <span style={{ color: "#64748b", fontFamily: "monospace" }}>{s.code}</span>
          </div>
        ))}
      </div>
    ),
    color: "#10b981",
  },
  {
    title: "🏛️ Classes & Rooms",
    desc: "Define class sections and available rooms. The engine ensures no room clash across the entire schedule.",
    visual: (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, fontSize: "0.55rem" }}>
        {["6-A", "6-B", "7-A", "7-B", "8-A", "8-B"].map(c => (
          <div key={c} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "5px", textAlign: "center", color: "#e2e8f0", fontWeight: 700 }}>{c}</div>
        ))}
      </div>
    ),
    color: "#f59e0b",
  },
  {
    title: "📋 Lessons & Constraints",
    desc: "Map which teacher teaches which subject to which class. Add time constraints for no-go slots.",
    visual: (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.55rem" }}>
        {[
          { cls: "6-A", sub: "Math", teacher: "Mr. Ahmed" },
          { cls: "6-A", sub: "Eng", teacher: "Ms. Sarah" },
          { cls: "7-B", sub: "Sci", teacher: "Mr. Khan" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 5, padding: "4px 8px", alignItems: "center" }}>
            <span style={{ color: "#3b82f6", fontWeight: 700, width: 28 }}>{l.cls}</span>
            <span style={{ color: "#e2e8f0", flex: 1 }}>{l.sub}</span>
            <span style={{ color: "#94a3b8" }}>→ {l.teacher}</span>
          </div>
        ))}
      </div>
    ),
    color: "#8b5cf6",
  },
  {
    title: "⚡ Generate & Review",
    desc: "One-click AI generation produces a clash-free timetable. Review by class, teacher, or room. Drag & drop to fine-tune.",
    visual: (() => {
      const days = ["M", "T", "W", "T", "F"];
      const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2, fontSize: "0.48rem" }}>
          {days.map(d => <div key={d} style={{ textAlign: "center", color: "#64748b", fontWeight: 700, fontSize: "0.5rem" }}>{d}</div>)}
          {Array.from({ length: 25 }, (_, i) => (
            <div key={i} style={{ background: colors[i % colors.length], borderRadius: 3, padding: 3, textAlign: "center", color: "#fff", fontWeight: 600, fontSize: "0.4rem" }}>
              {["Ma", "En", "Sc", "Ur", "Ar", "Ph", "Ch"][i % 7]}
            </div>
          ))}
        </div>
      );
    })(),
    color: "#ef4444",
  },
  {
    title: "📤 Export Everywhere",
    desc: "Export class or teacher timetables as PDF, Excel, or CSV. Share via email or WhatsApp. Download project files for backup.",
    visual: (
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {[
          { icon: "📄", label: "PDF", bg: "#ef4444" },
          { icon: "📊", label: "Excel", bg: "#10b981" },
          { icon: "📋", label: "CSV", bg: "#3b82f6" },
        ].map(e => (
          <div key={e.label} style={{ background: e.bg, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
            <div style={{ fontSize: "1.1rem" }}>{e.icon}</div>
            <div style={{ color: "#fff", fontSize: "0.55rem", fontWeight: 700, marginTop: 2 }}>{e.label}</div>
          </div>
        ))}
      </div>
    ),
    color: "#06b6d4",
  },
];

function TabSlider() {
  const [active, setActive] = useState(0);
  const next = useCallback(() => setActive(p => (p + 1) % TAB_SLIDES.length), []);

  useEffect(() => {
    const t = setInterval(next, 4000);
    return () => clearInterval(t);
  }, [next]);

  const s = TAB_SLIDES[active];

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Dots */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10 }}>
        {TAB_SLIDES.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            width: i === active ? 18 : 6, height: 6, borderRadius: 3, border: "none",
            background: i === active ? s.color : "rgba(255,255,255,0.15)", cursor: "pointer",
            transition: "all 0.3s ease", padding: 0,
          }} />
        ))}
      </div>
      {/* Slide */}
      <div key={active} style={{
        background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}30`,
        borderRadius: 12, padding: "0.9rem 1rem", animation: "loginSlideUp 0.5s ease both",
      }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
          {s.title}
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.68rem", lineHeight: 1.5, margin: "0 0 10px" }}>{s.desc}</p>
        {s.visual}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT COUNTER
   ═══════════════════════════════════════════════════════════════════════════ */
function StatCounter({ value, label, delay }: { value: string; label: string; delay: number }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{ textAlign: "center", opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(12px)", transition: "all 0.6s cubic-bezier(0.4,0,0.2,1)" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#e2e8f0", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN LOGIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (isSignUp && password !== confirmPwd) { setError("Passwords do not match"); return; }
    if (isSignUp && password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (isSignUp && !schoolName.trim()) { setError("School name is required"); return; }
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

  return (
    <>
      <style>{`
        @keyframes loginSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes loginPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes loginFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes loginGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .login-split { display: flex; min-height: 100vh; }
        .login-hero {
          flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 1.4rem; padding: 2rem 1.5rem;
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
          flex: 0 0 420px; display: flex; flex-direction: column; justify-content: center; padding: 2.5rem;
          background: #fff; box-shadow: -8px 0 40px rgba(0,0,0,0.08);
        }
        .login-input {
          width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #e2e8f0; border-radius: 10px;
          font-size: 0.85rem; background: #f8fafc; transition: all 0.2s ease; outline: none; font-family: inherit;
          box-sizing: border-box;
        }
        .login-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); background: #fff; }
        .login-btn {
          width: 100%; padding: 0.7rem; border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 700;
          background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; cursor: pointer;
          transition: all 0.2s ease; font-family: inherit; letter-spacing: 0.02em;
        }
        .login-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59,130,246,0.35); }
        .login-btn:disabled { opacity: 0.6; transform: none; box-shadow: none; }
        .login-toggle { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 0.82rem; font-weight: 600; padding: 0; font-family: inherit; }
        .login-toggle:hover { text-decoration: underline; }
        @media (max-width: 860px) {
          .login-split { flex-direction: column; }
          .login-hero { flex: none; min-height: 35vh; padding: 1.5rem 1rem; }
          .login-form-side { flex: 1; padding: 1.5rem; }
        }
      `}</style>

      <div className="login-split">
        {/* ─── Left Hero ─── */}
        <div className="login-hero">
          <div style={{ position: "relative", zIndex: 1, maxWidth: 380, width: "100%" }}>
            {/* Logo */}
            <div style={{ animation: "loginSlideUp 0.6s ease both", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem", boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
                }}>📅</div>
                <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                  SchoolScheduler
                </span>
              </div>
              <p style={{ color: "#94a3b8", fontSize: "0.75rem", lineHeight: 1.5, margin: 0 }}>
                Generate clash-free timetables in minutes.<br />
                Trusted by schools for professional scheduling.
              </p>
            </div>

            {/* Stats + Pies */}
            <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", marginBottom: "1rem" }}>
              <StatCounter value="100%" label="Clash-free" delay={400} />
              <StatCounter value="5 min" label="Setup" delay={600} />
              <StatCounter value="∞" label="Projects" delay={800} />
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "1.2rem", animation: "loginFloat 4s ease-in-out infinite" }}>
              <AnimatedPie size={70} label="Subjects" segments={[
                { pct: 25, color: "#3b82f6" }, { pct: 20, color: "#8b5cf6" },
                { pct: 18, color: "#06b6d4" }, { pct: 15, color: "#f59e0b" },
                { pct: 12, color: "#10b981" }, { pct: 10, color: "#ef4444" },
              ]} />
              <AnimatedPie size={70} label="Teachers" segments={[
                { pct: 30, color: "#ec4899" }, { pct: 25, color: "#6366f1" },
                { pct: 22, color: "#14b8a6" }, { pct: 23, color: "#f97316" },
              ]} />
              <AnimatedPie size={70} label="Rooms" segments={[
                { pct: 40, color: "#22c55e" }, { pct: 35, color: "#0ea5e9" },
                { pct: 25, color: "#a855f7" },
              ]} />
            </div>

            {/* ★ Animated Tab Slides */}
            <TabSlider />
          </div>
        </div>

        {/* ─── Right Form ─── */}
        <div className="login-form-side">
          <div style={{ maxWidth: 340, margin: "0 auto", width: "100%" }}>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>
              {isSignUp ? "Create account" : "Welcome back"}
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0 0 1.3rem 0" }}>
              {isSignUp ? "Start building your timetable today." : "Sign in to continue managing your timetable."}
            </p>

            {success && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#166534", marginBottom: "0.8rem" }}>
                ✅ {success}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {isSignUp && (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 }}>School name</label>
                  <input className="login-input" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. City Public School" required />
                </div>
              )}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 }}>Email address</label>
                <input className="login-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.com" required autoComplete="email" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 }}>Password</label>
                <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={isSignUp ? "new-password" : "current-password"} />
              </div>
              {isSignUp && (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 }}>Confirm password</label>
                  <input className="login-input" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="••••••••" required autoComplete="new-password"
                    style={{ borderColor: confirmPwd && confirmPwd !== password ? "#ef4444" : undefined }}
                  />
                  {confirmPwd && confirmPwd !== password && (
                    <div style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: 3 }}>Passwords do not match</div>
                  )}
                </div>
              )}
              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#dc2626" }}>
                  {error}
                </div>
              )}
              <button type="submit" className="login-btn" disabled={loading || (isSignUp && !!confirmPwd && confirmPwd !== password)}>
                {loading ? "⏳ Please wait…" : isSignUp ? "Create account" : "Sign in"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
              </span>
              <button type="button" className="login-toggle" onClick={() => { setIsSignUp(!isSignUp); setError(""); setSuccess(""); }}>
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "1.2rem", paddingTop: "0.8rem", textAlign: "center" }}>
              <p style={{ color: "#cbd5e1", fontSize: "0.65rem", margin: 0 }}>
                Demo: <strong>admin@school.demo</strong> / <strong>admin123</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
