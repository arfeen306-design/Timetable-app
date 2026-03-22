import { useState, useEffect, useRef } from "react";

interface Props {
  onDismiss: () => void;
  onStart: () => void;
}

/* ─── Animated SVG Icons ─────────────────────────────────────────── */

function SchoolIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Base building */}
      <rect x="8" y="20" width="32" height="22" rx="2" fill="#0a192f" stroke="#64ffda" strokeWidth="1.5"
        style={{ animation: "obDrawUp 0.6s ease both" }} />
      {/* Roof triangle */}
      <path d="M4 22L24 8L44 22" stroke="#64ffda" strokeWidth="1.8" strokeLinecap="round" fill="none"
        style={{ animation: "obDrawUp 0.5s ease 0.2s both" }} />
      {/* Door */}
      <rect x="19" y="30" width="10" height="12" rx="1" fill="#64ffda" opacity="0.2" stroke="#64ffda" strokeWidth="1"
        style={{ animation: "obDrawUp 0.4s ease 0.4s both" }} />
      {/* Windows */}
      <rect x="12" y="24" width="6" height="5" rx="1" fill="#64ffda" opacity="0.15" stroke="#64ffda" strokeWidth="0.8"
        style={{ animation: "obCheckScale 0.3s ease 0.5s both" }} />
      <rect x="30" y="24" width="6" height="5" rx="1" fill="#64ffda" opacity="0.15" stroke="#64ffda" strokeWidth="0.8"
        style={{ animation: "obCheckScale 0.3s ease 0.6s both" }} />
      {/* Flag */}
      <line x1="24" y1="4" x2="24" y2="10" stroke="#64ffda" strokeWidth="1.2"
        style={{ animation: "obDrawUp 0.3s ease 0.3s both" }} />
      <rect x="24" y="4" width="7" height="4" rx="1" fill="#64ffda" opacity="0.3"
        style={{ animation: "obStepIn 0.3s ease 0.5s both" }} />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Calendar body */}
      <rect x="6" y="12" width="36" height="30" rx="3" fill="#0a192f" stroke="#64ffda" strokeWidth="1.5"
        style={{ animation: "obDrawUp 0.5s ease both" }} />
      {/* Header bar */}
      <rect x="6" y="12" width="36" height="10" rx="3" fill="#64ffda" opacity="0.15"
        style={{ animation: "obDrawUp 0.4s ease 0.1s both" }} />
      {/* Hooks */}
      <line x1="16" y1="8" x2="16" y2="16" stroke="#64ffda" strokeWidth="2" strokeLinecap="round"
        style={{ animation: "obDrawUp 0.3s ease 0.2s both" }} />
      <line x1="32" y1="8" x2="32" y2="16" stroke="#64ffda" strokeWidth="2" strokeLinecap="round"
        style={{ animation: "obDrawUp 0.3s ease 0.3s both" }} />
      {/* Day cells - some highlighted as "off" */}
      {[0,1,2,3,4].map(col => (
        [0,1,2].map(row => {
          const isOff = col >= 4;
          return (
            <rect key={`${col}-${row}`}
              x={10 + col * 7} y={25 + row * 6} width={5} height={4} rx={1}
              fill={isOff ? "#64ffda" : "#64ffda"} opacity={isOff ? 0.4 : 0.08}
              stroke={isOff ? "#64ffda" : "none"} strokeWidth={isOff ? 0.6 : 0}
              style={{ animation: `obCheckScale 0.2s ease ${0.3 + (col * 3 + row) * 0.04}s both` }}
            />
          );
        })
      ))}
    </svg>
  );
}

function FacultyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Teacher avatar 1 */}
      <circle cx="16" cy="16" r="6" fill="#0a192f" stroke="#64ffda" strokeWidth="1.5"
        style={{ animation: "obCheckScale 0.4s ease both" }} />
      <path d="M16 14v0" stroke="#64ffda" strokeWidth="1" />
      <circle cx="14" cy="14" r="1" fill="#64ffda" opacity="0.5" />
      <circle cx="18" cy="14" r="1" fill="#64ffda" opacity="0.5" />
      <path d="M13 17c0 0 1.5 2 3 2s3-2 3-2" stroke="#64ffda" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      {/* Teacher avatar 2 */}
      <circle cx="32" cy="16" r="6" fill="#0a192f" stroke="#64ffda" strokeWidth="1.5"
        style={{ animation: "obCheckScale 0.4s ease 0.15s both" }} />
      <circle cx="30" cy="14" r="1" fill="#64ffda" opacity="0.5" />
      <circle cx="34" cy="14" r="1" fill="#64ffda" opacity="0.5" />
      <path d="M29 17c0 0 1.5 2 3 2s3-2 3-2" stroke="#64ffda" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      {/* Subject tags */}
      <rect x="4" y="30" width="16" height="6" rx="3" fill="#64ffda" opacity="0.15" stroke="#64ffda" strokeWidth="0.8"
        style={{ animation: "obStepIn 0.4s ease 0.3s both" }} />
      <text x="12" y="35" textAnchor="middle" fontSize="4" fill="#64ffda" fontFamily="var(--font-sans)" fontWeight="600">Math</text>
      <rect x="28" y="30" width="16" height="6" rx="3" fill="#64ffda" opacity="0.15" stroke="#64ffda" strokeWidth="0.8"
        style={{ animation: "obStepIn 0.4s ease 0.4s both" }} />
      <text x="36" y="35" textAnchor="middle" fontSize="4" fill="#64ffda" fontFamily="var(--font-sans)" fontWeight="600">Eng</text>
      {/* Connecting lines */}
      <line x1="16" y1="22" x2="12" y2="30" stroke="#64ffda" strokeWidth="0.6" opacity="0.3" strokeDasharray="2 2"
        style={{ animation: "obFadeIn 0.3s ease 0.5s both" }} />
      <line x1="32" y1="22" x2="36" y2="30" stroke="#64ffda" strokeWidth="0.6" opacity="0.3" strokeDasharray="2 2"
        style={{ animation: "obFadeIn 0.3s ease 0.55s both" }} />
      {/* Third teacher (center, smaller) */}
      <circle cx="24" cy="40" r="4" fill="#0a192f" stroke="#64ffda" strokeWidth="1" opacity="0.5"
        style={{ animation: "obCheckScale 0.3s ease 0.5s both" }} />
    </svg>
  );
}


function SolverIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Grid */}
      {[0,1,2,3].map(row => (
        [0,1,2,3,4].map(col => (
          <rect key={`${row}-${col}`}
            x={4 + col * 8.5} y={8 + row * 9} width={7.5} height={8} rx={1.5}
            fill="#64ffda" opacity={0.06 + Math.random() * 0.15}
            stroke="#64ffda" strokeWidth="0.5" strokeOpacity="0.3"
            style={{ animation: `obCheckScale 0.2s ease ${0.1 + (row * 5 + col) * 0.03}s both` }}
          />
        ))
      ))}
      {/* Sparkle effects */}
      <circle cx="10" cy="6" r="1.5" fill="#64ffda" opacity="0.6"
        style={{ animation: "obSparkle 1.5s ease-in-out infinite" }} />
      <circle cx="38" cy="4" r="1" fill="#64ffda" opacity="0.4"
        style={{ animation: "obSparkle 1.5s ease-in-out 0.5s infinite" }} />
      <circle cx="44" cy="20" r="1.2" fill="#64ffda" opacity="0.5"
        style={{ animation: "obSparkle 1.5s ease-in-out 1s infinite" }} />
      {/* Check overlay */}
      <path d="M18 25L22 29L32 19" stroke="#64ffda" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        style={{ animation: "obDrawCheck 0.6s ease 0.8s both" }} />
    </svg>
  );
}

