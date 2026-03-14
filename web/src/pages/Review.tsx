import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";
import TimetableGrid from "../components/TimetableGrid";

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

export default function Review() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const [runSummary, setRunSummary] = useState<Awaited<ReturnType<typeof api.getRunSummary>> | null>(null);
  const [classes, setClasses] = useState<Awaited<ReturnType<typeof api.listClasses>>>([]);
  const [teachers, setTeachers] = useState<Awaited<ReturnType<typeof api.listTeachers>>>([]);
  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof api.listRooms>>>([]);
  const [view, setView] = useState<"summary" | "class" | "teacher" | "room" | "master" | "workload">("summary");
  const [classId, setClassId] = useState(0);
  const [teacherId, setTeacherId] = useState(0);
  const [roomId, setRoomId] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [gridDays, setGridDays] = useState(5);
  const [gridPeriods, setGridPeriods] = useState(7);
  const [workloadData, setWorkloadData] = useState<Awaited<ReturnType<typeof api.getWorkload>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNaN(pid)) return;
    api.getRunSummary(pid).then(setRunSummary).catch(() => setRunSummary(null));
    api.listClasses(pid).then(setClasses);
    api.listTeachers(pid).then(setTeachers);
    api.listRooms(pid).then(setRooms);
  }, [pid]);

  // Load timetable data for the selected view
  useEffect(() => {
    if (view === "class" && classId) {
      setLoading(true);
      api.getClassTimetable(pid!, classId)
        .then((data) => {
          setEntries((data.entries || []) as Entry[]);
          setGridDays(data.days);
          setGridPeriods(data.periods);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else if (view === "teacher" && teacherId) {
      setLoading(true);
      api.getTeacherTimetable(pid!, teacherId)
        .then((data) => {
          setEntries((data.entries || []) as Entry[]);
          setGridDays(data.days);
          setGridPeriods(data.periods);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else if (view === "room" && roomId) {
      setLoading(true);
      api.getRoomTimetable(pid!, roomId)
        .then((data) => {
          setEntries((data.entries || []) as Entry[]);
          setGridDays(data.days);
          setGridPeriods(data.periods);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else if (view === "master") {
      setLoading(true);
      api.getMasterTimetable(pid!)
        .then((data) => {
          // Flatten master grid (each cell is an array) into a flat entries list
          const flat: Entry[] = (data.entries || []) as Entry[];
          setEntries(flat);
          setGridDays(data.days);
          setGridPeriods(data.periods);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else if (view === "workload") {
      setLoading(true);
      api.getWorkload(pid!)
        .then(setWorkloadData)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else {
      setEntries([]);
    }
  }, [view, classId, teacherId, roomId, pid]);

  if (isNaN(pid)) return <div>Invalid project</div>;
  const run = runSummary?.run;
  const noRun = !run || run.status !== "completed";

  const showGrid = (view === "class" && classId > 0) ||
    (view === "teacher" && teacherId > 0) ||
    (view === "room" && roomId > 0) ||
    view === "master";

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to={`/project/${pid}`}>← Editor</Link>
      </p>
      <h1>Review Timetable</h1>
      {noRun && (
        <div className="alert alert-warning">
          No completed timetable run. <Link to={`/project/${pid}/generate`}>Generate</Link> first.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs">
        <button type="button" className={view === "summary" ? "active" : ""} onClick={() => setView("summary")}>Summary</button>
        <button type="button" className={view === "class" ? "active" : ""} onClick={() => setView("class")}>By Class</button>
        <button type="button" className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>By Teacher</button>
        <button type="button" className={view === "room" ? "active" : ""} onClick={() => setView("room")}>By Room</button>
        <button type="button" className={view === "master" ? "active" : ""} onClick={() => setView("master")}>Master</button>
        <button type="button" className={view === "workload" ? "active" : ""} onClick={() => setView("workload")}>Workload</button>
      </div>

      {/* Summary */}
      {view === "summary" && run && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Run Summary</h2>
          <p>Status: <strong>{run.status}</strong></p>
          <p>Entries: {run.entries_count}</p>
          {run.finished_at && <p>Finished: {run.finished_at}</p>}
        </div>
      )}

      {/* Selector bars */}
      {view === "class" && (
        <div className="tt-view-bar">
          <select value={classId} onChange={(e) => setClassId(Number(e.target.value))}>
            <option value={0}>Select class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="tt-legend">
            <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: "#dcfce7", border: "2px solid #22c55e" }} /> Valid slot</span>
            <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: "#fef2f2", border: "2px solid #ef4444" }} /> Conflict</span>
          </div>
        </div>
      )}
      {view === "teacher" && (
        <div className="tt-view-bar">
          <select value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))}>
            <option value={0}>Select teacher…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
        </div>
      )}
      {view === "room" && (
        <div className="tt-view-bar">
          <select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
            <option value={0}>Select room…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && <p>Loading…</p>}

      {/* Visual Grid */}
      {!loading && showGrid && entries.length > 0 && (
        <TimetableGrid
          projectId={pid}
          entries={entries}
          days={gridDays}
          periods={gridPeriods}
          viewType={view === "master" ? "master" : view as "class" | "teacher" | "room"}
          onEntriesChange={setEntries}
        />
      )}
      {!loading && showGrid && entries.length === 0 && !noRun && (
        <div className="card">
          <p style={{ textAlign: "center", color: "#64748b" }}>No entries found for this selection.</p>
        </div>
      )}

      {/* Workload table */}
      {view === "workload" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Teacher Workload</h2>
          {loading && <p>Loading…</p>}
          {workloadData && (
            <table>
              <thead><tr><th>Teacher</th><th>Periods Scheduled</th></tr></thead>
              <tbody>
                {workloadData.workload.map((w) => (
                  <tr key={w.teacher_id}><td>{w.teacher_name}</td><td>{w.periods_scheduled}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
