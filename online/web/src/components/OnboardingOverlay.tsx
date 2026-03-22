import { useState } from "react";

interface Props {
  onDismiss: () => void;
  onStart: () => void;
}

const STEPS = [
  {
    icon: "🏫",
    title: "School Identity",
    desc: "Name your school and set the academic year — this becomes your project workspace.",
    color: "#6366F1",
  },
  {
    icon: "📅",
    title: "Define Off Days",
    desc: "Mark weekends & holidays. Set Friday or Saturday as different-schedule days.",
    color: "#0EA875",
  },
  {
    icon: "👩‍🏫",
    title: "Add Faculty",
    desc: "Import your teachers from Excel or add one-by-one. Assign subjects to each.",
    color: "#E8A020",
  },
  {
    icon: "🔔",
    title: "Bell Schedule",
    desc: "Define lessons per day, break positions, and period timings for the timetable grid.",
    color: "#EC4899",
  },
  {
    icon: "⚡",
    title: "Generate & Review",
    desc: "Click Generate — the solver builds a clash-free timetable in under 10 seconds.",
    color: "#00CEC8",
  },
];

export default function OnboardingOverlay({ onDismiss, onStart }: Props) {
  const [screen, setScreen] = useState<"welcome" | "steps">("welcome");

  return (
    <>
      <style>{`
        @keyframes obFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes obSlideUp { from { opacity: 0; transform: translateY(40px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes obStepIn { from { opacity: 0; transform: translateX(-20px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes obPulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,206,200,0.4) } 50% { box-shadow: 0 0 0 14px rgba(0,206,200,0) } }
        @keyframes obLineDraw { from { height: 0 } to { height: 100% } }
        @keyframes obShimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes obFloat1 { 0%,100% { transform: translate(0,0) rotate(0deg) } 50% { transform: translate(15px,-20px) rotate(10deg) } }
        @keyframes obFloat2 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-12px,15px) rotate(-8deg) } }
        @keyframes obBounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes obCheckScale { from { transform: scale(0) } to { transform: scale(1) } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onDismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: "rgba(8,15,28,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation: "obFadeIn 0.4s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: screen === "welcome" ? 520 : 600,
            borderRadius: 24, position: "relative", overflow: "hidden",
            background: "linear-gradient(155deg, #0F1A2B 0%, #1C2E4A 50%, #1A3040 100%)",
            border: "1px solid rgba(0,206,200,0.15)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
            animation: "obSlideUp 0.5s ease",
            transition: "max-width 0.4s ease",
          }}
        >
          {/* ═══ SCREEN 1: WELCOME ═══ */}
          {screen === "welcome" && (
            <div style={{ padding: "3rem 2.5rem 2.5rem", textAlign: "center" }}>
              {/* Floating shapes */}
              <div style={{ position: "absolute", top: -30, right: -20, width: 120, height: 120, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(0,206,200,0.12) 0%, transparent 70%)",
                animation: "obFloat1 7s ease-in-out infinite" }} />
              <div style={{ position: "absolute", bottom: -40, left: -30, width: 160, height: 160, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
                animation: "obFloat2 9s ease-in-out infinite" }} />

              {/* Logo */}
              <div style={{
                width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "obPulseGlow 2.5s ease-in-out infinite",
              }}>
                <svg width="72" height="72" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="46" stroke="#00CEC8" strokeWidth="3" fill="rgba(0,206,200,0.08)" />
                  <path d="M50 22L30 33v13c0 11.5 7.5 18 16.5 21 1.2.4 2.3.5 3.5.7 1.2-.2 2.3-.3 3.5-.7C63.5 64 70 57.5 70 46V33L50 22z"
                    fill="rgba(0,206,200,0.15)" stroke="#00CEC8" strokeWidth="1.5" />
                  <text x="50" y="52" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" fontFamily="Sora, sans-serif">A</text>
                </svg>
              </div>

              {/* Title */}
              <h1 style={{
                margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "#fff",
                letterSpacing: "-0.03em", lineHeight: 1.2,
                animation: "obSlideUp 0.5s ease 0.15s both",
              }}>
                Welcome to <span style={{ color: "#00CEC8" }}>Agora</span>
              </h1>
              <p style={{
                margin: "12px auto 0", fontSize: "0.92rem", color: "rgba(255,255,255,0.5)",
                maxWidth: 380, lineHeight: 1.6,
                animation: "obSlideUp 0.5s ease 0.25s both",
              }}>
                Let&apos;s walk you through the 5 simple steps to generate your first clash-free timetable.
              </p>

              {/* CTA */}
              <div style={{ marginTop: 32, animation: "obSlideUp 0.5s ease 0.35s both" }}>
                <button
                  type="button"
                  onClick={() => setScreen("steps")}
                  style={{
                    fontSize: "1rem", padding: "0.85rem 2.2rem", fontWeight: 700,
                    borderRadius: 14, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #00CEC8 0%, #00B4AE 100%)",
                    color: "#0F1A2B", fontFamily: "var(--font-sans)",
                    boxShadow: "0 8px 28px rgba(0,206,200,0.3)",
                    transition: "all 0.2s ease",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,206,200,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,206,200,0.3)"; }}
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
                  fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)",
                  textDecoration: "underline", textUnderlineOffset: 3,
                  animation: "obSlideUp 0.5s ease 0.45s both",
                }}
              >
                Skip for now
              </button>
            </div>
          )}

          {/* ═══ SCREEN 2: 5-STEP GUIDE ═══ */}
          {screen === "steps" && (
            <div style={{ padding: "2.5rem 2.5rem 2rem" }}>
              {/* Floating shapes */}
              <div style={{ position: "absolute", top: -20, right: -15, width: 100, height: 100, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(0,206,200,0.1) 0%, transparent 70%)",
                animation: "obFloat1 8s ease-in-out infinite" }} />

              <h2 style={{
                margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#fff",
                textAlign: "center", letterSpacing: "-0.02em",
                animation: "obSlideUp 0.4s ease both",
              }}>
                Your path to a perfect timetable
              </h2>
              <p style={{
                margin: "6px 0 28px", fontSize: "0.78rem", color: "rgba(255,255,255,0.35)",
                textAlign: "center", animation: "obSlideUp 0.4s ease 0.1s both",
              }}>
                5 steps · Under 15 minutes · Zero clashes
              </p>

              {/* Steps */}
              <div style={{ position: "relative", paddingLeft: 44 }}>
                {/* Vertical line */}
                <div style={{
                  position: "absolute", left: 17, top: 6, bottom: 6, width: 2,
                  background: "rgba(255,255,255,0.06)", borderRadius: 1,
                }}>
                  <div style={{
                    width: "100%", background: "linear-gradient(180deg, #00CEC8, #6366F1)",
                    borderRadius: 1, animation: "obLineDraw 1.5s ease 0.3s both",
                  }} />
                </div>

                {STEPS.map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 14,
                      padding: "12px 16px", marginBottom: i < 4 ? 8 : 0,
                      borderRadius: 14, position: "relative",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      animation: `obStepIn 0.4s ease ${0.2 + i * 0.12}s both`,
                      transition: "all 0.2s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${step.color}40`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
                  >
                    {/* Step number dot on the line */}
                    <div style={{
                      position: "absolute", left: -33, top: 16,
                      width: 14, height: 14, borderRadius: "50%",
                      background: step.color, border: "2px solid #0F1A2B",
                      animation: `obCheckScale 0.3s ease ${0.4 + i * 0.12}s both`,
                    }} />

                    {/* Icon */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: `${step.color}15`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.1rem",
                    }}>
                      {step.icon}
                    </div>

                    {/* Text */}
                    <div>
                      <div style={{
                        fontSize: "0.82rem", fontWeight: 700, color: "#fff",
                        marginBottom: 2, display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span style={{
                          fontSize: "0.58rem", fontWeight: 700, color: step.color,
                          background: `${step.color}18`, padding: "1px 6px", borderRadius: 4,
                          fontFamily: "var(--font-mono)",
                        }}>
                          {i + 1}
                        </span>
                        {step.title}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                        {step.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{ textAlign: "center", marginTop: 28, animation: "obSlideUp 0.4s ease 0.9s both" }}>
                <button
                  type="button"
                  onClick={onStart}
                  style={{
                    fontSize: "0.95rem", padding: "0.8rem 2rem", fontWeight: 700,
                    borderRadius: 14, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #00CEC8 0%, #00B4AE 100%)",
                    color: "#0F1A2B", fontFamily: "var(--font-sans)",
                    boxShadow: "0 8px 28px rgba(0,206,200,0.3)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,206,200,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,206,200,0.3)"; }}
                >
                  Start Building →
                </button>
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={onDismiss}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.72rem", color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-sans)",
                      textDecoration: "underline", textUnderlineOffset: 3,
                    }}
                  >
                    I&apos;ll explore on my own
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
