import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

/* ── Modular tab components ── */
import SubjectsTab from "./tabs/SubjectsTab";
import ClassesTab from "./tabs/ClassesTab";
import ClassroomsTab from "./tabs/ClassroomsTab";
import TeachersTab from "./tabs/TeachersTab";
import LessonsTab from "./tabs/LessonsTab";
import ConstraintsTab from "./tabs/ConstraintsTab";

type Tab = "settings" | "subjects" | "classes" | "rooms" | "teachers" | "lessons" | "constraints";
const TAB_SEGMENTS: Tab[] = ["settings", "subjects", "classes", "rooms", "teachers", "lessons", "constraints"];

export default function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const segment = location.pathname.split("/").filter(Boolean).pop() as string | undefined;
  const tab: Tab = TAB_SEGMENTS.includes(segment as Tab) ? (segment as Tab) : "settings";
  const pid = Number(projectId);

  /* ── Data state ── */
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.getSchoolSettings>> | null>(null);
  const [subjects, setSubjects] = useState<Awaited<ReturnType<typeof api.listSubjects>>>([]);
  const [classes, setClasses] = useState<Awaited<ReturnType<typeof api.listClasses>>>([]);
  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof api.listRooms>>>([]);
  const [teachers, setTeachers] = useState<Awaited<ReturnType<typeof api.listTeachers>>>([]);
  const [lessons, setLessons] = useState<Awaited<ReturnType<typeof api.listLessons>>>([]);
  const [constraints, setConstraints] = useState<Awaited<ReturnType<typeof api.listConstraints>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    if (!pid) return;
    setLoading(true);
    Promise.all([
      api.getSchoolSettings(pid).then(setSettings).catch(() => setSettings(null)),
      api.listSubjects(pid).then(setSubjects),
      api.listClasses(pid).then(setClasses),
      api.listRooms(pid).then(setRooms),
      api.listTeachers(pid).then(setTeachers),
      api.listLessons(pid).then(setLessons),
      api.listConstraints(pid).then(setConstraints),
    ]).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [pid]);

  if (isNaN(pid)) return <div className="container">Invalid project</div>;
  if (loading && !settings && subjects.length === 0) return <div className="container" style={{ padding: "2rem" }}>Loading project data…</div>;

  function navigateTab(seg: string) {
    navigate(`/project/${projectId}/${seg}`);
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      {tab === "settings" && (
        <SettingsTab pid={pid} settings={settings} onSave={() => { api.getSchoolSettings(pid).then(setSettings); }} />
      )}
      {tab === "subjects" && (
        <SubjectsTab pid={pid} subjects={subjects} rooms={rooms} onChange={setSubjects} onNext={() => navigateTab("classes")} />
      )}
      {tab === "classes" && (
        <ClassesTab pid={pid} classes={classes} teachers={teachers} rooms={rooms} onChange={setClasses} onNext={() => navigateTab("rooms")} />
      )}
      {tab === "rooms" && (
        <ClassroomsTab pid={pid} rooms={rooms} onChange={setRooms} onNext={() => navigateTab("teachers")} />
      )}
      {tab === "teachers" && (
        <TeachersTab pid={pid} teachers={teachers} subjects={subjects} onChange={setTeachers} onNext={() => navigateTab("lessons")} />
      )}
      {tab === "lessons" && (
        <LessonsTab pid={pid} lessons={lessons} subjects={subjects} classes={classes} teachers={teachers} onChange={setLessons} onNext={() => navigateTab("constraints")} />
      )}
      {tab === "constraints" && (
        <ConstraintsTab pid={pid} constraints={constraints} teachers={teachers} classes={classes} rooms={rooms} settings={settings ? { days_per_week: settings.days_per_week, periods_per_day: settings.periods_per_day } : null} onChange={setConstraints} onNext={() => navigate(`/project/${projectId}/generate`)} />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════
   Utilities for time computation
   ══════════════════════════════════════════════════ */
function parseTime(t: string): number {
  if (!t || !t.includes(":")) return 8 * 60;
  const [h, m] = t.split(":").map(Number);
  return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
}
function fmtTimeHelper(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ══════════════════════════════════════════════════
   Settings Tab — Bell Schedule with per-lesson durations
   ══════════════════════════════════════════════════ */

interface BreakItem { name: string; after_period: number; duration_minutes: number; }
type ScheduleRow = { type: "lesson" | "break"; index: number; start: string; end: string; duration: number; name?: string };

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) for (let m = 0; m < 60; m += 5) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
const DURATION_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90];
const BREAK_DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];

/** Compute the full schedule from inputs — auto-cascading times */
function computeSchedule(
  numPeriods: number, startTime: string, defDur: number,
  durations: number[], brks: BreakItem[]
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let current = parseTime(startTime);
  const breakMap: Record<number, BreakItem> = {};
  for (const b of brks) breakMap[b.after_period] = b;

  for (let p = 0; p < numPeriods; p++) {
    const dur = (p < durations.length && durations[p]) ? durations[p] : defDur;
    rows.push({ type: "lesson", index: p + 1, start: fmtTimeHelper(current), end: fmtTimeHelper(current + dur), duration: dur });
    current += dur;
    const brk = breakMap[p + 1];
    if (brk) {
      rows.push({ type: "break", index: -1, start: fmtTimeHelper(current), end: fmtTimeHelper(current + brk.duration_minutes), duration: brk.duration_minutes, name: brk.name || "Break" });
      current += brk.duration_minutes;
    }
  }
  return rows;
}

/** Interactive schedule table */
function ScheduleTable({ rows, editable, onEditDur }: {
  rows: ScheduleRow[];
  editable?: boolean;
  onEditDur?: (lessonIndex: number, val: number) => void;
}) {
  return (
    <table className="data-table" style={{ marginTop: "0.75rem", maxWidth: 540 }}>
      <thead><tr>
        <th style={{ width: 36 }}>#</th>
        <th>Type</th>
        <th style={{ width: 70 }}>Start</th>
        <th style={{ width: 70 }}>End</th>
        <th style={{ width: 120 }}>Duration</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={r.type === "break" ? { background: "#f0fdf4" } : undefined}>
            <td style={{ color: r.type === "break" ? "#16a34a" : undefined, fontWeight: 600, textAlign: "center" }}>
              {r.type === "lesson" ? r.index : "☕"}
            </td>
            <td style={{ fontWeight: 500 }}>
              {r.type === "lesson" ? `Lesson ${r.index}` : (r.name || "Break")}
            </td>
            <td style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{r.start}</td>
            <td style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{r.end}</td>
            <td>
              {editable && r.type === "lesson" && onEditDur ? (
                <select
                  value={r.duration}
                  onChange={e => onEditDur(r.index - 1, Number(e.target.value))}
                  style={{ width: 100, fontSize: "0.82rem" }}
                >
                  {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              ) : (
                <span style={{ color: r.type === "break" ? "#16a34a" : undefined }}>{r.duration} min</span>
              )}
            </td>
          </tr>
        ))}
        {rows.length > 0 && (
          <tr style={{ borderTop: "2px solid #e2e8f0" }}>
            <td colSpan={3} style={{ fontWeight: 600, fontSize: "0.9rem" }}>🏫 School ends</td>
            <td style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem" }}>{rows[rows.length - 1].end}</td>
            <td></td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function SettingsTab({
  pid,
  settings,
  onSave,
}: {
  pid: number;
  settings: Awaited<ReturnType<typeof api.getSchoolSettings>> | null;
  onSave: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // ── School info ──
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  // ── Schedule structure ──
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);

  // ── Bell schedule ──
  const [defaultDuration, setDefaultDuration] = useState(45);
  const [firstPeriodStart, setFirstPeriodStart] = useState("08:30");
  const [lessonDurations, setLessonDurations] = useState<number[]>([]);
  const [zeroPeroid, setZeroPeriod] = useState(false);
  const [schoolStartTime, setSchoolStartTime] = useState("08:00");

  // ── Breaks ──
  const [numBreaks, setNumBreaks] = useState(0);
  const [breaks, setBreaks] = useState<BreakItem[]>([]);

  // ── Exceptional day ──
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [fridayDifferent, setFridayDifferent] = useState(false);
  const [fridayDayIndex, setFridayDayIndex] = useState(4);
  const [fridayFirstPeriodStart, setFridayFirstPeriodStart] = useState("08:10");
  const [fridayDefaultDuration, setFridayDefaultDuration] = useState(40);
  const [fridayPeriodsPerDay, setFridayPeriodsPerDay] = useState(0); // 0 = same as regular
  const [fridayLessonDurations, setFridayLessonDurations] = useState<number[]>([]);
  const [fridayNumBreaks, setFridayNumBreaks] = useState(0);
  const [fridayBreaks, setFridayBreaks] = useState<BreakItem[]>([]);

  // ── Weekend ──
  const [weekendDays, setWeekendDays] = useState<Set<number>>(new Set([5, 6]));

  // ── Load from settings ──
  useEffect(() => {
    if (!settings) return;
    setName(settings.name || "");
    setAcademicYear(settings.academic_year || "");
    setDaysPerWeek(settings.days_per_week);
    setPeriodsPerDay(settings.periods_per_day);
    setDefaultDuration((settings as Record<string, unknown>).period_duration_minutes as number || 45);
    setSchoolStartTime((settings as Record<string, unknown>).school_start_time as string || "08:00");
    try {
      const bell = JSON.parse(settings.bell_schedule_json || "{}");
      if (typeof bell === "object" && !Array.isArray(bell)) {
        setFirstPeriodStart(bell.first_period_start || "08:30");
        setZeroPeriod(!!bell.zero_period);
        if (Array.isArray(bell.lesson_durations)) setLessonDurations(bell.lesson_durations);
        setFridayDifferent(!!bell.friday_different);
        setFridayDayIndex(bell.friday_day_index ?? 4);
        setFridayFirstPeriodStart(bell.friday_first_period_start || "08:10");
        setFridayDefaultDuration(bell.friday_default_duration || 40);
        setFridayPeriodsPerDay(bell.friday_periods_per_day ?? 0);
        if (Array.isArray(bell.friday_lesson_durations)) setFridayLessonDurations(bell.friday_lesson_durations);
      }
    } catch { /* ignore */ }
    try {
      const parsed = JSON.parse((settings as Record<string, unknown>).breaks_json as string || "[]");
      if (Array.isArray(parsed)) {
        const regular = parsed.filter((b: BreakItem & { is_friday?: boolean }) => !b.is_friday);
        const friday = parsed.filter((b: BreakItem & { is_friday?: boolean }) => b.is_friday);
        setNumBreaks(regular.length);
        setBreaks(regular.map((b: BreakItem) => ({ name: b.name || "", after_period: b.after_period ?? 2, duration_minutes: b.duration_minutes || 20 })));
        setFridayNumBreaks(friday.length);
        setFridayBreaks(friday.map((b: BreakItem) => ({ name: b.name || "", after_period: b.after_period ?? 3, duration_minutes: b.duration_minutes || 20 })));
      }
    } catch { /* ignore */ }
    const wd = (settings as Record<string, unknown>).weekend_days as string || "5,6";
    setWeekendDays(new Set(wd.split(",").filter(Boolean).map(Number)));
  }, [settings]);

  // Sync break array length
  useEffect(() => { setBreaks(prev => { if (prev.length < numBreaks) { const a = [...prev]; for (let i = prev.length; i < numBreaks; i++) a.push({ name: i === 0 ? "Short Break" : "Lunch Break", after_period: i + 2, duration_minutes: 20 }); return a; } return prev.slice(0, numBreaks); }); }, [numBreaks]);
  useEffect(() => { setFridayBreaks(prev => { if (prev.length < fridayNumBreaks) { const a = [...prev]; for (let i = prev.length; i < fridayNumBreaks; i++) a.push({ name: "Break", after_period: i + 2, duration_minutes: 20 }); return a; } return prev.slice(0, fridayNumBreaks); }); }, [fridayNumBreaks]);

  function updateBreak(i: number, f: keyof BreakItem, v: string | number) { setBreaks(prev => prev.map((b, idx) => idx === i ? { ...b, [f]: v } : b)); }
  function updateFridayBreak(i: number, f: keyof BreakItem, v: string | number) { setFridayBreaks(prev => prev.map((b, idx) => idx === i ? { ...b, [f]: v } : b)); }
  function toggleWeekend(d: number) { setWeekendDays(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; }); }

  // ── Compute schedules ──
  const schedule = computeSchedule(periodsPerDay, firstPeriodStart, defaultDuration, lessonDurations, breaks);
  const schoolEnd = schedule.length > 0 ? schedule[schedule.length - 1].end : firstPeriodStart;

  const fridayPeriodCount = fridayPeriodsPerDay > 0 ? fridayPeriodsPerDay : periodsPerDay;
  const fridaySchedule = fridayDifferent
    ? computeSchedule(fridayPeriodCount, fridayFirstPeriodStart, fridayDefaultDuration, fridayLessonDurations, fridayBreaks)
    : [];
  const fridayEnd = fridaySchedule.length > 0 ? fridaySchedule[fridaySchedule.length - 1].end : "";

  function setLessonDur(index: number, val: number) {
    setLessonDurations(prev => {
      const arr = [...prev];
      while (arr.length < periodsPerDay) arr.push(0);
      arr[index] = val;
      return arr;
    });
  }
  function setFridayLessonDur(index: number, val: number) {
    setFridayLessonDurations(prev => {
      const arr = [...prev];
      while (arr.length < periodsPerDay) arr.push(0);
      arr[index] = val;
      return arr;
    });
  }

  async function save(andNext?: boolean) {
    setSaving(true);
    try {
      const bellSchedule = JSON.stringify({
        first_period_start: firstPeriodStart,
        default_duration: defaultDuration,
        lesson_durations: lessonDurations,
        zero_period: zeroPeroid,
        friday_different: fridayDifferent,
        friday_day_index: fridayDayIndex,
        friday_first_period_start: fridayFirstPeriodStart,
        friday_default_duration: fridayDefaultDuration,
        friday_periods_per_day: fridayPeriodsPerDay > 0 ? fridayPeriodsPerDay : periodsPerDay,
        friday_lesson_durations: fridayLessonDurations,
      });
      const allBreaks = [
        ...breaks.map(b => ({ ...b, is_friday: false })),
        ...(fridayDifferent ? fridayBreaks.map(b => ({ ...b, is_friday: true })) : []),
      ];
      const weekendStr = Array.from(weekendDays).sort().join(",");
      await api.updateSchoolSettings(pid, {
        name, academic_year: academicYear,
        days_per_week: daysPerWeek, periods_per_day: periodsPerDay,
        period_duration_minutes: defaultDuration,
        school_start_time: schoolStartTime,
        school_end_time: schoolEnd,
        bell_schedule_json: bellSchedule,
        breaks_json: JSON.stringify(allBreaks),
        weekend_days: weekendStr,
        ...(fridayDifferent ? { friday_start_time: fridayFirstPeriodStart, friday_end_time: fridayEnd } : { friday_start_time: null, friday_end_time: null }),
      });
      onSave();
      toast("success", "School settings saved.");
      if (andNext) navigate(`/project/${pid}/subjects`);
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  const inputNarrow: React.CSSProperties = { width: 100, maxWidth: 100 };

  return (
    <div className="settings-card">
      <h2>School Settings</h2>
      <p className="subheading">Configure your school's basic information and schedule structure.</p>

      {/* ═══ SCHOOL INFO ═══ */}
      <h3 className="settings-section-title">School Information</h3>
      <div className="settings-field"><label className="settings-label required">School Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Islamabad Model School" /></div>
      <div className="settings-field"><label className="settings-label">Academic Year</label><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2025-2026" /></div>

      {/* ═══ SCHEDULE STRUCTURE ═══ */}
      <div className="settings-section">
        <h3 className="settings-section-title">Schedule Structure</h3>
        <div className="settings-field"><label className="settings-label">Working Days per Week</label><select value={daysPerWeek} onChange={e => setDaysPerWeek(Number(e.target.value))} style={inputNarrow}>{[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
        <div className="settings-field"><label className="settings-label">Lessons per Day</label><select value={periodsPerDay} onChange={e => setPeriodsPerDay(Number(e.target.value))} style={inputNarrow}>{Array.from({length:16},(_,i) => <option key={i} value={i}>{i}</option>)}</select></div>
      </div>

      {/* ═══ BELL SCHEDULE ═══ */}
      <div className="settings-section">
        <h3 className="settings-section-title">Bell Schedule — Lesson Timing</h3>
        <div className="settings-field"><label className="settings-label">School start time</label><select value={schoolStartTime} onChange={e => setSchoolStartTime(e.target.value)} style={{width:120}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="settings-field"><label className="settings-label">First lesson starts at</label><select value={firstPeriodStart} onChange={e => setFirstPeriodStart(e.target.value)} style={{width:120}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="settings-field"><label className="settings-label">Default lesson duration</label><select value={defaultDuration} onChange={e => setDefaultDuration(Number(e.target.value))} style={inputNarrow}>{DURATION_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}</select></div>
        <div className="settings-hint"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={zeroPeroid} onChange={e => setZeroPeriod(e.target.checked)} style={{width:"auto",accentColor:"#3b82f6"}} />Include zero lesson (class teacher time: school start → first lesson)</label></div>
      </div>

      {/* ═══ BREAKS ═══ */}
      <div className="settings-section">
        <h3 className="settings-section-title">Breaks</h3>
        <div className="settings-field"><label className="settings-label">Number of breaks</label><select value={numBreaks} onChange={e => setNumBreaks(Number(e.target.value))} style={inputNarrow}>{Array.from({length:10},(_,i) => <option key={i} value={i}>{i}</option>)}</select></div>
        {breaks.map((b, i) => (
          <div key={i} className="break-card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", padding: "0.75rem 1rem", marginBottom: "0.5rem" }}>
            <span style={{ fontWeight: 600, minWidth: 65, color: "#16a34a" }}>☕ Break {i + 1}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>After lesson</span>
              <select value={b.after_period} onChange={e => updateBreak(i, "after_period", Number(e.target.value))} style={{ width: 56 }}>
                {Array.from({length: periodsPerDay}, (_, p) => <option key={p+1} value={p+1}>{p+1}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Duration</span>
              <select value={b.duration_minutes} onChange={e => updateBreak(i, "duration_minutes", Number(e.target.value))} style={{ width: 78 }}>
                {BREAK_DURATION_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Name</span>
              <input value={b.name} onChange={e => updateBreak(i, "name", e.target.value)} placeholder="Short Break" style={{ width: 140 }} />
            </div>
          </div>
        ))}
        <p className="settings-hint" style={{ marginTop: 8 }}>Break times are computed automatically based on lesson durations. No manual time entry needed.</p>
      </div>

      {/* ═══ AUTO-COMPUTED SCHEDULE TABLE ═══ */}
      {periodsPerDay > 0 && (
        <div className="settings-section">
          <h3 className="settings-section-title">📋 Regular Day Schedule</h3>
          <p className="settings-hint" style={{ marginBottom: 4 }}>Times auto-calculate. Change any lesson's duration below — all following times adjust automatically.</p>
          <ScheduleTable rows={schedule} editable onEditDur={setLessonDur} />
        </div>
      )}

      {/* ═══ EXCEPTIONAL DAY ═══ */}
      <div className="settings-section">
        <h3 className="friday-section-title">
          <select value={fridayDayIndex} onChange={e => setFridayDayIndex(Number(e.target.value))} style={{width:120,fontWeight:600}}>{DAY_LABELS.map((d,i) => <option key={i} value={i}>{d}</option>)}</select>
          <span> — Different Schedule (Optional)</span>
        </h3>
        <div className="settings-field" style={{marginLeft:20}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontWeight:500,fontSize:"0.875rem"}}><input type="checkbox" checked={fridayDifferent} onChange={e => setFridayDifferent(e.target.checked)} style={{width:"auto",accentColor:"#f59e0b"}} />{DAY_LABELS[fridayDayIndex]} has different timing</label>
        </div>
        {fridayDifferent && (
          <div style={{marginLeft:20,marginTop:"0.75rem"}}>
            <div className="settings-field"><label className="settings-label">{DAY_LABELS[fridayDayIndex]} lessons per day</label><select value={fridayPeriodsPerDay || periodsPerDay} onChange={e => setFridayPeriodsPerDay(Number(e.target.value))} style={inputNarrow}>{Array.from({length:16},(_,i) => <option key={i} value={i}>{i}{i === periodsPerDay ? " (same)" : ""}</option>)}</select></div>
            <div className="settings-field"><label className="settings-label">{DAY_LABELS[fridayDayIndex]} first lesson starts at</label><select value={fridayFirstPeriodStart} onChange={e => setFridayFirstPeriodStart(e.target.value)} style={{width:120}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="settings-field"><label className="settings-label">{DAY_LABELS[fridayDayIndex]} default lesson duration</label><select value={fridayDefaultDuration} onChange={e => setFridayDefaultDuration(Number(e.target.value))} style={inputNarrow}>{DURATION_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}</select></div>
            <div className="settings-field"><label className="settings-label">{DAY_LABELS[fridayDayIndex]} breaks</label><select value={fridayNumBreaks} onChange={e => setFridayNumBreaks(Number(e.target.value))} style={inputNarrow}>{Array.from({length:10},(_,i) => <option key={i} value={i}>{i}</option>)}</select></div>
            {fridayBreaks.map((b, i) => (
              <div key={i} className="break-card-friday" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", padding: "0.75rem 1rem", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 600, minWidth: 90, color: "#d97706" }}>☕ {DAY_LABELS[fridayDayIndex]} Break {i + 1}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: "0.82rem" }}>After lesson</span>
                  <select value={b.after_period} onChange={e => updateFridayBreak(i, "after_period", Number(e.target.value))} style={{ width: 56 }}>
                    {Array.from({length: periodsPerDay}, (_, p) => <option key={p+1} value={p+1}>{p+1}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: "0.82rem" }}>Duration</span>
                  <select value={b.duration_minutes} onChange={e => updateFridayBreak(i, "duration_minutes", Number(e.target.value))} style={{ width: 78 }}>
                    {BREAK_DURATION_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: "0.82rem" }}>Name</span>
                  <input value={b.name} onChange={e => updateFridayBreak(i, "name", e.target.value)} placeholder="Break" style={{ width: 120 }} />
                </div>
              </div>
            ))}
            {periodsPerDay > 0 && (
              <>
                <h4 style={{ marginTop: "1rem", marginBottom: 4, fontWeight: 600 }}>📋 {DAY_LABELS[fridayDayIndex]} Schedule</h4>
                <ScheduleTable rows={fridaySchedule} editable onEditDur={setFridayLessonDur} />
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ WEEKEND DAYS ═══ */}
      <div className="settings-section">
        <h3 className="settings-section-title">Weekend Days</h3>
        <div className="weekend-row">
          {DAY_LABELS.map((day, i) => (
            <label key={i} className={`weekend-checkbox${weekendDays.has(i) ? " checked" : ""}`}>
              <input type="checkbox" checked={weekendDays.has(i)} onChange={() => toggleWeekend(i)} style={{width:"auto"}} />{day}
            </label>
          ))}
        </div>
      </div>

      {/* ═══ SAVE FOOTER ═══ */}
      <div className="settings-footer">
        <button type="button" className="btn btn-primary" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "💾 Save Settings"}</button>
        <button type="button" className="btn" onClick={() => save(true)} disabled={saving}>Next: Subjects →</button>
      </div>
    </div>
  );
}
