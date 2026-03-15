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
        <TeachersTab pid={pid} teachers={teachers} onChange={setTeachers} onNext={() => navigateTab("lessons")} />
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
   Utilities for time validation
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
   Settings Tab — kept inline
   ══════════════════════════════════════════════════ */

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

  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [periodDuration, setPeriodDuration] = useState(45);
  const [schoolStartTime, setSchoolStartTime] = useState("08:00");
  const [firstPeriodStart, setFirstPeriodStart] = useState("08:30");
  const [zeroPeroid, setZeroPeriod] = useState(false);

  interface BreakItem { name: string; start: string; end: string; after_period: number; duration_minutes: number; }
  const [numBreaks, setNumBreaks] = useState(0);
  const [breaks, setBreaks] = useState<BreakItem[]>([]);
  const [fridayDifferent, setFridayDifferent] = useState(false);
  const [fridayDayIndex, setFridayDayIndex] = useState(4);
  const [fridayFirstPeriodStart, setFridayFirstPeriodStart] = useState("08:10");
  const [fridayPeriodDuration, setFridayPeriodDuration] = useState(50);
  const [fridayNumBreaks, setFridayNumBreaks] = useState(0);
  const [fridayBreaks, setFridayBreaks] = useState<BreakItem[]>([]);
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [weekendDays, setWeekendDays] = useState<Set<number>>(new Set([5, 6]));

  useEffect(() => {
    if (!settings) return;
    setName(settings.name || ""); setAcademicYear(settings.academic_year || "");
    setDaysPerWeek(settings.days_per_week); setPeriodsPerDay(settings.periods_per_day);
    setPeriodDuration((settings as Record<string, unknown>).period_duration_minutes as number || 45);
    setSchoolStartTime((settings as Record<string, unknown>).school_start_time as string || "08:00");
    try {
      const bell = JSON.parse(settings.bell_schedule_json || "{}");
      if (typeof bell === "object" && !Array.isArray(bell)) {
        setFirstPeriodStart(bell.first_period_start || "08:30");
        setZeroPeriod(!!bell.zero_period);
        setFridayDifferent(!!bell.friday_different);
        setFridayDayIndex(bell.friday_day_index ?? 4);
        setFridayFirstPeriodStart(bell.friday_first_period_start || "08:10");
        setFridayPeriodDuration(bell.friday_period_duration || 50);
      }
    } catch { /* ignore */ }
    try {
      const parsed = JSON.parse((settings as Record<string, unknown>).breaks_json as string || "[]");
      if (Array.isArray(parsed)) {
        const regular = parsed.filter((b: BreakItem & { is_friday?: boolean }) => !b.is_friday);
        const friday = parsed.filter((b: BreakItem & { is_friday?: boolean }) => b.is_friday);
        setNumBreaks(regular.length);
        setBreaks(regular.map((b: BreakItem) => ({ name: b.name || "", start: b.start || "10:00", end: b.end || "10:20", after_period: b.after_period || 2, duration_minutes: b.duration_minutes || 20 })));
        setFridayNumBreaks(friday.length);
        setFridayBreaks(friday.map((b: BreakItem) => ({ name: b.name || "", start: b.start || "10:40", end: b.end || "11:00", after_period: b.after_period || 3, duration_minutes: b.duration_minutes || 20 })));
      }
    } catch { /* ignore */ }
    const wd = (settings as Record<string, unknown>).weekend_days as string || "5,6";
    setWeekendDays(new Set(wd.split(",").filter(Boolean).map(Number)));
  }, [settings]);

  useEffect(() => { setBreaks(prev => { if (prev.length < numBreaks) { const a = [...prev]; for (let i = prev.length; i < numBreaks; i++) a.push({ name: "", start: "10:00", end: "10:20", after_period: i + 2, duration_minutes: 20 }); return a; } return prev.slice(0, numBreaks); }); }, [numBreaks]);
  useEffect(() => { setFridayBreaks(prev => { if (prev.length < fridayNumBreaks) { const a = [...prev]; for (let i = prev.length; i < fridayNumBreaks; i++) a.push({ name: "", start: "10:40", end: "11:00", after_period: i + 3, duration_minutes: 20 }); return a; } return prev.slice(0, fridayNumBreaks); }); }, [fridayNumBreaks]);

  function updateBreak(i: number, f: keyof BreakItem, v: string | number) { setBreaks(prev => prev.map((b, idx) => idx === i ? { ...b, [f]: v } : b)); }
  function updateFridayBreak(i: number, f: keyof BreakItem, v: string | number) { setFridayBreaks(prev => prev.map((b, idx) => idx === i ? { ...b, [f]: v } : b)); }
  function toggleWeekend(d: number) { setWeekendDays(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; }); }

  const TIME_OPTIONS: string[] = [];
  for (let h = 6; h <= 23; h++) for (let m = 0; m < 60; m += 5) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  async function save(andNext?: boolean) {
    setSaving(true);
    try {
      const bellSchedule = JSON.stringify({ first_period_start: firstPeriodStart, zero_period: zeroPeroid, friday_different: fridayDifferent, friday_day_index: fridayDayIndex, friday_first_period_start: fridayFirstPeriodStart, friday_period_duration: fridayPeriodDuration });
      const allBreaks = [...breaks.map(b => ({ ...b, is_friday: false })), ...(fridayDifferent ? fridayBreaks.map(b => ({ ...b, is_friday: true })) : [])];
      const weekendStr = Array.from(weekendDays).sort().join(",");
      await api.updateSchoolSettings(pid, { name, academic_year: academicYear, days_per_week: daysPerWeek, periods_per_day: periodsPerDay, bell_schedule_json: bellSchedule, weekend_days: weekendStr });
      await fetch(`/api/projects/${pid}/school-settings`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("timetable_token")}` }, body: JSON.stringify({ period_duration_minutes: periodDuration, school_start_time: schoolStartTime, breaks_json: JSON.stringify(allBreaks) }) });
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

      <h3 className="settings-section-title">School Information</h3>
      <div className="settings-field"><label className="settings-label required">School Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Islamabad Model School" /></div>
      <div className="settings-field"><label className="settings-label">Academic Year</label><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2025-2026" /></div>

      <div className="settings-section">
        <h3 className="settings-section-title">Schedule Structure</h3>
        <div className="settings-field"><label className="settings-label">Working Days per Week</label><select value={daysPerWeek} onChange={e => setDaysPerWeek(Number(e.target.value))} style={inputNarrow}>{[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
        <div className="settings-field"><label className="settings-label">Lessons per Day</label><select value={periodsPerDay} onChange={e => setPeriodsPerDay(Number(e.target.value))} style={inputNarrow}>{Array.from({length:16},(_,i) => <option key={i} value={i}>{i}</option>)}</select></div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Bell Schedule — Lesson Timing</h3>
        <div className="settings-field"><label className="settings-label">Lesson duration (minutes)</label><select value={periodDuration} onChange={e => setPeriodDuration(Number(e.target.value))} style={inputNarrow}>{[25,30,35,40,45,50,55,60,70,80,90].map(m => <option key={m} value={m}>{m} minutes</option>)}</select></div>
        <div className="settings-field"><label className="settings-label">School start time</label><select value={schoolStartTime} onChange={e => setSchoolStartTime(e.target.value)} style={{width:120}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="settings-field"><label className="settings-label">First lesson start time</label><select value={firstPeriodStart} onChange={e => setFirstPeriodStart(e.target.value)} style={{width:120}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="settings-hint"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={zeroPeroid} onChange={e => setZeroPeriod(e.target.checked)} style={{width:"auto",accentColor:"#3b82f6"}} />Include zero lesson (class teacher time: school start → first lesson)</label></div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Breaks</h3>
        <div className="settings-field"><label className="settings-label">Number of breaks (0–9)</label><select value={numBreaks} onChange={e => setNumBreaks(Number(e.target.value))} style={inputNarrow}>{Array.from({length:10},(_,i) => <option key={i} value={i}>{i}</option>)}</select></div>
        {breaks.map((b, i) => {
          // Compute expected break start: first_period_start + sum of period durations + previous break durations
          const fpStart = parseTime(firstPeriodStart);
          let expectedStart = fpStart;
          // after_period is 1-indexed: after_period=2 means after 2 periods
          expectedStart += periodDuration * b.after_period;
          // Add durations of earlier breaks that come before this one
          for (const prev of breaks) {
            if (prev !== b && prev.after_period < b.after_period) {
              expectedStart += (parseTime(prev.end) - parseTime(prev.start));
            }
          }
          const expectedStartStr = fmtTimeHelper(expectedStart);
          const userStart = b.start;
          const userEnd = b.end;
          const startMismatch = userStart && expectedStartStr !== userStart;
          const endBeforeStart = userStart && userEnd && parseTime(userEnd) <= parseTime(userStart);

          return (
            <div key={i}>
              <div className="break-card" style={startMismatch || endBeforeStart ? { border: "2px solid #ef4444", background: "#fef2f2" } : undefined}>
                <div className="break-card-title">Break {i + 1}</div>
                <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>Name</label><input value={b.name} onChange={e => updateBreak(i,"name",e.target.value)} placeholder="e.g. Short Break" style={{width:200}} /></div>
                <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>Start time</label><select value={b.start} onChange={e => updateBreak(i,"start",e.target.value)} style={{width:110, borderColor: startMismatch ? "#ef4444" : undefined}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>End time</label><select value={b.end} onChange={e => updateBreak(i,"end",e.target.value)} style={{width:110, borderColor: endBeforeStart ? "#ef4444" : undefined}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>After lesson</label><select value={b.after_period} onChange={e => updateBreak(i,"after_period",Number(e.target.value))} style={inputNarrow}>{Array.from({length:periodsPerDay},(_,p) => <option key={p+1} value={p+1}>{p+1} (after lesson)</option>)}</select></div>
                {startMismatch && (
                  <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 6, padding: "0.5rem 0.75rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "#dc2626" }}>
                    ⚠️ <strong>Time conflict!</strong> Lesson {b.after_period} ends at <strong>{expectedStartStr}</strong>, but break starts at <strong>{userStart}</strong>.
                    Please set break start time to <strong>{expectedStartStr}</strong>.
                  </div>
                )}
                {endBeforeStart && (
                  <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 6, padding: "0.5rem 0.75rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "#dc2626" }}>
                    ⚠️ <strong>Invalid!</strong> Break end time ({userEnd}) is before or equal to start time ({userStart}).
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <p className="settings-hint">Lesson length (single, double, etc.) is set per lesson in the Lessons tab.</p>
      </div>

      <div className="settings-section">
        <h3 className="friday-section-title">
          <select value={fridayDayIndex} onChange={e => setFridayDayIndex(Number(e.target.value))} style={{width:120,fontWeight:600}}>{DAY_LABELS.map((d,i) => <option key={i} value={i}>{d}</option>)}</select>
          <span>— Different Schedule (Optional)</span>
        </h3>
        <div className="settings-field" style={{marginLeft:20}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontWeight:500,fontSize:"0.875rem"}}><input type="checkbox" checked={fridayDifferent} onChange={e => setFridayDifferent(e.target.checked)} style={{width:"auto",accentColor:"#f59e0b"}} />{DAY_LABELS[fridayDayIndex]} has different timing</label>
        </div>
        {fridayDifferent && (
          <div style={{marginLeft:20,marginTop:"0.75rem"}}>
            <div className="settings-field"><label className="settings-label">{DAY_LABELS[fridayDayIndex]} first lesson start</label><select value={fridayFirstPeriodStart} onChange={e => setFridayFirstPeriodStart(e.target.value)} style={{width:120}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="settings-field"><label className="settings-label">{DAY_LABELS[fridayDayIndex]} lesson duration</label><select value={fridayPeriodDuration} onChange={e => setFridayPeriodDuration(Number(e.target.value))} style={inputNarrow}>{[25,30,35,40,45,50,55,60,70,80,90].map(m => <option key={m} value={m}>{m} minutes</option>)}</select></div>
            <div className="settings-field"><label className="settings-label">{DAY_LABELS[fridayDayIndex]} breaks (0–9)</label><select value={fridayNumBreaks} onChange={e => setFridayNumBreaks(Number(e.target.value))} style={inputNarrow}>{Array.from({length:10},(_,i) => <option key={i} value={i}>{i}</option>)}</select></div>
            {fridayBreaks.map((b, i) => {
              // Compute expected break start using FRIDAY timing
              const fpStart = parseTime(fridayFirstPeriodStart);
              let expectedStart = fpStart;
              expectedStart += fridayPeriodDuration * b.after_period;
              for (const prev of fridayBreaks) {
                if (prev !== b && prev.after_period < b.after_period) {
                  expectedStart += (parseTime(prev.end) - parseTime(prev.start));
                }
              }
              const expectedStartStr = fmtTimeHelper(expectedStart);
              const userStart = b.start;
              const userEnd = b.end;
              const startMismatch = userStart && expectedStartStr !== userStart;
              const endBeforeStart = userStart && userEnd && parseTime(userEnd) <= parseTime(userStart);

              return (
                <div key={i}>
                  <div className="break-card-friday" style={startMismatch || endBeforeStart ? { border: "2px solid #ef4444", background: "#fef2f2" } : undefined}>
                    <div className="break-card-title">{DAY_LABELS[fridayDayIndex]} Break {i + 1}</div>
                    <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>Name</label><input value={b.name} onChange={e => updateFridayBreak(i,"name",e.target.value)} placeholder="e.g. Break" style={{width:200}} /></div>
                    <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>Start time</label><select value={b.start} onChange={e => updateFridayBreak(i,"start",e.target.value)} style={{width:110, borderColor: startMismatch ? "#ef4444" : undefined}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>End time</label><select value={b.end} onChange={e => updateFridayBreak(i,"end",e.target.value)} style={{width:110, borderColor: endBeforeStart ? "#ef4444" : undefined}}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="settings-field"><label className="settings-label" style={{minWidth:140}}>After lesson</label><select value={b.after_period} onChange={e => updateFridayBreak(i,"after_period",Number(e.target.value))} style={inputNarrow}>{Array.from({length:periodsPerDay},(_,p) => <option key={p+1} value={p+1}>{p+1} (after lesson)</option>)}</select></div>
                    {startMismatch && (
                      <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 6, padding: "0.5rem 0.75rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "#dc2626" }}>
                        ⚠️ <strong>Time conflict!</strong> Lesson {b.after_period} ends at <strong>{expectedStartStr}</strong>, but break starts at <strong>{userStart}</strong>.
                        Please set break start time to <strong>{expectedStartStr}</strong>.
                      </div>
                    )}
                    {endBeforeStart && (
                      <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 6, padding: "0.5rem 0.75rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "#dc2626" }}>
                        ⚠️ <strong>Invalid!</strong> Break end time ({userEnd}) is before or equal to start time ({userStart}).
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {(() => {
        // Compute whether any time conflicts exist
        const hasConflict = (() => {
          for (const b of breaks) {
            const fp = parseTime(firstPeriodStart);
            let exp = fp + periodDuration * b.after_period;
            for (const prev of breaks) { if (prev !== b && prev.after_period < b.after_period) exp += (parseTime(prev.end) - parseTime(prev.start)); }
            if (b.start && fmtTimeHelper(exp) !== b.start) return true;
            if (b.start && b.end && parseTime(b.end) <= parseTime(b.start)) return true;
          }
          if (fridayDifferent) {
            for (const b of fridayBreaks) {
              const fp = parseTime(fridayFirstPeriodStart);
              let exp = fp + fridayPeriodDuration * b.after_period;
              for (const prev of fridayBreaks) { if (prev !== b && prev.after_period < b.after_period) exp += (parseTime(prev.end) - parseTime(prev.start)); }
              if (b.start && fmtTimeHelper(exp) !== b.start) return true;
              if (b.start && b.end && parseTime(b.end) <= parseTime(b.start)) return true;
            }
          }
          return false;
        })();

        return (
          <div className="settings-footer">
            {hasConflict && (
              <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "#dc2626", fontWeight: 600, marginBottom: "0.5rem" }}>
                🚫 Fix all time conflicts above before saving.
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={() => save()} disabled={saving || hasConflict}>{saving ? "Saving…" : "💾 Save Settings"}</button>
            <button type="button" className="btn" onClick={() => save(true)} disabled={saving || hasConflict}>Next: Subjects →</button>
          </div>
        );
      })()}
    </div>
  );
}