/* ─── Extra SVG Icons for new steps ──────────────────────────────── */

function ClassroomIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Door frame */}
      <rect x="12" y="8" width="24" height="34" rx="2" fill="#0a192f" stroke="#64ffda" strokeWidth="1.5"
        style={{ animation: "obDrawUp 0.5s ease both" }} />
      {/* Door panels */}
      <rect x="15" y="12" width="8" height="14" rx="1" fill="#64ffda" opacity="0.1" stroke="#64ffda" strokeWidth="0.6"
        style={{ animation: "obCheckScale 0.3s ease 0.2s both" }} />
      <rect x="25" y="12" width="8" height="14" rx="1" fill="#64ffda" opacity="0.1" stroke="#64ffda" strokeWidth="0.6"
        style={{ animation: "obCheckScale 0.3s ease 0.3s both" }} />
      {/* Handle */}
      <circle cx="32" cy="28" r="1.5" fill="#64ffda" opacity="0.5"
        style={{ animation: "obCheckScale 0.2s ease 0.4s both" }} />
      {/* Room label */}
      <text x="24" y="38" textAnchor="middle" fontSize="5" fill="#64ffda" opacity="0.4" fontFamily="var(--font-mono)" fontWeight="600">Room A</text>
    </svg>
  );
}

function SubjectIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Book stack */}
      <rect x="10" y="28" width="28" height="6" rx="1" fill="#64ffda" opacity="0.1" stroke="#64ffda" strokeWidth="1"
        style={{ animation: "obDrawUp 0.4s ease both" }} />
      <rect x="12" y="21" width="24" height="6" rx="1" fill="#64ffda" opacity="0.15" stroke="#64ffda" strokeWidth="1"
        style={{ animation: "obDrawUp 0.4s ease 0.1s both" }} />
      <rect x="14" y="14" width="20" height="6" rx="1" fill="#64ffda" opacity="0.2" stroke="#64ffda" strokeWidth="1"
        style={{ animation: "obDrawUp 0.4s ease 0.2s both" }} />
      {/* Subject labels */}
      <text x="24" y="18" textAnchor="middle" fontSize="3.5" fill="#64ffda" fontFamily="var(--font-sans)" fontWeight="600"
        style={{ animation: "obFadeIn 0.3s ease 0.4s both" }}>Mathematics</text>
      <text x="24" y="25" textAnchor="middle" fontSize="3.5" fill="#64ffda" fontFamily="var(--font-sans)" fontWeight="600"
        style={{ animation: "obFadeIn 0.3s ease 0.5s both" }}>English</text>
      <text x="24" y="32" textAnchor="middle" fontSize="3.5" fill="#64ffda" fontFamily="var(--font-sans)" fontWeight="600"
        style={{ animation: "obFadeIn 0.3s ease 0.6s both" }}>Science</text>
    </svg>
  );
}

function ClassIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Graduation cap */}
      <path d="M24 10L4 22L24 34L44 22L24 10Z" fill="#64ffda" opacity="0.1" stroke="#64ffda" strokeWidth="1.2"
        style={{ animation: "obDrawUp 0.5s ease both" }} />
      <line x1="24" y1="22" x2="24" y2="40" stroke="#64ffda" strokeWidth="1" opacity="0.4"
        style={{ animation: "obDrawUp 0.3s ease 0.3s both" }} />
      {/* Tassel */}
      <path d="M24 34L20 38" stroke="#64ffda" strokeWidth="1.2" strokeLinecap="round"
        style={{ animation: "obDrawUp 0.3s ease 0.4s both" }} />
      {/* Class labels */}
      <rect x="8" y="38" width="14" height="5" rx="2.5" fill="#64ffda" opacity="0.12" stroke="#64ffda" strokeWidth="0.6"
        style={{ animation: "obStepIn 0.3s ease 0.5s both" }} />
      <text x="15" y="42" textAnchor="middle" fontSize="3.5" fill="#64ffda" fontWeight="600">10-A</text>
      <rect x="26" y="38" width="14" height="5" rx="2.5" fill="#64ffda" opacity="0.12" stroke="#64ffda" strokeWidth="0.6"
        style={{ animation: "obStepIn 0.3s ease 0.6s both" }} />
      <text x="33" y="42" textAnchor="middle" fontSize="3.5" fill="#64ffda" fontWeight="600">10-B</text>
    </svg>
  );
}

function ConstraintIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
      {/* Gear outer */}
      <circle cx="24" cy="24" r="14" fill="#0a192f" stroke="#64ffda" strokeWidth="1.5"
        style={{ animation: "obCheckScale 0.5s ease both" }} />
      {/* Gear teeth */}
      {[0,45,90,135,180,225,270,315].map(deg => {
        const rad = deg * Math.PI / 180;
        const x = 24 + 16 * Math.cos(rad);
        const y = 24 + 16 * Math.sin(rad);
        return <circle key={deg} cx={x} cy={y} r="2.5" fill="#0a192f" stroke="#64ffda" strokeWidth="1" opacity="0.6"
          style={{ animation: `obCheckScale 0.2s ease ${0.3 + deg * 0.001}s both` }} />;
      })}
      {/* Inner circle */}
      <circle cx="24" cy="24" r="6" fill="#64ffda" opacity="0.1" stroke="#64ffda" strokeWidth="1"
        style={{ animation: "obCheckScale 0.3s ease 0.4s both" }} />
      {/* Check mark inside */}
      <path d="M20 24L23 27L28 21" stroke="#64ffda" strokeWidth="1.5" strokeLinecap="round" fill="none"
        style={{ animation: "obDrawCheck 0.4s ease 0.6s both" }} />
    </svg>
  );
}

/* ─── Steps Data — matches sidebar menu exactly ──────────────────── */

const STEPS = [
  {
    icon: SchoolIcon,
    emoji: "🏫",
    title: "School",
    desc: "Set your school name, academic year, and off-day structure. This is the foundation of your timetable.",
    color: "#6366F1",
    highlight: false,
  },
  {
    icon: ClassroomIcon,
    emoji: "🚪",
    title: "Classrooms",
    desc: "Add your rooms and labs. The solver uses these to prevent room conflicts — two classes can't be in the same room at once.",
    color: "#0891B2",
    highlight: false,
  },
  {
    icon: FacultyIcon,
    emoji: "👩‍🏫",
    title: "Teachers",
    desc: "Add your faculty — import from Excel or one by one. Assign subjects and set max periods per day.",
    color: "#E8A020",
    highlight: false,
  },
  {
    icon: SubjectIcon,
    emoji: "📚",
    title: "Subjects",
    desc: "Create your subject list — Mathematics, English, Science, etc. These link teachers to class lessons.",
    color: "#7C3AED",
    highlight: false,
  },
  {
    icon: ClassIcon,
    emoji: "🎓",
    title: "Classes",
    desc: "Define your class sections — 10-A, 10-B, etc. Each class gets its own column in the final timetable.",
    color: "#0EA875",
    highlight: false,
  },
  {
    icon: CalendarIcon,
    emoji: "📋",
    title: "Lessons",
    desc: "Map which teacher teaches which subject to which class, and how many periods per week. This is the core scheduling data.",
    color: "#64ffda",
    highlight: true,
  },
  {
    icon: ConstraintIcon,
    emoji: "⚙️",
    title: "Constraints",
    desc: "Set rules — max consecutive periods, preferred time slots, room restrictions. The solver respects all of these.",
    color: "#EC4899",
    highlight: false,
  },
  {
    icon: SolverIcon,
    emoji: "⚡",
    title: "Generate",
    desc: "One click — the AI solver processes all your data and rules, then builds a clash-free timetable in under 10 seconds.",
    color: "#64ffda",
    highlight: false,
  },
];

