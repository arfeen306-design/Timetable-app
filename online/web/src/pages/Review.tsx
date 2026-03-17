import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

interface Entry {
  id: number; lesson_id: number; day_index: number; period_index: number;
  room_id: number | null; locked: boolean; teacher_id: number; subject_id: number;
  class_id: number; teacher_name: string; subject_name: string; subject_code: string;
  subject_color: string; class_name: string; room_name: string;
}

type ViewType = "class" | "teacher" | "room";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ── Slot definition ── */
interface SlotDef {
  type: "period" | "break" | "zero";
  periodIndex: number; // -1 for breaks/zero
  start: string;
  end: string;
  breakName?: string;
}

function parseTime(t: string): number {
  if (!t || !t.includes(":")) return 8 * 60;
  const [h, m] = t.split(":").map(Number);
  return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
}
function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface BreakDef { name?: string; start?: string; end?: string; after_period?: number; duration_minutes?: number; is_friday?: boolean }

/**
 * Compute slot sequence using first_period_start (NOT school_start).
 * after_period from UI is 1-indexed: "after period 2" = after_period=2 → after periodIndex=1.
 * Break uses its user-entered start/end, cursor advances to break.end.
 */
function computeSlots(
  firstPeriodStart: string, defaultDuration: number, numPeriods: number,
  breaks: BreakDef[], lessonDurations: number[],
  schoolStartTime?: string, zeroPeriodEnabled?: boolean,
): SlotDef[] {
  const startMin = parseTime(firstPeriodStart);

  const breakByIdx: Record<number, BreakDef> = {};
  for (const b of breaks) {
    if (b.after_period != null) breakByIdx[b.after_period - 1] = b;
  }

  const slots: SlotDef[] = [];

  // Zero period: school_start → first_period_start
  if (zeroPeriodEnabled && schoolStartTime) {
    const ss = parseTime(schoolStartTime);
    if (ss < startMin) {
      slots.push({ type: "zero", periodIndex: -1, start: fmtTime(ss), end: fmtTime(startMin), breakName: "Zero Period" });
    }
  }

  let current = startMin;
  for (let p = 0; p < numPeriods; p++) {
    // Per-lesson duration: use array if available, else default
    const dur = (p < lessonDurations.length && lessonDurations[p]) ? lessonDurations[p] : defaultDuration;
    const end = current + dur;
    slots.push({ type: "period", periodIndex: p, start: fmtTime(current), end: fmtTime(end) });
    current = end;

    const brk = breakByIdx[p];
    if (brk) {
      const brkDur = brk.duration_minutes || 20;
      slots.push({ type: "break", periodIndex: -1, start: fmtTime(current), end: fmtTime(current + brkDur), breakName: brk.name || "Break" });
      current += brkDur;
    }
  }
  return slots;
}

