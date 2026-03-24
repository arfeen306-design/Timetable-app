import React, { useState, useMemo } from "react";
import * as api from "../../api";
import type { SchoolClass, Room } from "../../api";
import { useToast } from "../../context/ToastContext";

type Teacher = Awaited<ReturnType<typeof api.listTeachers>>[0];

interface Props {
  pid: number;
  classes: SchoolClass[];
  teachers: Teacher[];
  rooms: Room[];
  onChange: (c: SchoolClass[]) => void;
  onNext: () => void;
}

const GRADE_OPTIONS = Array.from({ length: 14 }, (_, i) => i); // 0-13
const CLASS_COLORS = ['#50C878','#4F46E5','#0891B2','#D97706','#7C3AED','#0F766E','#9333EA','#0369A1','#15803D','#C2410C','#B45309','#16A34A','#DC2626','#6366F1'];
const DEFAULT_ALPHA_SECTIONS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

function parseSections(input: string): string[] {
  return input.split(",").map(s => s.trim()).filter(s => s.length > 0);
}

function ClassesTab({ pid, classes, onChange, onNext }: Props) {
  const toast = useToast();

  // ── Bulk creation state ──
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [sameForAll, setSameForAll] = useState(true);
  const [sectionCount, setSectionCount] = useState(3);
  const [sharedSections, setSharedSections] = useState("");
  const [perGradeSections, setPerGradeSections] = useState<Record<number, string>>({});
  const [editMode, setEditMode] = useState(classes.length === 0);
  const [saving, setSaving] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);

  // Import
  const importRef = React.createRef<HTMLInputElement>();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; errors: { row: number; message: string }[] } | null>(null);

  // Delete state
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  // ── Grade selection ──
  function toggleGrade(g: number) {
    setSelectedGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a, b) => a - b)
    );
  }

  function selectAllGrades() {
    setSelectedGrades([...GRADE_OPTIONS]);
  }

  function clearGrades() {
    setSelectedGrades([]);
  }

  // ── Auto-fill section names from count ──
  function autoFillSections(count: number) {
    setSectionCount(count);
    const names = DEFAULT_ALPHA_SECTIONS.slice(0, Math.min(count, 12));
    setSharedSections(names.join(", "));
  }

  // ── Build preview ──
  const preview = useMemo(() => {
    const result: { grade: string; section: string; name: string; code: string; color: string }[] = [];
    let colorIdx = 0;
    for (const g of selectedGrades) {
      const sectionsStr = sameForAll ? sharedSections : (perGradeSections[g] || "");
      const sects = parseSections(sectionsStr);
      if (sects.length === 0) {
        result.push({
          grade: String(g),
          section: "",
          name: g === 0 ? "Pre-School" : `Grade ${g}`,
          code: g === 0 ? "PRE" : `${g}`,
          color: CLASS_COLORS[colorIdx++ % CLASS_COLORS.length],
        });
      } else {
        for (const sec of sects) {
          result.push({
            grade: String(g),
            section: sec,
            name: g === 0 ? `Pre-${sec}` : `Grade ${g}-${sec}`,
            code: g === 0 ? `PRE-${sec}`.toUpperCase() : `${g}-${sec}`.toUpperCase(),
            color: CLASS_COLORS[colorIdx++ % CLASS_COLORS.length],
          });
        }
      }
    }
    return result;
  }, [selectedGrades, sameForAll, sharedSections, perGradeSections]);

  // Count new vs existing
  const newItems = preview.filter(p => !classes.some(c => c.grade === p.grade && c.section === p.section));
  const existingItems = preview.filter(p => classes.some(c => c.grade === p.grade && c.section === p.section));

  // ── Save all ──
  async function saveConfiguration() {
    if (preview.length === 0) {
      toast("error", "Select at least one grade.");
      return;
    }
    // If there are existing classes and we're generating new ones, show overwrite warning
    if (classes.length > 0 && newItems.length > 0 && !showOverwriteWarning) {
      setShowOverwriteWarning(true);
      return;
    }
    setShowOverwriteWarning(false);
    setSaving(true);
    const startTime = Date.now();
    let created = 0;
    let errors = 0;
    try {
      for (const item of preview) {
        const exists = classes.some(c => c.grade === item.grade && c.section === item.section);
        if (exists) continue;
        try {
          await api.createClass(pid, {
            grade: item.grade,
            section: item.section,
            stream: "",
            name: item.name,
            code: item.code,
            color: item.color,
            strength: 30,
            class_teacher_id: null,
            home_room_id: null,
          });
          created++;
        } catch { errors++; }
      }
      const fresh = await api.listClasses(pid);
      onChange(fresh);
      setEditMode(false);
      setSelectedGrades([]);
      setSharedSections("");
      setPerGradeSections({});
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      toast("success", `✅ ${created} class${created !== 1 ? "es" : ""} created in ${elapsed}s${errors > 0 ? ` (${errors} failed)` : ""}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  }

  // ── Delete ──
  async function handleDelete() {
    if (checkedIds.size === 0) return;
    const ids = Array.from(checkedIds);
    try {
      const result = await api.bulkDeleteClasses(pid, ids);
      onChange(classes.filter(c => !ids.includes(c.id)));
      setCheckedIds(new Set());
      toast("success", `${result.deleted} class${result.deleted !== 1 ? "es" : ""} deleted.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── Import ──
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const res = await api.importClassesExcel(pid, file);
      setImportResult(res);
      if (res.success_count > 0) { const list = await api.listClasses(pid); onChange(list); }
    } catch (err) { toast("error", err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  }

  const allChecked = classes.length > 0 && checkedIds.size === classes.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Classes & Sections</h2>
      <p className="subheading">
        {classes.length > 0 && !editMode
          ? `${classes.length} class${classes.length !== 1 ? "es" : ""} configured. Click "Edit Configuration" to add or change.`
          : "Quickly create all your grades and sections in one go."}
      </p>

      {/* ── Toolbar ── */}
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {!editMode && classes.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => setEditMode(true)}>✏️ Edit Configuration</button>
        )}
        <input type="file" ref={importRef} accept=".xlsx,.xls" style={{ display: "none" }} onChange={onImportFile} />
        <button type="button" className="btn" onClick={() => importRef.current?.click()} disabled={importing}>
          {importing ? "⏳ Processing…" : "📥 Import from Excel"}
        </button>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("classes")}>📋 Template</button>
        {checkedIds.size > 0 && (
          <button type="button" className="btn btn-danger" onClick={handleDelete}>🗑 Delete ({checkedIds.size})</button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>{classes.length} class{classes.length !== 1 ? "es" : ""}</span>
      </div>

      {/* ── Import result ── */}
      {importResult && (
        <div style={{
          marginBottom: "1rem", borderRadius: 8, padding: "12px 16px",
          background: importResult.errors.length > 0 ? "#FFFBEB" : "#F0FDF4",
          border: `1px solid ${importResult.errors.length > 0 ? "#FDE68A" : "#BBF7D0"}`,
        }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>✅ Imported {importResult.success_count} class(es)</div>
          <button type="button" onClick={() => setImportResult(null)} style={{ marginTop: 4, fontSize: "0.72rem", background: "none", border: "none", color: "var(--slate-400)", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
        </div>
      )}

      {/* ═══ BULK GENERATOR ═══ */}
      {editMode && (
        <div style={{
          background: "var(--surface-card, #f8fafc)",
          border: "2px solid var(--primary-200, #c7d2fe)",
          borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem",
        }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700, color: "var(--primary-700)" }}>
            ⚡ Quick Setup — Bulk Class Generator
          </h3>

          {/* ── STEP 1: Grade Selection ── */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 24, height: 24, borderRadius: "50%", background: "var(--primary-500)",
                color: "#fff", fontSize: "0.72rem", fontWeight: 700,
              }}>1</span>
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Select Grades</span>
              <button type="button" onClick={selectAllGrades} style={{ fontSize: "0.68rem", background: "none", border: "1px solid var(--slate-200)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", color: "var(--primary-600)", fontWeight: 600 }}>Select All</button>
              <button type="button" onClick={clearGrades} style={{ fontSize: "0.68rem", background: "none", border: "1px solid var(--slate-200)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", color: "var(--slate-500)" }}>Clear</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {GRADE_OPTIONS.map(g => (
                <button
                  key={g} type="button"
                  onClick={() => toggleGrade(g)}
                  style={{
                    padding: "6px 16px", borderRadius: 8,
                    border: selectedGrades.includes(g) ? "2px solid var(--primary-500)" : "2px solid var(--slate-200)",
                    background: selectedGrades.includes(g) ? "var(--primary-500)" : "#fff",
                    color: selectedGrades.includes(g) ? "#fff" : "var(--slate-600)",
                    fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                    transition: "all 0.12s", minWidth: 44,
                  }}
                >
                  {g === 0 ? "Pre" : g}
                </button>
              ))}
            </div>
            {selectedGrades.length > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--primary-600)", fontWeight: 500 }}>
                ✓ {selectedGrades.length} grade{selectedGrades.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* ── STEP 2: Section Count + Names ── */}
          {selectedGrades.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, borderRadius: "50%", background: "var(--primary-500)",
                  color: "#fff", fontSize: "0.72rem", fontWeight: 700,
                }}>2</span>
                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Define Sections</span>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", marginBottom: 10 }}>
                <input type="checkbox" checked={sameForAll} onChange={e => setSameForAll(e.target.checked)} style={{ width: "auto", accentColor: "var(--primary-500)" }} />
                <span style={{ fontWeight: 500 }}>Apply same sections to all selected grades</span>
              </label>

              {sameForAll ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Section count + auto-fill */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 500 }}>Sections per grade:</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={sectionCount}
                      min={1} max={12}
                      onChange={e => {
                        const v = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                        autoFillSections(v);
                      }}
                      onKeyDown={e => {
                        if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
                        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                      }}
                      style={{ width: 56, textAlign: "center", fontWeight: 700, fontSize: "0.88rem", borderRadius: 6, border: "1px solid var(--slate-200)", padding: "6px 8px" }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>= {selectedGrades.length * Math.max(parseSections(sharedSections).length, 1)} total classes</span>
                  </div>
                  {/* Section names */}
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--slate-600)", display: "block", marginBottom: 4 }}>
                      Section names (comma separated):
                    </label>
                    <input
                      value={sharedSections}
                      onChange={e => {
                        setSharedSections(e.target.value);
                        const parsed = parseSections(e.target.value);
                        if (parsed.length > 0) setSectionCount(parsed.length);
                      }}
                      placeholder='e.g. A, B, C, D  or  Red, Blue, Green'
                      style={{
                        width: "100%", maxWidth: 420, padding: "8px 12px",
                        borderRadius: 8, border: "1px solid var(--slate-200)", fontSize: "0.82rem",
                      }}
                    />
                    {sharedSections && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {parseSections(sharedSections).map((s, i) => (
                          <span key={i} style={{
                            background: "var(--primary-100)", color: "var(--primary-700)",
                            fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                          }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--slate-400)", margin: "0 0 4px" }}>
                    Customize sections per grade (comma separated):
                  </p>
                  {selectedGrades.map(g => (
                    <div key={g} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.82rem", minWidth: 80, color: "var(--slate-700)" }}>
                        {g === 0 ? "Pre-School" : `Grade ${g}`}:
                      </span>
                      <input
                        value={perGradeSections[g] || ""}
                        onChange={e => setPerGradeSections(prev => ({ ...prev, [g]: e.target.value }))}
                        placeholder="e.g. A, B, C"
                        style={{ flex: 1, maxWidth: 300, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--slate-200)", fontSize: "0.82rem" }}
                      />
                      {(perGradeSections[g] || "") && (
                        <span style={{ fontSize: "0.68rem", color: "var(--slate-400)", fontWeight: 500 }}>
                          {parseSections(perGradeSections[g] || "").length} section{parseSections(perGradeSections[g] || "").length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {preview.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, borderRadius: "50%", background: "var(--primary-500)",
                  color: "#fff", fontSize: "0.72rem", fontWeight: 700,
                }}>3</span>
                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                  Preview — {preview.length} class{preview.length !== 1 ? "es" : ""}
                  {existingItems.length > 0 && <span style={{ color: "var(--slate-400)", fontWeight: 400 }}> ({existingItems.length} already exist, {newItems.length} new)</span>}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 140, overflowY: "auto", padding: 4 }}>
                {preview.map((p, i) => {
                  const exists = classes.some(c => c.grade === p.grade && c.section === p.section);
                  return (
                    <span key={i} style={{
                      display: "inline-block", padding: "4px 12px",
                      borderRadius: 6, fontSize: "0.72rem", fontWeight: 600,
                      background: exists ? "var(--slate-100)" : p.color,
                      color: exists ? "var(--slate-400)" : "#fff",
                      textDecoration: exists ? "line-through" : "none",
                      transition: "all 0.1s",
                    }} title={exists ? "Already exists — will be skipped" : `Will create: ${p.name} (${p.code})`}>
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Overwrite warning ── */}
          {showOverwriteWarning && (
            <div style={{
              marginBottom: "1rem", borderRadius: 8, padding: "12px 16px",
              background: "#FEF3C7", border: "1px solid #FDE68A",
            }}>
              <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#92400E" }}>
                ⚠️ You already have {classes.length} class{classes.length !== 1 ? "es" : ""}. 
                {newItems.length > 0 && ` ${newItems.length} new class${newItems.length !== 1 ? "es" : ""} will be added.`}
                {existingItems.length > 0 && ` ${existingItems.length} existing will be skipped.`}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-primary" onClick={saveConfiguration} style={{ fontSize: "0.78rem" }}>
                  Yes, Add {newItems.length} New Classes
                </button>
                <button type="button" className="btn" onClick={() => setShowOverwriteWarning(false)} style={{ fontSize: "0.78rem" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {!showOverwriteWarning && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveConfiguration}
                disabled={preview.length === 0 || saving || newItems.length === 0}
                style={{ minWidth: 180, fontSize: "0.88rem", padding: "10px 20px" }}
              >
                {saving ? "⏳ Creating…" : `⚡ Apply All — Create ${newItems.length} Class${newItems.length !== 1 ? "es" : ""}`}
              </button>
              {classes.length > 0 && (
                <button type="button" className="btn" onClick={() => { setEditMode(false); setShowOverwriteWarning(false); }}>Cancel</button>
              )}
              {newItems.length === 0 && preview.length > 0 && (
                <span style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>All selected classes already exist.</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ EXISTING CLASSES TABLE ═══ */}
      {classes.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked; }}
                    onChange={e => setCheckedIds(e.target.checked ? new Set(classes.map(c => c.id)) : new Set())}
                    title="Select all"
                  />
                </th>
                <th style={{ width: 40 }}>#</th>
                <th>Name</th>
                <th>Grade</th>
                <th>Section</th>
                <th>Code</th>
                <th style={{ width: 50 }}>Color</th>
                <th>Strength</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c, i) => (
                <tr key={c.id}>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(c.id)}
                      onChange={() => setCheckedIds(prev => {
                        const next = new Set(prev);
                        next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                        return next;
                      })}
                    />
                  </td>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>{c.grade}</td>
                  <td>{c.section || "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 600, color: "var(--primary-700)" }}>{c.code}</td>
                  <td><span className="color-swatch" style={{ backgroundColor: c.color || "#50C878" }} /></td>
                  <td>{c.strength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {classes.length === 0 && !editMode && (
        <p className="subheading" style={{ textAlign: "center", padding: "2rem 0" }}>
          No classes configured yet. Click "Edit Configuration" or import from Excel.
        </p>
      )}

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Classrooms →</button>
      </div>
    </div>
  );
}

export default React.memo(ClassesTab);
