import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ZyncaWelcome.css";

// ── Animated pie chart data ───────────────────────────────────
const PIE_DATA = [
  { label: "Teachers Assigned", pct: 87, color: "#6366F1" },
  { label: "Rooms Utilized",    pct: 72, color: "#06B6D4" },
  { label: "Clashes Resolved",  pct: 100, color: "#10B981" },
  { label: "Periods Covered",   pct: 94, color: "#F59E0B" },
];

function AnimatedPie({ pct, color, delay }: { pct: number; color: string; delay: number }) {
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

  const r = 40, c = 2 * Math.PI * r;
  const offset = c - (animPct / 100) * c;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="zynca-pie">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--zynca-ring-bg, #1E293B)" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 0.3s ease" }} />
      <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="800"
        fill={color} fontFamily="'Sora', sans-serif">{animPct}%</text>
    </svg>
  );
}

// ── Floating shapes ───────────────────────────────────────────
function FloatingShapes() {
  return (
    <div className="zynca-shapes" aria-hidden="true">
      <div className="zynca-shape zynca-s1" />
      <div className="zynca-shape zynca-s2" />
      <div className="zynca-shape zynca-s3" />
      <div className="zynca-shape zynca-s4" />
      <div className="zynca-shape zynca-s5" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function ZyncaWelcome() {
  const navigate    = useNavigate();
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
    <div className={`zynca-welcome ${visible ? "visible" : ""}`}>
      <FloatingShapes />

      {/* Hero section */}
      <div className="zynca-hero">
        <div className="zynca-shield-wrap">
          <svg className="zynca-hero-shield" viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 2L4 16v20c0 18 12 28 26 32 14-4 26-14 26-32V16L30 2z"
              stroke="var(--zynca-shield-stroke, #6366F1)" strokeWidth="3" fill="var(--zynca-shield-fill, rgba(99,102,241,0.08))" />
            <text x="30" y="46" textAnchor="middle" fontSize="26" fontWeight="800"
              fill="var(--zynca-shield-stroke, #6366F1)" fontFamily="'Sora', sans-serif">Z</text>
          </svg>
        </div>

        <h1 className="zynca-title">
          Welcome to <span className="zynca-brand">Myzynca</span>
        </h1>
        <p className="zynca-subtitle">
          Smart scheduling intelligence for modern schools.
          <br />
          Empower your administration with conflict-free timetables, duty management, and real-time insights.
        </p>
      </div>

      {/* Stats pie charts */}
      <div className="zynca-metrics">
        {PIE_DATA.map((d, i) => (
          <div key={d.label} className="zynca-metric-card">
            <AnimatedPie pct={d.pct} color={d.color} delay={i * 300} />
            <span className="zynca-metric-label">{d.label}</span>
          </div>
        ))}
      </div>

      {/* Value props for principals */}
      <div className="zynca-features-grid">
        <div className="zynca-feat">
          <div className="zynca-feat-icon">📋</div>
          <h3>Complete Timetable Generation</h3>
          <p>Zero clashes. Constraint-based solver handles rooms, teachers, and class conflicts automatically.</p>
        </div>
        <div className="zynca-feat">
          <div className="zynca-feat-icon">👥</div>
          <h3>Staff & Duty Management</h3>
          <p>Assign substitutes, manage exam duties, and run committees — all from one dashboard.</p>
        </div>
        <div className="zynca-feat">
          <div className="zynca-feat-icon">📊</div>
          <h3>Real-time Workload Analytics</h3>
          <p>Track every teacher's load across 40 weeks. Spot burnout early and balance schedules fairly.</p>
        </div>
      </div>

      {/* CTA */}
      <div className="zynca-cta-section">
        <p className="zynca-cta-text">
          Ready to transform your school scheduling?
        </p>
        <button className="zynca-cta-btn" onClick={handleCTA}>
          <span className="zynca-cta-icon">🚀</span>
          Make your first lesson plan with us
        </button>
        <p className="zynca-cta-sub">
          Designed for principals, coordinators, and school administration teams worldwide.
        </p>
      </div>
    </div>
  );
}
