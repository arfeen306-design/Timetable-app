import React, { useState, useEffect } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

type Tab = "settings" | "subjects" | "classes" | "rooms" | "teachers" | "lessons" | "constraints";

const TAB_SEGMENTS: Tab[] = ["settings", "subjects", "classes", "rooms", "teachers", "lessons", "constraints"];

export default function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const segment = location.pathname.split("/").filter(Boolean).pop() as string | undefined;
  const tab: Tab = TAB_SEGMENTS.includes(segment as Tab) ? (segment as Tab) : "settings";
  const pid = Number(projectId);
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

  if (isNaN(pid)) return <div>Invalid project</div>;
  if (loading && !settings && subjects.length === 0) return <div>Loading…</div>;

  const progressSteps = [
    { key: "settings", label: "School settings", done: !!settings?.name },
    { key: "teachers", label: "Add teachers", done: teachers.length > 0 },
    { key: "classes", label: "Add classes", done: classes.length > 0 },
    { key: "subjects", label: "Add subjects", done: subjects.length > 0 },
    { key: "rooms", label: "Add rooms", done: rooms.length > 0 },
    { key: "constraints", label: "Configure constraints", done: constraints.length > 0 },
    { key: "generate", label: "Generate timetable", done: false },
    { key: "review", label: "Review conflicts", done: false },
    { key: "publish", label: "Publish timetable", done: false },
  ];

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to="/">← Introduction</Link>
      </p>
      <div className="card setup-progress-panel" style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem" }}>
        <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem" }}>Setup progress</h3>
        <div className="setup-progress-steps" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem" }}>
          {progressSteps.map((step, i) => (
            <span key={step.key} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span aria-hidden style={{ width: "1.25rem", color: step.done ? "var(--success, #16a34a)" : "#94a3b8" }}>
                {step.done ? "✓" : `${i + 1}.`}
              </span>
              <span style={{ color: step.done ? "#64748b" : undefined }}>{step.label}</span>
            </span>
          ))}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs">
        {TAB_SEGMENTS.map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            type="button"
            onClick={() => navigate(`/project/${projectId}/${t}`)}
          >
            {t === "settings" ? "School" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <SettingsTab pid={pid} settings={settings} onSave={() => { api.getSchoolSettings(pid).then(setSettings); }} />
      )}
      {tab === "subjects" && <SubjectsTab pid={pid} subjects={subjects} onChange={setSubjects} />}
      {tab === "classes" && <ClassesTab pid={pid} classes={classes} onChange={setClasses} />}
      {tab === "rooms" && <RoomsTab pid={pid} rooms={rooms} onChange={setRooms} />}
      {tab === "teachers" && <TeachersTab pid={pid} teachers={teachers} onChange={setTeachers} />}
      {tab === "lessons" && (
        <LessonsTab pid={pid} lessons={lessons} subjects={subjects} classes={classes} teachers={teachers} onChange={setLessons} />
      )}
      {tab === "constraints" && <ConstraintsTab pid={pid} constraints={constraints} teachers={teachers} classes={classes} rooms={rooms} onChange={setConstraints} />}
    </>
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

  // School Information
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  // Schedule Structure
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);

  // Bell Schedule
  const [periodDuration, setPeriodDuration] = useState(45);
  const [schoolStartTime, setSchoolStartTime] = useState("08:00");
  const [firstPeriodStart, setFirstPeriodStart] = useState("08:30");
  const [zeroPeroid, setZeroPeriod] = useState(false);

  // Breaks
  interface BreakItem {
    name: string;
    start: string;
    end: string;
    after_period: number;
    duration_minutes: number;
  }
  const [numBreaks, setNumBreaks] = useState(0);
  const [breaks, setBreaks] = useState<BreakItem[]>([]);

  // Friday / Different Schedule
  const [fridayDifferent, setFridayDifferent] = useState(false);
  const [fridayDayIndex, setFridayDayIndex] = useState(4); // 0=Mon, 4=Fri
  const [fridayFirstPeriodStart, setFridayFirstPeriodStart] = useState("08:10");
  const [fridayPeriodDuration, setFridayPeriodDuration] = useState(50);
  const [fridayNumBreaks, setFridayNumBreaks] = useState(0);
  const [fridayBreaks, setFridayBreaks] = useState<BreakItem[]>([]);

  // Weekend Days — checkboxes
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [weekendDays, setWeekendDays] = useState<Set<number>>(new Set([5, 6])); // 0-indexed 0=Mon

  // Initialize from settings
  useEffect(() => {
    if (!settings) return;
    setName(settings.name || "");
    setAcademicYear(settings.academic_year || "");
    setDaysPerWeek(settings.days_per_week);
    setPeriodsPerDay(settings.periods_per_day);
    setPeriodDuration((settings as Record<string, unknown>).period_duration_minutes as number || 45);
    setSchoolStartTime((settings as Record<string, unknown>).school_start_time as string || "08:00");

    // Parse bell_schedule_json
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

    // Parse breaks_json
    try {
      const parsed = JSON.parse((settings as Record<string, unknown>).breaks_json as string || "[]");
      if (Array.isArray(parsed)) {
        const regular = parsed.filter((b: BreakItem & { is_friday?: boolean }) => !b.is_friday);
        const friday = parsed.filter((b: BreakItem & { is_friday?: boolean }) => b.is_friday);
        setNumBreaks(regular.length);
        setBreaks(regular.map((b: BreakItem) => ({
          name: b.name || "",
          start: b.start || "10:00",
          end: b.end || "10:20",
          after_period: b.after_period || 2,
          duration_minutes: b.duration_minutes || 20,
        })));
        setFridayNumBreaks(friday.length);
        setFridayBreaks(friday.map((b: BreakItem) => ({
          name: b.name || "",
          start: b.start || "10:40",
          end: b.end || "11:00",
          after_period: b.after_period || 3,
          duration_minutes: b.duration_minutes || 20,
        })));
      }
    } catch { /* ignore */ }

    // Weekend days
    const wd = (settings as Record<string, unknown>).weekend_days as string || "5,6";
    setWeekendDays(new Set(wd.split(",").filter(Boolean).map(Number)));
  }, [settings]);

  // Sync numBreaks to breaks array length
  useEffect(() => {
    setBreaks((prev) => {
      if (prev.length < numBreaks) {
        const newBreaks = [...prev];
        for (let i = prev.length; i < numBreaks; i++) {
          newBreaks.push({ name: "", start: "10:00", end: "10:20", after_period: i + 2, duration_minutes: 20 });
        }
        return newBreaks;
      }
      return prev.slice(0, numBreaks);
    });
  }, [numBreaks]);

  useEffect(() => {
    setFridayBreaks((prev) => {
      if (prev.length < fridayNumBreaks) {
        const newBreaks = [...prev];
        for (let i = prev.length; i < fridayNumBreaks; i++) {
          newBreaks.push({ name: "", start: "10:40", end: "11:00", after_period: i + 3, duration_minutes: 20 });
        }
        return newBreaks;
      }
      return prev.slice(0, fridayNumBreaks);
    });
  }, [fridayNumBreaks]);

  function updateBreak(index: number, field: keyof BreakItem, value: string | number) {
    setBreaks((prev) => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  }

  function updateFridayBreak(index: number, field: keyof BreakItem, value: string | number) {
    setFridayBreaks((prev) => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  }

  function toggleWeekend(dayIdx: number) {
    setWeekendDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIdx)) next.delete(dayIdx);
      else next.add(dayIdx);
      return next;
    });
  }

  // Generate time options (every 5 min from 06:00 to 23:00)
  const TIME_OPTIONS: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (let m = 0; m < 60; m += 5) {
      TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  async function save(andNext?: boolean) {
    setSaving(true);
    try {
      const bellSchedule = JSON.stringify({
        first_period_start: firstPeriodStart,
        zero_period: zeroPeroid,
        friday_different: fridayDifferent,
        friday_day_index: fridayDayIndex,
        friday_first_period_start: fridayFirstPeriodStart,
        friday_period_duration: fridayPeriodDuration,
      });

      const allBreaks = [
        ...breaks.map((b) => ({ ...b, is_friday: false })),
        ...(fridayDifferent ? fridayBreaks.map((b) => ({ ...b, is_friday: true })) : []),
      ];

      const weekendStr = Array.from(weekendDays).sort().join(",");
      const workingStr = DAY_LABELS.map((_, i) => i).filter((i) => !weekendDays.has(i)).join(",");

      await api.updateSchoolSettings(pid, {
        name,
        academic_year: academicYear,
        days_per_week: daysPerWeek,
        periods_per_day: periodsPerDay,
        bell_schedule_json: bellSchedule,
        weekend_days: weekendStr,
      });

      // Update extended fields via a second call with full data
      await fetch(`/api/projects/${pid}/school-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("timetable_token")}`,
        },
        body: JSON.stringify({
          period_duration_minutes: periodDuration,
          school_start_time: schoolStartTime,
          breaks_json: JSON.stringify(allBreaks),
          working_days: workingStr,
        }),
      });

      onSave();
      toast("success", "School settings saved.");
      if (andNext) navigate(`/project/${pid}/subjects`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inputNarrow: React.CSSProperties = { width: 100, maxWidth: 100 };

  return (
    <div className="settings-card">
      {/* ── School Information ── */}
      <h2>School Settings</h2>
      <p className="subheading">Configure your school's basic information and schedule structure.</p>

      <h3 className="settings-section-title">School Information</h3>
      <div className="settings-field">
        <label className="settings-label required">School Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Islamabad Model School" />
      </div>
      <div className="settings-field">
        <label className="settings-label">Academic Year</label>
        <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2025-2026" />
      </div>

      {/* ── Schedule Structure ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Schedule Structure</h3>
        <div className="settings-field">
          <label className="settings-label">Working Days per Week</label>
          <select value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))} style={inputNarrow}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">Lessons per Day</label>
          <select value={periodsPerDay} onChange={(e) => setPeriodsPerDay(Number(e.target.value))} style={inputNarrow}>
            {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* ── Bell Schedule — Period Timing ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Bell Schedule — Period Timing</h3>
        <div className="settings-field">
          <label className="settings-label">Period duration (minutes)</label>
          <select value={periodDuration} onChange={(e) => setPeriodDuration(Number(e.target.value))} style={inputNarrow}>
            {[25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">School start time</label>
          <select value={schoolStartTime} onChange={(e) => setSchoolStartTime(e.target.value)} style={{ width: 120 }}>
            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">First period start time</label>
          <select value={firstPeriodStart} onChange={(e) => setFirstPeriodStart(e.target.value)} style={{ width: 120 }}>
            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="settings-hint">
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={zeroPeroid} onChange={(e) => setZeroPeriod(e.target.checked)} style={{ width: "auto", accentColor: "#3b82f6" }} />
            Include zero period (class teacher time: school start → first period)
          </label>
        </div>
      </div>

      {/* ── Breaks ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Breaks</h3>
        <div className="settings-field">
          <label className="settings-label">Number of breaks (0–9)</label>
          <select value={numBreaks} onChange={(e) => setNumBreaks(Number(e.target.value))} style={inputNarrow}>
            {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        {breaks.map((b, i) => (
          <div key={i} className="break-card">
            <div className="break-card-title">Break {i + 1}</div>
            <div className="settings-field">
              <label className="settings-label" style={{ minWidth: 140 }}>Name</label>
              <input value={b.name} onChange={(e) => updateBreak(i, "name", e.target.value)} placeholder="e.g. Short Break" style={{ width: 200 }} />
            </div>
            <div className="settings-field">
              <label className="settings-label" style={{ minWidth: 140 }}>Start time</label>
              <select value={b.start} onChange={(e) => updateBreak(i, "start", e.target.value)} style={{ width: 110 }}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="settings-field">
              <label className="settings-label" style={{ minWidth: 140 }}>End time</label>
              <select value={b.end} onChange={(e) => updateBreak(i, "end", e.target.value)} style={{ width: 110 }}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="settings-field">
              <label className="settings-label" style={{ minWidth: 140 }}>After period</label>
              <select value={b.after_period} onChange={(e) => updateBreak(i, "after_period", Number(e.target.value))} style={inputNarrow}>
                {Array.from({ length: periodsPerDay }, (_, p) => <option key={p + 1} value={p + 1}>{p + 1} (after period)</option>)}
              </select>
            </div>
          </div>
        ))}

        <p className="settings-hint">
          Lesson length in periods (single, double, etc.) is set per lesson in the Lessons tab.
        </p>
      </div>

      {/* ── Friday / Different Schedule ── */}
      <div className="settings-section">
        <h3 className="friday-section-title">
          <select value={fridayDayIndex} onChange={(e) => setFridayDayIndex(Number(e.target.value))} style={{ width: 120, fontWeight: 600 }}>
            {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <span>— Different Schedule (Optional)</span>
        </h3>
        <div className="settings-field" style={{ marginLeft: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}>
            <input type="checkbox" checked={fridayDifferent} onChange={(e) => setFridayDifferent(e.target.checked)} style={{ width: "auto", accentColor: "#f59e0b" }} />
            {DAY_LABELS[fridayDayIndex]} has different timing
          </label>
        </div>

        {fridayDifferent && (
          <div style={{ marginLeft: 20, marginTop: "0.75rem" }}>
            <div className="settings-field">
              <label className="settings-label">{DAY_LABELS[fridayDayIndex]} first period start</label>
              <select value={fridayFirstPeriodStart} onChange={(e) => setFridayFirstPeriodStart(e.target.value)} style={{ width: 120 }}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="settings-field">
              <label className="settings-label">{DAY_LABELS[fridayDayIndex]} period duration</label>
              <select value={fridayPeriodDuration} onChange={(e) => setFridayPeriodDuration(Number(e.target.value))} style={inputNarrow}>
                {[25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </div>
            <div className="settings-field">
              <label className="settings-label">{DAY_LABELS[fridayDayIndex]} breaks (0–9)</label>
              <select value={fridayNumBreaks} onChange={(e) => setFridayNumBreaks(Number(e.target.value))} style={inputNarrow}>
                {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            {fridayBreaks.map((b, i) => (
              <div key={i} className="break-card-friday">
                <div className="break-card-title">{DAY_LABELS[fridayDayIndex]} Break {i + 1}</div>
                <div className="settings-field">
                  <label className="settings-label" style={{ minWidth: 140 }}>Name</label>
                  <input value={b.name} onChange={(e) => updateFridayBreak(i, "name", e.target.value)} placeholder="e.g. Break" style={{ width: 200 }} />
                </div>
                <div className="settings-field">
                  <label className="settings-label" style={{ minWidth: 140 }}>Start time</label>
                  <select value={b.start} onChange={(e) => updateFridayBreak(i, "start", e.target.value)} style={{ width: 110 }}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="settings-field">
                  <label className="settings-label" style={{ minWidth: 140 }}>End time</label>
                  <select value={b.end} onChange={(e) => updateFridayBreak(i, "end", e.target.value)} style={{ width: 110 }}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="settings-field">
                  <label className="settings-label" style={{ minWidth: 140 }}>After period</label>
                  <select value={b.after_period} onChange={(e) => updateFridayBreak(i, "after_period", Number(e.target.value))} style={inputNarrow}>
                    {Array.from({ length: periodsPerDay }, (_, p) => <option key={p + 1} value={p + 1}>{p + 1}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Weekend Days ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Weekend Days</h3>
        <div className="weekend-row">
          {DAY_LABELS.map((day, i) => (
            <label key={i} className={`weekend-checkbox${weekendDays.has(i) ? " checked" : ""}`}>
              <input type="checkbox" checked={weekendDays.has(i)} onChange={() => toggleWeekend(i)} style={{ width: "auto" }} />
              {day}
            </label>
          ))}
        </div>
      </div>

      {/* ── Save buttons ── */}
      <div className="settings-footer">
        <button type="button" className="btn btn-primary" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "💾 Save Settings"}</button>
        <button type="button" className="btn" onClick={() => save(true)} disabled={saving}>Next: Subjects →</button>
      </div>
    </div>
  );
}

function SubjectsTab({
  pid,
  subjects,
  onChange,
}: { pid: number; subjects: Awaited<ReturnType<typeof api.listSubjects>>; onChange: (s: Awaited<ReturnType<typeof api.listSubjects>>) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const s = await api.createSubject(pid, { name: name.trim(), code: code.trim() });
      onChange([...subjects, { ...s, name: name.trim(), code: code.trim(), color: "#4A90D9", category: "Core" } as typeof subjects[0]]);
      setName("");
      setCode("");
    } finally {
      setAdding(false);
    }
  }
  async function del(id: number) {
    try {
      await api.deleteSubject(pid, id);
      onChange(subjects.filter((s) => s.id !== id));
    } catch (e) {
      alert(e);
    }
  }
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Subjects</h2>
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
      </form>
      <table>
        <thead><tr><th>Name</th><th>Code</th><th></th></tr></thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.id}><td>{s.name}</td><td>{s.code}</td><td><button type="button" className="btn btn-danger" onClick={() => del(s.id)}>Delete</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassesTab({
  pid,
  classes,
  onChange,
}: { pid: number; classes: Awaited<ReturnType<typeof api.listClasses>>; onChange: (c: Awaited<ReturnType<typeof api.listClasses>>) => void }) {
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [stream, setStream] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [strength, setStrength] = useState(30);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; errors: { row: number; message: string }[] } | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!grade.trim()) return;
    setAdding(true);
    try {
      const c = await api.createClass(pid, { grade: grade.trim(), section: section.trim(), stream: stream.trim(), name: name.trim(), code: code.trim(), strength });
      onChange([...classes, { ...c, grade: grade.trim(), section: section.trim(), stream: stream.trim(), name: name.trim() || `Grade ${grade} ${section}`.trim(), code: code.trim(), color: "#50C878", strength } as typeof classes[0]]);
      setGrade(""); setSection(""); setStream(""); setName(""); setCode(""); setStrength(30);
    } catch (e) {
      alert(e);
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit() {
    if (editId == null) return;
    try {
      await api.updateClass(pid, editId, { grade, section, stream, name, code, strength });
      onChange(classes.map((c) => c.id === editId ? { ...c, grade, section, stream, name, code, strength } : c));
      setEditId(null);
      setGrade(""); setSection(""); setStream(""); setName(""); setCode(""); setStrength(30);
    } catch (e) {
      alert(e);
    }
  }

  function startEdit(c: typeof classes[0]) {
    setEditId(c.id);
    setGrade(c.grade);
    setSection(c.section);
    setStream(c.stream);
    setName(c.name);
    setCode(c.code);
    setStrength(c.strength);
  }

  async function del(id: number) {
    if (!confirm("Delete this class?")) return;
    try {
      await api.deleteClass(pid, id);
      onChange(classes.filter((c) => c.id !== id));
    } catch (e) {
      alert(e);
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importClassesExcel(pid, file);
      setImportResult(res);
      if (res.success_count > 0) api.listClasses(pid).then(onChange);
    } catch (err) {
      alert(err);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Classes &amp; Sections</h2>
      <p className="subheading">Add and manage classes, sections, and streams.</p>
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" onClick={() => { setEditId(null); setGrade(""); setSection(""); setStream(""); setName(""); setCode(""); setStrength(30); }}>+ Add Class</button>
        <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={importing}>{importing ? "Importing…" : "Import from Excel"}</button>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("classes")}>Download Template</button>
        <button type="button" className="btn" onClick={() => selectedId != null && startEdit(classes.find((c) => c.id === selectedId)!)} disabled={selectedId == null}>Edit</button>
        <button type="button" className="btn btn-danger" onClick={() => selectedId != null && del(selectedId)} disabled={selectedId == null}>Delete</button>
      </div>
      {importResult && (
        <div className="alert" style={{ marginBottom: "1rem" }}>
          Imported {importResult.success_count} class(es). {importResult.errors.length > 0 && `Errors: ${importResult.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ")}`}
        </div>
      )}
      {editId != null && (
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <input placeholder="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} required />
          <input placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} />
          <input placeholder="Stream" value={stream} onChange={(e) => setStream(e.target.value)} />
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input type="number" placeholder="Strength" value={strength} onChange={(e) => setStrength(Number(e.target.value))} style={{ width: 80 }} />
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" className="btn" onClick={() => setEditId(null)}>Cancel</button>
        </form>
      )}
      {editId == null && (
        <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <input placeholder="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} required />
          <input placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} />
          <input placeholder="Stream" value={stream} onChange={(e) => setStream(e.target.value)} />
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input type="number" placeholder="Strength" value={strength} onChange={(e) => setStrength(Number(e.target.value))} style={{ width: 80 }} />
          <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
        </form>
      )}
      {classes.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No classes added yet. Import from Excel or add manually.</p>}
      <table className="data-table">
        <thead><tr><th>Name</th><th>Grade</th><th>Section</th><th>Stream</th><th>Code</th><th>Color</th><th>Strength</th><th></th></tr></thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id} className={selectedId === c.id ? "selected" : ""} onClick={() => setSelectedId(c.id)}>
              <td>{c.name}</td><td>{c.grade}</td><td>{c.section}</td><td>{c.stream}</td><td>{c.code}</td>
              <td><span style={{ display: "inline-block", width: 16, height: 16, backgroundColor: c.color || "#50C878", border: "1px solid #ccc" }} /></td>
              <td>{c.strength}</td>
              <td><button type="button" className="btn btn-danger" onClick={(ev) => { ev.stopPropagation(); del(c.id); }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoomsTab({
  pid,
  rooms,
  onChange,
}: { pid: number; rooms: Awaited<ReturnType<typeof api.listRooms>>; onChange: (r: Awaited<ReturnType<typeof api.listRooms>>) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [roomType, setRoomType] = useState("Classroom");
  const [adding, setAdding] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const r = await api.createRoom(pid, { name: name.trim(), code: code.trim(), room_type: roomType });
      onChange([...rooms, { ...r, name: name.trim(), code: code.trim(), room_type: roomType, capacity: 40 } as typeof rooms[0]]);
      setName("");
      setCode("");
    } finally {
      setAdding(false);
    }
  }
  async function del(id: number) {
    try {
      await api.deleteRoom(pid, id);
      onChange(rooms.filter((r) => r.id !== id));
    } catch (e) {
      alert(e);
    }
  }
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Rooms</h2>
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
          <option>Classroom</option>
          <option>Lab</option>
          <option>Hall</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
      </form>
      <table>
        <thead><tr><th>Name</th><th>Code</th><th>Type</th><th></th></tr></thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.id}><td>{r.name}</td><td>{r.code}</td><td>{r.room_type}</td><td><button type="button" className="btn btn-danger" onClick={() => del(r.id)}>Delete</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeachersTab({
  pid,
  teachers,
  onChange,
}: { pid: number; teachers: Awaited<ReturnType<typeof api.listTeachers>>; onChange: (t: Awaited<ReturnType<typeof api.listTeachers>>) => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const list = Array.isArray(teachers) ? teachers : [];
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("Mr.");
  const [color, setColor] = useState("#E8725A");
  const [maxPerDay, setMaxPerDay] = useState(6);
  const [maxPerWeek, setMaxPerWeek] = useState(30);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; errors: { row: number; message: string }[] } | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function add(e: React.FormEvent, action: "save" | "saveAndNext" | "saveAndAddAnother" = "saveAndAddAnother") {
    e.preventDefault();
    if (!firstName.trim()) return;
    setAdding(true);
    try {
      const t = await api.createTeacher(pid, { first_name: firstName.trim(), last_name: lastName.trim(), code: code.trim(), title, color, max_periods_day: maxPerDay, max_periods_week: maxPerWeek });
      onChange([...list, { ...t, first_name: firstName.trim(), last_name: lastName.trim(), code: code.trim(), title, color, max_periods_day: maxPerDay, max_periods_week: maxPerWeek } as (typeof teachers)[0]]);
      toast("success", "Data saved successfully");
      setFirstName(""); setLastName(""); setCode(""); setTitle("Mr."); setColor("#E8725A"); setMaxPerDay(6); setMaxPerWeek(30);
      if (action === "saveAndNext") navigate(`/project/${pid}/lessons`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(t: { id: number; first_name?: string; last_name?: string; code?: string; title?: string; color?: string; max_periods_day?: number; max_periods_week?: number } | undefined) {
    if (!t || t.id == null) return;
    setEditId(t.id);
    setFirstName(t.first_name ?? "");
    setLastName(t.last_name ?? "");
    setCode(t.code ?? "");
    setTitle(t.title ?? "Mr.");
    setColor(t.color ?? "#E8725A");
    setMaxPerDay(t.max_periods_day ?? 6);
    setMaxPerWeek(t.max_periods_week ?? 30);
  }

  async function saveEdit(andNext?: boolean) {
    if (editId == null) return;
    try {
      await api.updateTeacher(pid, editId, { first_name: firstName, last_name: lastName, code, title, color, max_periods_day: maxPerDay, max_periods_week: maxPerWeek });
      onChange(Array.isArray(teachers) ? teachers.map((t) => (t && t.id === editId) ? { ...t, first_name: firstName, last_name: lastName, code, title, color, max_periods_day: maxPerDay, max_periods_week: maxPerWeek } : t) : []);
      toast("success", "Data saved successfully");
      setEditId(null);
      setFirstName(""); setLastName(""); setCode(""); setTitle("Mr."); setColor("#E8725A"); setMaxPerDay(6); setMaxPerWeek(30);
      if (andNext) navigate(`/project/${pid}/lessons`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    }
  }

  async function del(id: number) {
    if (!confirm("Delete this teacher?")) return;
    try {
      await api.deleteTeacher(pid, id);
      onChange(Array.isArray(teachers) ? teachers.filter((t) => t && t.id !== id) : []);
      toast("success", "Data saved successfully");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importTeachersExcel(pid, file);
      setImportResult(res);
      if (res.success_count > 0) api.listTeachers(pid).then(onChange);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Teachers</h2>
      <p className="subheading">Add and manage teaching staff.</p>
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" onClick={() => { setEditId(null); setFirstName(""); setLastName(""); setCode(""); setTitle("Mr."); setColor("#E8725A"); setMaxPerDay(6); setMaxPerWeek(30); }}>+ Add Teacher</button>
        <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={importing}>{importing ? "Importing…" : "Import from Excel"}</button>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("teachers")}>Download Template</button>
        <button type="button" className="btn" onClick={() => { const teacher = list.find((t) => t && t.id === selectedId); if (teacher) startEdit(teacher); }} disabled={selectedId == null}>Edit</button>
        <button type="button" className="btn btn-danger" onClick={() => selectedId != null && del(selectedId)} disabled={selectedId == null}>Delete</button>
      </div>
      {importResult && (
        <div className="alert" style={{ marginBottom: "1rem" }}>
          Imported {importResult.success_count} teacher(s). {importResult.errors.length > 0 && `Errors: ${importResult.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ")}`}
        </div>
      )}
      {editId != null && (
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 70 }} />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" style={{ width: 36, height: 28, padding: 0 }} />
          <input type="number" min={1} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} style={{ width: 60 }} title="Max/day" />
          <input type="number" min={1} value={maxPerWeek} onChange={(e) => setMaxPerWeek(Number(e.target.value))} style={{ width: 60 }} title="Max/week" />
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" className="btn" onClick={() => saveEdit(true)}>Save and Next</button>
          <button type="button" className="btn" onClick={() => setEditId(null)}>Cancel</button>
        </form>
      )}
      {editId == null && (
        <form onSubmit={(e) => add(e, "saveAndAddAnother")} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 70 }} />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" style={{ width: 36, height: 28, padding: 0 }} />
          <input type="number" min={1} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} style={{ width: 60 }} title="Max/day" />
          <input type="number" min={1} value={maxPerWeek} onChange={(e) => setMaxPerWeek(Number(e.target.value))} style={{ width: 60 }} title="Max/week" />
          <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Saving…" : "Save"}</button>
          <button type="button" className="btn" onClick={(e) => add(e, "saveAndAddAnother")} disabled={adding}>Save and Add Another</button>
          <button type="button" className="btn" onClick={(e) => add(e, "saveAndNext")} disabled={adding}>Save and Next</button>
          <button type="button" className="btn" onClick={() => { setFirstName(""); setLastName(""); setCode(""); setTitle("Mr."); setColor("#E8725A"); setMaxPerDay(6); setMaxPerWeek(30); }}>Cancel</button>
        </form>
      )}
      {list.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No teachers added yet. Add at least one teacher before creating lessons.</p>}
      <table className="data-table">
        <thead><tr><th>Name</th><th>Code</th><th>Title</th><th>Color</th><th>Max/Day</th><th>Max/Week</th><th></th></tr></thead>
        <tbody>
          {list.map((t) => (
            <tr key={t?.id ?? 0} className={selectedId === t?.id ? "selected" : ""} onClick={() => t && setSelectedId(t.id)}>
              <td>{t?.first_name ?? ""} {t?.last_name ?? ""}</td>
              <td>{t?.code ?? ""}</td>
              <td>{t?.title ?? ""}</td>
              <td><span style={{ display: "inline-block", width: 16, height: 16, backgroundColor: t?.color || "#E8725A", border: "1px solid #ccc" }} /></td>
              <td>{t?.max_periods_day ?? ""}</td>
              <td>{t?.max_periods_week ?? ""}</td>
              <td><button type="button" className="btn btn-danger" onClick={(ev) => { ev.stopPropagation(); if (t?.id != null) del(t.id); }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LessonsTab({
  pid,
  lessons,
  subjects,
  classes,
  teachers,
  onChange,
}: {
  pid: number;
  lessons: Awaited<ReturnType<typeof api.listLessons>>;
  subjects: Awaited<ReturnType<typeof api.listSubjects>>;
  classes: Awaited<ReturnType<typeof api.listClasses>>;
  teachers: Awaited<ReturnType<typeof api.listTeachers>>;
  onChange: (l: Awaited<ReturnType<typeof api.listLessons>>) => void;
}) {
  const [teacherId, setTeacherId] = useState<number>(0);
  const [subjectId, setSubjectId] = useState<number>(0);
  const [classId, setClassId] = useState<number>(0);
  const [periods, setPeriods] = useState(1);
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [bulkTeacherId, setBulkTeacherId] = useState(0);
  const [bulkSubjectId, setBulkSubjectId] = useState(0);
  const [bulkClassPeriods, setBulkClassPeriods] = useState<Record<number, number>>({});
  const [copySourceId, setCopySourceId] = useState(0);
  const [copyTargetIds, setCopyTargetIds] = useState<number[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [copySubmitting, setCopySubmitting] = useState(false);

  function nameTeacher(id: number) {
    const t = teachers.find((x) => x.id === id);
    return t ? `${t.first_name} ${t.last_name}` : `#${id}`;
  }
  function nameSubject(id: number) {
    return subjects.find((x) => x.id === id)?.name ?? `#${id}`;
  }
  function nameClass(id: number) {
    return classes.find((x) => x.id === id)?.name ?? `#${id}`;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId || !subjectId || !classId) return;
    setAdding(true);
    try {
      const l = await api.createLesson(pid, { teacher_id: teacherId, subject_id: subjectId, class_id: classId, periods_per_week: periods });
      onChange([...lessons, { id: l.id, teacher_id: teacherId, subject_id: subjectId, class_id: classId, periods_per_week: periods } as typeof lessons[0]]);
      setTeacherId(0); setSubjectId(0); setClassId(0); setPeriods(1);
    } finally {
      setAdding(false);
    }
  }

  async function doBulkAssign() {
    if (!bulkTeacherId || !bulkSubjectId) return;
    const classIds = classes.map((c) => c.id);
    const selected = classIds.filter((id) => (bulkClassPeriods[id] ?? 0) > 0);
    if (selected.length === 0) {
      alert("Select at least one class and set periods per week.");
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await api.bulkCreateLessons(pid, {
        teacher_id: bulkTeacherId,
        subject_id: bulkSubjectId,
        classes: selected.map((class_id) => ({ class_id, periods_per_week: bulkClassPeriods[class_id] ?? 1 })),
      });
      if (res.created > 0) {
        const list = await api.listLessons(pid);
        onChange(list);
        setBulkOpen(false);
        setBulkTeacherId(0);
        setBulkSubjectId(0);
        setBulkClassPeriods({});
      }
      if (res.errors.length > 0) alert("Some rows failed: " + res.errors.map((e) => e.message).join("; "));
    } catch (e) {
      alert(e);
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function doCopyFromClass() {
    if (!copySourceId || copyTargetIds.length === 0) return;
    setCopySubmitting(true);
    try {
      const res = await api.copyLessonsFromClass(pid, copySourceId, copyTargetIds);
      if (res.copied > 0) {
        const list = await api.listLessons(pid);
        onChange(list);
        setCopyOpen(false);
        setCopySourceId(0);
        setCopyTargetIds([]);
      }
      alert(`Copied ${res.copied} lesson(s).`);
    } catch (e) {
      alert(e);
    } finally {
      setCopySubmitting(false);
    }
  }

  function toggleCopyTarget(id: number) {
    setCopyTargetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function del(id: number) {
    try {
      await api.deleteLesson(pid, id);
      onChange(lessons.filter((l) => l.id !== id));
    } catch (e) {
      alert(e);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Lesson Assignments</h2>
      <p className="subheading">Assign teachers to subjects and classes with weekly period counts.</p>
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn" onClick={() => setBulkOpen(false)}>+ Add Single Lesson</button>
        <button type="button" className="btn btn-primary" onClick={() => setBulkOpen(true)} title="Assign one teacher + subject to multiple classes">+ Bulk Assign (1 Teacher → Many Classes)</button>
        <button type="button" className="btn" onClick={() => setCopyOpen(true)}>Copy from Class</button>
      </div>

      {bulkOpen && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ maxWidth: 560, maxHeight: "90vh", overflow: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Bulk Assign</h3>
            <p>Assign one teacher and one subject to multiple classes. Set periods per week for each class.</p>
            <div style={{ marginBottom: "1rem" }}>
              <label>Teacher</label>
              <select value={bulkTeacherId} onChange={(e) => setBulkTeacherId(Number(e.target.value))} style={{ width: "100%", marginBottom: 8 }}>
                <option value={0}>Select teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
              </select>
              <label>Subject</label>
              <select value={bulkSubjectId} onChange={(e) => setBulkSubjectId(Number(e.target.value))} style={{ width: "100%", marginBottom: 8 }}>
                <option value={0}>Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <table className="data-table"><thead><tr><th>Class</th><th>Periods / Week</th></tr></thead><tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><input type="number" min={0} value={bulkClassPeriods[c.id] ?? 0} onChange={(e) => setBulkClassPeriods((prev) => ({ ...prev, [c.id]: Number(e.target.value) || 0 }))} style={{ width: 80 }} /></td>
                </tr>
              ))}
            </tbody></table>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-primary" onClick={doBulkAssign} disabled={bulkSubmitting}>{bulkSubmitting ? "Creating…" : "Create lessons"}</button>
              <button type="button" className="btn" onClick={() => setBulkOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {copyOpen && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ maxWidth: 480, maxHeight: "90vh", overflow: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Copy from Class</h3>
            <p>Copy all lesson assignments from one class to other classes.</p>
            <div style={{ marginBottom: "1rem" }}>
              <label>Copy from class</label>
              <select value={copySourceId} onChange={(e) => setCopySourceId(Number(e.target.value))} style={{ width: "100%", marginBottom: 8 }}>
                <option value={0}>Select source class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label>To classes (select one or more)</label>
              <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #ccc", padding: 8 }}>
                {classes.filter((c) => c.id !== copySourceId).map((c) => (
                  <label key={c.id} style={{ display: "block", marginBottom: 4 }}>
                    <input type="checkbox" checked={copyTargetIds.includes(c.id)} onChange={() => toggleCopyTarget(c.id)} /> {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-primary" onClick={doCopyFromClass} disabled={copySubmitting || !copySourceId || copyTargetIds.length === 0}>{copySubmitting ? "Copying…" : "Copy"}</button>
              <button type="button" className="btn" onClick={() => setCopyOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <select value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))} required>
          <option value={0}>Teacher</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} required>
          <option value={0}>Subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} required>
          <option value={0}>Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="number" min={1} value={periods} onChange={(e) => setPeriods(Number(e.target.value))} style={{ width: 80 }} />
        <span>per week</span>
        <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
      </form>
      <table className="data-table">
        <thead><tr><th>Teacher</th><th>Subject</th><th>Class</th><th>Periods/week</th><th></th></tr></thead>
        <tbody>
          {lessons.map((l) => (
            <tr key={l.id}>
              <td>{nameTeacher(l.teacher_id)}</td>
              <td>{nameSubject(l.subject_id)}</td>
              <td>{nameClass(l.class_id)}</td>
              <td>{l.periods_per_week}</td>
              <td><button type="button" className="btn btn-danger" onClick={() => del(l.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConstraintsTab({
  pid,
  constraints,
  teachers,
  classes,
  rooms,
  onChange,
}: {
  pid: number;
  constraints: Awaited<ReturnType<typeof api.listConstraints>>;
  teachers: Awaited<ReturnType<typeof api.listTeachers>>;
  classes: Awaited<ReturnType<typeof api.listClasses>>;
  rooms: Awaited<ReturnType<typeof api.listRooms>>;
  onChange: (c: Awaited<ReturnType<typeof api.listConstraints>>) => void;
}) {
  const [entityType, setEntityType] = useState<"teacher" | "class" | "room">("teacher");
  const [entityId, setEntityId] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const options = entityType === "teacher" ? teachers : entityType === "class" ? classes : rooms;
  function nameEntity(c: { entity_type: string; entity_id: number }) {
    if (c.entity_type === "teacher") return teachers.find((t) => t.id === c.entity_id)?.first_name + " " + teachers.find((t) => t.id === c.entity_id)?.last_name || `#${c.entity_id}`;
    if (c.entity_type === "class") return classes.find((x) => x.id === c.entity_id)?.name ?? `#${c.entity_id}`;
    return rooms.find((r) => r.id === c.entity_id)?.name ?? `#${c.entity_id}`;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const c = await api.createConstraint(pid, { entity_type: entityType, entity_id: entityId, day_index: dayIndex, period_index: periodIndex, is_hard: true });
      onChange([...constraints, { id: c.id, entity_type: entityType, entity_id: entityId, day_index: dayIndex, period_index: periodIndex } as typeof constraints[0]]);
      setEntityId(0);
    } finally {
      setAdding(false);
    }
  }
  async function del(id: number) {
    try {
      await api.deleteConstraint(pid, id);
      onChange(constraints.filter((c) => c.id !== id));
    } catch (e) {
      alert(e);
    }
  }
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Constraints (unavailability)</h2>
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value as "teacher" | "class" | "room"); setEntityId(0); }}>
          <option value="teacher">Teacher</option>
          <option value="class">Class</option>
          <option value="room">Room</option>
        </select>
        <select value={entityId} onChange={(e) => setEntityId(Number(e.target.value))} required>
          <option value={0}>Select</option>
          {options.map((o) => <option key={o.id} value={o.id}>{"first_name" in o ? (o as { first_name: string; last_name: string }).first_name + " " + (o as { last_name: string }).last_name : (o as { name: string }).name}</option>)}
        </select>
        <span>Day</span>
        <input type="number" min={0} value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))} style={{ width: 60 }} />
        <span>Period</span>
        <input type="number" min={0} value={periodIndex} onChange={(e) => setPeriodIndex(Number(e.target.value))} style={{ width: 60 }} />
        <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
      </form>
      <table>
        <thead><tr><th>Type</th><th>Entity</th><th>Day</th><th>Period</th><th></th></tr></thead>
        <tbody>
          {constraints.map((c) => (
            <tr key={c.id}>
              <td>{c.entity_type}</td>
              <td>{nameEntity(c)}</td>
              <td>{c.day_index}</td>
              <td>{c.period_index}</td>
              <td><button type="button" className="btn btn-danger" onClick={() => del(c.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
