import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ZyncaWelcome.css";

// ── Animated ring chart data ───────────────────────────────────
const METRICS = [
  { label: "Teachers Assigned", pct: 87, color: "#2563EB", track: "rgba(37,99,235,0.10)" },
  { label: "Rooms Utilized",    pct: 72, color: "#0891B2", track: "rgba(8,145,178,0.10)" },
  { label: "Clashes Resolved",  pct: 100, color: "#16A34A", track: "rgba(22,163,74,0.10)" },
  { label: "Periods Covered",   pct: 94, color: "#D97706", track: "rgba(217,119,6,0.10)" },
];

function AnimatedRing({ pct, color, trackColor, delay }: { pct: number; color: string; trackColor: string; delay: number }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      let cur = 0;
      const iv = setInterval(() => {
        cur += 2;
        if (cur >= pct) { cur = pct; clearInterval(iv); }
        setAnimPct(cur);
      }, 16);
    }, delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  const r = 42, c = 2 * Math.PI * r;
  const offset = c - (animPct / 100) * c;

  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="mz-ring-svg">
      <circle cx="55" cy="55" r={r} fill="none" stroke={trackColor} strokeWidth="7" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 55 55)"
        style={{ transition: "stroke-dashoffset 0.3s ease" }} />
      <text x="55" y="60" textAnchor="middle" fontSize="20" fontWeight="800"
        fill={color} fontFamily="'Sora', sans-serif">{animPct}%</text>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────
export default function ZyncaWelcome() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [visible, setVisible] = useState(false);

  useEffect(() => { setVisible(true); }, []);

  function handleCTA() {
    if (projectId) {
      navigate(`/project/${projectId}/settings`);
    } else {
      navigate("/");
    }
  }

  return (
    <div className={`mz-welcome ${visible ? "visible" : ""}`}>

      {/* ── Ambient background shapes ── */}
      <div className="mz-ambient" aria-hidden="true">
        <div className="mz-orb mz-orb-1" />
        <div className="mz-orb mz-orb-2" />
        <div className="mz-orb mz-orb-3" />
      </div>

      {/* ── Hero section ── */}
      <div className="mz-hero">
        <div className="mz-shield-container">
          <div className="mz-shield-glow" />
          <svg className="mz-shield-icon" viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="shieldGrad" x1="0" y1="0" x2="60" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
              <linearGradient id="shieldFill" x1="0" y1="0" x2="60" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(37,99,235,0.12)" />
                <stop offset="100%" stopColor="rgba(6,182,212,0.08)" />
              </linearGradient>
            </defs>
            <path d="M30 2L4 16v20c0 18 12 28 26 32 14-4 26-14 26-32V16L30 2z"
              stroke="url(#shieldGrad)" strokeWidth="2.5" fill="url(#shieldFill)" />
            <text x="30" y="46" textAnchor="middle" fontSize="24" fontWeight="800"
              fill="url(#shieldGrad)" fontFamily="'Sora', sans-serif">Z</text>
          </svg>
        </div>

        <h1 className="mz-title">
          Welcome to <span className="mz-brand-gradient">Myzynca</span>
        </h1>
        <p className="mz-subtitle">
          Smart scheduling intelligence for modern schools.
          <br />
          Conflict-free timetables, duty management, and real-time insights — all in one place.
        </p>
      </div>

      {/* ── Metrics ring cards ── */}
      <div className="mz-metrics">
        {METRICS.map((d, i) => (
          <div key={d.label} className="mz-metric-card">
            <AnimatedRing pct={d.pct} color={d.color} trackColor={d.track} delay={i * 250} />
            <span className="mz-metric-label">{d.label}</span>
          </div>
        ))}
      </div>

      {/* ── Features grid ── */}
      <div className="mz-features">
        <div className="mz-feat-card">
          <div className="mz-feat-icon" style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB" }}>📋</div>
          <h3>Complete Timetable Generation</h3>
          <p>Zero clashes. Constraint-based solver handles rooms, teachers, and class conflicts automatically.</p>
        </div>
        <div className="mz-feat-card">
          <div className="mz-feat-icon" style={{ background: "rgba(8,145,178,0.08)", color: "#0891B2" }}>👥</div>
          <h3>Staff & Duty Management</h3>
          <p>Assign substitutes, manage exam duties, and run committees — all from one dashboard.</p>
        </div>
        <div className="mz-feat-card">
          <div className="mz-feat-icon" style={{ background: "rgba(22,163,74,0.08)", color: "#16A34A" }}>📊</div>
          <h3>Real-time Workload Analytics</h3>
          <p>Track every teacher's load across 40 weeks. Spot burnout early and balance schedules fairly.</p>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="mz-cta">
        <p className="mz-cta-heading">
          Ready to transform your school scheduling?
        </p>
        <button className="mz-cta-btn" onClick={handleCTA}>
          <span className="mz-cta-btn-icon">→</span>
          Make your first lesson plan
        </button>
        <p className="mz-cta-footnote">
          Designed for principals, coordinators, and school administration teams worldwide.
        </p>
      </div>

      {/* ── Footer branding ── */}
      <div className="mz-footer">
        <span className="mz-footer-logo">Z</span>
        <span className="mz-footer-brand">Myzynca</span>
        <span className="mz-footer-dot">·</span>
        <a href="https://myzynca.com" className="mz-footer-url" target="_blank" rel="noreferrer">myzynca.com</a>
      </div>
    </div>
  );
}
