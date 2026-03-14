import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";
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

export default function Review() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const toast = useToast();

  const [runSummary, setRunSummary] = useState<Awaited<ReturnType<typeof api.getRunSummary>> | null>(null);
  const [classes, setClasses] = useState<Awaited<ReturnType<typeof api.listClasses>>>([]);
  const [teachers, setTeachers] = useState<Awaited<ReturnType<typeof api.listTeachers>>>([]);
  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof api.listRooms>>>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.getSchoolSettings>> | null>(null);

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

  /* ── Load data on mount ── */
  useEffect(() => {
    if (isNaN(pid)) return;
    api.getRunSummary(pid).then(setRunSummary).catch(() => setRunSummary(null));
    api.listClasses(pid).then(c => { setClasses(c); if (c.length > 0) setClassId(c[0].id); });
    api.listTeachers(pid).then(t => { setTeachers(t); if (t.length > 0) setTeacherId(t[0].id); });
    api.listRooms(pid).then(r => { setRooms(r); if (r.length > 0) setRoomId(r[0].id); });
    api.getSchoolSettings(pid).then(setSettings).catch(() => setSettings(null));
  }, [pid]);

  /* ── Load timetable for selected entity ── */
  useEffect(() => {
    if (view === "class" && classId) {
      setLoading(true);
      api.getClassTimetable(pid, classId)
        .then(data => { setEntries((data.entries || []) as Entry[]); setGridDays(data.days); setGridPeriods(data.periods); })
        .catch(e => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else if (view === "teacher" && teacherId) {
      setLoading(true);
      api.getTeacherTimetable(pid, teacherId)
        .then(data => { setEntries((data.entries || []) as Entry[]); setGridDays(data.days); setGridPeriods(data.periods); })
        .catch(e => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else if (view === "room" && roomId) {
      setLoading(true);
      api.getRoomTimetable(pid, roomId)
        .then(data => { setEntries((data.entries || []) as Entry[]); setGridDays(data.days); setGridPeriods(data.periods); })
        .catch(e => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else {
      setEntries([]);
    }
  }, [view, classId, teacherId, roomId, pid]);

  /* ── Bell schedule times ── */
  const bellSchedule = settings?.bell_schedule_json ? (() => {
    try { return JSON.parse(settings.bell_schedule_json); } catch { return null; }
  })() : null;

  function periodLabel(idx: number): string {
    if (bellSchedule && Array.isArray(bellSchedule) && bellSchedule[idx]) {
      const slot = bellSchedule[idx];
      return `${idx + 1}\n${slot.start || ""} to ${slot.end || ""}`;
    }
    return String(idx + 1);
  }

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  /* ── Export helpers ── */
  async function handleExport(format: "excel" | "csv" | "pdf") {
    setExporting(format);
    try {
      const ext = format === "excel" ? "xlsx" : format;
      await api.downloadExport(pid, format, `timetable.${ext}`);
      toast("success", `${format.toUpperCase()} export downloaded.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : `${format} export failed`);
    } finally {
      setExporting(null);
    }
  }

  if (isNaN(pid)) return <div>Invalid project</div>;
  const run = runSummary?.run;
  const noRun = !run || run.status !== "completed";

  const selectedEntityId = view === "class" ? classId : view === "teacher" ? teacherId : roomId;
  const showGrid = selectedEntityId > 0;

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to={`/project/${pid}`}>← Editor</Link>
      </p>
      <h1>Review &amp; Export Timetable</h1>

      {noRun && (
        <div className="alert alert-warning">
          No completed timetable run. <Link to={`/project/${pid}/generate`}>Generate</Link> first.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {/* ── View tabs: Class / Teacher / Room ── */}
      <div className="tabs">
        <button type="button" className={view === "class" ? "active" : ""} onClick={() => setView("class")}>Class Timetable</button>
        <button type="button" className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>Teacher Timetable</button>
        <button type="button" className={view === "room" ? "active" : ""} onClick={() => setView("room")}>Room Timetable</button>
      </div>

      {/* ── Entity selector ── */}
      <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <label style={{ fontWeight: 600, color: "#475569" }}>
          Select {view === "class" ? "Class" : view === "teacher" ? "Teacher" : "Room"}:
        </label>
        {view === "class" && (
          <select value={classId} onChange={e => setClassId(Number(e.target.value))} style={{ minWidth: 220 }}>
            <option value={0}>Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        )}
        {view === "teacher" && (
          <select value={teacherId} onChange={e => setTeacherId(Number(e.target.value))} style={{ minWidth: 220 }}>
            <option value={0}>Select teacher…</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.title} {t.first_name} {t.last_name} ({t.code})</option>)}
          </select>
        )}
        {view === "room" && (
          <select value={roomId} onChange={e => setRoomId(Number(e.target.value))} style={{ minWidth: 220 }}>
            <option value={0}>Select room…</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
          </select>
        )}
      </div>

      {/* ── Timetable Grid ── */}
      {loading && <p>Loading…</p>}

      {!loading && showGrid && entries.length > 0 && (
        <div className="card" style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
          <table className="data-table" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 60 }}></th>
                {Array.from({ length: gridPeriods }, (_, i) => (
                  <th key={i} style={{ textAlign: "center", whiteSpace: "pre-line", fontSize: "0.8rem", lineHeight: 1.3 }}>
                    {periodLabel(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: gridDays }, (_, dayIdx) => (
                <tr key={dayIdx}>
                  <td style={{ fontWeight: 600, color: "#334155" }}>{DAY_NAMES[dayIdx] || `Day ${dayIdx + 1}`}</td>
                  {Array.from({ length: gridPeriods }, (_, pIdx) => {
                    const entry = entries.find(e => e.day_index === dayIdx && e.period_index === pIdx);
                    return (
                      <td key={pIdx} style={{
                        textAlign: "center",
                        verticalAlign: "middle",
                        padding: "0.4rem",
                        minHeight: 60,
                        backgroundColor: entry?.subject_color ? `${entry.subject_color}22` : "#f8fafc",
                        borderLeft: entry?.subject_color ? `3px solid ${entry.subject_color}` : undefined,
                      }}>
                        {entry ? (
                          <div style={{ fontSize: "0.8rem", lineHeight: 1.3 }}>
                            <div style={{ fontWeight: 600, color: entry.subject_color || "#1e293b" }}>{entry.subject_code || entry.subject_name}</div>
                            {view === "class" && <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{entry.teacher_name}</div>}
                            {view === "teacher" && <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{entry.class_name}</div>}
                            {view === "room" && <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{entry.class_name}</div>}
                            {entry.room_name && <div style={{ color: "#94a3b8", fontSize: "0.7rem" }}>{entry.room_name}</div>}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && showGrid && entries.length === 0 && !noRun && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ textAlign: "center", color: "#64748b" }}>No entries found for this selection.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         EXPORT SECTION
         ══════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.1rem" }}>Export</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={noRun || exporting === "excel"}
            onClick={() => handleExport("excel")}
          >
            {exporting === "excel" ? "Downloading…" : "Export to Excel"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={noRun || exporting === "csv"}
            onClick={() => handleExport("csv")}
          >
            {exporting === "csv" ? "Downloading…" : "Export to CSV"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={noRun || exporting === "pdf"}
            onClick={() => handleExport("pdf")}
          >
            {exporting === "pdf" ? "Downloading…" : "Export to PDF"}
          </button>
        </div>
      </div>

      {/* ── Communication / Batch Export ── */}
      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.1rem" }}>Communication — email / WhatsApp ready</h2>

        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ color: "#475569", marginBottom: "0.5rem" }}>
            <strong>Teacher timetables:</strong> {teachers.length} teachers. Export one PDF per teacher for email or WhatsApp.
          </p>
          <button
            type="button"
            className="btn"
            disabled={noRun || teachers.length === 0}
            onClick={() => {
              toast("info", "Batch teacher PDF export — use Export to Excel for all teacher timetables in one file.");
              handleExport("excel");
            }}
          >
            Export all teacher timetables…
          </button>
        </div>

        <div>
          <p style={{ color: "#475569", marginBottom: "0.5rem" }}>
            <strong>Class timetables for class teachers:</strong> {classes.filter(c => c.class_teacher_id).length} classes with assigned teachers.
            Export one PDF per class for the class teacher.
          </p>
          <button
            type="button"
            className="btn"
            disabled={noRun || classes.length === 0}
            onClick={() => {
              toast("info", "Batch class PDF export — use Export to Excel for all class timetables in one file.");
              handleExport("excel");
            }}
          >
            Export class timetables for class teachers…
          </button>
        </div>
      </div>
    </>
  );
}
