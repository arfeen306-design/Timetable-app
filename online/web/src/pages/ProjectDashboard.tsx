import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

/* ── Types ── */
interface DashboardData {
  school_name: string;
  academic_year: string;
  week_label: string;
  week_number: number;
  date: string;
  date_formatted: string;
  day_name: string;
  time: string;
  is_off_day: boolean;
  current_period: number;
  current_lesson_start: string;
  current_lesson_end: string;
  num_periods: number;
  lesson_slots: {
    type: "lesson" | "break";
    lesson_number?: number;
    period_index?: number;
    label: string;
    start_time: string;
    end_time: string;
    is_current: boolean;
    is_past: boolean;
  }[];
  stats: {
    total_teachers: number;
    present_today: number;
    absent_today: number;
    busy_now: number;
    on_sub_now: number;
    free_now: number;
    avg_workload: number;
    over_max: number;
    total_classes: number;
    total_grades: number;
    total_lessons: number;
    attendance_pct: number;
  };
  class_breakdown: { grade: string; sections: number }[];
  unassigned: { teacher_name: string; period_index: number }[];
  substitutions_today: {
    id: number;
    period_index: number;
    sub_teacher_name: string;
    sub_teacher_initials: string;
    absent_teacher_name: string;
    subject_name: string;
    class_name: string;
    is_override: boolean;
  }[];
  workload_chart: {
    teacher_name: string;
    teacher_code: string;
    initials: string;
    scheduled: number;
    substitutions: number;
    total: number;
    max: number;
    utilization_pct: number;
  }[];
  substitution_history: { date: string; subs: number; absences: number }[];
  absent_teachers: {
    id: number;
    teacher_id: number;
    teacher_name: string;
    reason: string;
  }[];
}

const AVATAR_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#22c55e"];
function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }

/** Convert "HH:MM" → "h:mm AM/PM" */
function formatTime12(t: string): string {
  if (!t) return "";
  const [hh, mm] = t.split(":").map(Number);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h = hh % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function fmtHistDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" });
}

