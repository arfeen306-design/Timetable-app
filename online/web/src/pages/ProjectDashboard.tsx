import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api, listPendingWithSuggestions, assignSubstitute, type SuggestionTeacher } from "../api";
import { cachedFetch, invalidateCachePrefix } from "../hooks/prefetchCache";
import { useLivePeriod } from "../hooks/useLivePeriod";
import { useTheme } from "../context/ThemeContext";

/* ── Types ── */
interface LiveTeacher {
  teacher_id: number; name: string; initials: string;
  status: "busy" | "free" | "sub"; class_name: string;
  subject_name: string; color: string;
  today_lessons?: number;
}
interface DashboardData {
  school_name: string; academic_year: string; week_label: string;
  week_number: number; date: string; date_formatted: string;
  day_name: string; time: string; is_off_day: boolean;
  current_period: number; current_lesson_start: string;
  current_lesson_end: string; num_periods: number;
  lesson_slots: {
    type: "lesson"|"break"; lesson_number?: number; period_index?: number;
    label: string; start_time: string; end_time: string;
    is_current: boolean; is_past: boolean;
  }[];
  stats: {
    total_teachers: number; present_today: number; absent_today: number;
    busy_now: number; on_sub_now: number; free_now: number;
    avg_workload: number; over_max: number; total_classes: number;
    total_grades: number; total_lessons: number; attendance_pct: number;
  };
  class_breakdown: { grade: string; sections: number }[];
  unassigned: { teacher_id: number; teacher_name: string; period_index: number; lesson_id: number; subject_name: string; class_name: string; room_id: number | null; room_name: string }[];
  substitutions_today: {
    id: number; period_index: number; sub_teacher_name: string;
    sub_teacher_initials: string; absent_teacher_name: string;
    subject_name: string; class_name: string; is_override: boolean;
  }[];
  workload_chart: {
    teacher_name: string; teacher_code: string; initials: string;
    scheduled: number; substitutions: number; total: number;
    max: number; utilization_pct: number;
  }[];
  substitution_history: { date: string; subs: number; absences: number }[];
  absent_teachers: { id: number; teacher_id: number; teacher_name: string; reason: string }[];
  live_teachers: LiveTeacher[];
}

interface TodoTask {
  id: string;
  title: string;
  due_date: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
}

/* ── Helpers ── */
function fmt12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function countryFlag(cc: string) {
  if (!cc || cc.length !== 2) return "🌐";
  const b = 0x1F1E6;
  return String.fromCodePoint(b + cc.charCodeAt(0) - 65, b + cc.charCodeAt(1) - 65);
}

const COLORS = ["#5B4EE8","#0369A1","#7C3AED","#B45309","#B45309","#0EA875","#F06830","#0891B2"];
const av = (i: number) => COLORS[i % COLORS.length];

/* ── Null-safe defaults ── */
const E_SLOTS: DashboardData["lesson_slots"] = [];
// class_breakdown not needed in current layout
const E_UN: DashboardData["unassigned"] = [];
const E_SUB: DashboardData["substitutions_today"] = [];
const E_WC: DashboardData["workload_chart"] = [];

const E_AT: DashboardData["absent_teachers"] = [];
const E_LT: LiveTeacher[] = [];

/* ═══════════════════════════════════════════════════════════════
   ProjectDashboard — "Myzynca School OS" design
   ═══════════════════════════════════════════════════════════════ */
