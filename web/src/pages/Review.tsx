import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";

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
  const [classData, setClassData] = useState<Awaited<ReturnType<typeof api.getClassTimetable>> | null>(null);
  const [teacherData, setTeacherData] = useState<Awaited<ReturnType<typeof api.getTeacherTimetable>> | null>(null);
  const [roomData, setRoomData] = useState<Awaited<ReturnType<typeof api.getRoomTimetable>> | null>(null);
  const [masterData, setMasterData] = useState<Awaited<ReturnType<typeof api.getMasterTimetable>> | null>(null);
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

  useEffect(() => {
    if (view === "class" && classId) {
      setLoading(true);
      api.getClassTimetable(pid!, classId).then(setClassData).catch(setError).finally(() => setLoading(false));
    } else setClassData(null);
  }, [view, classId, pid]);
  useEffect(() => {
    if (view === "teacher" && teacherId) {
      setLoading(true);
      api.getTeacherTimetable(pid!, teacherId).then(setTeacherData).catch(setError).finally(() => setLoading(false));
    } else setTeacherData(null);
  }, [view, teacherId, pid]);
  useEffect(() => {
    if (view === "room" && roomId) {
      setLoading(true);
      api.getRoomTimetable(pid!, roomId).then(setRoomData).catch(setError).finally(() => setLoading(false));
    } else setRoomData(null);
  }, [view, roomId, pid]);
  useEffect(() => {
    if (view === "master") {
      setLoading(true);
      api.getMasterTimetable(pid!).then(setMasterData).catch(setError).finally(() => setLoading(false));
    } else setMasterData(null);
  }, [view, pid]);
  useEffect(() => {
    if (view === "workload") {
      setLoading(true);
      api.getWorkload(pid!).then(setWorkloadData).catch(setError).finally(() => setLoading(false));
    } else setWorkloadData(null);
  }, [view, pid]);

  if (isNaN(pid)) return <div>Invalid project</div>;
  const run = runSummary?.run;
  const noRun = !run || run.status !== "completed";

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to={`/project/${pid}`}>← Editor</Link>
      </p>
      <h1>Review timetable</h1>
      {noRun && (
        <div className="alert alert-warning">
          No completed timetable run. <Link to={`/project/${pid}/generate`}>Generate</Link> first.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs">
        <button type="button" className={view === "summary" ? "active" : ""} onClick={() => setView("summary")}>Summary</button>
        <button type="button" className={view === "class" ? "active" : ""} onClick={() => setView("class")}>Class</button>
        <button type="button" className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>Teacher</button>
        <button type="button" className={view === "room" ? "active" : ""} onClick={() => setView("room")}>Room</button>
        <button type="button" className={view === "master" ? "active" : ""} onClick={() => setView("master")}>Master</button>
        <button type="button" className={view === "workload" ? "active" : ""} onClick={() => setView("workload")}>Workload</button>
      </div>
      {view === "summary" && run && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Run summary</h2>
          <p>Status: <strong>{run.status}</strong></p>
          <p>Entries: {run.entries_count}</p>
          {run.finished_at && <p>Finished: {run.finished_at}</p>}
        </div>
      )}
      {view === "class" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Class timetable</h2>
          <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} style={{ maxWidth: 200, marginBottom: "1rem" }}>
            <option value={0}>Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {loading && <p>Loading…</p>}
          {classData && classData.grid && (
            <table>
              <thead>
                <tr><th>Day \ Period</th>
                  {Array.from({ length: classData.periods }, (_, i) => <th key={i}>P{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {classData.grid.map((row, d) => (
                  <tr key={d}>
                    <td><strong>Day {d + 1}</strong></td>
                    {row.map((cell, p) => (
                      <td key={p}>{cell ? `${(cell as { subject_name?: string; teacher_name?: string }).subject_name ?? ""} (${(cell as { subject_name?: string; teacher_name?: string }).teacher_name ?? ""})` : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {view === "teacher" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Teacher timetable</h2>
          <select value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))} style={{ maxWidth: 200, marginBottom: "1rem" }}>
            <option value={0}>Select teacher</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
          {loading && <p>Loading…</p>}
          {teacherData && teacherData.grid && (
            <table>
              <thead>
                <tr><th>Day \ Period</th>
                  {Array.from({ length: teacherData.periods }, (_, i) => <th key={i}>P{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {teacherData.grid.map((row, d) => (
                  <tr key={d}>
                    <td><strong>Day {d + 1}</strong></td>
                    {row.map((cell, p) => (
                      <td key={p}>{cell ? `${(cell as { subject_name?: string; class_name?: string }).subject_name ?? ""} (${(cell as { subject_name?: string; class_name?: string }).class_name ?? ""})` : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {view === "room" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Room timetable</h2>
          <select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))} style={{ maxWidth: 200, marginBottom: "1rem" }}>
            <option value={0}>Select room</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {loading && <p>Loading…</p>}
          {roomData && roomData.grid && (
            <table>
              <thead>
                <tr><th>Day \ Period</th>
                  {Array.from({ length: roomData.periods }, (_, i) => <th key={i}>P{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {roomData.grid.map((row, d) => (
                  <tr key={d}>
                    <td><strong>Day {d + 1}</strong></td>
                    {row.map((cell, p) => (
                      <td key={p}>{cell ? `${(cell as { subject_name?: string; class_name?: string }).subject_name ?? ""} (${(cell as { subject_name?: string; class_name?: string }).class_name ?? ""})` : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {view === "master" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Master timetable</h2>
          {loading && <p>Loading…</p>}
          {masterData && masterData.entries && (
            <p>{masterData.entries.length} entries. Use class/teacher/room view for a grid.</p>
          )}
        </div>
      )}
      {view === "workload" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Teacher workload</h2>
          {loading && <p>Loading…</p>}
          {workloadData && (
            <table>
              <thead><tr><th>Teacher</th><th>Periods scheduled</th></tr></thead>
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