// Country flag emoji from ISO 3166-1 alpha-2
function countryFlag(cc: string): string {
  if (!cc || cc.length !== 2) return "🌐";
  const base = 0x1F1E6;
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65);
}

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Client-side live clock
  const [clientTime, setClientTime] = useState(() => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [countryCode, setCountryCode] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Live clock — update every second
    const timer = setInterval(() => {
      setClientTime(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Detect country from IP
    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(d => {
        if (d.country_code) setCountryCode(d.country_code);
        if (d.timezone) setTz(d.timezone);
      })
      .catch(() => { /* fallback to browser tz */ });
  }, []);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    api<DashboardData>(`/api/projects/${pid}/dashboard`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [pid]);

  if (loading) return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="skeleton skeleton-title" style={{ width: "30%" }} />
      <div className="stat-cards" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginTop: 16 }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 100 }} />)}
      </div>
      <div className="skeleton skeleton-card" style={{ height: 340, marginTop: 16 }} />
    </div>
  );

  if (!data) return <div className="empty-state"><div className="empty-state-title">No data</div></div>;

  const d = data;
  const s = d.stats;
  const uncoveredCount = d.unassigned.length;
  const chartMax = Math.max(...d.workload_chart.map(w => w.total), 1);
  const currentLessonLabel = d.lesson_slots.find(sl => sl.is_current && sl.type === "lesson")?.lesson_number;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ═══ Header ═══ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))" }}>Dashboard</h1>
          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted, var(--slate-400))", display: "flex", alignItems: "center", gap: 6 }}>
            {d.school_name} · {d.academic_year || ""} · <span className="live-indicator" /> {d.week_label} · {d.date_formatted}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Live clock with country flag */}
          <div style={{
            padding: "0.35rem 0.75rem", borderRadius: "var(--r-md, var(--radius-md))",
            background: "var(--surface-card, #fff)", border: "1px solid var(--border-default, var(--slate-200))",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: "1rem" }}>{countryCode ? countryFlag(countryCode) : "🌐"}</span>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1.2 }}>{clientTime}</div>
              <div style={{ fontSize: "0.5rem", color: "var(--text-muted, var(--slate-400))", fontFamily: "var(--font-mono)" }}>{tz}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Unassigned alert ═══ */}
      {uncoveredCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0.55rem 1rem", borderRadius: "var(--r-md, var(--radius-md))",
          background: "var(--color-warning-bg, var(--warning-50))", border: "1px solid var(--warning-200, #fde68a)",
          marginBottom: 16, fontSize: "0.78rem", color: "var(--warning-700, #b45309)",
        }}>
          <span style={{ fontSize: "1rem" }}>⚠</span>
          <span style={{ flex: 1 }}>
            <strong>{uncoveredCount} unassigned lesson{uncoveredCount !== 1 ? "s" : ""}</strong> — {
              d.unassigned.slice(0, 3).map(u => `${u.teacher_name} (L${u.period_index + 1})`).join(", ")
            }{d.unassigned.length > 3 ? ` + ${d.unassigned.length - 3} more` : ""} {uncoveredCount === 1 ? "has" : "have"} no substitute assigned yet
          </span>
          <Link to={`/project/${pid}/substitutions`} className="btn btn-danger" style={{ fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap", padding: "4px 10px" }}>
            Assign Now
          </Link>
        </div>
      )}

      {/* ═══ Stat Cards (5 across) ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        {/* Present Today */}
        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "0ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-success, var(--success-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>PRESENT TODAY</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>
            {d.is_off_day ? "—" : s.present_today}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>
            {d.is_off_day ? `${d.day_name} — Off day` : `of ${s.total_teachers} teachers`}
          </div>
          {!d.is_off_day && (
            <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-success-bg, var(--success-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-success, var(--success-600))" }}>{s.attendance_pct}% attendance</div>
          )}
          {d.is_off_day && (
            <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--warning-50)", fontSize: "0.6rem", fontWeight: 700, color: "var(--warning-600)" }}>🏖️ Holiday</div>
          )}
        </div>

        {/* Absent Today */}
        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "50ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-danger, var(--danger-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>ABSENT TODAY</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>
            {d.is_off_day ? "—" : s.absent_today}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>
            {d.is_off_day ? "No school today" : "marked absent"}
          </div>
          {!d.is_off_day && uncoveredCount > 0 && (
            <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-warning-bg, var(--warning-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-warning, var(--warning-600))" }}>{uncoveredCount} uncovered</div>
          )}
        </div>

        {/* Busy Right Now */}
        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "100ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(99,102,241,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-brand, var(--primary-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>BUSY RIGHT NOW</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>
            {d.is_off_day ? "—" : s.busy_now}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>
            {d.is_off_day ? "No lessons today" : currentLessonLabel ? `in Lesson ${currentLessonLabel}` : "between lessons"}
          </div>
          {!d.is_off_day && (
            <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-brand-light, var(--primary-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-brand, var(--primary-600))" }}>{s.free_now} free</div>
          )}
        </div>

        {/* Avg Workload */}
        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "150ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(245,158,11,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-warning, var(--warning-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>AVG. WORKLOAD</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>{s.avg_workload}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>lessons / week</div>
          {s.over_max > 0 && (
            <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-danger-bg, var(--danger-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-danger, var(--danger-600))" }}>{s.over_max} over max</div>
          )}
        </div>

        {/* Total Classes */}
        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "200ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(6,182,212,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#0891B2", textTransform: "uppercase", letterSpacing: "0.06em" }}>TOTAL CLASSES</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>{s.total_classes}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>Sections across {s.total_grades} grade{s.total_grades !== 1 ? "s" : ""}</div>
          {/* Grade breakdown tooltip */}
          {d.class_breakdown.length > 0 && (
            <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
              {d.class_breakdown.slice(0, 4).map(g => (
                <span key={g.grade} style={{ padding: "0px 6px", borderRadius: "var(--r-pill, 999px)", background: "#ecfeff", fontSize: "0.52rem", fontWeight: 700, color: "#0891B2" }}>
                  {g.grade}: {g.sections}
                </span>
              ))}
              {d.class_breakdown.length > 4 && (
                <span style={{ fontSize: "0.52rem", fontWeight: 600, color: "var(--slate-400)" }}>+{d.class_breakdown.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Live Lesson Bar ═══ */}
      {d.is_off_day ? (
        <div className="card anim-card" style={{
          padding: "0.8rem 1rem", marginBottom: 16, animationDelay: "250ms",
          background: "linear-gradient(135deg, var(--surface-card, #fff) 0%, #fefce8 100%)",
          border: "1px solid var(--warning-200, #fde68a)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.2rem" }}>🏖️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--warning-700, #92400e)" }}>
                {d.day_name} — No school today
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--warning-600, #d97706)" }}>
                Enjoy your day off! Dashboard stats will resume on the next working day.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card anim-card" style={{ padding: "0.7rem 1rem", marginBottom: 16, animationDelay: "250ms" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="live-indicator" />
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                Live right now {currentLessonLabel ? `— Lesson ${currentLessonLabel}` : ""}
              </span>
              {d.current_lesson_start && (
                <span style={{
                  padding: "2px 10px", borderRadius: "var(--r-pill, 999px)",
                  background: "var(--color-brand-light, var(--primary-50))", border: "1px solid var(--primary-200, #c7d2fe)",
                  fontSize: "0.62rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--color-brand)",
                }}>{formatTime12(d.current_lesson_start)} – {formatTime12(d.current_lesson_end)}</span>
              )}
            </div>
            <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {s.busy_now} busy · {s.free_now} free · {s.on_sub_now} on sub
            </div>
          </div>

          {/* Lesson bar */}
          <div style={{ display: "flex", gap: 2 }}>
            {d.lesson_slots.map((slot, i) => {
              const isBreak = slot.type === "break";
              const isCurrent = slot.is_current;
              const isPast = slot.is_past;
              return (
                <div key={i} style={{
                  flex: isBreak ? 0.3 : 1,
                  height: isBreak ? 28 : 36,
                  borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isBreak ? "0.52rem" : "0.68rem",
                  fontWeight: 700, position: "relative",
                  background: isCurrent ? "var(--color-brand, var(--primary-500))"
                    : isPast ? "var(--slate-200)" : "var(--slate-100)",
                  color: isCurrent ? "#fff" : isPast ? "var(--slate-400)" : "var(--slate-600)",
                  transition: "all 0.3s",
                }}>
                  {isBreak ? "☕" : `L${slot.lesson_number}`}
                  {isCurrent && !isBreak && (
                    <span style={{
                      position: "absolute", top: 2, right: 2,
                      width: 5, height: 5, borderRadius: "50%",
                      background: "#fff",
                      animation: "livePulse 1.5s infinite",
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Time labels */}
          <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
            {d.lesson_slots.filter(sl => sl.type === "lesson").map((slot) => (
              <div key={slot.lesson_number} style={{
                flex: 1, textAlign: "center",
                fontSize: "0.48rem", color: slot.is_current ? "var(--color-brand)" : "var(--text-muted)",
                fontFamily: "var(--font-mono)", fontWeight: slot.is_current ? 700 : 400,
              }}>
                {slot.start_time}–{slot.end_time}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Three-column grid ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {/* ── LEFT: Weekly Workload chart ── */}
        <div className="card anim-card" style={{ padding: "1rem", animationDelay: "300ms" }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)", marginBottom: 4 }}>
            Weekly workload — lessons per teacher
          </div>
          <div style={{ fontSize: "0.62rem", color: "var(--text-muted, var(--slate-400))", marginBottom: 16, display: "flex", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--color-brand, var(--primary-500))", display: "inline-block" }} /> Scheduled
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--color-sub, #F97316)", display: "inline-block" }} /> Sub
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--color-danger, var(--danger-500))", display: "inline-block" }} /> Over
            </span>
          </div>

          {d.workload_chart.length > 0 ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, marginBottom: 8 }}>
              {d.workload_chart.map((w, i) => {
                const schedH = (w.scheduled / chartMax) * 130;
                const subH = (w.substitutions / chartMax) * 130;
                const isOver = w.utilization_pct > 100;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: "0.55rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: isOver ? "var(--color-danger)" : "var(--text-muted)" }}>
                      {w.total}
                    </span>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column-reverse", borderRadius: "3px 3px 0 0", overflow: "hidden" }}>
                      <div className="wl-bar" style={{ height: schedH, background: isOver ? "var(--color-danger, var(--danger-500))" : "var(--color-brand, var(--primary-500))" }} />
                      {w.substitutions > 0 && (
                        <div className="wl-bar" style={{ height: subH, background: "var(--color-sub, #F97316)", animationDelay: `${i * 50}ms` }} />
                      )}
                    </div>
                    <span style={{ fontSize: "0.55rem", fontWeight: 600, color: "var(--text-muted)" }}>{w.initials}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
              Generate a timetable to see workload data
            </div>
          )}

          {/* Teacher status summary */}
          <div style={{ borderTop: "1px solid var(--border-default, var(--slate-200))", paddingTop: 12, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: `conic-gradient(var(--color-success) 0% ${d.is_off_day ? 0 : s.attendance_pct}%, var(--color-danger-bg, var(--danger-100)) ${d.is_off_day ? 0 : s.attendance_pct}% 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", background: "var(--surface-card, #fff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.55rem", fontWeight: 800, flexDirection: "column", lineHeight: 1.2,
                }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800 }}>{s.total_teachers}</span>
                  <span style={{ fontSize: "0.48rem", color: "var(--text-muted)" }}>teachers</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px", fontSize: "0.68rem" }}>
                <span><span style={{ color: "var(--color-success)", fontWeight: 700 }}>●</span> Present <strong>{d.is_off_day ? "—" : s.present_today}</strong></span>
                <span><span style={{ color: "var(--color-danger)", fontWeight: 700 }}>●</span> Absent <strong>{d.is_off_day ? "—" : s.absent_today}</strong></span>
                <span><span style={{ color: "var(--color-brand)", fontWeight: 700 }}>●</span> Busy {currentLessonLabel ? `L${currentLessonLabel}` : ""} <strong>{d.is_off_day ? "—" : s.busy_now}</strong></span>
                <span><span style={{ color: "#22c55e", fontWeight: 700 }}>●</span> Free {currentLessonLabel ? `L${currentLessonLabel}` : ""} <strong>{d.is_off_day ? "—" : s.free_now}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* ── MIDDLE: Substitutions Today + History ── */}
        <div className="card anim-card" style={{ padding: "1rem", animationDelay: "350ms" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                {showHistory ? "Substitution History" : "Substitutions today"}
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                {showHistory ? "Last 30 days" : "Assigned coverage for absent teachers"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setShowHistory(!showHistory)}
                className="btn" style={{ fontSize: "0.58rem", padding: "2px 8px", fontWeight: 700 }}>
                {showHistory ? "Today" : "📅 History"}
              </button>
              <span style={{
                padding: "2px 10px", borderRadius: "var(--r-pill, 999px)",
                background: "var(--color-success-bg, var(--success-50))", border: "1px solid var(--success-200, #bbf7d0)",
                fontSize: "0.6rem", fontWeight: 700, color: "var(--color-success)",
              }}>{d.substitutions_today.length} assigned</span>
            </div>
          </div>

          {showHistory ? (
            /* ── History view ── */
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {d.substitution_history.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", padding: "1.5rem 0", textAlign: "center" }}>
                  No substitutions in the last 30 days
                </div>
              ) : d.substitution_history.map((h) => (
                <div key={h.date} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--border-subtle, var(--slate-100))",
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                    background: h.date === d.date ? "var(--color-brand-light, var(--primary-50))" : "var(--slate-50)",
                    border: h.date === d.date ? "1px solid var(--primary-200)" : "1px solid var(--slate-200)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.55rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: h.date === d.date ? "var(--color-brand)" : "var(--text-muted)",
                  }}>{new Date(h.date + "T00:00:00").getDate()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.72rem", color: "var(--text-primary)" }}>{fmtHistDate(h.date)}</div>
                    <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
                      {h.absences} absent · {h.subs} substitution{h.subs !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {h.absences > 0 && <span style={{ padding: "1px 6px", borderRadius: "var(--r-pill, 999px)", background: "var(--danger-50)", fontSize: "0.55rem", fontWeight: 700, color: "var(--danger-600)" }}>{h.absences}A</span>}
                    {h.subs > 0 && <span style={{ padding: "1px 6px", borderRadius: "var(--r-pill, 999px)", background: "var(--primary-50)", fontSize: "0.55rem", fontWeight: 700, color: "var(--primary-600)" }}>{h.subs}S</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Today's subs ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.substitutions_today.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", padding: "1.5rem 0", textAlign: "center" }}>
                  No substitutions assigned yet
                </div>
              ) : d.substitutions_today.map((sub, i) => (
                <div key={sub.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0.5rem 0",
                  borderBottom: i < d.substitutions_today.length - 1 ? "1px solid var(--border-subtle, var(--slate-100))" : "none",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: avatarColor(i), color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.6rem", fontWeight: 700, flexShrink: 0,
                  }}>{sub.sub_teacher_initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--text-primary)" }}>{sub.sub_teacher_name}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Covering {sub.absent_teacher_name} · {sub.subject_name} · {sub.class_name}
                    </div>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: "var(--r-pill, 999px)",
                    background: sub.is_override ? "var(--color-danger-bg, var(--danger-50))" : "var(--color-brand-light, var(--primary-50))",
                    border: sub.is_override ? "1px solid var(--danger-200)" : "1px solid var(--primary-200, #c7d2fe)",
                    fontSize: "0.58rem", fontWeight: 700,
                    color: sub.is_override ? "var(--color-danger)" : "var(--color-brand)",
                  }}>L{sub.period_index + 1}</span>
                </div>
              ))}
            </div>
          )}

          {!showHistory && uncoveredCount > 0 && (
            <div style={{
              marginTop: 10, padding: "6px 10px", borderRadius: "var(--r-md, var(--radius-md))",
              background: "var(--color-warning-bg, var(--warning-50))", border: "1px solid var(--warning-200, #fde68a)",
              fontSize: "0.65rem", fontWeight: 600, color: "var(--color-warning)",
            }}>
              🟡 {uncoveredCount} lesson{uncoveredCount !== 1 ? "s" : ""} still unassigned — <Link to={`/project/${pid}/substitutions`} style={{ fontWeight: 700 }}>Assign Now</Link>
            </div>
          )}
        </div>

        {/* ── RIGHT: Recent Activity ── */}
        <div className="card anim-card" style={{ padding: "1rem", animationDelay: "400ms" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>Recent activity</div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Live updates</div>
            </div>
            <span className="live-indicator" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.substitutions_today.map((sub) => (
              <div key={`sub-${sub.id}`} style={{ display: "flex", gap: 10, fontSize: "0.72rem" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-success)", flexShrink: 0, marginTop: 5 }} />
                <div>
                  <div><strong>{sub.sub_teacher_name}</strong> assigned L{sub.period_index + 1} sub for {sub.absent_teacher_name}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>Today</div>
                </div>
              </div>
            ))}
            {d.absent_teachers.map((a) => (
              <div key={`abs-${a.id}`} style={{ display: "flex", gap: 10, fontSize: "0.72rem" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-sub, #F97316)", flexShrink: 0, marginTop: 5 }} />
                <div>
                  <div><strong>{a.teacher_name}</strong> marked absent · {a.reason || "No reason"}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>Today</div>
                </div>
              </div>
            ))}
            {d.substitutions_today.length === 0 && d.absent_teachers.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", padding: "1rem 0", textAlign: "center" }}>
                No activity today yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