export default function ProjectDashboard() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
  // timezone handled via ipapi
  const [cc, setCc] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Interactive card filter: click a stat card to filter the Live Now grid
  const [cardFilter, setCardFilter] = useState<"present" | "absent" | "busy" | null>(null);

  /* ── To-Do state ── */
  const todoKey = `myzynca_tasks_${pid}`;
  const [tasks, setTasks] = useState<TodoTask[]>(() => {
    try { return JSON.parse(localStorage.getItem(`myzynca_tasks_${pid}`) || "[]"); } catch { return []; }
  });
  const [todoFilter, setTodoFilter] = useState<"today" | "week" | "month">("today");
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");

  /* ── Calendar state ── */
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());

  const saveTasks = (t: TodoTask[]) => { setTasks(t); localStorage.setItem(todoKey, JSON.stringify(t)); };
  const addTask = () => {
    if (!newTitle.trim()) return;
    const t: TodoTask = { id: String(Date.now()), title: newTitle.trim(), due_date: newDue || new Date().toISOString().slice(0, 10), priority: newPriority, completed: false };
    saveTasks([...tasks, t]);
    setNewTitle(""); setNewDue(""); setNewPriority("medium");
  };
  const toggleTask = (id: string) => saveTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const deleteTask = (id: string) => saveTasks(tasks.filter(t => t.id !== id));

  const filteredTasks = tasks.filter(t => {
    const d2 = new Date(t.due_date + "T00:00");
    const now = new Date(); now.setHours(0,0,0,0);
    if (todoFilter === "today") return d2.toDateString() === now.toDateString();
    if (todoFilter === "week") {
      const end = new Date(now); end.setDate(end.getDate() + (7 - end.getDay()));
      return d2 >= now && d2 <= end;
    }
    /* month */ return d2.getMonth() === now.getMonth() && d2.getFullYear() === now.getFullYear();
  });

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) })
      .then(r => r.json()).then(d => { if (d.country_code) setCc(d.country_code); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const url = `/api/projects/${pid}/dashboard?tz=${encodeURIComponent(clientTz)}`;
    cachedFetch(`dash-${pid}`, () => api<DashboardData>(url), 30_000)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [pid]);

  // Refresh handler — force fresh data
  const refreshDash = async () => {
    if (!pid || refreshing) return;
    setRefreshing(true);
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const url = `/api/projects/${pid}/dashboard?tz=${encodeURIComponent(clientTz)}`;
    try {
      const fresh = await api<DashboardData>(url);
      setData(fresh);
    } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  /* ── Quick Assign state ── */
  const [qaExpanded, setQaExpanded] = useState<string | null>(null);
  const [qaSuggestions, setQaSuggestions] = useState<Record<string, SuggestionTeacher[]>>({});
  const [qaAssigning, setQaAssigning] = useState(false);
  const [qaMsg, setQaMsg] = useState("");

  // Preload free-teacher suggestions for ALL unassigned slots in one call
  useEffect(() => {
    if (!pid || !data?.date || !data?.unassigned?.length) return;
    listPendingWithSuggestions(pid, data.date)
      .then(r => setQaSuggestions(r.suggestions || {}))
      .catch(() => setQaSuggestions({}));
  }, [pid, data?.date, data?.unassigned?.length]);

  function handleQaExpand(u: DashboardData["unassigned"][0]) {
    const key = `${u.teacher_id}-${u.period_index}`;
    if (qaExpanded === key) { setQaExpanded(null); return; }
    setQaExpanded(key);
  }

  // Derive free teachers for expanded row from preloaded suggestions
  const qaFreeKey = qaExpanded || "";
  const qaFree: SuggestionTeacher[] = qaSuggestions[qaFreeKey] || [];

  async function handleQaAssign(u: DashboardData["unassigned"][0], ft: SuggestionTeacher, force = false) {
    setQaAssigning(true);
    // Optimistic: remove from unassigned immediately
    const prevData = data;
    if (data) {
      setData({ ...data, unassigned: data.unassigned.filter(x => !(x.teacher_id === u.teacher_id && x.period_index === u.period_index)) });
    }
    setQaExpanded(null);
    setQaMsg(`⚡ Assigning ${ft.teacher_name} to Lesson ${u.period_index + 1}...`);
    try {
      await assignSubstitute(pid, {
        date: data?.date || "",
        period_index: u.period_index,
        absent_teacher_id: u.teacher_id,
        sub_teacher_id: ft.teacher_id,
        lesson_id: u.lesson_id,
        room_id: u.room_id,
        force_override: force,
      });
      setQaMsg(`✅ ${ft.teacher_name} assigned to Lesson ${u.period_index + 1}`);
      // Refresh dashboard data in background
      invalidateCachePrefix(`dash-${pid}`);
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      api<DashboardData>(`/api/projects/${pid}/dashboard?tz=${encodeURIComponent(clientTz)}`)
        .then(setData).catch(console.error);
      setTimeout(() => setQaMsg(""), 3000);
    } catch (e: unknown) {
      // Rollback on error
      if (prevData) setData(prevData);
      const err = e as { status?: number; detail?: { code?: string; teacher_name?: string; sub_count?: number } };
      if (err.status === 409 && err.detail?.code === "LIMIT_EXCEEDED") {
        if (window.confirm(`${err.detail.teacher_name} has ${err.detail.sub_count} subs this week (limit 2). Override?`)) {
          await handleQaAssign(u, ft, true);
        }
      } else {
        setQaMsg(`❌ ${e instanceof Error ? e.message : "Assignment failed"}`);
        setTimeout(() => setQaMsg(""), 4000);
      }
    }
    finally { setQaAssigning(false); }
  }

  // ── useLivePeriod must be called unconditionally (Rules of Hooks) ──
  const slots = data?.lesson_slots ?? E_SLOTS;
  const { currentSlot, currentIndex } = useLivePeriod(slots);

  if (loading) return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="skeleton skeleton-title" style={{ width: "30%" }} />
      <div className="pd-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginTop: 16 }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 110 }} />)}
      </div>
      <div className="skeleton skeleton-card" style={{ height: 200, marginTop: 16 }} />
    </div>
  );
  if (!data) return <div className="empty-state"><div className="empty-state-title">No data</div></div>;

  const d = data;
  const s = d.stats || {} as DashboardData["stats"];
  // class_breakdown used below in stats card
  const unassigned = d.unassigned || E_UN;
  const subs = d.substitutions_today || E_SUB;
  const wChart = d.workload_chart || E_WC;

  const absent = d.absent_teachers || E_AT;
  const liveT = d.live_teachers || E_LT;
  const chartMax = Math.max(...wChart.map(w => w.total), 1);
  const curLesson = currentSlot?.type === "lesson" ? currentSlot : null;
  const uncovered = unassigned.length;

  /* ── Donut SVG calculation ── */
  const total = s.total_teachers || 1;
  const pPct = (s.present_today / total);
  const aPct = (s.absent_today / total);
  const pDash = pPct * 188.5;
  const aDash = aPct * 188.5;

  return (
    <div className="pd-page" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ═══ TOPBAR ═══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--card-bg)", padding: "14px 20px",
        borderBottom: "1px solid var(--slate-200)",
      }}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--slate-900)", letterSpacing: "-0.02em" }}>Dashboard</div>
          <div style={{ fontSize: "0.72rem", color: "var(--slate-400)", marginTop: 1 }}>
            {d.school_name} · {d.academic_year} · {d.week_label} · <span style={{ color: "#0EA875", fontWeight: 600 }}>{d.date_formatted}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 500,
            background: "var(--slate-50)", padding: "5px 12px", borderRadius: 8,
            border: "1px solid var(--slate-200)", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{cc ? countryFlag(cc) : "🌐"}</span>
            <span>{clock}</span>
          </div>
          <button className="btn" onClick={refreshDash} disabled={refreshing} style={{ fontSize: "0.72rem", padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.4s", transform: refreshing ? "rotate(360deg)" : "none" }}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ═══ NOTIFICATION BANNER — unassigned ═══ */}
      {uncovered > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: isDark ? "rgba(217,119,6,0.12)" : "#FFFBEB", border: isDark ? "2px solid rgba(217,119,6,0.25)" : "2px solid #FDE68A", borderRadius: 10,
          padding: "10px 20px", animation: "fadeUp 0.3s ease",
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: "50%", background: "#D97706",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6rem", color: "#fff", fontWeight: 700, flexShrink: 0,
          }}>!</div>
          <div style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600, color: isDark ? "#FBBF24" : "#78350F" }}>
            {uncovered} unassigned lesson{uncovered !== 1 ? "s" : ""} <span style={{ fontWeight: 400, color: isDark ? "#F59E0B" : "#92400E" }}>
              — {unassigned.slice(0, 3).map(u => `${u.teacher_name} (Lesson ${u.period_index + 1})`).join(", ")}
              {uncovered > 3 ? ` + ${uncovered - 3} more` : ""}
            </span>
          </div>
          <Link to={`/project/${pid}/substitutions`} style={{
            padding: "5px 12px", borderRadius: 6, background: "#D97706", color: "#fff",
            fontSize: "0.68rem", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
          }}>Assign Now</Link>
        </div>
      )}

      {/* ═══ STAT CARDS (5 across) ═══ */}
      <div className="pd-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {/* Present */}
        <div
          className="sc anim-card"
          onClick={() => setCardFilter(f => f === "present" ? null : "present")}
          style={{
            background: "var(--card-bg)", border: cardFilter === "present" ? "2px solid #0EA875" : "1px solid var(--border-default)",
            borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden",
            cursor: "pointer", transition: "border 0.2s, box-shadow 0.2s, transform 0.15s",
            boxShadow: cardFilter === "present" ? "0 0 0 3px rgba(14,168,117,0.15)" : "none",
            transform: cardFilter === "present" ? "scale(1.02)" : "none",
          }}
        >
          <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "50%", transform: "translate(20px,-20px)", background: "#0EA875", opacity: 0.08 }} />
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--slate-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Present today</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0EA875", lineHeight: 1, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)" }}>
            {d.is_off_day ? "—" : s.present_today}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 5 }}>{d.is_off_day ? "Off day" : `of ${s.total_teachers} teachers`}</div>
          {!d.is_off_day && <div style={{ display: "inline-flex", fontSize: "0.6rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, marginTop: 6, background: isDark ? "rgba(14,168,117,0.15)" : "#E8FAF4", color: isDark ? "#34D399" : "#076644" }}>{s.attendance_pct}% attendance</div>}
          {d.is_off_day && <div style={{ display: "inline-flex", fontSize: "0.6rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, marginTop: 6, background: isDark ? "rgba(245,158,11,0.15)" : "#FEF3DC", color: isDark ? "#FBBF24" : "#8A5A00" }}>🏖️ Holiday</div>}
        </div>

        {/* Absent */}
        <div
          className="sc anim-card"
          onClick={() => setCardFilter(f => f === "absent" ? null : "absent")}
          style={{
            background: "var(--card-bg)", border: cardFilter === "absent" ? "2px solid #D97706" : "1px solid var(--border-default)",
            borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden",
            cursor: "pointer", transition: "border 0.2s, box-shadow 0.2s, transform 0.15s",
            boxShadow: cardFilter === "absent" ? "0 0 0 3px rgba(217,119,6,0.15)" : "none",
            transform: cardFilter === "absent" ? "scale(1.02)" : "none",
          }}
        >
          <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "50%", transform: "translate(20px,-20px)", background: "#D97706", opacity: 0.08 }} />
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--slate-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Absent today</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#D97706", lineHeight: 1, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)" }}>
            {d.is_off_day ? "—" : s.absent_today}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 5 }}>{d.is_off_day ? "No school" : "marked this morning"}</div>
          {!d.is_off_day && uncovered > 0 && <div style={{ display: "inline-flex", fontSize: "0.6rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, marginTop: 6, background: isDark ? "rgba(217,119,6,0.15)" : "#FEF3C7", color: isDark ? "#FBBF24" : "#78350F" }}>{uncovered} lessons uncovered</div>}
        </div>

        {/* Busy */}
        <div
          className="sc anim-card"
          onClick={() => setCardFilter(f => f === "busy" ? null : "busy")}
          style={{
            background: "var(--card-bg)", border: cardFilter === "busy" ? "2px solid #5B4EE8" : "1px solid var(--border-default)",
            borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden",
            cursor: "pointer", transition: "border 0.2s, box-shadow 0.2s, transform 0.15s",
            boxShadow: cardFilter === "busy" ? "0 0 0 3px rgba(91,78,232,0.15)" : "none",
            transform: cardFilter === "busy" ? "scale(1.02)" : "none",
          }}
        >
          <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "50%", transform: "translate(20px,-20px)", background: "#5B4EE8", opacity: 0.08 }} />
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--slate-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Busy right now</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#5B4EE8", lineHeight: 1, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)" }}>
            {d.is_off_day ? "—" : s.busy_now}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 5 }}>
            {d.is_off_day ? "No lessons" : curLesson ? `in Lesson ${curLesson.lesson_number}` : "between lessons"}
          </div>
          {!d.is_off_day && <div style={{ display: "inline-flex", fontSize: "0.6rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, marginTop: 6, background: isDark ? "rgba(91,78,232,0.15)" : "#ECEAFD", color: isDark ? "#A5B4FC" : "#3D32B0" }}>{s.free_now} teachers free</div>}
        </div>

        {/* Workload */}
        <div className="sc anim-card" style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "50%", transform: "translate(20px,-20px)", background: "#E8A020", opacity: 0.08 }} />
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--slate-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Avg. workload</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#E8A020", lineHeight: 1, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)" }}>{s.avg_workload}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 5 }}>lessons this week</div>
          {s.over_max > 0 && <div style={{ display: "inline-flex", fontSize: "0.6rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, marginTop: 6, background: isDark ? "rgba(217,119,6,0.15)" : "#FEF3C7", color: isDark ? "#FBBF24" : "#78350F" }}>{s.over_max} over max limit</div>}
        </div>

        {/* Classes */}
        <div className="sc anim-card" style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "50%", transform: "translate(20px,-20px)", background: "#F06830", opacity: 0.08 }} />
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--slate-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Total classes</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#F06830", lineHeight: 1, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)" }}>{s.total_classes}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 5 }}>{s.total_grades || 0} grades</div>
          <div style={{ display: "inline-flex", fontSize: "0.6rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, marginTop: 6, background: isDark ? "rgba(240,104,48,0.15)" : "#FEF0E8", color: isDark ? "#FB923C" : "#8A3200" }}>{s.total_lessons} lessons / week</div>
        </div>
      </div>

      {/* ═══ LIVE NOW PANEL — light colorful theme ═══ */}
      {d.is_off_day ? (
        <div style={{
          background: isDark ? "linear-gradient(135deg, #1B2838 0%, #162232 50%, #1C2B3D 100%)" : "linear-gradient(135deg, #FEFCE8 0%, #F0FDF4 50%, #FDF2F8 100%)",
          border: isDark ? "1px solid var(--border-default)" : "1px solid #E9D5FF", borderRadius: 14, padding: "18px 20px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <span style={{ fontSize: "1.2rem" }}>🏖️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>{d.day_name} — No school today</div>
              <div style={{ fontSize: "0.68rem", color: "#64748B" }}>Dashboard stats will resume on the next working day.</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: isDark ? "linear-gradient(135deg, #1B2838 0%, #162232 50%, #1C2B3D 100%)" : "linear-gradient(135deg, #FEFCE8 0%, #F0FDF4 50%, #FDF2F8 100%)",
          border: isDark ? "1px solid var(--border-default)" : "1px solid #E9D5FF", borderRadius: 14, position: "relative", overflow: "hidden",
        }}>

          {/* Live header */}
          <div className="pd-live-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="live-indicator" style={{ background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" }} />
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Live right now {curLesson ? `— Lesson ${curLesson.lesson_number}` : ""}
              </span>
              {curLesson && (
                <span style={{
                  background: "#DBEAFE", color: "#1D4ED8",
                  fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px",
                  borderRadius: 20, fontFamily: "var(--font-mono)",
                }}>{fmt12(curLesson.start_time)} – {fmt12(curLesson.end_time)}</span>
              )}
              {/* Active filter indicator */}
              {cardFilter && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: cardFilter === "present" ? (isDark ? "rgba(14,168,117,0.15)" : "#E8FAF4") : cardFilter === "absent" ? (isDark ? "rgba(217,119,6,0.15)" : "#FEF3C7") : (isDark ? "rgba(91,78,232,0.15)" : "#ECEAFD"),
                  color: cardFilter === "present" ? (isDark ? "#34D399" : "#076644") : cardFilter === "absent" ? (isDark ? "#FBBF24" : "#78350F") : (isDark ? "#A5B4FC" : "#3D32B0"),
                  fontSize: "0.62rem", fontWeight: 700, padding: "3px 10px",
                  borderRadius: 20, animation: "fadeUp 0.2s ease",
                }}>
                  Showing: {cardFilter === "present" ? "Present" : cardFilter === "absent" ? "Absent" : "Busy"}
                  <button
                    onClick={(e) => { e.stopPropagation(); setCardFilter(null); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.7rem", color: "inherit", padding: 0, lineHeight: 1,
                    }}
                    title="Clear filter"
                  >✕</button>
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", display: "flex", gap: 8 }}>
              <span style={{ color: "#D97706", fontWeight: 600 }}>{s.busy_now} busy</span>
              <span style={{ color: "#64748B" }}>·</span>
              <span style={{ color: "#16A34A", fontWeight: 600 }}>{s.free_now} free</span>
              <span style={{ color: "#64748B" }}>·</span>
              <span style={{ color: "#7C3AED", fontWeight: 600 }}>{s.on_sub_now} on sub</span>
            </div>
          </div>

          {/* Live teacher cards */}
          {(() => {
            // Apply filter to teacher list
            let filtered: typeof liveT = liveT;
            if (cardFilter === "present") {
              filtered = liveT; // all live teachers are present
            } else if (cardFilter === "busy") {
              filtered = liveT.filter(t => t.status === "busy");
            } else if (cardFilter === "absent") {
              // Absent teachers are NOT in liveT — build virtual cards from absent_teachers
              const absentCards: LiveTeacher[] = absent.map((a, i) => ({
                teacher_id: a.teacher_id,
                name: a.teacher_name,
                initials: a.teacher_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2),
                status: "free" as const, // placeholder status
                class_name: "",
                subject_name: a.reason || "Absent",
                color: av(i),
              }));
              return absentCards.length > 0 ? (
                <div className="pd-live-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 14px 14px", position: "relative" }}>
                  {absentCards.map((t, i) => (
                    <div key={t.teacher_id || i} style={{
                      borderRadius: 10, padding: "10px 12px",
                      background: "var(--card-bg)", border: "1px solid var(--danger-200, #FDE68A)",
                      animation: `fadeUp 0.2s ease ${i * 0.03}s both`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%", background: "#D97706",
                          fontSize: "0.55rem", fontWeight: 700, color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>{t.initials}</div>
                        <div>
                          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                          <div style={{ fontSize: "0.62rem", color: "#D97706", fontWeight: 600 }}>Absent today</div>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.6rem", color: "#94A3B8", fontStyle: "italic" }}>{t.subject_name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--slate-400)", fontSize: "0.82rem" }}>No absent teachers today 🎉</div>
              );
            }
            return filtered.length > 0 ? (
            <div style={{ padding: "0 14px 14px" }}>
              {/* ── Ongoing Lessons (busy + sub) ── */}
              {(() => {
                const ongoing = filtered.filter(t => t.status === "busy" || t.status === "sub");
                const free = filtered.filter(t => t.status === "free");
                return (
                  <>
                    {ongoing.length > 0 && (
                      <>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          📖 Ongoing Lessons ({ongoing.length})
                        </div>
                        <div className="pd-live-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: free.length > 0 ? 16 : 0 }}>
                          {ongoing.map((t, i) => (
                            <div key={t.teacher_id || i} style={{
                              borderRadius: 10, padding: "10px 12px",
                              background: "var(--card-bg)",
                              border: "1px solid var(--border-default)",
                              animation: cardFilter ? `fadeUp 0.2s ease ${i * 0.03}s both` : undefined,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                                <div style={{
                                  width: 26, height: 26, borderRadius: "50%", background: t.color,
                                  fontSize: "0.55rem", fontWeight: 700, color: "#fff",
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}>{t.initials}</div>
                                <div>
                                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                                  <div style={{
                                    fontSize: "0.62rem", marginTop: 1,
                                    color: t.status === "sub" ? "#7C3AED" : "#64748B",
                                  }}>
                                    {t.status === "sub" ? "On substitution" : "Teaching"}
                                  </div>
                                </div>
                              </div>
                              {t.status === "busy" && (
                                <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{
                                    background: "#EEF2FF", color: "#4F46E5",
                                    fontSize: "0.58rem", fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                                    fontFamily: "var(--font-mono)",
                                  }}>{t.class_name}</span>
                                  <span>{t.subject_name}</span>
                                </div>
                              )}
                              {t.status === "sub" && (
                                <div style={{ fontSize: "0.6rem", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{
                                    background: "#F5F3FF", color: "#7C3AED",
                                    fontSize: "0.58rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                    fontFamily: "var(--font-mono)",
                                  }}>{t.class_name}</span>
                                  <span style={{ color: "#7C3AED", fontWeight: 600 }}>↔ {t.subject_name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {free.length > 0 && (
                      <>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          🟢 Free Teachers ({free.length})
                          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: "normal", color: "var(--text-muted)", fontSize: "0.6rem" }}>— sorted by lowest workload today</span>
                        </div>
                        <div style={{ maxHeight: 320, overflowY: "auto", borderRadius: 10, padding: "2px 2px 2px 0" }}>
                          <div className="pd-live-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                            {free.map((t, i) => (
                              <div key={t.teacher_id || i} style={{
                                borderRadius: 10, padding: "10px 12px",
                                background: "var(--card-bg)",
                                border: "1px solid var(--border-default)",
                                animation: cardFilter ? `fadeUp 0.2s ease ${i * 0.03}s both` : undefined,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                                  <div style={{
                                    width: 26, height: 26, borderRadius: "50%", background: t.color,
                                    fontSize: "0.55rem", fontWeight: 700, color: "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                  }}>{t.initials}</div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                                    <div style={{ fontSize: "0.62rem", marginTop: 1, color: "#16A34A" }}>Free this lesson</div>
                                  </div>
                                  <div style={{
                                    fontSize: "0.58rem", fontWeight: 700, padding: "2px 7px",
                                    borderRadius: 10, fontFamily: "var(--font-mono)",
                                    background: (t.today_lessons ?? 0) === 0 ? "rgba(14,168,117,0.1)" : "rgba(245,158,11,0.1)",
                                    color: (t.today_lessons ?? 0) === 0 ? "#0EA875" : "#D97706",
                                  }}>{t.today_lessons ?? 0} today</div>
                                </div>
                                <div style={{ fontSize: "0.6rem", color: "#16A34A", fontWeight: 600 }}>Available for substitution</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            /* Fallback: lesson slot bar if no live teachers */
            <div style={{ padding: "0 14px 14px", position: "relative" }}>
              <div style={{ display: "flex", gap: 2 }}>
                {slots.map((sl, i) => {
                  const isCurrent = i === currentIndex;
                  const [eh, em] = sl.end_time.split(":").map(Number);
                  const isPast = (new Date().getHours() * 60 + new Date().getMinutes()) >= eh * 60 + em;
                  return (
                    <div key={i} style={{
                      flex: sl.type === "break" ? 0.3 : 1, height: sl.type === "break" ? 24 : 32,
                      borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: sl.type === "break" ? "0.52rem" : "0.62rem", fontWeight: 700,
                      background: isCurrent ? "#4F46E5" : isPast ? "#F1F5F9" : "#F8FAFC",
                      color: isCurrent ? "#fff" : isPast ? "#94A3B8" : "#475569",
                      border: isCurrent ? "none" : "1px solid #E2E8F0",
                    }}>
                      {sl.type === "break" ? "☕" : `L${sl.lesson_number}`}
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })()}
        </div>
      )}

      {/* ═══ UNASSIGNED ALERTS CARD ═══ */}
      {uncovered > 0 && !d.is_off_day && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--danger-200, #FCCDD3)", borderRadius: 14, overflow: "hidden", maxHeight: 300, display: "flex", flexDirection: "column" }}>
          <div style={{
            background: isDark ? "rgba(217,119,6,0.12)" : "#FFFBEB", padding: "12px 18px", display: "flex", alignItems: "center", gap: 8,
            borderBottom: "1px solid #FCCDD3",
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: "#D97706",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.55rem", color: "#fff", fontWeight: 700, flexShrink: 0,
            }}>!</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: isDark ? "#FBBF24" : "#78350F" }}>Unassigned lessons — Quick Assign available</div>
            <div style={{
              marginLeft: "auto", background: "#D97706", color: "#fff",
              fontSize: "0.6rem", fontWeight: 700, padding: "2px 7px", borderRadius: 10,
            }}>{uncovered} urgent</div>
          </div>
          {qaMsg && (
            <div style={{ padding: "8px 18px", background: qaMsg.startsWith("✅") ? "#F0FDF4" : "#FEF2F2", fontSize: "0.75rem", fontWeight: 600, color: qaMsg.startsWith("✅") ? "#166534" : "#991B1B" }}>
              {qaMsg}
            </div>
          )}
          <div className="scroll-on-hover" style={{ flex: 1 }}>
            {unassigned.map((u, i) => {
              const key = `${u.teacher_id}-${u.period_index}`;
              const isExpanded = qaExpanded === key;
              return (
                <div key={i}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 18px", borderBottom: (i < unassigned.length - 1 || isExpanded) ? "1px solid #FEE8EB" : "none",
                    cursor: "pointer",
                  }} onClick={() => handleQaExpand(u)}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.68rem", fontWeight: 700,
                      background: "#FEF3C7", color: "#D97706", padding: "2px 7px", borderRadius: 4,
                      whiteSpace: "nowrap",
                    }}>Lesson {u.period_index + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--slate-900)" }}>{u.teacher_name}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--slate-400)" }}>
                        {u.subject_name ? `${u.subject_name} · ${u.class_name}` : "Absent — no substitute assigned"}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQaExpand(u); }}
                      style={{
                        padding: "5px 12px", background: isExpanded ? "var(--slate-200)" : "#5B4EE8", color: isExpanded ? "var(--slate-700)" : "#fff", border: "none", borderRadius: 6,
                        fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >{isExpanded ? "Close" : "Quick Assign"}</button>
                  </div>
                  {/* Inline free teachers panel */}
                  {isExpanded && (
                    <div style={{ padding: "8px 18px 12px", background: "#FAFBFE", borderBottom: "1px solid #FEE8EB" }}>
                      {qaFree.length === 0 ? (
                        <div style={{ fontSize: "0.75rem", color: "var(--slate-400)", padding: "8px 0" }}>No free teachers available for this lesson.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--slate-400)", textTransform: "uppercase", marginBottom: 2 }}>
                            {qaFree.length} teachers available · Click to assign
                          </div>
                          {qaFree.slice(0, 5).map(ft => (
                            <div key={ft.teacher_id} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "6px 10px", borderRadius: 8,
                              background: ft.best_fit ? "#EEF2FF" : "#fff",
                              border: ft.best_fit ? "1.5px solid #818CF8" : "1px solid var(--slate-200)",
                              cursor: qaAssigning ? "wait" : "pointer",
                            }} onClick={() => !qaAssigning && handleQaAssign(u, ft)}>
                              <div style={{
                                width: 26, height: 26, borderRadius: "50%", background: av(ft.teacher_id),
                                fontSize: "0.55rem", fontWeight: 700, color: "#fff",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              }}>{ft.teacher_name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--slate-900)", display: "flex", alignItems: "center", gap: 5 }}>
                                  {ft.teacher_name}
                                  {ft.best_fit && <span style={{ fontSize: "0.55rem", fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "#4F46E5", color: "#fff" }}>Best fit</span>}
                                  {ft.sub_limit_reached && <span style={{ fontSize: "0.55rem", fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "#FEF3C7", color: "#B45309" }}>At limit</span>}
                                </div>
                                <div style={{ fontSize: "0.62rem", color: "var(--slate-400)" }}>
                                  {ft.subject || ""} · {ft.periods_today} lessons today · {ft.subs_this_week}/2 subs
                                </div>
                              </div>
                            </div>
                          ))}
                          {qaFree.length > 5 && (
                            <Link to={`/project/${pid}/substitutions`} style={{ fontSize: "0.68rem", color: "#5B4EE8", fontWeight: 600, textAlign: "center", padding: "4px 0" }}>
                              View all {qaFree.length} teachers →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ BODY GRID: Chart + Subs + Activity ═══ */}
      <div className="pd-body-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 14 }}>

        {/* ── Workload Chart ── */}
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden", maxHeight: 420, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: "1px solid var(--slate-50)" }}>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--slate-900)" }}>Weekly workload — lessons per teacher</div>
              <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 1 }}>Sorted highest to lowest · orange = substitution · red = over limit</div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[{ c: "#5B4EE8", l: "Sched" }, { c: "#F06830", l: "Sub" }, { c: "#D97706", l: "Over" }].map(x => (
                <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.6rem", color: "var(--slate-400)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, display: "inline-block" }} />{x.l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding: "16px 18px 12px" }}>
            {wChart.length > 0 ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 100 }}>
                {wChart.map((w, i) => {
                  const h = (w.total / chartMax) * 90;
                  const isOver = w.utilization_pct > 100;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                      <span style={{ fontSize: "0.55rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: isOver ? "#D97706" : "var(--slate-400)" }}>{w.total}</span>
                      <div style={{ width: "100%", borderRadius: "4px 4px 0 0", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
                        <div className="wl-bar" style={{ height: Math.max(h - (w.substitutions / chartMax * 90), 4), background: isOver ? "#D97706" : "#5B4EE8" }} />
                        {w.substitutions > 0 && <div className="wl-bar" style={{ height: (w.substitutions / chartMax * 90), background: "#F06830" }} />}
                      </div>
                      <span style={{ fontSize: "0.5rem", color: "var(--slate-400)", fontFamily: "var(--font-mono)" }}>{w.initials}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--slate-400)", fontSize: "0.78rem" }}>Generate a timetable to see data</div>
            )}
          </div>

          {/* Donut */}
          <div style={{ borderTop: "1px solid var(--slate-100)", display: "flex", alignItems: "center", gap: 16, padding: "12px 18px" }}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
              <circle cx="40" cy="40" r="30" fill="none" stroke={isDark ? "#334155" : "#E4E8F2"} strokeWidth="12" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#0EA875" strokeWidth="12"
                strokeDasharray={`${d.is_off_day ? 0 : pDash} ${188.5 - (d.is_off_day ? 0 : pDash)}`}
                strokeDashoffset="0" transform="rotate(-90 40 40)" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#D97706" strokeWidth="12"
                strokeDasharray={`${d.is_off_day ? 0 : aDash} ${188.5 - (d.is_off_day ? 0 : aDash)}`}
                strokeDashoffset={`${-(d.is_off_day ? 0 : pDash)}`} transform="rotate(-90 40 40)" />
              <text x="40" y="37" textAnchor="middle" fontSize="13" fontWeight="800" fill={isDark ? "#E2E8F0" : "#0D1117"} fontFamily="var(--font-mono)">{s.total_teachers}</text>
              <text x="40" y="50" textAnchor="middle" fontSize="9" fill={isDark ? "#94A3B8" : "#6B7594"}>teachers</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { c: "#0EA875", l: "Present", v: d.is_off_day ? "—" : s.present_today },
                { c: "#D97706", l: "Absent", v: d.is_off_day ? "—" : s.absent_today },
                { c: "#5B4EE8", l: curLesson ? `Busy L${curLesson.lesson_number}` : "Busy", v: d.is_off_day ? "—" : s.busy_now },
                { c: "#0EA875", l: curLesson ? `Free L${curLesson.lesson_number}` : "Free", v: d.is_off_day ? "—" : s.free_now },
              ].map(x => (
                <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--slate-500)", fontWeight: 500 }}>{x.l}</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--slate-900)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden", maxHeight: 420, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: "1px solid var(--slate-50)" }}>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--slate-900)" }}>Substitutions today</div>
              <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 1 }}>Assigned coverage</div>
            </div>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#FEF0E8", color: "#8A3200", padding: "3px 9px", borderRadius: 20 }}>{subs.length} assigned</span>
          </div>

          {(
            <div className="scroll-on-hover" style={{ flex: 1 }}>
              {subs.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--slate-400)", fontSize: "0.78rem" }}>No substitutions assigned</div>
              ) : subs.map((sub, i) => (
                <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: i < subs.length - 1 ? "1px solid var(--slate-50)" : "none" }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", background: av(i),
                    fontSize: "0.6rem", fontWeight: 700, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{sub.sub_teacher_initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{sub.sub_teacher_name}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 2 }}>
                      Covering <strong>{sub.absent_teacher_name}</strong> · {sub.subject_name} · {sub.class_name}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 700,
                    background: "#ECEAFD", color: "#3D32B0", padding: "2px 7px", borderRadius: 4,
                  }}>Lesson {sub.period_index + 1}</span>
                </div>
              ))}
              {uncovered > 0 && (
                <div style={{ padding: "10px 18px", background: "#FEF3C7", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706" }} />
                  <span style={{ fontSize: "0.68rem", color: "#78350F", fontWeight: 600 }}>
                    {uncovered} lesson{uncovered !== 1 ? "s" : ""} still unassigned
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Activity Feed ── */}
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden", maxHeight: 420, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: "1px solid var(--slate-50)" }}>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--slate-900)" }}>Recent activity</div>
              <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 1 }}>Live updates</div>
            </div>
            <span className="live-indicator" />
          </div>
          <div className="scroll-on-hover" style={{ flex: 1 }}>
            {subs.map(sub => (
              <div key={`s${sub.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--slate-50)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0EA875", flexShrink: 0, marginTop: 3 }} />
                  <div style={{ width: 1, background: "var(--slate-200)", flex: 1, minHeight: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--slate-600)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--slate-900)" }}>{sub.sub_teacher_name}</strong> assigned Lesson {sub.period_index + 1} for {sub.absent_teacher_name}
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--slate-400)", marginTop: 2, fontFamily: "var(--font-mono)" }}>Today</div>
                </div>
              </div>
            ))}
            {absent.map(a => (
              <div key={`a${a.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--slate-50)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#D97706", flexShrink: 0, marginTop: 3 }} />
                  <div style={{ width: 1, background: "var(--slate-200)", flex: 1, minHeight: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--slate-600)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--slate-900)" }}>{a.teacher_name}</strong> marked absent · {a.reason || "No reason"}
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--slate-400)", marginTop: 2, fontFamily: "var(--font-mono)" }}>Today</div>
                </div>
              </div>
            ))}
            {subs.length === 0 && absent.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--slate-400)", fontSize: "0.78rem" }}>No activity today</div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ WIDGETS ROW ═══ */}
      <div className="pd-body-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 14 }}>

        {/* ── Calendar Widget ── */}
        {(() => {
          const now = new Date();
          const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
          const firstDay = new Date(calYear, calMonth, 1).getDay();
          const monthName = new Date(calYear, calMonth).toLocaleString("default", { month: "long", year: "numeric" });
          const today = now.getDate();
          const isCurrentMonth = calMonth === now.getMonth() && calYear === now.getFullYear();
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); };
          const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); };
          return (
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--slate-50)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--slate-900)" }}>Calendar</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 1 }}>School schedule overview</div>
                </div>
                <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "0.65rem", fontWeight: 600, color: "#4285F4", textDecoration: "none" }}>
                  Google Calendar ↗
                </a>
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--slate-500)", padding: "2px 8px" }}>‹</button>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--slate-800)" }}>{monthName}</span>
                  <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--slate-500)", padding: "2px 8px" }}>›</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center", marginBottom: 4 }}>
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                    <div key={d} style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--slate-400)", padding: "2px 0", textTransform: "uppercase" }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
                  {cells.map((day, i) => {
                    const isToday = isCurrentMonth && day === today;
                    const isWeekend = i % 7 === 0 || i % 7 === 6;
                    return (
                      <div key={i} style={{
                        fontSize: "0.72rem", fontWeight: isToday ? 800 : 500,
                        color: day == null ? "transparent" : isToday ? "#fff" : isWeekend ? "var(--slate-400)" : "var(--slate-700)",
                        background: isToday ? "#4285F4" : "transparent",
                        borderRadius: "50%", width: 28, height: 28, lineHeight: "28px",
                        margin: "0 auto",
                      }}>
                        {day ?? ""}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "#EEF2FF", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4285F4", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--slate-700)" }}>
                    Today: {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── To-Do Widget ── */}
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--slate-50)" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--slate-900)" }}>To-Do</div>
            <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 1 }}>{tasks.filter(t => !t.completed).length} pending tasks</div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--slate-100)" }}>
            {(["today", "week", "month"] as const).map(f => (
              <button key={f} onClick={() => setTodoFilter(f)} style={{
                flex: 1, padding: "8px 0", border: "none", background: todoFilter === f ? "var(--slate-50)" : "transparent",
                fontSize: "0.68rem", fontWeight: todoFilter === f ? 700 : 500,
                color: todoFilter === f ? "#5B4EE8" : "var(--slate-400)",
                borderBottom: todoFilter === f ? "2px solid #5B4EE8" : "2px solid transparent",
                cursor: "pointer", textTransform: "capitalize",
              }}>
                {f === "today" ? "Today" : f === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>

          {/* Add task form */}
          <div style={{ display: "flex", gap: 6, padding: "10px 14px", borderBottom: "1px solid var(--slate-50)", flexWrap: "wrap" }}>
            <input
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTask()}
              placeholder="Task title..."
              style={{
                flex: 1, minWidth: 100, fontSize: "0.72rem", padding: "6px 10px", borderRadius: 6,
                border: "1px solid var(--slate-200)", outline: "none", color: "var(--slate-900)",
                background: "var(--slate-50)",
              }}
            />
            <input
              type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              style={{
                fontSize: "0.68rem", padding: "6px 8px", borderRadius: 6,
                border: "1px solid var(--slate-200)", outline: "none", color: "var(--slate-600)",
                background: "var(--slate-50)", width: 110,
              }}
            />
            <select
              value={newPriority} onChange={e => setNewPriority(e.target.value as "high" | "medium" | "low")}
              style={{
                fontSize: "0.68rem", padding: "6px 8px", borderRadius: 6,
                border: "1px solid var(--slate-200)", outline: "none", color: "var(--slate-600)",
                background: "var(--slate-50)",
              }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button onClick={addTask} style={{
              fontSize: "0.68rem", fontWeight: 700, padding: "6px 14px", borderRadius: 6,
              background: "#5B4EE8", color: "#fff", border: "none", cursor: "pointer",
            }}>Add</button>
          </div>

          {/* Task list */}
          <div style={{ flex: 1, maxHeight: 220, overflowY: "auto" }}>
            {filteredTasks.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--slate-400)", fontSize: "0.75rem" }}>
                No tasks for {todoFilter === "today" ? "today" : todoFilter === "week" ? "this week" : "this month"}
              </div>
            ) : filteredTasks.map(t => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                borderBottom: "1px solid var(--slate-50)",
                opacity: t.completed ? 0.5 : 1,
              }}>
                <div
                  onClick={() => toggleTask(t.id)}
                  style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer",
                    border: t.completed ? "none" : "2px solid var(--slate-300)",
                    background: t.completed ? "#0EA875" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {t.completed && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.75rem", fontWeight: 600, color: "var(--slate-900)",
                    textDecoration: t.completed ? "line-through" : "none",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{t.title}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--slate-400)", marginTop: 1, fontFamily: "var(--font-mono)" }}>
                    {t.due_date}
                  </div>
                </div>
                <span style={{
                  fontSize: "0.55rem", fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                  background: t.priority === "high" ? "#FEF3C7" : t.priority === "medium" ? "#FEF3DC" : "#E8FAF4",
                  color: t.priority === "high" ? "#D97706" : t.priority === "medium" ? "#8A5A00" : "#076644",
                }}>{t.priority}</span>
                <button onClick={() => deleteTask(t.id)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                  color: "var(--slate-300)", fontSize: "0.75rem", lineHeight: 1,
                }} title="Delete task">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Teacher Attendance Pie Chart ── */}
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--slate-50)" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--slate-900)" }}>Teacher Attendance</div>
            <div style={{ fontSize: "0.68rem", color: "var(--slate-400)", marginTop: 1 }}>Daily presence overview</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 18px 16px", gap: 14 }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="52" fill="none" stroke={isDark ? "#334155" : "#E4E8F2"} strokeWidth="18" />
              <circle cx="70" cy="70" r="52" fill="none" stroke="#0EA875" strokeWidth="18"
                strokeDasharray={`${(s.present_today / (s.total_teachers || 1)) * 326.7} ${326.7 - (s.present_today / (s.total_teachers || 1)) * 326.7}`}
                strokeDashoffset="0" transform="rotate(-90 70 70)" strokeLinecap="round" />
              <circle cx="70" cy="70" r="52" fill="none" stroke="#D97706" strokeWidth="18"
                strokeDasharray={`${(s.absent_today / (s.total_teachers || 1)) * 326.7} ${326.7 - (s.absent_today / (s.total_teachers || 1)) * 326.7}`}
                strokeDashoffset={`${-((s.present_today / (s.total_teachers || 1)) * 326.7)}`}
                transform="rotate(-90 70 70)" strokeLinecap="round" />
              <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="800" fill={isDark ? "#E2E8F0" : "#0D1117"} fontFamily="var(--font-mono)">{s.total_teachers}</text>
              <text x="70" y="82" textAnchor="middle" fontSize="10" fill={isDark ? "#94A3B8" : "#6B7594"}>teachers</text>
            </svg>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              {[
                { c: "#0EA875", l: "Present", v: d.is_off_day ? "—" : s.present_today, pct: d.is_off_day ? "—" : `${Math.round((s.present_today / (s.total_teachers || 1)) * 100)}%` },
                { c: "#D97706", l: "Absent", v: d.is_off_day ? "—" : s.absent_today, pct: d.is_off_day ? "—" : `${Math.round((s.absent_today / (s.total_teachers || 1)) * 100)}%` },
              ].map(x => (
                <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--slate-500)", fontWeight: 500 }}>{x.l}</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--slate-900)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>{x.v}</span>
                  <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--slate-400)", fontFamily: "var(--font-mono)", width: 32, textAlign: "right" }}>{x.pct}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 4, padding: "8px 14px", background: "var(--slate-50)", borderRadius: 8, width: "100%",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: "0.68rem", color: "var(--slate-400)", fontWeight: 500 }}>Total scheduled lessons</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#5B4EE8", fontFamily: "var(--font-mono)" }}>{s.total_lessons}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