export default function Review() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const toast = useToast();

  const [runSummary, setRunSummary] = useState<Awaited<ReturnType<typeof api.getRunSummary>> | null>(null);
  const [classes, setClasses] = useState<Awaited<ReturnType<typeof api.listClasses>>>([]);
  const [teachers, setTeachers] = useState<Awaited<ReturnType<typeof api.listTeachers>>>([]);
  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof api.listRooms>>>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);

  const [view, setView] = useState<ViewType>("class");
  const [classId, setClassId] = useState(0);
  const [teacherId, setTeacherId] = useState(0);
  const [roomId, setRoomId] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [, setGridDays] = useState(5);
  const [gridPeriods, setGridPeriods] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [dragEntry, setDragEntry] = useState<Entry | null>(null);
  const [dragOver, setDragOver] = useState<{ day: number; period: number } | null>(null);
  const [moving, setMoving] = useState(false);

  /* ── Load data ── */
  useEffect(() => {
    if (isNaN(pid)) return;
    api.getRunSummary(pid).then(setRunSummary).catch(() => setRunSummary(null));
    api.listClasses(pid).then(c => { setClasses(c); if (c.length > 0) setClassId(c[0].id); });
    api.listTeachers(pid).then(t => { setTeachers(t); if (t.length > 0) setTeacherId(t[0].id); });
    api.listRooms(pid).then(r => { setRooms(r); if (r.length > 0) setRoomId(r[0].id); });
    fetch(`/api/projects/${pid}/school-settings`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("timetable_token")}` }
    }).then(r => r.json()).then(s => setSettings(s)).catch(() => setSettings(null));
  }, [pid]);

  /* ── Load timetable ── */
  const loadTimetable = useCallback(() => {
    const id = view === "class" ? classId : view === "teacher" ? teacherId : roomId;
    if (!id) { setEntries([]); return; }
    setLoading(true); setError("");
    const fn = view === "class" ? api.getClassTimetable(pid, classId)
      : view === "teacher" ? api.getTeacherTimetable(pid, teacherId)
      : api.getRoomTimetable(pid, roomId);
    fn.then(data => { setEntries((data.entries || []) as Entry[]); setGridDays(data.days); setGridPeriods(data.periods); })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [view, classId, teacherId, roomId, pid]);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  /* ── Compute slot sequences + working day indices ── */
  const { regularSlots, fridaySlots, hasFridayDiff, fridayDayIndex, workingDayIndices } = useMemo(() => {
    if (!settings) return { regularSlots: [] as SlotDef[], fridaySlots: [] as SlotDef[], hasFridayDiff: false, fridayDayIndex: 4, workingDayIndices: [0,1,2,3,4] };

    const schoolStart = (settings.school_start_time as string) || "08:00";
    const defaultDuration = (settings.period_duration_minutes as number) || 45;
    const numPeriods = (settings.periods_per_day as number) || 7;

    // Compute working day indices from weekend_days
    const wdStr = (settings.weekend_days as string) || "5,6";
    const offSet = new Set(wdStr.split(",").filter(Boolean).map(Number));
    const workDays = Array.from({ length: 7 }, (_, i) => i).filter(i => !offSet.has(i));

    let breaks: BreakDef[] = [];
    try { const raw = settings.breaks_json as string; if (raw) breaks = JSON.parse(raw); } catch { /* */ }
    const regularBreaks = breaks.filter(b => !b.is_friday);
    const fridayBreaksList = breaks.filter(b => !!b.is_friday);

    let bell: Record<string, unknown> = {};
    try { const raw = settings.bell_schedule_json as string; if (raw) bell = JSON.parse(raw); } catch { /* */ }

    const firstPeriodStart = (bell.first_period_start as string) || schoolStart;
    const zeroPeriod = !!(bell.zero_period);
    const fridayDiff = !!(bell.friday_different);
    const friDayIdx = (bell.friday_day_index as number) ?? 4;
    const friStart = (bell.friday_first_period_start as string) || firstPeriodStart;
    const friDefaultDur = (bell.friday_default_duration as number) || defaultDuration;
    const friPeriodsPerDay = (bell.friday_periods_per_day as number) || numPeriods;

    // Per-lesson duration arrays
    const lessonDurations: number[] = Array.isArray(bell.lesson_durations) ? bell.lesson_durations as number[] : [];
    const fridayLessonDurations: number[] = Array.isArray(bell.friday_lesson_durations) ? bell.friday_lesson_durations as number[] : [];

    const regular = computeSlots(firstPeriodStart, defaultDuration, numPeriods, regularBreaks, lessonDurations, schoolStart, zeroPeriod);
    const friday = fridayDiff
      ? computeSlots(friStart, friDefaultDur, friPeriodsPerDay, fridayBreaksList, fridayLessonDurations, schoolStart, zeroPeriod)
      : regular;

    return { regularSlots: regular, fridaySlots: friday, hasFridayDiff: fridayDiff, fridayDayIndex: friDayIdx, workingDayIndices: workDays };
  }, [settings]);

  /* ── Drag & Drop ── */
  function onDragStart(e: React.DragEvent, entry: Entry) {
    setDragEntry(entry); e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(entry.id));
  }
  async function onDrop(e: React.DragEvent, newDay: number, newPeriod: number) {
    e.preventDefault(); setDragOver(null);
    if (!dragEntry || moving) return;
    if (dragEntry.day_index === newDay && dragEntry.period_index === newPeriod) { setDragEntry(null); return; }
    const oldDay = dragEntry.day_index, oldPeriod = dragEntry.period_index;
    setEntries(prev => prev.map(en => en.id === dragEntry.id ? { ...en, day_index: newDay, period_index: newPeriod } : en));
    setMoving(true);
    try {
      const result = await api.moveEntry(pid, dragEntry.id, newDay, newPeriod, false);
      if (!result.success) {
        setEntries(prev => prev.map(en => en.id === dragEntry.id ? { ...en, day_index: oldDay, period_index: oldPeriod } : en));
        const msgs = result.conflicts.map(c => c.message).join("\n");
        if (confirm(`⚠️ Conflicts:\n${msgs}\n\nMove anyway (force)?`)) {
          const forced = await api.moveEntry(pid, dragEntry.id, newDay, newPeriod, true);
          if (forced.success) setEntries(prev => prev.map(en => en.id === dragEntry.id ? { ...en, day_index: newDay, period_index: newPeriod } : en));
        }
      } else { toast("success", result.message || "Moved."); }
    } catch (err) {
      setEntries(prev => prev.map(en => en.id === dragEntry.id ? { ...en, day_index: oldDay, period_index: oldPeriod } : en));
      toast("error", err instanceof Error ? err.message : "Move failed");
    } finally { setMoving(false); setDragEntry(null); }
  }

  /* ── Export ── */
  async function handleExport(format: "excel" | "csv" | "pdf") {
    setExporting(format);
    try {
      const ext = format === "excel" ? "xlsx" : format;
      await api.downloadExport(pid, format, `timetable.${ext}`);
      toast("success", `${format.charAt(0).toUpperCase() + format.slice(1)} downloaded.`);
    } catch (err) { toast("error", err instanceof Error ? err.message : `${format} export failed`); }
    finally { setExporting(null); }
  }

  if (isNaN(pid)) return <div>Invalid project</div>;
  const run = runSummary?.run;
  const noRun = !run || run.status !== "completed";
  const selectedId = view === "class" ? classId : view === "teacher" ? teacherId : roomId;

  const colSlots = regularSlots.length > 0 ? regularSlots : Array.from({ length: gridPeriods }, (_, i) => ({ type: "period" as const, periodIndex: i, start: "", end: "" }));

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link to={`/project/${pid}`} style={{ color: "#3b82f6", textDecoration: "none", fontSize: "0.9rem" }}>← Editor</Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b", marginBottom: "1.25rem" }}>Review &amp; Export Timetable</h1>

      {noRun && (
        <div className="alert alert-warning" style={{ marginBottom: "1rem" }}>
          No completed timetable run. <Link to={`/project/${pid}/generate`} style={{ color: "#3b82f6", fontWeight: 600 }}>Generate</Link> first.
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* ═══ View Tabs ═══ */}
      <div style={{ display: "flex", gap: 0, marginBottom: "1rem", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", width: "fit-content" }}>
        {(["class", "teacher", "room"] as ViewType[]).map(v => (
          <button key={v} type="button" onClick={() => setView(v)} style={{
            padding: "0.5rem 1.25rem", border: "none", cursor: "pointer",
            background: view === v ? "#3b82f6" : "#fff", color: view === v ? "#fff" : "#475569",
            fontWeight: view === v ? 600 : 400, fontSize: "0.85rem",
            borderRight: v !== "room" ? "1px solid #e2e8f0" : undefined, transition: "all 0.15s ease",
          }}>
            {v === "class" ? "Class Timetable" : v === "teacher" ? "Teacher Timetable" : "Room Timetable"}
          </button>
        ))}
      </div>

      {/* ═══ Entity Selector ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <label style={{ fontWeight: 600, color: "#475569", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
          Select {view === "class" ? "Class" : view === "teacher" ? "Teacher" : "Room"}:
        </label>
        {view === "class" && (
          <select value={classId} onChange={e => setClassId(Number(e.target.value))} style={{ minWidth: 240, padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        )}
        {view === "teacher" && (
          <select value={teacherId} onChange={e => setTeacherId(Number(e.target.value))} style={{ minWidth: 240, padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.title} {t.first_name} {t.last_name} ({t.code})</option>)}
          </select>
        )}
        {view === "room" && (
          <select value={roomId} onChange={e => setRoomId(Number(e.target.value))} style={{ minWidth: 240, padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
          </select>
        )}
      </div>

      {!noRun && selectedId > 0 && (
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.5rem" }}>💡 Drag any cell to move it. Conflicts checked automatically.</p>
      )}

      {/* ═══ Timetable Grid ═══ */}
      {loading && <p style={{ color: "#64748b", padding: "2rem", textAlign: "center" }}>Loading…</p>}

      {!loading && selectedId > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "auto", marginBottom: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "#2d3748" }}>
                <th style={{ padding: "0.5rem 0.6rem", textAlign: "left", borderBottom: "2px solid #1a202c", width: 64, color: "#e2e8f0", fontSize: "0.75rem" }}></th>
                {colSlots.map((slot, i) => (
                  <th key={i} style={{
                    padding: "0.4rem 0.25rem", textAlign: "center", borderBottom: "2px solid #1a202c",
                    borderLeft: "1px solid #4a5568", fontSize: "0.68rem", color: "#fff", lineHeight: 1.3,
                    background: slot.type === "break" ? "#4a5568" : slot.type === "zero" ? "#2c5282" : "#2d3748",
                    minWidth: slot.type === "break" ? 70 : slot.type === "zero" ? 80 : 90,
                  }}>
                    {slot.type === "period" ? (
                      <>
                        <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>{slot.periodIndex + 1}</div>
                        {slot.start && <div style={{ fontWeight: 400, color: "#cbd5e0", fontSize: "0.58rem" }}>{slot.start} TO {slot.end}</div>}
                      </>
                    ) : slot.type === "zero" ? (
                      <>
                        <div style={{ fontWeight: 600, fontSize: "0.7rem", color: "#90cdf4" }}>0</div>
                        {slot.start && <div style={{ fontWeight: 400, color: "#90cdf4", fontSize: "0.55rem" }}>{slot.start} TO {slot.end}</div>}
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase" }}>{slot.breakName || "Break"}</div>
                        {slot.start && <div style={{ fontWeight: 400, color: "#a0aec0", fontSize: "0.55rem" }}>{slot.start} TO {slot.end}</div>}
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workingDayIndices.map(dayIdx => {
                const isFridayRow = dayIdx === fridayDayIndex;
                const useSlots = isFridayRow && hasFridayDiff ? fridaySlots : colSlots;
                const headerCols = colSlots.length;

                return (
                  <>
                    {/* Friday times row */}
                    {isFridayRow && hasFridayDiff && (
                      <tr key={`fri-times-${dayIdx}`} style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" }}>
                        <td style={{ padding: "0.25rem 0.5rem", fontWeight: 700, color: "#92400e", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                          {DAY_NAMES[fridayDayIndex] || "Fri"} times
                        </td>
                        {fridaySlots.map((slot, i) => (
                          <td key={i} style={{
                            textAlign: "center", padding: "0.2rem 0.15rem", fontSize: "0.55rem", color: "#92400e",
                            fontWeight: 500, borderLeft: "1px solid #fde68a",
                            background: slot.type === "break" ? "#fcd34d50" : undefined,
                          }}>
                            {slot.type === "break" ? `${slot.breakName}\n${slot.start}–${slot.end}` : `${slot.start} to ${slot.end}`}
                          </td>
                        ))}
                        {fridaySlots.length < headerCols && Array.from({ length: headerCols - fridaySlots.length }, (_, i) => (
                          <td key={`fill-${i}`} style={{ borderLeft: "1px solid #fde68a" }}></td>
                        ))}
                      </tr>
                    )}

                    {/* Day row — uses this day's OWN slot sequence */}
                    <tr key={dayIdx} style={{ borderBottom: dayIdx < workingDayIndices[workingDayIndices.length - 1] ? "1px solid #e2e8f0" : undefined }}>
                      <td style={{
                        padding: "0.5rem 0.5rem", fontWeight: 700, color: "#1e293b", fontSize: "0.85rem",
                        background: isFridayRow && hasFridayDiff ? "#fffbeb" : "#f8fafc",
                        borderRight: "1px solid #e2e8f0",
                      }}>
                        {DAY_NAMES[dayIdx] || `Day ${dayIdx + 1}`}
                      </td>
                      {useSlots.map((slot, colIdx) => {
                        if (slot.type === "break") {
                          return (
                            <td key={colIdx} style={{
                              background: "#e2e8f0", textAlign: "center", borderLeft: "1px solid #cbd5e0",
                              verticalAlign: "middle", color: "#64748b", fontSize: "0.62rem", fontStyle: "italic", padding: "0.3rem",
                            }}>
                              <div>{slot.breakName || "Break"}</div>
                              <div style={{ fontSize: "0.55rem", color: "#94a3b8" }}>{slot.start} to {slot.end}</div>
                            </td>
                          );
                        }

                        if (slot.type === "zero") {
                          return (
                            <td key={colIdx} style={{
                              background: "#ebf8ff", textAlign: "center", borderLeft: "1px solid #bee3f8",
                              verticalAlign: "middle", color: "#2b6cb0", fontSize: "0.62rem", fontStyle: "italic", padding: "0.3rem",
                            }}>
                              <div style={{ fontWeight: 600, fontSize: "0.65rem" }}>Class Teacher</div>
                              <div style={{ fontSize: "0.55rem", color: "#4299e1" }}>{slot.start}–{slot.end}</div>
                            </td>
                          );
                        }

                        // Lesson column — look for entry
                        const entry = entries.find(e => e.day_index === dayIdx && e.period_index === slot.periodIndex);
                        const isDragTarget = dragOver?.day === dayIdx && dragOver?.period === slot.periodIndex;
                        const isDragSource = dragEntry?.day_index === dayIdx && dragEntry?.period_index === slot.periodIndex;

                        return (
                          <td key={colIdx}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver({ day: dayIdx, period: slot.periodIndex }); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={e => onDrop(e, dayIdx, slot.periodIndex)}
                            style={{
                              padding: "0.25rem 0.15rem", textAlign: "center", verticalAlign: "middle",
                              borderLeft: "1px solid #e2e8f0", minWidth: 80, height: 56,
                              background: isDragTarget ? "#dbeafe"
                                : isDragSource ? "#fef3c7"
                                : entry ? `${entry.subject_color || "#3b82f6"}15` : "transparent",
                              borderBottom: entry ? `3px solid ${entry.subject_color || "#3b82f6"}` : undefined,
                              outline: isDragTarget ? "2px dashed #3b82f6" : undefined,
                              transition: "background 0.1s", cursor: entry ? "grab" : "default",
                            }}
                          >
                            {entry && (
                              <div draggable onDragStart={e => onDragStart(e, entry)}
                                onDragEnd={() => { setDragEntry(null); setDragOver(null); }}
                                style={{ lineHeight: 1.15, cursor: "grab", userSelect: "none" }}>
                                <div style={{ fontWeight: 700, fontSize: "0.76rem", color: entry.subject_color || "#1e293b" }}>
                                  {entry.subject_code || entry.subject_name}
                                </div>
                                <div style={{ fontSize: "0.63rem", color: "#64748b", marginTop: 1 }}>
                                  {view === "class" ? entry.teacher_name : entry.class_name}
                                </div>
                                {entry.room_name && <div style={{ fontSize: "0.58rem", color: "#94a3b8", fontStyle: "italic" }}>{entry.room_name}</div>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {/* Pad shorter rows to match header column count */}
                      {useSlots.length < headerCols && Array.from({ length: headerCols - useSlots.length }, (_, i) => (
                        <td key={`pad-${i}`} style={{ borderLeft: "1px solid #e2e8f0" }}></td>
                      ))}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && selectedId > 0 && entries.length === 0 && !noRun && (
        <div style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", padding: "2rem", textAlign: "center", color: "#94a3b8", marginBottom: "1.5rem" }}>
          No entries for this selection.
        </div>
      )}

      {/* ═══ Export ═══ */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "1.25rem 1.5rem", marginBottom: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Export</h3>
        <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "0 0 0.75rem" }}>
          Excel &amp; CSV: all classes + all teachers in one file. PDF: current view only.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" disabled={noRun || exporting === "excel"} onClick={() => handleExport("excel")} style={{ background: "#22c55e", borderColor: "#22c55e" }}>
            {exporting === "excel" ? "⏳ Exporting…" : "📊 Export to Excel"}
          </button>
          <button type="button" className="btn" disabled={noRun || exporting === "csv"} onClick={() => handleExport("csv")}>
            {exporting === "csv" ? "⏳ Exporting…" : "📄 Export to CSV"}
          </button>
          <button type="button" className="btn" disabled={noRun || exporting === "pdf-view"} onClick={async () => {
            setExporting("pdf-view");
            try {
              const params: { class_id?: number; teacher_id?: number; room_id?: number } = {};
              if (view === "class") params.class_id = classId;
              else if (view === "teacher") params.teacher_id = teacherId;
              else params.room_id = roomId;
              await api.downloadPdfView(pid, params, `timetable_${view}.pdf`);
              toast("success", "PDF downloaded.");
            } catch (err) { toast("error", err instanceof Error ? err.message : "PDF failed"); }
            finally { setExporting(null); }
          }}>
            {exporting === "pdf-view" ? "⏳ Exporting…" : `📑 PDF (current ${view})`}
          </button>
        </div>
      </div>

      {/* ═══ Communication — email / WhatsApp ═══ */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "1.25rem 1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Communication — email / WhatsApp ready</h3>
        <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "0 0 0.75rem" }}>
          Download separate PDF files for all teachers or all classes — one per page.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 250, background: "#f8fafc", borderRadius: 8, padding: "1rem", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "0.85rem", color: "#475569", margin: "0 0 0.5rem", fontWeight: 600 }}>
              👨‍🏫 Teacher Timetables ({teachers.length})
            </p>
            <button type="button" className="btn" disabled={noRun || exporting === "pdf-teachers" || teachers.length === 0}
              onClick={async () => {
                setExporting("pdf-teachers");
                try {
                  await api.downloadPdfAll(pid, "all-teachers", "all_teacher_timetables.pdf");
                  toast("success", "All teacher timetables downloaded.");
                } catch (err) { toast("error", err instanceof Error ? err.message : "Export failed"); }
                finally { setExporting(null); }
              }}
              style={{ width: "100%" }}>
              {exporting === "pdf-teachers" ? "⏳ Exporting…" : "📑 Export all teacher timetables (PDF)"}
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 250, background: "#f8fafc", borderRadius: 8, padding: "1rem", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "0.85rem", color: "#475569", margin: "0 0 0.5rem", fontWeight: 600 }}>
              🏫 Class Timetables ({classes.length})
            </p>
            <button type="button" className="btn" disabled={noRun || exporting === "pdf-classes" || classes.length === 0}
              onClick={async () => {
                setExporting("pdf-classes");
                try {
                  await api.downloadPdfAll(pid, "all-classes", "all_class_timetables.pdf");
                  toast("success", "All class timetables downloaded.");
                } catch (err) { toast("error", err instanceof Error ? err.message : "Export failed"); }
                finally { setExporting(null); }
              }}
              style={{ width: "100%" }}>
              {exporting === "pdf-classes" ? "⏳ Exporting…" : "📑 Export all class timetables (PDF)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

