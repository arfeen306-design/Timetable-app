import React, { useState, useEffect } from "react";
import * as api from "../../api";
import { useToast } from "../../context/ToastContext";
import SearchableSelect from "../../components/SearchableSelect";

type Lesson = Awaited<ReturnType<typeof api.listLessons>>[0];
type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];
type SchoolClass = Awaited<ReturnType<typeof api.listClasses>>[0];
import type { Subject } from "../../api";

interface Props {
  pid: number;
  lessons: Lesson[];
  subjects: Subject[];
  classes: SchoolClass[];
  teachers: Teacher[];
  onChange: (l: Lesson[]) => void;
  onNext: () => void;
}

function LessonsTab({ pid, lessons, subjects, classes, teachers, onChange, onNext }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  /* ── Teacher → Subject mapping (fetched once) ── */
  const [teacherSubjectMap, setTeacherSubjectMap] = useState<Map<number, number[]>>(new Map());
  useEffect(() => {
    if (teachers.length === 0) return;
    Promise.all(
      teachers.map(t =>
        api.getTeacherSubjects(pid, t.id)
          .then(ids => ({ id: t.id, ids }))
          .catch(() => ({ id: t.id, ids: [] as number[] }))
      )
    ).then(results => {
      const map = new Map<number, number[]>();
      results.forEach(r => map.set(r.id, r.ids));
      setTeacherSubjectMap(map);
    });
  }, [pid, teachers.length]);

  /* Single lesson form — now supports multi-class */
  const [fTeacher, setFTeacher] = useState(0);
  const [fSubject, setFSubject] = useState(0);
  const [fClasses, setFClasses] = useState<number[]>([]);
  const [fLessons, setFLessons] = useState(1);
  const [saving, setSaving] = useState(false);

  /* Bulk assign — cascading grade → section */
  const [bulkTeacher, setBulkTeacher] = useState(0);
  const [bulkSubject, setBulkSubject] = useState(0);
  const [bulkSelectedGrades, setBulkSelectedGrades] = useState<string[]>([]);
  const [bulkSelectedClasses, setBulkSelectedClasses] = useState<number[]>([]);
  const [bulkLpw, setBulkLpw] = useState(1);
  const [bulkSaving, setBulkSaving] = useState(false);

  /* Copy from class */
  const [copySource, setCopySource] = useState(0);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);
  const [copySaving, setCopySaving] = useState(false);

  /* ── Auto-populate subject when teacher changes (single modal) ── */
  useEffect(() => {
    if (!fTeacher) { setFSubject(0); return; }
    const linked = teacherSubjectMap.get(fTeacher) || [];
    if (linked.length === 1) {
      setFSubject(linked[0]);
    } else if (linked.length > 1 && !linked.includes(fSubject)) {
      setFSubject(linked[0]);
    } else if (linked.length === 0) {
      setFSubject(0);
    }
  }, [fTeacher, teacherSubjectMap]);

  /* ── Auto-populate subject when teacher changes (bulk modal) ── */
  useEffect(() => {
    if (!bulkTeacher) { setBulkSubject(0); return; }
    const linked = teacherSubjectMap.get(bulkTeacher) || [];
    if (linked.length === 1) {
      setBulkSubject(linked[0]);
    } else if (linked.length > 1 && !linked.includes(bulkSubject)) {
      setBulkSubject(linked[0]);
    } else if (linked.length === 0) {
      setBulkSubject(0);
    }
  }, [bulkTeacher, teacherSubjectMap]);

  /* ── Compute filtered subjects for selected teacher ── */
  const fLinkedSubjectIds = fTeacher ? (teacherSubjectMap.get(fTeacher) || []) : [];
  const fLinkedSubjects = fLinkedSubjectIds.length > 0
    ? subjects.filter(s => fLinkedSubjectIds.includes(s.id))
    : subjects;
  const fIsOverride = fSubject && fLinkedSubjectIds.length > 0 && !fLinkedSubjectIds.includes(fSubject);

  const bulkLinkedSubjectIds = bulkTeacher ? (teacherSubjectMap.get(bulkTeacher) || []) : [];
  const bulkLinkedSubjects = bulkLinkedSubjectIds.length > 0
    ? subjects.filter(s => bulkLinkedSubjectIds.includes(s.id))
    : subjects;
  const bulkIsOverride = bulkSubject && bulkLinkedSubjectIds.length > 0 && !bulkLinkedSubjectIds.includes(bulkSubject);

  function nameTeacher(id: number) { const t = teachers.find(x => x.id === id); return t ? `${t.first_name} ${t.last_name}` : `#${id}`; }
  function nameSubject(id: number) { return subjects.find(x => x.id === id)?.name ?? `#${id}`; }
  function nameClass(id: number) { return classes.find(x => x.id === id)?.name ?? `#${id}`; }

  const totalLessons = lessons.reduce((s, l) => s + l.periods_per_week, 0);

  /* Max lessons warning */
  function teacherMaxWeek(tid: number): number {
    const t = teachers.find(x => x.id === tid);
    return t?.max_periods_week ?? 30;
  }
  function teacherCurrentLoad(tid: number): number {
    return lessons.filter(l => l.teacher_id === tid).reduce((s, l) => s + l.periods_per_week, 0);
  }

  /* Check prerequisites */
  const missing: string[] = [];
  if (teachers.length === 0) missing.push("Teachers");
  if (subjects.length === 0) missing.push("Subjects");
  if (classes.length === 0) missing.push("Classes");

  function openAddModal() {
    setFTeacher(0); setFSubject(0); setFClasses([]); setFLessons(1);
    setModalOpen(true);
  }

  /* ── Multi-class add: creates one lesson per selected class ── */
  async function addLessons() {
    if (!fTeacher || !fSubject || fClasses.length === 0) return;

    // Overload warning
    const adding = fClasses.length * fLessons;
    const current = teacherCurrentLoad(fTeacher);
    const max = teacherMaxWeek(fTeacher);
    if (current + adding > max) {
      const over = current + adding - max;
      if (!confirm(`⚠️ This will exceed ${nameTeacher(fTeacher)}'s weekly limit by ${over} lesson(s) (${current + adding}/${max}). Continue?`)) return;
    }

    setSaving(true);
    let created = 0;
    try {
      for (const classId of fClasses) {
        await api.createLesson(pid, {
          teacher_id: fTeacher, subject_id: fSubject,
          class_id: classId, periods_per_week: fLessons,
        });
        created++;
      }
      const list = await api.listLessons(pid);
      onChange(list);
      setModalOpen(false);
      toast("success", `${created} lesson${created !== 1 ? "s" : ""} added.`);
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function deleteSelected() {
    if (selectedId == null) return;
    if (!confirm("Delete this lesson assignment?")) return;
    try {
      await api.deleteLesson(pid, selectedId);
      onChange(lessons.filter(l => l.id !== selectedId));
      setSelectedId(null);
      toast("success", "Lesson deleted.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Delete failed"); }
  }

  async function doBulkAssign() {
    if (!bulkTeacher || !bulkSubject) return;
    if (bulkSelectedClasses.length === 0) { toast("info", "Select at least one class."); return; }

    // Overload warning
    const adding = bulkSelectedClasses.length * bulkLpw;
    const current = teacherCurrentLoad(bulkTeacher);
    const max = teacherMaxWeek(bulkTeacher);
    if (current + adding > max) {
      const over = current + adding - max;
      if (!confirm(`⚠️ This will exceed ${nameTeacher(bulkTeacher)}'s weekly limit by ${over} lesson(s) (${current + adding}/${max}). Continue?`)) return;
    }

    setBulkSaving(true);
    try {
      const res = await api.bulkCreateLessons(pid, {
        teacher_id: bulkTeacher, subject_id: bulkSubject,
        classes: bulkSelectedClasses.map(class_id => ({ class_id, periods_per_week: bulkLpw })),
      });
      if (res.created > 0) { const list = await api.listLessons(pid); onChange(list); setBulkOpen(false); toast("success", `Created ${res.created} lesson(s).`); }
      if (res.errors.length > 0) toast("error", "Some rows failed: " + res.errors.map(e => e.message).join("; "));
    } catch (err) { toast("error", err instanceof Error ? err.message : "Bulk assign failed"); }
    finally { setBulkSaving(false); }
  }

  async function doCopy() {
    if (!copySource || copyTargets.length === 0) return;
    setCopySaving(true);
    try {
      const res = await api.copyLessonsFromClass(pid, copySource, copyTargets);
      if (res.copied > 0) { const list = await api.listLessons(pid); onChange(list); setCopyOpen(false); toast("success", `Copied ${res.copied} lesson(s).`); }
    } catch (err) { toast("error", err instanceof Error ? err.message : "Copy failed"); }
    finally { setCopySaving(false); }
  }

  /* ── Helper: toggle class in multi-select ── */
  function toggleClass(id: number) {
    setFClasses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function selectAllClasses() { setFClasses(classes.map(c => c.id)); }
  function clearClasses() { setFClasses([]); }

  /* ── Helper: Subject selector with auto-fill indicator ── */
  function SubjectSelector({ value, onChange: onChangeSub, linkedIds, linkedSubjects, allSubjects, isOverride }: {
    value: number; onChange: (v: number) => void;
    linkedIds: number[]; linkedSubjects: Subject[]; allSubjects: Subject[];
    isOverride: boolean;
  }) {
    const [showAll, setShowAll] = useState(false);
    const displayList = showAll ? allSubjects : (linkedSubjects.length > 0 ? linkedSubjects : allSubjects);

    return (
      <div>
        <select
          value={value}
          onChange={e => onChangeSub(Number(e.target.value))}
          style={{
            maxWidth: "100%",
            borderColor: isOverride ? "var(--warning-500, #f59e0b)" : undefined,
          }}
        >
          <option value={0}>
            {linkedIds.length === 0 ? "No subjects linked — select manually" : "Select subject"}
          </option>
          {displayList.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
              {linkedIds.includes(s.id) ? " ✓" : ""}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 4, fontSize: "0.72rem" }}>
          {linkedIds.length === 1 && value === linkedIds[0] && (
            <span style={{ color: "var(--success-600, #16a34a)", fontWeight: 600 }}>
              ✓ Auto-filled from teacher profile
            </span>
          )}
          {linkedIds.length > 1 && linkedIds.includes(value) && (
            <span style={{ color: "var(--primary-600)", fontWeight: 500 }}>
              {linkedIds.length} subjects linked — showing teacher's subjects
            </span>
          )}
          {linkedIds.length === 0 && (
            <span style={{ color: "var(--warning-500, #f59e0b)", fontStyle: "italic" }}>
              ⚠ No subjects found for this teacher. Add one in the Teachers tab.
            </span>
          )}
          {isOverride && (
            <span style={{ color: "var(--warning-600, #d97706)", fontWeight: 500 }}>
              ⚠ This subject isn't linked to the teacher's profile
            </span>
          )}
        </div>
        {linkedSubjects.length > 0 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              marginTop: 4, fontSize: "0.68rem", background: "none", border: "none",
              color: "var(--primary-500)", cursor: "pointer", textDecoration: "underline", padding: 0,
            }}
          >Show all subjects</button>
        )}
        {showAll && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            style={{
              marginTop: 4, fontSize: "0.68rem", background: "none", border: "none",
              color: "var(--slate-400)", cursor: "pointer", textDecoration: "underline", padding: 0,
            }}
          >Show only linked</button>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Lesson Assignments</h2>
      <p className="subheading">Assign teachers to subjects and classes with weekly lesson counts.</p>

      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn" onClick={openAddModal}>+ Add Lesson</button>
        <button type="button" className="btn btn-primary" onClick={() => { setBulkTeacher(0); setBulkSubject(0); setBulkSelectedGrades([]); setBulkSelectedClasses([]); setBulkLpw(1); setBulkOpen(true); }}>+ Bulk Assign (1 Teacher → Many Classes)</button>
        <button type="button" className="btn" onClick={() => { setCopySource(0); setCopyTargets([]); setCopyOpen(true); }}>Copy from Class</button>
        <button type="button" className="btn btn-danger" onClick={deleteSelected} disabled={selectedId == null}>Delete</button>
        <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.85rem" }}>{lessons.length} lessons, {totalLessons} total lessons/week</span>
      </div>

      {missing.length > 0 && (
        <div className="warning-banner">⚠ You must add {missing.join(", ")} before creating lessons. Go back and fill those tabs first.</div>
      )}

      {lessons.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No lessons added yet.</p>}
      <table className="data-table">
        <thead><tr><th style={{ width: 40 }}>#</th><th>Teacher</th><th>Subject</th><th>Class</th><th>Lessons/Week</th></tr></thead>
        <tbody>
          {lessons.map((l, i) => (
            <tr key={l.id} className={selectedId === l.id ? "selected" : ""} onClick={() => setSelectedId(l.id)}>
              <td>{i + 1}</td><td>{nameTeacher(l.teacher_id)}</td><td>{nameSubject(l.subject_id)}</td><td>{nameClass(l.class_id)}</td><td>{l.periods_per_week}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Constraints →</button>
      </div>

      {/* ═══ Add Lesson Modal (Multi-Class) ═══ */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>Add Lesson</h3>
            <p className="subheading" style={{ margin: "0 0 0.75rem" }}>Select a teacher, subject, and one or more classes.</p>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Teacher:</label>
                <SearchableSelect
                  value={fTeacher || ""}
                  onChange={v => setFTeacher(v ? Number(v) : 0)}
                  options={teachers.map(t => {
                    const cnt = (teacherSubjectMap.get(t.id) || []).length;
                    return { value: t.id, label: `${t.first_name} ${t.last_name}${cnt ? ` (${cnt} subj)` : ''}` };
                  })}
                  placeholder="Select teacher"
                />
              </div>
              <div className="modal-field">
                <label className="modal-label required">Subject:</label>
                {fTeacher ? (
                  <SubjectSelector
                    value={fSubject}
                    onChange={setFSubject}
                    linkedIds={fLinkedSubjectIds}
                    linkedSubjects={fLinkedSubjects}
                    allSubjects={subjects}
                    isOverride={!!fIsOverride}
                  />
                ) : (
                  <select disabled><option>Select a teacher first</option></select>
                )}
              </div>

              {/* Multi-class selector */}
              <div className="modal-field">
                <label className="modal-label required" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Classes:
                  <span style={{ fontSize: "0.68rem", fontWeight: 400, color: "var(--text-muted)" }}>
                    ({fClasses.length} selected)
                  </span>
                  <button type="button" onClick={selectAllClasses} style={{
                    fontSize: "0.65rem", background: "none", border: "1px solid var(--border-default)",
                    borderRadius: 4, padding: "1px 6px", cursor: "pointer", color: "var(--primary-600)", fontWeight: 600,
                  }}>All</button>
                  <button type="button" onClick={clearClasses} style={{
                    fontSize: "0.65rem", background: "none", border: "1px solid var(--border-default)",
                    borderRadius: 4, padding: "1px 6px", cursor: "pointer", color: "var(--text-muted)",
                  }}>Clear</button>
                </label>
                <div style={{
                  maxHeight: 180, overflowY: "auto",
                  border: "1px solid var(--border-default, #e2e8f0)", borderRadius: 8,
                  padding: "6px 10px", background: "var(--surface-card)",
                }}>
                  {classes.map(c => (
                    <label key={c.id} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "3px 0",
                      cursor: "pointer", fontSize: "0.82rem",
                    }}>
                      <input
                        type="checkbox"
                        checked={fClasses.includes(c.id)}
                        onChange={() => toggleClass(c.id)}
                        style={{ width: "auto", accentColor: "var(--primary-500)" }}
                      />
                      <span style={{ fontWeight: fClasses.includes(c.id) ? 600 : 400 }}>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-field">
                <label className="modal-label">Lessons/Week (per class):</label>
                <input type="number" min={1} value={fLessons} onChange={e => setFLessons(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80 }} />
              </div>
            </div>

            {/* Summary */}
            {fTeacher > 0 && fSubject > 0 && fClasses.length > 0 && (
              <div style={{
                marginTop: 8, padding: "8px 12px", borderRadius: 8,
                background: "var(--surface-input, #f8fafc)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.78rem",
              }}>
                Will create <strong>{fClasses.length}</strong> lesson{fClasses.length !== 1 ? "s" : ""} for
                <strong> {nameTeacher(fTeacher)}</strong> teaching <strong>{nameSubject(fSubject)}</strong> × {fLessons}/week each
                = <strong>{fClasses.length * fLessons}</strong> total lessons/week
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addLessons}
                disabled={saving || !fTeacher || !fSubject || fClasses.length === 0}
              >{saving ? "Creating…" : `Add ${fClasses.length || 0} Lesson${fClasses.length !== 1 ? "s" : ""}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bulk Assign Modal (Cascading Grade → Section) ═══ */}
      {bulkOpen && (() => {
        // Compute unique grades from classes
        const uniqueGrades = Array.from(new Set(classes.map(c => c.grade).filter(Boolean)));
        // Classes filtered by selected grades
        const filteredClasses = bulkSelectedGrades.length > 0
          ? classes.filter(c => bulkSelectedGrades.includes(c.grade))
          : [];
        const bulkTotal = bulkSelectedClasses.length * bulkLpw;

        return (
          <div className="modal-overlay" onClick={() => setBulkOpen(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
              <h3 style={{ marginTop: 0 }}>Bulk Assign</h3>
              <p className="subheading" style={{ margin: "0 0 0.75rem" }}>Select teacher → grades → sections → lessons/week.</p>

              {/* Step 1: Teacher + Subject */}
              <div className="modal-form">
                <div className="modal-field"><label className="modal-label required">Teacher:</label>
                  <SearchableSelect
                    value={bulkTeacher || ""}
                    onChange={v => setBulkTeacher(v ? Number(v) : 0)}
                    options={teachers.map(t => {
                      const cnt = (teacherSubjectMap.get(t.id) || []).length;
                      return { value: t.id, label: `${t.first_name} ${t.last_name}${cnt ? ` (${cnt} subj)` : ''}` };
                    })}
                    placeholder="Select teacher"
                    style={{ maxWidth: "100%" }}
                  />
                </div>
                <div className="modal-field"><label className="modal-label required">Subject:</label>
                  {bulkTeacher ? (
                    <SubjectSelector
                      value={bulkSubject}
                      onChange={setBulkSubject}
                      linkedIds={bulkLinkedSubjectIds}
                      linkedSubjects={bulkLinkedSubjects}
                      allSubjects={subjects}
                      isOverride={!!bulkIsOverride}
                    />
                  ) : (
                    <select disabled style={{ maxWidth: "100%" }}><option>Select a teacher first</option></select>
                  )}
                </div>
              </div>

              {/* Auto-fill summary */}
              {bulkTeacher > 0 && bulkSubject > 0 && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", borderRadius: 8,
                  background: "var(--surface-input, #f8fafc)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.78rem",
                }}>
                  <strong>{nameTeacher(bulkTeacher)}</strong> teaching <strong>{nameSubject(bulkSubject)}</strong>
                  {bulkLinkedSubjectIds.length === 1 && (
                    <span style={{ color: "var(--success-600)", marginLeft: 8 }}>✓ Auto-filled</span>
                  )}
                </div>
              )}

              {/* Step 2: Grade Selection (chips) */}
              {bulkTeacher > 0 && bulkSubject > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <label style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                    Step 2 — Select Grade(s)
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {uniqueGrades.map(g => {
                      const active = bulkSelectedGrades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? bulkSelectedGrades.filter(x => x !== g)
                              : [...bulkSelectedGrades, g];
                            setBulkSelectedGrades(next);
                            // Also deselect classes that no longer belong to selected grades
                            const validClassIds = classes.filter(c => next.includes(c.grade)).map(c => c.id);
                            setBulkSelectedClasses(prev => prev.filter(id => validClassIds.includes(id)));
                          }}
                          style={{
                            padding: "5px 14px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600,
                            cursor: "pointer", transition: "all 0.15s",
                            border: active ? "2px solid var(--primary-500)" : "1.5px solid var(--border-default)",
                            background: active ? "var(--primary-500)" : "var(--surface-card)",
                            color: active ? "#fff" : "var(--text-primary)",
                          }}
                        >{g}</button>
                      );
                    })}
                    {uniqueGrades.length === 0 && (
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>No classes created yet.</span>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Section Selection (checkboxes) — only shown when grades are selected */}
              {bulkSelectedGrades.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <label style={{
                    fontWeight: 600, fontSize: "0.82rem", color: "var(--text-secondary)",
                    marginBottom: 6, display: "flex", alignItems: "center", gap: 8,
                  }}>
                    Step 3 — Select Sections
                    <span style={{ fontSize: "0.68rem", fontWeight: 400, color: "var(--text-muted)" }}>({bulkSelectedClasses.length} selected)</span>
                    <button type="button" onClick={() => setBulkSelectedClasses(filteredClasses.map(c => c.id))} style={{
                      fontSize: "0.65rem", background: "none", border: "1px solid var(--border-default)",
                      borderRadius: 4, padding: "1px 6px", cursor: "pointer", color: "var(--primary-600)", fontWeight: 600,
                    }}>All</button>
                    <button type="button" onClick={() => setBulkSelectedClasses([])} style={{
                      fontSize: "0.65rem", background: "none", border: "1px solid var(--border-default)",
                      borderRadius: 4, padding: "1px 6px", cursor: "pointer", color: "var(--text-muted)",
                    }}>Clear</button>
                  </label>
                  <div style={{
                    maxHeight: 200, overflowY: "auto",
                    border: "1px solid var(--border-default)", borderRadius: 8,
                    padding: "6px 10px", background: "var(--surface-card)",
                  }}>
                    {/* Group by grade */}
                    {bulkSelectedGrades.map(grade => {
                      const gradeClasses = filteredClasses.filter(c => c.grade === grade);
                      if (gradeClasses.length === 0) return null;
                      return (
                        <div key={grade} style={{ marginBottom: 6 }}>
                          <div style={{
                            fontSize: "0.7rem", fontWeight: 700, color: "var(--primary-500)",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                            padding: "2px 0", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4,
                          }}>{grade}</div>
                          {gradeClasses.map(c => (
                            <label key={c.id} style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "2px 0",
                              cursor: "pointer", fontSize: "0.82rem",
                            }}>
                              <input
                                type="checkbox"
                                checked={bulkSelectedClasses.includes(c.id)}
                                onChange={() => setBulkSelectedClasses(prev =>
                                  prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                                )}
                                style={{ width: "auto", accentColor: "var(--primary-500)" }}
                              />
                              <span style={{ fontWeight: bulkSelectedClasses.includes(c.id) ? 600 : 400 }}>
                                {c.section ? `${c.section} (${c.name})` : c.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Lessons/Week */}
              {bulkSelectedClasses.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div className="modal-field">
                    <label className="modal-label" style={{ fontWeight: 600 }}>Lessons/Week:</label>
                    <input type="number" min={1} value={bulkLpw} onChange={e => setBulkLpw(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80 }} />
                  </div>
                </div>
              )}

              {/* Summary */}
              {bulkTeacher > 0 && bulkSubject > 0 && bulkSelectedClasses.length > 0 && (
                <div style={{
                  marginTop: 10, padding: "8px 12px", borderRadius: 8,
                  background: "var(--surface-input)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.78rem",
                }}>
                  Will create <strong>{bulkSelectedClasses.length}</strong> lesson{bulkSelectedClasses.length !== 1 ? "s" : ""} ×
                  <strong> {bulkLpw}</strong>/week = <strong>{bulkTotal}</strong> total lessons/week
                  for <strong>{nameTeacher(bulkTeacher)}</strong>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setBulkOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={doBulkAssign}
                  disabled={bulkSaving || !bulkTeacher || !bulkSubject || bulkSelectedClasses.length === 0}
                >{bulkSaving ? "Creating…" : `Create ${bulkSelectedClasses.length} Lesson${bulkSelectedClasses.length !== 1 ? "s" : ""}`}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ Copy from Class Modal ═══ */}
      {copyOpen && (
        <div className="modal-overlay" onClick={() => setCopyOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>Copy from Class</h3>
            <p className="subheading">Copy all lesson assignments from one class to other classes.</p>
            <div className="modal-form">
              <div className="modal-field"><label className="modal-label">Copy from:</label>
                <select value={copySource} onChange={e => setCopySource(Number(e.target.value))} style={{ maxWidth: "100%" }}>
                  <option value={0}>Select source class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label className="modal-label" style={{ display: "block", marginBottom: 4 }}>To classes (select one or more):</label>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-default, #e2e8f0)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                {classes.filter(c => c.id !== copySource).map(c => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={copyTargets.includes(c.id)} onChange={() => setCopyTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} style={{ width: "auto" }} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setCopyOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={doCopy} disabled={copySaving || !copySource || copyTargets.length === 0}>{copySaving ? "Copying…" : "Copy"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(LessonsTab);
