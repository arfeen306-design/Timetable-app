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
    total_lessons: number;
    attendance_pct: number;
  };
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

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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
          <span style={{
            padding: "0.35rem 0.75rem", borderRadius: "var(--r-md, var(--radius-md))",
            background: "var(--surface-card, #fff)", border: "1px solid var(--border-default, var(--slate-200))",
            fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-mono)",
          }}>{d.time}</span>
          <button onClick={() => window.open(`/api/projects/${pid}/substitutions/export-pdf?date=${d.date}`, "_blank")}
            className="btn" style={{ fontSize: "0.78rem", fontWeight: 700 }}>Export PDF</button>
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
            <strong>{uncoveredCount} unassigned period{uncoveredCount !== 1 ? "s" : ""}</strong> — {
              d.unassigned.slice(0, 3).map(u => `${u.teacher_name} (P${u.period_index + 1})`).join(", ")
            }{d.unassigned.length > 3 ? ` + ${d.unassigned.length - 3} more` : ""} {uncoveredCount === 1 ? "has" : "have"} no substitute assigned yet
          </span>
          <Link to={`/project/${pid}/substitutions`} className="btn btn-danger" style={{ fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap", padding: "4px 10px" }}>
            Assign Now
          </Link>
        </div>
      )}

      {/* ═══ Stat Cards (5 across) ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "0ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-success, var(--success-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>PRESENT TODAY</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>{s.present_today}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>of {s.total_teachers} teachers</div>
          <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-success-bg, var(--success-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-success, var(--success-600))" }}>{s.attendance_pct}% attendance</div>
        </div>

        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "50ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-danger, var(--danger-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>ABSENT TODAY</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>{s.absent_today}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>marked this morning</div>
          {uncoveredCount > 0 && (
            <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-warning-bg, var(--warning-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-warning, var(--warning-600))" }}>{uncoveredCount} periods uncovered</div>
          )}
        </div>

        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "100ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(99,102,241,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-brand, var(--primary-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>BUSY RIGHT NOW</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>{s.busy_now}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>in Lesson {(d.lesson_slots.find(s => s.is_current && s.type === "lesson")?.lesson_number) || (d.current_period + 1)}</div>
          <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-brand-light, var(--primary-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-brand, var(--primary-600))" }}>{s.free_now} teachers free</div>
        </div>

        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "150ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(245,158,11,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--color-warning, var(--warning-600))", textTransform: "uppercase", letterSpacing: "0.06em" }}>AVG. WORKLOAD</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>{s.avg_workload}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>periods this week</div>
          {s.over_max > 0 && (
            <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "var(--color-danger-bg, var(--danger-50))", fontSize: "0.6rem", fontWeight: 700, color: "var(--color-danger, var(--danger-600))" }}>{s.over_max} over max</div>
          )}
        </div>

        <div className="card anim-card" style={{ padding: "0.85rem 1rem", position: "relative", overflow: "hidden", animationDelay: "200ms" }}>
          <div style={{ position: "absolute", top: -8, right: -8, width: 48, height: 48, borderRadius: "50%", background: "rgba(6,182,212,0.08)" }} />
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#0891B2", textTransform: "uppercase", letterSpacing: "0.06em" }}>TOTAL CLASSES</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, var(--slate-900))", lineHeight: 1.2, margin: "4px 0" }}>{s.total_classes}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted, var(--slate-400))" }}>Grades</div>
          <div style={{ display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: "var(--r-pill, 999px)", background: "#ecfeff", fontSize: "0.6rem", fontWeight: 700, color: "#0891B2" }}>{s.total_lessons} lessons / week</div>
        </div>
      </div>

      {/* ═══ Live Lesson Bar ═══ */}
      {d.is_off_day ? (
        <div className="card anim-card" style={{
          padding: "0.8rem 1rem", marginBottom: 16, animationDelay: "250ms",
          background: "linear-gradient(135deg, var(--surface-card, #fff) 0%, #fefce8 100%)",
          border: "1px solid var(--warning-200, #fde68a)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.4rem" }}>🏖️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                {d.day_name} — Holiday
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                No lessons scheduled today. Enjoy your day off!
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card anim-card" style={{ padding: "0.6rem 1rem", marginBottom: 16, animationDelay: "250ms" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {d.current_lesson_start ? (
                <>
                  <span className="live-indicator" />
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                    Live right now — Lesson {d.lesson_slots.find(s => s.is_current && s.type === "lesson")?.lesson_number || ""}
                  </span>
                  <span style={{
                    padding: "2px 8px", borderRadius: "var(--r-pill, 999px)",
                    background: "var(--color-brand-light, var(--primary-50))",
                    border: "1px solid var(--primary-200, #c7d2fe)",
                    fontSize: "0.65rem", fontWeight: 700, color: "var(--color-brand)",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {formatTime12(d.current_lesson_start)} – {formatTime12(d.current_lesson_end)}
                  </span>
                </>
              ) : d.lesson_slots.find(s => s.is_current && s.type === "break") ? (
                <>
                  <span style={{ fontSize: "1rem" }}>☕</span>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                    Break — {d.lesson_slots.find(s => s.is_current && s.type === "break")?.label}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>📚</span>
                  <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {d.lesson_slots.every(s => s.is_past) ? "School day ended" : "School hasn't started yet"}
                  </span>
                </>
              )}
            </div>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted, var(--slate-400))" }}>
              {s.busy_now} busy · {s.free_now} free · {s.on_sub_now} on sub
            </span>
          </div>

          {/* Lesson slot bar */}
          <div style={{ display: "flex", gap: 2, height: 28, borderRadius: 6, overflow: "hidden" }}>
            {d.lesson_slots.map((slot, i) => {
              const isCurrent = slot.is_current;
              const isPast = slot.is_past && !isCurrent;
              const isBreak = slot.type === "break";

              return (
                <div key={i} title={`${slot.label}: ${slot.start_time} – ${slot.end_time}`} style={{
                  flex: isBreak ? 0.4 : 1,
                  borderRadius: 3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.52rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                  cursor: "default",
                  transition: "all 0.3s",
                  position: "relative",
                  background: isBreak
                    ? (isCurrent ? "var(--warning-100, #fef3c7)" : isPast ? "var(--border-subtle, var(--slate-100))" : "var(--border-default, var(--slate-200))")
                    : isCurrent
                      ? "var(--color-brand, var(--primary-500))"
                      : isPast
                        ? "var(--color-brand-mid, var(--primary-300))"
                        : "var(--border-default, var(--slate-200))",
                  color: isCurrent && !isBreak ? "#fff" : isPast ? "var(--text-muted)" : "var(--text-secondary, var(--slate-500))",
                  boxShadow: isCurrent && !isBreak ? "0 0 8px rgba(99,102,241,0.4)" : "none",
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

          {/* Time labels below bar */}
          <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
            {d.lesson_slots.filter(s => s.type === "lesson").map((slot) => (
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

      {/* ═══ Unassigned warning banner ═══ */}
      {uncoveredCount > 0 && (
        <div className="card" style={{
          padding: "0.55rem 1rem", marginBottom: 16,
          borderLeft: "3px solid var(--color-danger, var(--danger-500))",
          background: "var(--color-danger-bg, var(--danger-50))",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--color-danger, var(--danger-600))", fontWeight: 600 }}>
            🔴 Unassigned periods — absent teacher classes with no substitute
          </div>
          <span style={{
            padding: "2px 10px", borderRadius: "var(--r-pill, 999px)",
            background: "var(--color-danger, var(--danger-500))", color: "#fff",
            fontSize: "0.62rem", fontWeight: 700,
          }}>{uncoveredCount} urgent</span>
        </div>
      )}

      {/* ═══ Three-column grid ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {/* ── LEFT: Workload chart ── */}
        <div className="card anim-card" style={{ padding: "1rem", animationDelay: "300ms" }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)", marginBottom: 4 }}>
            Today's workload — periods per teacher
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
                background: `conic-gradient(var(--color-success) 0% ${s.attendance_pct}%, var(--color-danger-bg, var(--danger-100)) ${s.attendance_pct}% 100%)`,
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
                <span><span style={{ color: "var(--color-success)", fontWeight: 700 }}>●</span> Present <strong>{s.present_today}</strong></span>
                <span><span style={{ color: "var(--color-danger)", fontWeight: 700 }}>●</span> Absent <strong>{s.absent_today}</strong></span>
                <span><span style={{ color: "var(--color-brand)", fontWeight: 700 }}>●</span> Busy L{(d.lesson_slots.find(s => s.is_current && s.type === "lesson")?.lesson_number) || (d.current_period + 1)} <strong>{s.busy_now}</strong></span>
                <span><span style={{ color: "#22c55e", fontWeight: 700 }}>●</span> Free L{(d.lesson_slots.find(s => s.is_current && s.type === "lesson")?.lesson_number) || (d.current_period + 1)} <strong>{s.free_now}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* ── MIDDLE: Substitutions Today ── */}
        <div className="card anim-card" style={{ padding: "1rem", animationDelay: "350ms" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>Substitutions today</div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Assigned coverage for absent teachers</div>
            </div>
            <span style={{
              padding: "2px 10px", borderRadius: "var(--r-pill, 999px)",
              background: "var(--color-success-bg, var(--success-50))", border: "1px solid var(--success-200, #bbf7d0)",
              fontSize: "0.6rem", fontWeight: 700, color: "var(--color-success)",
            }}>{d.substitutions_today.length} assigned</span>
          </div>

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
                }}>P{sub.period_index + 1}</span>
              </div>
            ))}
          </div>

          {uncoveredCount > 0 && (
            <div style={{
              marginTop: 10, padding: "6px 10px", borderRadius: "var(--r-md, var(--radius-md))",
              background: "var(--color-warning-bg, var(--warning-50))", border: "1px solid var(--warning-200, #fde68a)",
              fontSize: "0.65rem", fontWeight: 600, color: "var(--color-warning)",
            }}>
              🟡 {uncoveredCount} period{uncoveredCount !== 1 ? "s" : ""} still unassigned — <Link to={`/project/${pid}/substitutions`} style={{ fontWeight: 700 }}>click Assign Now above</Link>
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
                  <div><strong>{sub.sub_teacher_name}</strong> assigned P{sub.period_index + 1} sub for {sub.absent_teacher_name}</div>
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
