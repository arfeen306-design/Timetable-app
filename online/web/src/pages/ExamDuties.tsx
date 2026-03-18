import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";
import SearchableSelect from "../components/SearchableSelect";

type Teacher    = Awaited<ReturnType<typeof api.listTeachers>>[0];
type Subject    = Awaited<ReturnType<typeof api.listSubjects>>[0];
type Room       = Awaited<ReturnType<typeof api.listRooms>>[0];
type ExamSession = api.ExamSession;
type ExamSlot    = api.ExamSlot;
type TeacherDutySummary = api.TeacherDutySummary;

type Tab = "setup" | "datesheet" | "assignments" | "summary";

// ── helpers ───────────────────────────────────────────────────────────────────

function badge(txt: string, bg: string, fg: string) {
  return (
    <span style={{
      display: "inline-block", fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px",
      borderRadius: "var(--radius-full)", background: bg, color: fg, whiteSpace: "nowrap",
    }}>{txt}</span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatHours(minutes: number): string {
  if (minutes === 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getDutyCountClass(count: number): string {
  if (count === 0) return "duty-none";
  if (count <= 3)  return "duty-ok";
  if (count <= 6)  return "duty-warn";
  return "duty-heavy";
}

// ══════════════════════════════════════════════════════════════════════════════
// SETUP TAB
// ══════════════════════════════════════════════════════════════════════════════

function SetupTab({ pid, teachers }: { pid: number; teachers: Teacher[] }) {
  const toast = useToast();
  const [_cfg,    setCfg]     = useState<api.ExamDutyConfig | null>(null);
  const [rooms,   setRooms]   = useState(10);
  const [dur,     setDur]     = useState(90);
  const [invPR,   setInvPR]   = useState(1);
  const [exempts, setExempts] = useState<number[]>([]);
  const [addExId, setAddExId] = useState<number | "">("");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.getExamDutyConfig(pid).then(c => {
      setCfg(c);
      setRooms(c.total_exam_rooms);
      setDur(c.duty_duration_minutes);
      setInvPR(c.invigilators_per_room);
      setExempts(c.exempt_teacher_ids);
    }).catch(() => {/* no config yet — defaults */});
  }, [pid]);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.saveExamDutyConfig(pid, {
        total_exam_rooms:      rooms,
        duty_duration_minutes: dur,
        invigilators_per_room: invPR,
        exempt_teacher_ids:    exempts,
      });
      setCfg(updated);
      toast("success", "Configuration saved.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addExempt() {
    if (addExId === "" || exempts.includes(addExId as number)) return;
    setExempts(prev => [...prev, addExId as number]);
    setAddExId("");
  }

  const nonExemptTeachers = teachers.filter(t => !exempts.includes(t.id));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      {/* Config column */}
      <div className="card" style={{ margin: 0 }}>
        <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.9rem", color: "var(--slate-700)" }}>EXAM CONFIGURATION</h4>
        {(["Total exam rooms", "Invigilators / room", "Duty duration (min)"] as const).map((label, i) => {
          const [val, setter] = [
            [rooms, setRooms], [invPR, setInvPR], [dur, setDur],
          ][i] as [number, React.Dispatch<React.SetStateAction<number>>];
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <label style={{ flex: 1, fontSize: "0.82rem", color: "var(--slate-600)" }}>{label}</label>
              <input
                type="number" min={1} value={val}
                onChange={e => setter(Number(e.target.value))}
                style={{ width: 70, textAlign: "center", fontSize: "0.85rem" }}
              />
            </div>
          );
        })}
        <button type="button" className="btn btn-primary" style={{ marginTop: "0.5rem", fontSize: "0.82rem" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      {/* Exempted teachers column */}
      <div className="card" style={{ margin: 0 }}>
        <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.9rem", color: "var(--slate-700)" }}>EXEMPTED TEACHERS</h4>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <select value={addExId} onChange={e => setAddExId(Number(e.target.value))} style={{ flex: 1, fontSize: "0.82rem" }}>
            <option value="">— add exempt teacher —</option>
            {nonExemptTeachers.map(t => (
              <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
            ))}
          </select>
          <button type="button" className="btn" style={{ fontSize: "0.8rem" }} onClick={addExempt} disabled={addExId === ""}>Add</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {exempts.length === 0 && <p style={{ color: "var(--slate-400)", fontSize: "0.8rem", margin: 0 }}>No exemptions set.</p>}
          {exempts.map(id => {
            const t = teachers.find(x => x.id === id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                <span style={{ flex: 1 }}>{t ? `${t.first_name} ${t.last_name}` : `Teacher #${id}`}</span>
                <button type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-400)", fontSize: "0.9rem", padding: "2px 4px" }}
                  onClick={() => setExempts(prev => prev.filter(x => x !== id))}>✕</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DATE SHEET UPLOAD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function DateSheetUpload({ pid, onConfirmed }: { pid: number; onConfirmed: () => void }) {
  const toast = useToast();
  const inputRef                        = useRef<HTMLInputElement>(null);
  const [dragging,   setDragging]       = useState(false);
  const [uploading,  setUploading]      = useState(false);
  const [preview,    setPreview]        = useState<api.ParsedDateSheet | null>(null);
  const [editedRows, setEditedRows]     = useState<api.ParsedExamRow[]>([]);
  const [confirming, setConfirming]     = useState(false);
  const [result,     setResult]         = useState<{ created: number; skipped: number } | null>(null);
  const [uploadErr,  setUploadErr]      = useState<string | null>(null);

  async function handleFile(file: File) {
    const allowed = ["pdf", "xlsx", "xls", "csv", "docx", "doc"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowed.includes(ext)) {
      setUploadErr("Unsupported file type. Upload PDF, Excel (.xlsx / .csv), or Word (.docx).");
      return;
    }
    setUploading(true); setUploadErr(null); setPreview(null); setResult(null);
    try {
      const data = await api.uploadDateSheet(pid, file);
      setPreview(data);
      setEditedRows(data.rows);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!editedRows.length) return;
    setConfirming(true);
    try {
      const res = await api.confirmDateSheet(pid, editedRows);
      setResult({ created: res.created, skipped: res.skipped });
      if (res.errors.length) res.errors.forEach(e => toast("error", e));
      setPreview(null); setEditedRows([]);
      onConfirmed();
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Failed to save sessions.");
    } finally {
      setConfirming(false);
    }
  }

  const updateRow = (idx: number, patch: Partial<api.ParsedExamRow>) =>
    setEditedRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const removeRow = (idx: number) =>
    setEditedRows(prev => prev.filter((_, i) => i !== idx));

  return (
    <div style={{ marginBottom: "1rem" }}>
      {/* Drop zone */}
      {!preview && !result && (
        <div
          style={{
            border: `2px dashed ${dragging ? "var(--primary-400)" : "var(--slate-300)"}`,
            borderRadius: "var(--radius-lg)", padding: "28px 20px", textAlign: "center",
            cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.7 : 1,
            background: dragging ? "var(--primary-50)" : "var(--slate-50)",
            transition: "all 0.15s",
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          {uploading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 24, height: 24, border: "3px solid var(--slate-200)",
                borderTopColor: "var(--primary-500)", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              <span style={{ fontSize: "0.82rem", color: "var(--slate-500)" }}>Parsing document…</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>📎</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--slate-700)" }}>Upload Date Sheet</div>
              <div style={{ fontSize: "0.78rem", color: "var(--slate-500)", marginTop: 3 }}>Drag & drop or click to browse</div>
              <div style={{
                fontSize: "0.7rem", color: "var(--slate-400)", marginTop: 8,
                display: "inline-block", padding: "2px 10px",
                border: "1px solid var(--slate-200)", borderRadius: "var(--radius-full)",
              }}>PDF · Excel (.xlsx / .csv) · Word (.docx)</div>
            </>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadErr && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", marginTop: 8,
          background: "var(--danger-50)", color: "var(--danger-600)",
          borderRadius: "var(--radius-md)", fontSize: "0.8rem",
        }}>
          <span>⚠ {uploadErr}</span>
          <button type="button" onClick={() => setUploadErr(null)}
            style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "auto", fontSize: "1rem", color: "var(--danger-400)" }}>×</button>
        </div>
      )}

      {/* Success banner */}
      {result && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          background: "var(--success-50)", color: "var(--success-700)",
          borderRadius: "var(--radius-md)", fontSize: "0.82rem",
        }}>
          <span>✓ <strong>{result.created}</strong> paper{result.created !== 1 ? "s" : ""} added to date sheet.
            {result.skipped > 0 ? ` ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""} skipped.` : ""}
          </span>
          <button type="button" className="btn" style={{ marginLeft: "auto", fontSize: "0.72rem", padding: "2px 8px" }}
            onClick={() => setResult(null)}>Upload another</button>
        </div>
      )}

      {/* Preview table */}
      {preview && editedRows.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem", flexWrap: "wrap", gap: 8 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{editedRows.length} paper{editedRows.length !== 1 ? "s" : ""} found</span>
              <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--slate-400)" }}>{preview.file_type} · {preview.parser_notes}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn" style={{ fontSize: "0.75rem" }}
                onClick={() => { setPreview(null); setEditedRows([]); }}>Clear</button>
              <button type="button" className="btn btn-primary" style={{ fontSize: "0.75rem" }}
                onClick={handleConfirm} disabled={confirming}>
                {confirming ? "Saving…" : `Confirm all ${editedRows.length} papers`}
              </button>
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {preview.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: "0.75rem", color: "var(--warning-600)", padding: "2px 0" }}>⚠ {w}</div>
              ))}
            </div>
          )}

          <table className="data-table" style={{ fontSize: "0.8rem" }}>
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Date</th><th>Subject</th><th>Start</th><th>End</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {editedRows.map((row, idx) => (
                <tr key={idx} style={{ background: row.confidence < 0.8 ? "#FFFBF0" : undefined }}>
                  <td style={{ textAlign: "center", fontSize: "0.85rem" }}>
                    {row.confidence >= 0.8 ? "✓" : <span style={{ color: "var(--warning-500)" }}>⚠</span>}
                  </td>
                  <td>
                    <input type="date" value={row.date_str}
                      onChange={e => updateRow(idx, { date_str: e.target.value })}
                      style={{ border: "1px solid var(--slate-200)", borderRadius: 4, padding: "3px 5px", fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}
                    />
                  </td>
                  <td>
                    <input type="text" value={row.subject} placeholder="Subject name"
                      onChange={e => updateRow(idx, { subject: e.target.value })}
                      style={{ border: "1px solid var(--slate-200)", borderRadius: 4, padding: "3px 6px", fontSize: "0.78rem", minWidth: 120 }}
                    />
                    {row.warning && <div style={{ fontSize: "0.65rem", color: "var(--warning-600)" }}>{row.warning}</div>}
                  </td>
                  <td>
                    <input type="time" value={row.start_time}
                      onChange={e => updateRow(idx, { start_time: e.target.value })}
                      style={{ border: "1px solid var(--slate-200)", borderRadius: 4, padding: "3px 5px", fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}
                    />
                  </td>
                  <td>
                    <input type="time" value={row.end_time}
                      onChange={e => updateRow(idx, { end_time: e.target.value })}
                      style={{ border: "1px solid var(--slate-200)", borderRadius: 4, padding: "3px 5px", fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}
                    />
                  </td>
                  <td>
                    <button type="button"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-400)", fontSize: "1rem", padding: "0 4px" }}
                      onClick={() => removeRow(idx)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty parse */}
      {preview && editedRows.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px", background: "var(--slate-50)", borderRadius: "var(--radius-lg)", marginTop: 8 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 6 }}>No exam papers detected</div>
          <div style={{ fontSize: "0.8rem", color: "var(--slate-500)", marginBottom: 10 }}>
            The parser could not find date/subject/time data in this file.<br/>
            Image-based (scanned) PDFs are not supported — try an Excel version.
          </div>
          <button type="button" className="btn" style={{ fontSize: "0.78rem" }}
            onClick={() => setPreview(null)}>Try another file</button>
        </div>
      )}

      {/* Divider */}
      {!preview && !result && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0", color: "var(--slate-400)", fontSize: "0.75rem" }}>
          <div style={{ flex: 1, height: 1, background: "var(--slate-200)" }} />
          or add manually
          <div style={{ flex: 1, height: 1, background: "var(--slate-200)" }} />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DATE SHEET TAB
// ══════════════════════════════════════════════════════════════════════════════

function DateSheetTab({
  pid, sessions, subjects, rooms,
  onCreated, onDeleted, onRefetch,
}: {
  pid: number;
  sessions: ExamSession[];
  subjects: Subject[];
  rooms: Room[];
  onCreated: (s: ExamSession) => void;
  onDeleted: (id: number) => void;
  onRefetch: () => void;
}) {
  const toast = useToast();
  const [showAdd,    setShowAdd]    = useState(false);
  const [prefillDate, setPrefillDate] = useState("");
  const [fSubject,   setFSubject]   = useState<number | "">("");
  const [fDate,      setFDate]      = useState("");
  const [fStart,     setFStart]     = useState("09:00");
  const [fEnd,       setFEnd]       = useState("12:00");
  const [fRooms,     setFRooms]     = useState<number[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  function openAddModal(prefill?: string) {
    setPrefillDate(prefill ?? "");
    setFDate(prefill ?? "");
    setFSubject("");
    setFStart("09:00");
    setFEnd("12:00");
    setFRooms([]);
    setFormError("");
    setShowAdd(true);
  }

  const subjectTeacherNote = fSubject !== "" ? `Subject: ${subjects.find(s => s.id === fSubject)?.name ?? ""}` : "";

  async function create() {
    if (fSubject === "" || !fDate || !fStart || !fEnd) {
      setFormError("Subject, date, start and end time are required.");
      return;
    }
    if (fEnd <= fStart) { setFormError("End time must be after start time."); return; }
    setFormError(""); setSaving(true);
    try {
      const created = await api.createExamSession(pid, {
        subject_id: fSubject as number, date: fDate,
        start_time: fStart, end_time: fEnd, room_ids: fRooms,
      });
      onCreated(created);
      toast("success", "Exam session added.");
      setShowAdd(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    try {
      await api.deleteExamSession(pid, id);
      onDeleted(id);
      setConfirmDel(null);
      toast("success", "Session removed.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  // Group sessions by date
  const sessionsByDate: Record<string, ExamSession[]> = {};
  sessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  });
  Object.values(sessionsByDate).forEach(group =>
    group.sort((a, b) => a.start_time.localeCompare(b.start_time))
  );
  const sortedDates = Object.keys(sessionsByDate).sort();

  return (
    <div>
      <DateSheetUpload pid={pid} onConfirmed={onRefetch} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
        <button type="button" className="btn btn-primary" style={{ fontSize: "0.82rem" }} onClick={() => openAddModal()}>
          + Add Paper
        </button>
      </div>

      {sessions.length === 0 && !showAdd && (
        <p className="subheading" style={{ textAlign: "center", padding: "2rem 0" }}>No exam sessions yet. Add a paper to get started.</p>
      )}

      {sortedDates.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Subject</th><th>Time</th><th>Rooms</th><th>Assigned</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sortedDates.map(date => {
              const group = sessionsByDate[date];
              return group.map((s, idx) => (
                <tr key={s.id} style={idx === 0 ? { borderTop: "2px solid var(--border-default)" } : {}}>
                  {idx === 0 && (
                    <td rowSpan={group.length} style={{ verticalAlign: "top", paddingTop: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {formatDate(date)}
                      <button
                        type="button"
                        title="Add another paper on this day"
                        onClick={() => openAddModal(date)}
                        style={{
                          marginLeft: 6, background: "none", cursor: "pointer",
                          border: "1px dashed var(--primary-400)", borderRadius: 4,
                          color: "var(--primary-500)", fontSize: "11px", padding: "1px 5px",
                        }}
                      >+</button>
                    </td>
                  )}
                  <td>
                    <span style={{ fontWeight: 600, color: s.subject_color || "var(--primary-600)" }}>{s.subject_name}</span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{s.start_time} – {s.end_time}</td>
                  <td>{s.room_ids.length > 0 ? `${s.room_ids.length} room${s.room_ids.length !== 1 ? "s" : ""}` : "—"}</td>
                  <td>
                    {s.slot_count >= s.slots_needed && s.slots_needed > 0
                      ? badge("Full", "var(--success-100)", "var(--success-700)")
                      : s.slot_count > 0
                        ? badge(`${s.slot_count}/${s.slots_needed}`, "var(--warning-100)", "var(--warning-700)")
                        : badge("Unassigned", "var(--slate-100)", "var(--slate-500)")}
                  </td>
                  <td>
                    {confirmDel === s.id ? (
                      <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: "0.75rem" }}>
                        Remove?
                        <button type="button" className="btn btn-danger" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => del(s.id)}>Yes</button>
                        <button type="button" className="btn" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => setConfirmDel(null)}>No</button>
                      </span>
                    ) : (
                      <button type="button" className="btn" style={{ fontSize: "0.72rem", padding: "2px 8px", color: "var(--danger-500)" }}
                        onClick={() => setConfirmDel(s.id)}>Remove</button>
                    )}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      )}

      {/* Add Paper modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => !saving && setShowAdd(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Exam Paper{prefillDate && ` — ${formatDate(prefillDate)}`}</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Subject:</label>
                <select value={fSubject} onChange={e => { setFSubject(Number(e.target.value)); setFormError(""); }} autoFocus>
                  <option value="">— select subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label required">Date:</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
              <div className="modal-field">
                <label className="modal-label required">Start time:</label>
                <input type="time" value={fStart} onChange={e => setFStart(e.target.value)} />
              </div>
              <div className="modal-field">
                <label className="modal-label required">End time:</label>
                <input type="time" value={fEnd} onChange={e => setFEnd(e.target.value)} />
              </div>
              <div className="modal-field" style={{ alignItems: "flex-start" }}>
                <label className="modal-label" style={{ paddingTop: 4 }}>Rooms:</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {rooms.map(r => {
                    const sel = fRooms.includes(r.id);
                    return (
                      <button
                        key={r.id} type="button"
                        style={{
                          fontSize: "0.72rem", padding: "3px 8px", borderRadius: "var(--radius-sm)",
                          border: "1px solid", cursor: "pointer",
                          background: sel ? "var(--primary-500)" : "var(--slate-50)",
                          color: sel ? "#fff" : "var(--slate-600)",
                          borderColor: sel ? "var(--primary-500)" : "var(--slate-200)",
                          transition: "all var(--t-fast)",
                        }}
                        onClick={() => setFRooms(prev => sel ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                      >{r.name}</button>
                    );
                  })}
                  {rooms.length === 0 && <span style={{ color: "var(--slate-400)", fontSize: "0.78rem" }}>No rooms in project.</span>}
                </div>
              </div>
              {fSubject !== "" && (
                <p style={{ margin: "0.25rem 0 0 160px", fontSize: "0.75rem", color: "var(--warning-600)" }}>
                  ⚠ Teachers who teach {subjectTeacherNote} will be excluded automatically on this date.
                </p>
              )}
              {formError && <p style={{ color: "var(--danger-600)", fontSize: "0.8rem", margin: "0.25rem 0 0 160px" }}>{formError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={create} disabled={saving || fSubject === "" || !fDate}>
                {saving ? "Adding…" : "Add to Sheet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════

function AssignmentsTab({
  pid, sessions, teachers, rooms,
}: {
  pid: number;
  sessions: ExamSession[];
  teachers: Teacher[];
  rooms: Room[];
}) {
  const toast = useToast();
  const [slots,       setSlots]       = useState<Record<number, ExamSlot[]>>({});
  const [loading,     setLoading]     = useState<Set<number>>(new Set());
  const [autoRunning, setAutoRunning] = useState<Set<number>>(new Set());
  const [assignModal, setAssignModal] = useState<{ session: ExamSession; roomId: number | null } | null>(null);
  const [aTeacher,    setATeacher]    = useState<number | "">("");
  const [aError,      setAError]      = useState("");
  const [aSaving,     setASaving]     = useState(false);
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  const loadSlots = useCallback(async (sessionId: number) => {
    setLoading(prev => new Set([...prev, sessionId]));
    try {
      const s = await api.listExamSlots(pid, sessionId);
      setSlots(prev => ({ ...prev, [sessionId]: s }));
    } catch { /* silent */ }
    finally { setLoading(prev => { const n = new Set(prev); n.delete(sessionId); return n; }); }
  }, [pid]);

  useEffect(() => {
    sessions.forEach(s => loadSlots(s.id));
  }, [sessions, loadSlots]);

  async function removeSlot(sessionId: number, slotId: number) {
    try {
      await api.removeExamSlot(pid, sessionId, slotId);
      setSlots(prev => ({ ...prev, [sessionId]: (prev[sessionId] || []).filter(sl => sl.id !== slotId) }));
      toast("success", "Assignment removed.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Remove failed");
    }
  }

  async function autoAssign(sessionId: number) {
    setAutoRunning(prev => new Set([...prev, sessionId]));
    try {
      const res = await api.autoAssignExamDuties(pid, sessionId);
      if (res.assigned.length > 0) {
        toast("success", `Auto-assigned ${res.assigned.length} teacher${res.assigned.length !== 1 ? "s" : ""}.`);
        await loadSlots(sessionId);
      }
      if (res.warnings.length > 0) {
        res.warnings.forEach(w => toast("error", w));
      }
      if (res.assigned.length === 0 && res.warnings.length === 0) {
        toast("success", "All rooms already assigned.");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Auto-assign failed");
    } finally {
      setAutoRunning(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
    }
  }

  async function manualAssign() {
    if (!assignModal || aTeacher === "") return;
    setAError(""); setASaving(true);
    try {
      const slot = await api.assignExamSlot(pid, assignModal.session.id, {
        teacher_id: aTeacher as number,
        room_id: assignModal.roomId ?? undefined,
      });
      setSlots(prev => ({ ...prev, [assignModal.session.id]: [...(prev[assignModal.session.id] || []), slot] }));
      toast("success", "Teacher assigned.");
      setAssignModal(null);
    } catch (err) {
      setAError(err instanceof Error ? err.message : "Assign failed");
    } finally { setASaving(false); }
  }

  if (sessions.length === 0) {
    return <p className="subheading" style={{ textAlign: "center", padding: "2rem 0" }}>Add exam sessions in the Date Sheet tab first.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {sessions.map(sess => {
        const sessSlots = slots[sess.id] || [];
        const isLoading = loading.has(sess.id);
        const isAuto    = autoRunning.has(sess.id);
        const assignedRoomIds = new Set(sessSlots.map(s => s.room_id));
        const unassignedRoomIds = sess.room_ids.filter(rid => !assignedRoomIds.has(rid));
        const assignedTeacherIds = new Set(sessSlots.map(s => s.teacher_id));
        const availableTeachers  = teachers.filter(t => !assignedTeacherIds.has(t.id));

        return (
          <div key={sess.id} style={{
            border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)",
            overflow: "hidden", background: "var(--surface-card)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-subtle)",
              background: "var(--surface-raised)",
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: sess.subject_color || "var(--primary-600)" }}>
                  {sess.subject_name}
                </span>
                <span style={{ marginLeft: 10, fontSize: "0.8rem", color: "var(--slate-500)" }}>
                  {new Date(sess.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}{sess.start_time}–{sess.end_time}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>
                {sess.room_ids.length} room{sess.room_ids.length !== 1 ? "s" : ""} · {sessSlots.length}/{sess.room_ids.length} assigned
              </span>
              <button type="button" className="btn btn-primary" style={{ fontSize: "0.75rem" }}
                disabled={isAuto || unassignedRoomIds.length === 0}
                onClick={() => autoAssign(sess.id)}>
                {isAuto ? "Assigning…" : "Auto-assign remaining"}
              </button>
            </div>

            <div style={{ padding: "0.75rem 1rem" }}>
              {isLoading && <p style={{ color: "var(--slate-400)", fontSize: "0.8rem" }}>Loading…</p>}

              {sessSlots.length > 0 && (
                <div style={{ marginBottom: "0.6rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>ASSIGNED</div>
                  {sessSlots.map(sl => (
                    <div key={sl.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--slate-500)", minWidth: 70 }}>{sl.room_name || `Room #${sl.room_id}`}</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>→ {sl.teacher_name}</span>
                      <span style={{ color: "var(--slate-400)", fontSize: "0.72rem" }}>{sl.duty_start}–{sl.duty_end}</span>
                      <button type="button"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-400)", fontSize: "0.9rem", padding: "0 3px" }}
                        onClick={() => removeSlot(sess.id, sl.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {unassignedRoomIds.length > 0 && (
                <div style={{ marginBottom: "0.6rem" }}>
                  {unassignedRoomIds.map(rid => {
                    const r = roomMap.get(rid);
                    return (
                      <div key={rid} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", fontSize: "0.82rem" }}>
                        <span style={{ color: "var(--slate-500)", minWidth: 70 }}>{r?.name ?? `Room #${rid}`}</span>
                        <span style={{ flex: 1, color: "var(--slate-400)" }}>(unassigned)</span>
                        <button type="button" className="btn" style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                          onClick={() => { setAssignModal({ session: sess, roomId: rid }); setATeacher(""); setAError(""); }}>
                          Assign
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {availableTeachers.length > 0 && unassignedRoomIds.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>AVAILABLE TEACHERS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {availableTeachers.slice(0, 6).map(t => (
                      <button key={t.id} type="button"
                        style={{
                          fontSize: "0.72rem", padding: "3px 9px", borderRadius: "var(--radius-sm)",
                          background: "var(--primary-50)", color: "var(--primary-700)",
                          border: "1px solid var(--primary-200)", cursor: "pointer",
                          transition: "all var(--t-fast)",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-100)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--primary-50)"; }}
                        onClick={() => { setAssignModal({ session: sess, roomId: unassignedRoomIds[0] ?? null }); setATeacher(t.id); setAError(""); }}
                      >
                        {t.first_name} {t.last_name}
                      </button>
                    ))}
                    {availableTeachers.length > 6 && (
                      <span style={{ fontSize: "0.72rem", color: "var(--slate-400)", padding: "3px 4px" }}>
                        +{availableTeachers.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {assignModal && (
        <div className="modal-overlay" onClick={() => !aSaving && setAssignModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Assign Teacher
              <span style={{ marginLeft: 8, fontSize: "0.8rem", fontWeight: 400, color: "var(--slate-500)" }}>
                {assignModal.session.subject_name} · {assignModal.roomId ? (roomMap.get(assignModal.roomId)?.name ?? `Room #${assignModal.roomId}`) : "No room"}
              </span>
            </h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Teacher:</label>
                <SearchableSelect
                  value={aTeacher}
                  onChange={v => { setATeacher(v ? Number(v) : ""); setAError(""); }}
                  options={teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name} (${t.code})` }))}
                  placeholder="— select teacher —"
                  autoFocus
                />
              </div>
              {aError && <p style={{ color: "var(--danger-600)", fontSize: "0.8rem", margin: "0.25rem 0 0 160px" }}>{aError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setAssignModal(null)} disabled={aSaving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={manualAssign} disabled={aSaving || aTeacher === ""}>
                {aSaving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY TAB
// ══════════════════════════════════════════════════════════════════════════════

type SortKey = "teacher_name" | "exam_duty_count" | "exam_duty_minutes" | "roster_duty_count" | "total_duty_events";

function SummaryTab({ pid }: { pid: number }) {
  const toast = useToast();
  const [summary,   setSummary]   = useState<TeacherDutySummary[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sortKey,   setSortKey]   = useState<SortKey>("total_duty_events");
  const [sortAsc,   setSortAsc]   = useState(false);

  useEffect(() => {
    api.getTeacherDutySummary(pid)
      .then(data => setSummary(data))
      .catch(err => toast("error", err instanceof Error ? err.message : "Failed to load summary"))
      .finally(() => setLoading(false));
  }, [pid, toast]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const active = summary.filter(t => !t.is_exempt);
  const exempt = summary.filter(t => t.is_exempt);

  const sorted = [...active].sort((a, b) => {
    const va = a[sortKey] as string | number;
    const vb = b[sortKey] as string | number;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sortAsc ? cmp : -cmp;
  });

  const dutyColors: Record<string, string> = {
    "duty-none":  "var(--slate-400)",
    "duty-ok":    "var(--success-600)",
    "duty-warn":  "var(--warning-600)",
    "duty-heavy": "var(--danger-600)",
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort(k)}>
      {label}{sortKey === k ? (sortAsc ? " ▲" : " ▼") : ""}
    </th>
  );

  if (loading) return <p className="subheading" style={{ padding: "2rem 0", textAlign: "center" }}>Loading summary…</p>;

  return (
    <div>
      <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.9rem", color: "var(--slate-700)" }}>
        TEACHER DUTY SUMMARY
      </h4>
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader k="teacher_name" label="Teacher" />
            <th>Subject</th>
            <SortHeader k="exam_duty_count" label="Exam Duties" />
            <SortHeader k="exam_duty_minutes" label="Hours" />
            <SortHeader k="roster_duty_count" label="Roster" />
            <SortHeader k="total_duty_events" label="Total" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(t => {
            const cls = getDutyCountClass(t.total_duty_events);
            const clr = dutyColors[cls];
            return (
              <tr key={t.teacher_id}>
                <td style={{ fontWeight: 600 }}>{t.teacher_name}</td>
                <td style={{ color: "var(--slate-500)", fontSize: "0.8rem" }}>{t.subject || "—"}</td>
                <td>
                  <span style={{ fontWeight: 600, color: dutyColors[getDutyCountClass(t.exam_duty_count)] }}>
                    {t.exam_duty_count}
                  </span>
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  {formatHours(t.exam_duty_minutes)}
                </td>
                <td>{t.roster_duty_count}</td>
                <td>
                  <span style={{ fontWeight: 700, color: clr }}>{t.total_duty_events}</span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--slate-400)", padding: "1.5rem 0" }}>No teachers found.</td></tr>
          )}
        </tbody>
      </table>

      {exempt.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--slate-500)", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
            EXEMPT FROM DUTIES
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {exempt.map(t => (
              <span key={t.teacher_id} style={{
                fontSize: "0.78rem", padding: "3px 10px", borderRadius: "var(--radius-pill)",
                background: "var(--slate-100)", color: "var(--slate-500)",
                border: "1px solid var(--slate-200)",
              }}>{t.teacher_name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function ExamDutiesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid   = Number(projectId);
  const toast = useToast();

  const [tab,      setTab]      = useState<Tab>("setup");
  const [loading,  setLoading]  = useState(true);
  const [exporting, setExporting] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms,    setRooms]    = useState<Room[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);

  useEffect(() => {
    Promise.all([
      api.listTeachers(pid),
      api.listSubjects(pid),
      api.listRooms(pid),
      api.listExamSessions(pid),
    ]).then(([t, s, r, sess]) => {
      setTeachers(t); setSubjects(s); setRooms(r); setSessions(sess);
    }).catch(err => {
      toast("error", err instanceof Error ? err.message : "Failed to load exam duties");
    }).finally(() => setLoading(false));
  }, [pid, toast]);

  async function refetchSessions() {
    try {
      const sess = await api.listExamSessions(pid);
      setSessions(sess);
    } catch { /* silent — user will see stale data */ }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      await api.exportExamDutiesPdf(pid);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "setup",       label: "⚙️ Setup" },
    { key: "datesheet",   label: "📋 Date Sheet" },
    { key: "assignments", label: "👤 Assignments" },
    { key: "summary",     label: "📊 Summary" },
  ];

  if (loading) return <div className="card"><p className="subheading">Loading…</p></div>;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Exam Duties</h2>
          <p className="subheading" style={{ margin: 0 }}>Schedule exam invigilators with conflict-free auto-assignment.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" style={{ fontSize: "0.78rem" }}
            onClick={async () => {
              try {
                const r = await api.publishSnapshot(pid, "exam_duties");
                toast("success", `Published: ${r.title} (${r.record_count} records)`);
              } catch (e) { toast("error", e instanceof Error ? e.message : "Publish failed"); }
            }}>📦 Publish</button>
          <button type="button" className="btn" style={{ fontSize: "0.78rem" }}
            onClick={handleExportPdf}
            disabled={exporting}>
            {exporting ? "Exporting…" : "📄 Export PDF"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "0" }}>
        {TABS.map(t => (
          <button key={t.key} type="button"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.5rem 1rem", fontSize: "0.84rem", fontWeight: 600,
              fontFamily: "var(--font-sans)",
              color: tab === t.key ? "var(--primary-600)" : "var(--slate-500)",
              borderBottom: tab === t.key ? "2px solid var(--primary-500)" : "2px solid transparent",
              transition: "all var(--t-fast)", marginBottom: "-1px",
            }}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "setup"       && <SetupTab pid={pid} teachers={teachers} />}
      {tab === "datesheet"   && (
        <DateSheetTab
          pid={pid} sessions={sessions} subjects={subjects} rooms={rooms}
          onCreated={s => {
            const subj = subjects.find(x => x.id === s.subject_id);
            setSessions(prev => [...prev, {
              ...s,
              subject_name: subj?.name ?? "",
              subject_color: subj?.color ?? "",
              slot_count: 0,
              slots_needed: s.room_ids.length,
            }]);
          }}
          onDeleted={id => setSessions(prev => prev.filter(s => s.id !== id))}
          onRefetch={refetchSessions}
        />
      )}
      {tab === "assignments" && (
        <AssignmentsTab pid={pid} sessions={sessions} teachers={teachers} rooms={rooms} />
      )}
      {tab === "summary"     && <SummaryTab pid={pid} />}
    </div>
  );
}