/* ─── Main Component ─────────────────────────────────────────────── */

export default function OnboardingOverlay({ onDismiss, onStart }: Props) {
  const [screen, setScreen] = useState<"welcome" | "steps">("welcome");
  const [activeStep, setActiveStep] = useState(0);
  const autoTimer = useRef<ReturnType<typeof setInterval>>();

  // Auto-advance steps in screen 2
  useEffect(() => {
    if (screen !== "steps") return;
    autoTimer.current = setInterval(() => {
      setActiveStep(s => (s + 1) % STEPS.length);
    }, 3500);
    return () => clearInterval(autoTimer.current);
  }, [screen]);

  const goStep = (i: number) => {
    setActiveStep(i);
    clearInterval(autoTimer.current);
    autoTimer.current = setInterval(() => {
      setActiveStep(s => (s + 1) % STEPS.length);
    }, 3500);
  };

  return (
    <>
      <style>{`
        @keyframes obFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes obSlideUp { from { opacity: 0; transform: translateY(40px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes obStepIn { from { opacity: 0; transform: translateX(-20px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes obPulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(100,255,218,0.4) } 50% { box-shadow: 0 0 0 14px rgba(100,255,218,0) } }
        @keyframes obLineDraw { from { height: 0 } to { height: 100% } }
        @keyframes obFloat1 { 0%,100% { transform: translate(0,0) rotate(0deg) } 50% { transform: translate(15px,-20px) rotate(10deg) } }
        @keyframes obFloat2 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-12px,15px) rotate(-8deg) } }
        @keyframes obCheckScale { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes obDrawUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes obClockHour { from { transform: rotate(-90deg) } to { transform: rotate(30deg) } }
        @keyframes obClockMinute { from { transform: rotate(-90deg) } to { transform: rotate(120deg) } }
        @keyframes obSparkle { 0%,100% { opacity: 0.2; transform: scale(0.6) } 50% { opacity: 0.8; transform: scale(1.2) } }
        @keyframes obDrawCheck { from { stroke-dashoffset: 30; opacity: 0 } to { stroke-dashoffset: 0; opacity: 1 } }
        @keyframes obSlideIn { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes obProgressBar { from { width: 0% } to { width: 100% } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onDismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: "rgba(8,15,28,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          animation: "obFadeIn 0.4s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: screen === "welcome" ? 520 : 700,
            borderRadius: 24, position: "relative", overflow: "hidden",
            background: "linear-gradient(155deg, #0a192f 0%, #112240 50%, #0d1f3c 100%)",
            border: "1px solid rgba(100,255,218,0.12)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 60px rgba(100,255,218,0.05)",
            animation: "obSlideUp 0.5s ease",
            transition: "max-width 0.4s ease",
          }}
        >
          {/* ═══ SCREEN 1: WELCOME ═══ */}
          {screen === "welcome" && (
            <div style={{ padding: "3rem 2.5rem 2.5rem", textAlign: "center" }}>
              {/* Floating shapes */}
              <div style={{ position: "absolute", top: -30, right: -20, width: 120, height: 120, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(100,255,218,0.08) 0%, transparent 70%)",
                animation: "obFloat1 7s ease-in-out infinite" }} />
              <div style={{ position: "absolute", bottom: -40, left: -30, width: 160, height: 160, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
                animation: "obFloat2 9s ease-in-out infinite" }} />

              {/* Logo */}
              <div style={{
                width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "obPulseGlow 2.5s ease-in-out infinite",
              }}>
                <svg width="72" height="72" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="46" stroke="#64ffda" strokeWidth="3" fill="rgba(100,255,218,0.06)" />
                  <path d="M50 22L30 33v13c0 11.5 7.5 18 16.5 21 1.2.4 2.3.5 3.5.7 1.2-.2 2.3-.3 3.5-.7C63.5 64 70 57.5 70 46V33L50 22z"
                    fill="rgba(100,255,218,0.1)" stroke="#64ffda" strokeWidth="1.5" />
                  <text x="50" y="52" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" fontFamily="Sora, sans-serif">Z</text>
                </svg>
              </div>

              {/* Title */}
              <h1 style={{
                margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "#CCD6F6",
                letterSpacing: "-0.03em", lineHeight: 1.2,
                animation: "obSlideUp 0.5s ease 0.15s both",
              }}>
                Welcome to <span style={{ color: "#64ffda" }}>Myzynca</span>
              </h1>
              <p style={{
                margin: "12px auto 0", fontSize: "0.92rem", color: "#8892B0",
                maxWidth: 400, lineHeight: 1.6,
                animation: "obSlideUp 0.5s ease 0.25s both",
              }}>
                Your First Timetable Setup — 5 steps to a mathematically perfect, clash-free schedule.
              </p>

              {/* CTA */}
              <div style={{ marginTop: 32, animation: "obSlideUp 0.5s ease 0.35s both" }}>
                <button
                  type="button"
                  onClick={() => setScreen("steps")}
                  style={{
                    fontSize: "1rem", padding: "0.85rem 2.2rem", fontWeight: 700,
                    borderRadius: 14, border: "2px solid #64ffda", cursor: "pointer",
                    background: "rgba(100,255,218,0.1)",
                    color: "#64ffda", fontFamily: "var(--font-sans)",
                    boxShadow: "0 8px 28px rgba(100,255,218,0.15)",
                    transition: "all 0.25s ease",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#64ffda"; e.currentTarget.style.color = "#0a192f"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(100,255,218,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(100,255,218,0.1)"; e.currentTarget.style.color = "#64ffda"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 28px rgba(100,255,218,0.15)"; }}
                >
                  Let&apos;s Build Your First Timetable →
                </button>
              </div>

              {/* Skip */}
              <button
                type="button"
                onClick={onDismiss}
                style={{
                  marginTop: 16, background: "none", border: "none", cursor: "pointer",
                  fontSize: "0.78rem", color: "#4A5568", fontFamily: "var(--font-sans)",
                  textDecoration: "underline", textUnderlineOffset: 3,
                  animation: "obSlideUp 0.5s ease 0.45s both",
                }}
              >
                Skip for now
              </button>
            </div>
          )}

          {/* ═══ SCREEN 2: 5-STEP INTERACTIVE GUIDE ═══ */}
          {screen === "steps" && (
            <div style={{ padding: "2rem 2.5rem 2rem" }}>
              {/* Floating shapes */}
              <div style={{ position: "absolute", top: -20, right: -15, width: 100, height: 100, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(100,255,218,0.06) 0%, transparent 70%)",
                animation: "obFloat1 8s ease-in-out infinite" }} />

              <h2 style={{
                margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#CCD6F6",
                textAlign: "center", letterSpacing: "-0.02em",
                animation: "obSlideUp 0.4s ease both",
              }}>
                Your First Timetable Setup
              </h2>
              <p style={{
                margin: "4px 0 20px", fontSize: "0.75rem", color: "#4A5568",
                textAlign: "center", animation: "obSlideUp 0.4s ease 0.1s both",
              }}>
                8 steps · Follow the sidebar · Zero clashes
              </p>

              {/* ── Two-column layout: steps list + animated preview ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, minHeight: 260 }}>
                {/* Left: Step list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {STEPS.map((step, i) => {
                    const isActive = i === activeStep;
                    const isHighlight = step.highlight;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => goStep(i)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 10px", borderRadius: 10, cursor: "pointer",
                          background: isActive
                            ? (isHighlight ? "rgba(100,255,218,0.14)" : "rgba(100,255,218,0.08)")
                            : "transparent",
                          border: isActive
                            ? `1px solid ${isHighlight ? "rgba(100,255,218,0.4)" : "rgba(100,255,218,0.2)"}`
                            : "1px solid transparent",
                          transition: "all 0.25s ease",
                          animation: `obStepIn 0.4s ease ${0.15 + i * 0.08}s both`,
                          textAlign: "left",
                          boxShadow: isActive && isHighlight ? "0 0 20px rgba(100,255,218,0.1)" : "none",
                        }}
                      >
                        {/* Step number */}
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          background: isActive ? "#64ffda" : "rgba(100,255,218,0.08)",
                          color: isActive ? "#0a192f" : "#64ffda",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.62rem", fontWeight: 800, fontFamily: "var(--font-mono)",
                          transition: "all 0.25s ease",
                        }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: "0.78rem", fontWeight: 700,
                            color: isActive ? "#CCD6F6" : "#8892B0",
                            transition: "color 0.2s",
                            display: "flex", alignItems: "center", gap: 6,
                          }}>
                            {step.emoji} {step.title}
                            {isHighlight && (
                              <span style={{
                                fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.06em",
                                padding: "1px 5px", borderRadius: 4,
                                background: "rgba(100,255,218,0.15)", color: "#64ffda",
                                fontFamily: "var(--font-mono)",
                              }}>★ KEY STEP</span>
                            )}
                          </div>
                          {isActive && (
                            <div style={{
                              fontSize: "0.66rem", color: "#4A5568", lineHeight: 1.4, marginTop: 2,
                              animation: "obFadeIn 0.3s ease",
                            }}>
                              {step.desc}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right: Animated SVG preview */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "rgba(100,255,218,0.03)", borderRadius: 16,
                  border: "1px solid rgba(100,255,218,0.06)",
                  padding: 20, position: "relative",
                }}>
                  <div key={activeStep} style={{ animation: "obSlideIn 0.4s ease both" }}>
                    {(() => {
                      const IconComponent = STEPS[activeStep].icon;
                      return <IconComponent />;
                    })()}
                  </div>
                  <div style={{
                    marginTop: 16, fontSize: "0.82rem", fontWeight: 700, color: "#CCD6F6",
                    animation: "obFadeIn 0.3s ease 0.2s both",
                  }}>
                    Step {activeStep + 1} of {STEPS.length}
                  </div>
                  {/* Progress dots */}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {STEPS.map((_, i) => (
                      <div
                        key={i}
                        onClick={() => goStep(i)}
                        style={{
                          width: i === activeStep ? 16 : 5, height: 5, borderRadius: 3,
                          background: i === activeStep ? "#64ffda" : "rgba(100,255,218,0.15)",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          position: "relative", overflow: "hidden",
                        }}
                      >
                        {i === activeStep && (
                          <div style={{
                            position: "absolute", inset: 0, borderRadius: 3,
                            background: "rgba(100,255,218,0.3)",
                            animation: "obProgressBar 3.5s linear",
                          }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div style={{ textAlign: "center", marginTop: 24, animation: "obSlideUp 0.4s ease 0.6s both" }}>
                <button
                  type="button"
                  onClick={onStart}
                  style={{
                    fontSize: "0.95rem", padding: "0.8rem 2rem", fontWeight: 700,
                    borderRadius: 14, border: "2px solid #64ffda", cursor: "pointer",
                    background: "rgba(100,255,218,0.1)",
                    color: "#64ffda", fontFamily: "var(--font-sans)",
                    boxShadow: "0 8px 28px rgba(100,255,218,0.12)",
                    transition: "all 0.25s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#64ffda"; e.currentTarget.style.color = "#0a192f"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(100,255,218,0.1)"; e.currentTarget.style.color = "#64ffda"; e.currentTarget.style.transform = ""; }}
                >
                  Get Started →
                </button>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={onDismiss}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.7rem", color: "#4A5568", fontFamily: "var(--font-sans)",
                      textDecoration: "underline", textUnderlineOffset: 3,
                    }}
                  >
                    Skip to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
