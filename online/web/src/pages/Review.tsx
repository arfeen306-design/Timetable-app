import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";
import type { DaySlots, PeriodSlot } from "../api";
import { useToast } from "../context/ToastContext";

interface Entry {
  id: number;
  lesson_id: number;
  day_index: number;
  period_index: number;
  room_id: number | null;
  locked: boolean;
  teacher_id: number;
  subject_id: number;
  class_id: number;
  teacher_name: string;
  subject_name: string;
  subject_code: string;
  subject_color: string;
  class_name: string;
  room_name: string;
}

type ViewType = "class" | "teacher" | "room";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Review() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const toast = useToast();

  const [runSummary, setRunSummary] = useState<Awaited<ReturnType<typeof api.getRunSummary>> | null>(null);
  const [classes, setClasses] = useState<Awaited<ReturnType<typeof api.listClasses>>>([]);
  const [teachers, setTeachers] = useState<Awaited<ReturnType<typeof api.listTeachers>>>([]);
  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof api.listRooms>>>([]);
  const [periodSlots, setPeriodSlots] = useState<DaySlots[]>([]);

  const [view, setView] = useState<ViewType>("class");
  const [classId, setClassId] = useState(0);
  const [teacherId, setTeacherId] = useState(0);
  const [roomId, setRoomId] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [gridDays, setGridDays] = useState(5);
  const [gridPeriods, setGridPeriods] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  /* ── Load data ── */
  useEffect(() => {
    if (isNaN(pid)) return;
    api.getRunSummary(pid).then(setRunSummary).catch(() => setRunSummary(null));
    api.listClasses(pid).then(c => { setClasses(c); if (c.length > 0) setClassId(c[0].id); });
    api.listTeachers(pid).then(t => { setTeachers(t); if (t.length > 0) setTeacherId(t[0].id); });
    api.listRooms(pid).then(r => { setRooms(r); if (r.length > 0) setRoomId(r[0].id); });
    api.getPeriodSlots(pid).then(d => setPeriodSlots(d.days)).catch(() => setPeriodSlots([]));
  }, [pid]);

  /* ── Load timetable ── */
  useEffect(() => {
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

  /* ── Compute period time labels per day ── */
  const slotsByDay = useMemo(() => {
    const m: Record<number, PeriodSlot[]> = {};
    for (const d of periodSlots) {
      m[d.day_index] = d.slots.filter(s => !s.is_break);
    }
    return m;
  }, [periodSlots]);

  /* Check if Friday (day_index=4) has different times than Monday (day_index=0) */
  const fridayDayIndex = 4;
  const fridayDifferent = useMemo(() => {
    const mon = slotsByDay[0];
    const fri = slotsByDay[fridayDayIndex];
    if (!mon || !fri || mon.length === 0 || fri.length === 0) return false;
    return mon[0]?.start_time !== fri[0]?.start_time || mon[0]?.end_time !== fri[0]?.end_time;
  }, [slotsByDay]);

  /* Get period time for a specific day & period index */
  function getSlot(dayIdx: number, periodIdx: number): PeriodSlot | undefined {
    const dayPeriods = slotsByDay[dayIdx];
    if (dayPeriods) return dayPeriods.find(s => s.period_index === periodIdx);
    // Fallback: use first available day's slots
    const firstDay = periodSlots[0];
    if (firstDay) return firstDay.slots.filter(s => !s.is_break).find(s => s.period_index === periodIdx);
    return undefined;
  }

  /* Get break info between periods for a day */
  function getBreaksForDay(dayIdx: number): PeriodSlot[] {
    const d = periodSlots.find(ds => ds.day_index === dayIdx);
    return d ? d.slots.filter(s => s.is_break) : [];
  }

  /* ── Export ── */
  async function handleExport(format: "excel" | "csv" | "pdf") {
    setExporting(format);
    try {
      const ext = format === "excel" ? "xlsx" : format;
      await api.downloadExport(pid, format, `timetable.${ext}`);
      toast("success", `${format.charAt(0).toUpperCase() + format.slice(1)} downloaded successfully.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : `${format} export failed`);
    } finally {
      setExporting(null);
    }
  }

  if (isNaN(pid)) return <div>Invalid project</div>;
  const run = runSummary?.run;
  const noRun = !run || run.status !== "completed";
  const selectedId = view === "class" ? classId : view === "teacher" ? teacherId : roomId;

  /* Default period headers from day 0 (Monday) */
  const defaultSlots = slotsByDay[0] || [];

  return (
    <div style={{ maxWidth: 1020, margin: "0 auto" }}>
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
      <div style={{
        display: "flex", gap: 0, marginBottom: "1rem", borderRadius: 8, overflow: "hidden",
        border: "1px solid #e2e8f0", width: "fit-content"
      }}>
        {(["class", "teacher", "room"] as ViewType[]).map(v => (
          <button key={v} type="button" onClick={() => setView(v)} style={{
            padding: "0.5rem 1.25rem", border: "none", cursor: "pointer",
            background: view === v ? "#3b82f6" : "#fff",
            color: view === v ? "#fff" : "#475569",
            fontWeight: view === v ? 600 : 400, fontSize: "0.85rem",
            borderRight: v !== "room" ? "1px solid #e2e8f0" : undefined,
            transition: "all 0.15s ease",
          }}>
            {v === "class" ? "Class Timetable" : v === "teacher" ? "Teacher Timetable" : "Room Timetable"}
          </button>
        ))}
      </div>

      {/* ═══ Entity Selector ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
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

      {/* ═══ Timetable Grid ═══ */}
      {loading && <p style={{ color: "#64748b", padding: "2rem", textAlign: "center" }}>Loading…</p>}

      {!loading && selectedId > 0 && (
        <div style={{
          background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
          overflow: "hidden", marginBottom: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", width: 64, color: "#94a3b8", fontSize: "0.75rem" }}></th>
                {Array.from({ length: gridPeriods }, (_, i) => {
                  const slot = defaultSlots.find(s => s.period_index === i);
                  return (
                    <th key={i} style={{ padding: "0.5rem 0.3rem", textAlign: "center", borderBottom: "2px solid #e2e8f0", borderLeft: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#475569", lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>{i + 1}</div>
                      {slot && (
                        <div style={{ fontWeight: 400, color: "#64748b", fontSize: "0.65rem", marginTop: 1 }}>
                          {slot.start_time} to {slot.end_time}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: gridDays }, (_, dayIdx) => {
                const isFriday = dayIdx === fridayDayIndex;
                const dayBreaks = getBreaksForDay(dayIdx);
                const fridaySlots = isFriday && fridayDifferent ? slotsByDay[fridayDayIndex] : null;

                return (
                  <>
                    {/* ── Friday different timing row ── */}
                    {isFriday && fridayDifferent && fridaySlots && (
                      <tr key={`fri-header-${dayIdx}`} style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
                        <td style={{ padding: "0.3rem 0.6rem", fontWeight: 600, color: "#92400e", fontSize: "0.72rem" }}>
                          ⏰ Fri timing
                        </td>
                        {Array.from({ length: gridPeriods }, (_, pIdx) => {
                          const fSlot = fridaySlots.find(s => s.period_index === pIdx);
                          return (
                            <td key={pIdx} style={{ textAlign: "center", borderLeft: "1px solid #fde68a", padding: "0.25rem 0.2rem", fontSize: "0.62rem", color: "#92400e", fontWeight: 500 }}>
                              {fSlot ? `${fSlot.start_time}–${fSlot.end_time}` : ""}
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* ── Day row ── */}
                    <tr key={dayIdx} style={{ borderBottom: dayIdx < gridDays - 1 ? "1px solid #f1f5f9" : undefined }}>
                      <td style={{
                        padding: "0.6rem 0.6rem", fontWeight: 600, color: "#334155", fontSize: "0.85rem",
                        background: isFriday && fridayDifferent ? "#fffbeb" : "#fafbfc", borderRight: "1px solid #f1f5f9",
                      }}>
                        {DAY_NAMES[dayIdx] || `Day ${dayIdx + 1}`}
                      </td>
                      {Array.from({ length: gridPeriods }, (_, pIdx) => {
                        const entry = entries.find(e => e.day_index === dayIdx && e.period_index === pIdx);
                        // Check if there's a break after this period on this day
                        const breakAfter = dayBreaks.find(b => {
                          const prevPeriod = pIdx; // break is after a period
                          // We check if the break start_time matches end of this period
                          const slot = getSlot(dayIdx, prevPeriod);
                          return slot && b.start_time === slot.end_time;
                        });

                        return (
                          <td key={pIdx} style={{
                            padding: "0.3rem 0.2rem", textAlign: "center", verticalAlign: "middle",
                            borderLeft: "1px solid #f1f5f9", minWidth: 80, height: 56,
                            background: entry ? `${entry.subject_color || "#3b82f6"}08` : "transparent",
                            borderBottom: entry ? `2px solid ${entry.subject_color || "#3b82f6"}` : undefined,
                            borderRight: breakAfter ? "3px dashed #f59e0b" : undefined,
                          }}>
                            {entry && (
                              <div style={{ lineHeight: 1.2 }}>
                                <div style={{ fontWeight: 700, fontSize: "0.78rem", color: entry.subject_color || "#1e293b" }}>
                                  {entry.subject_code || entry.subject_name}
                                </div>
                                <div style={{ fontSize: "0.66rem", color: "#64748b", marginTop: 1 }}>
                                  {view === "class" ? entry.teacher_name : entry.class_name}
                                </div>
                                {entry.room_name && (
                                  <div style={{ fontSize: "0.6rem", color: "#94a3b8", fontStyle: "italic" }}>
                                    {entry.room_name}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
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

      {/* ═══ Export Section ═══ */}
      <div style={{
        background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "1.25rem 1.5rem",
        marginBottom: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
      }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Export</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" disabled={noRun || exporting === "excel"} onClick={() => handleExport("excel")}
            style={{ background: "#22c55e", borderColor: "#22c55e" }}>
            {exporting === "excel" ? "⏳ Exporting…" : "📊 Export to Excel"}
          </button>
          <button type="button" className="btn" disabled={noRun || exporting === "csv"} onClick={() => handleExport("csv")}>
            {exporting === "csv" ? "⏳ Exporting…" : "📄 Export to CSV"}
          </button>
          <button type="button" className="btn" disabled={noRun || exporting === "pdf"} onClick={() => handleExport("pdf")}>
            {exporting === "pdf" ? "⏳ Exporting…" : "📑 Export to PDF"}
          </button>
        </div>
      </div>

      {/* ═══ Communication Section ═══ */}
      <div style={{
        background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "1.25rem 1.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
      }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Communication — email / WhatsApp ready</h3>

        <div style={{ marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#475569", margin: "0 0 0.5rem" }}>
            <strong>Teacher timetables:</strong> {teachers.length} teachers. Export one file per teacher for email or WhatsApp.
          </p>
          <button type="button" className="btn" disabled={noRun || teachers.length === 0} onClick={() => handleExport("excel")}>
            Export all teacher timetables…
          </button>
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#475569", margin: "0 0 0.5rem" }}>
            <strong>Class timetables for class teachers:</strong> {classes.filter(c => c.class_teacher_id).length} classes with assigned teachers.
          </p>
          <button type="button" className="btn" disabled={noRun || classes.length === 0} onClick={() => handleExport("excel")}>
            Export class timetables for class teachers…
          </button>
        </div>
      </div>
    </div>
  );
}
