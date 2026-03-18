import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

type Teacher    = Awaited<ReturnType<typeof api.listTeachers>>[0];
type DutyArea   = api.DutyArea;
type RosterRow  = api.DutyRosterRow;
type EntryV2    = api.DutyEntryV2;

// ─── Fuzzy search ──────────────────────────────────────────────────────────────
function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase(), t = target.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) { if (t[ti] === q[qi]) qi++; }
  return qi === q.length;
}
function fuzzyScore(query: string, target: string): number {
  const t = target.toLowerCase(), q = query.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  return 1;
}
function fuzzyFilter<T>(items: T[], query: string, getLabel: (i: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .filter(i => fuzzyMatch(query, getLabel(i)))
    .sort((a, b) => fuzzyScore(query, getLabel(b)) - fuzzyScore(query, getLabel(a)));
}

// ─── AreaHeaderCell ────────────────────────────────────────────────────────────
function AreaHeaderCell({
  colIdx, areas, selectedAreaId, onSelect, onCreateArea,
}: {
  colIdx: number;
  areas: DutyArea[];
  selectedAreaId: number | null;
  onSelect: (colIdx: number, area: DutyArea) => void;
  onCreateArea: (name: string) => Promise<DutyArea>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLTableHeaderCellElement>(null);
  const selectedArea = areas.find(a => a.id === selectedAreaId);

  const filtered = areas.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = areas.some(a => a.name.toLowerCase() === query.toLowerCase());

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <th ref={ref} style={{ padding: "6px 8px", minWidth: 140, position: "relative", fontWeight: 700 }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
          padding: "4px 8px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-default)",
          background: "var(--surface-card)", fontSize: "0.78rem", fontWeight: 600,
          justifyContent: "space-between",
        }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ color: selectedArea ? "var(--slate-800)" : "var(--slate-400)" }}>
          {selectedArea?.name ?? "Set area…"}
        </span>
        <span style={{ fontSize: "0.65rem", color: "var(--slate-400)" }}>▼</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, zIndex: 200,
          background: "#fff", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          minWidth: 200, overflow: "hidden",
        }}>
          <input
            autoFocus
            placeholder="Search or add area…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", border: "none",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: "0.82rem", outline: "none", background: "#fff",
            }}
          />
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 200, overflowY: "auto" }}>
            {filtered.map(a => (
              <li key={a.id}
                style={{
                  padding: "8px 14px", fontSize: "0.82rem", cursor: "pointer",
                  background: a.id === selectedAreaId ? "#EEF2FF" : undefined,
                  color: a.id === selectedAreaId ? "#4338CA" : "var(--slate-700)",
                  fontWeight: a.id === selectedAreaId ? 600 : 400,
                  display: "flex", alignItems: "center", gap: 6,
                }}
                onMouseDown={e => { e.preventDefault(); onSelect(colIdx, a); setOpen(false); setQuery(""); }}
              >
                {a.id === selectedAreaId && <span>✓</span>}
                {a.name}
              </li>
            ))}
            {query.trim().length > 0 && !exactMatch && (
              <li
                style={{
                  padding: "8px 14px", fontSize: "0.82rem", cursor: "pointer",
                  color: "#4338CA", borderTop: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", gap: 6,
                }}
                onMouseDown={async e => {
                  e.preventDefault();
                  const newArea = await onCreateArea(query.trim());
                  onSelect(colIdx, newArea);
                  setOpen(false); setQuery("");
                }}
              >
                <span>+</span> Add "{query.trim()}" as area
              </li>
            )}
            {filtered.length === 0 && !query.trim() && (
              <li style={{ padding: "12px 14px", fontSize: "0.78rem", color: "var(--slate-400)", textAlign: "center" }}>
                No areas yet. Type to create one.
              </li>
            )}
          </ul>
        </div>
      )}
    </th>
  );
}

// ─── TeacherChipSelector ───────────────────────────────────────────────────────
function TeacherChipSelector({
  rowId, colIdx, entries, allTeachers, onAdd, onRemove,
}: {
  rowId: number;
  colIdx: number;
  entries: EntryV2[];
  allTeachers: Teacher[];
  onAdd: (rowId: number, colIdx: number, teacherId: number) => void;
  onRemove: (entryId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const assignedIds = entries.map(e => e.teacher_id);
  const unassigned = allTeachers.filter(t => !assignedIds.includes(t.id));
  const filtered = fuzzyFilter(unassigned, query, t => `${t.first_name} ${t.last_name}`);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function highlightMatch(name: string, q: string) {
    if (!q) return <>{name}</>;
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <>{name}</>;
    return <>{name.slice(0, idx)}<mark style={{ background: "#FEF08A", color: "inherit", borderRadius: 2 }}>{name.slice(idx, idx + q.length)}</mark>{name.slice(idx + q.length)}</>;
  }

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 120 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", minHeight: 32, padding: "3px 4px" }}>
        {entries.map(e => (
          <span key={e.id} style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 6px 2px 8px", borderRadius: 20,
            fontSize: "0.68rem", fontWeight: 500,
            background: "#EEF2FF", color: "#3730A3", border: "1px solid #C7D2FE",
            whiteSpace: "nowrap",
          }}>
            {e.teacher_name || e.teacher_code}
            <button
              type="button"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: "#6366F1", lineHeight: 1 }}
              onClick={ev => { ev.stopPropagation(); onRemove(e.id); }}
            >×</button>
          </span>
        ))}
        <button
          type="button"
          style={{
            width: 22, height: 22, borderRadius: "50%", border: "1.5px dashed #C7D2FE",
            background: "none", color: "#6366F1", fontSize: 14, lineHeight: 1,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        >+</button>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 200,
          background: "#fff", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
          minWidth: 240, overflow: "hidden",
        }}>
          <input
            ref={inputRef}
            placeholder="Search by name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && filtered.length > 0) { onAdd(rowId, colIdx, filtered[0].id); setQuery(""); }
              if (e.key === "Escape") setOpen(false);
            }}
            style={{
              width: "100%", padding: "9px 12px", border: "none",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: "0.82rem", outline: "none",
            }}
          />
          {filtered.length === 0 ? (
            <div style={{ padding: "14px 12px", fontSize: "0.78rem", color: "var(--slate-400)", textAlign: "center" }}>
              {query ? `No match for "${query}"` : "All teachers assigned"}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 220, overflowY: "auto" }}>
              {filtered.slice(0, 8).map(t => {
                const name = `${t.first_name} ${t.last_name}`.trim();
                const init = (t.first_name[0] + (t.last_name?.[0] ?? "")).toUpperCase();
                return (
                  <li key={t.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F1F5F9"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                    onMouseDown={ev => {
                      ev.preventDefault();
                      onAdd(rowId, colIdx, t.id);
                      setQuery("");
                      // keep open for multi-select
                    }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", background: "#4F46E5",
                      color: "#fff", fontSize: "0.6rem", fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{init}</div>
                    <span style={{ flex: 1, fontSize: "0.82rem" }}>{highlightMatch(name, query)}</span>
                    {t.code && <span style={{ fontSize: "0.68rem", color: "var(--slate-400)", background: "#F1F5F9", padding: "1px 5px", borderRadius: 4 }}>{t.code}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DutyRosterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid   = Number(projectId);
  const toast = useToast();

  const [loading,  setLoading]  = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [areas,    setAreas]    = useState<DutyArea[]>([]);
  const [rows,     setRows]     = useState<RosterRow[]>([]);
  const [entries,  setEntries]  = useState<EntryV2[]>([]);

  // column → area mapping (colIdx → areaId)
  const [colAreaMap, setColAreaMap] = useState<Record<number, number>>({});
  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const numCols = Math.max(Object.keys(colAreaMap).length, areas.length > 0 ? Math.min(areas.length, 7) : 5);

  const load = useCallback(async () => {
    try {
      const [tList, aList, rList, eList] = await Promise.all([
        api.listTeachers(pid),
        api.listDutyAreas(pid),
        api.listDutyRosterRows(pid),
        api.listDutyEntriesV2(pid),
      ]);
      setTeachers(tList);
      setAreas(aList);
      setRows(rList);
      setEntries(eList);
      // Auto-map areas to columns by position
      const map: Record<number, number> = {};
      aList.forEach((a, i) => { map[i] = a.id; });
      setColAreaMap(map);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [pid, toast]);

  useEffect(() => { load(); }, [load]);

  // ── Area operations ──
  async function handleCreateArea(name: string): Promise<DutyArea> {
    const area = await api.createDutyArea(pid, { name });
    setAreas(prev => [...prev, area]);
    return area;
  }

  function handleSelectArea(colIdx: number, area: DutyArea) {
    setColAreaMap(prev => ({ ...prev, [colIdx]: area.id }));
  }

  // ── Row operations ──
  async function handleAddRow() {
    try {
      const row = await api.createDutyRosterRow(pid, {});
      setRows(prev => [...prev, row]);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to add row");
    }
  }

  async function handleUpdateRow(rowId: number, patch: { date_start?: string | null; date_end?: string | null }) {
    try {
      const updated = await api.updateDutyRosterRow(pid, rowId, patch);
      setRows(prev => prev.map(r => r.id === rowId ? updated : r));
    } catch { /* silent */ }
  }

  async function handleDeleteRow(rowId: number) {
    try {
      await api.deleteDutyRosterRow(pid, rowId);
      setRows(prev => prev.filter(r => r.id !== rowId));
      setEntries(prev => prev.filter(e => e.row_id !== rowId));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── Drag to reorder rows ──
  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }
  async function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const reordered = [...rows];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setRows(reordered);
    setDragIdx(null); setDragOverIdx(null);
    try {
      await api.reorderDutyRosterRows(pid, reordered.map((r, i) => ({ id: r.id, row_order: i })));
    } catch { /* silent */ }
  }

  // ── Entry operations ──
  async function handleAddTeacher(rowId: number, colIdx: number, teacherId: number) {
    try {
      const areaId = colAreaMap[colIdx];
      const area = areas.find(a => a.id === areaId);
      const entry = await api.createDutyEntryV2(pid, {
        row_id: rowId, column_index: colIdx, teacher_id: teacherId,
        duty_type: area?.name ?? "Duty",
      });
      setEntries(prev => [...prev, entry]);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Assign failed");
    }
  }

  async function handleRemoveTeacher(entryId: number) {
    try {
      await api.deleteDutyEntryV2(pid, entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Remove failed");
    }
  }

  if (loading) return <div className="card"><p className="subheading">Loading…</p></div>;

  const colIndices = Array.from({ length: Math.max(numCols, 5) }, (_, i) => i);

  return (
    <div className="card">
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Duty Roster</h2>
          <p className="subheading" style={{ margin: 0 }}>
            Set area names in column headers · add date ranges in rows · assign multiple teachers per cell.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" style={{ fontSize: "0.78rem" }}
            onClick={async () => {
              try {
                const r = await api.publishSnapshot(pid, "duty_roster");
                toast("success", `Published: ${r.title} (${r.record_count} records)`);
              } catch (e) { toast("error", e instanceof Error ? e.message : "Publish failed"); }
            }}>📦 Publish</button>
          <button
            type="button" className="btn"
            style={{ fontSize: "0.78rem" }}
            onClick={() => window.open(`/api/projects/${pid}/duty-roster/export-pdf`, "_blank")}
          >📄 Export PDF</button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ minWidth: 600, tableLayout: "auto", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ minWidth: 230, textAlign: "left", padding: "6px 8px", fontSize: "0.72rem", color: "var(--slate-500)" }}>Date Range</th>
              {colIndices.map(colIdx => (
                <AreaHeaderCell
                  key={colIdx}
                  colIdx={colIdx}
                  areas={areas}
                  selectedAreaId={colAreaMap[colIdx] ?? null}
                  onSelect={handleSelectArea}
                  onCreateArea={handleCreateArea}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colIndices.length + 1} style={{ padding: "2rem", textAlign: "center", color: "var(--slate-400)", fontSize: "0.82rem" }}>
                  No rows yet. Click "+ Add period" below.
                </td>
              </tr>
            )}
            {rows.map((row, rowIdx) => {
              const isDragOver = dragOverIdx === rowIdx;
              return (
                <tr
                  key={row.id}
                  style={{ background: isDragOver ? "#EEF2FF" : undefined, transition: "background 0.1s" }}
                  onDragOver={e => handleDragOver(e, rowIdx)}
                  onDrop={() => handleDrop(rowIdx)}
                >
                  {/* Row header */}
                  <td style={{ padding: "4px 8px", verticalAlign: "middle", minWidth: 230 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {/* Drag handle */}
                      <div
                        draggable
                        onDragStart={() => handleDragStart(rowIdx)}
                        style={{ cursor: "grab", color: "var(--slate-300)", fontSize: 16, padding: "2px 4px", userSelect: "none", flexShrink: 0 }}
                        title="Drag to reorder"
                      >⠿</div>
                      {/* Date inputs */}
                      <input
                        type="date"
                        value={row.date_start ?? ""}
                        onChange={e => handleUpdateRow(row.id, { date_start: e.target.value || null })}
                        style={{
                          border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
                          padding: "3px 5px", fontSize: "0.72rem", fontFamily: "var(--font-mono)",
                          width: 120, color: "var(--slate-700)",
                        }}
                      />
                      <span style={{ fontSize: "0.7rem", color: "var(--slate-400)" }}>→</span>
                      <input
                        type="date"
                        value={row.date_end ?? ""}
                        onChange={e => handleUpdateRow(row.id, { date_end: e.target.value || null })}
                        style={{
                          border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
                          padding: "3px 5px", fontSize: "0.72rem", fontFamily: "var(--font-mono)",
                          width: 120, color: "var(--slate-700)",
                        }}
                      />
                      {/* Delete btn */}
                      <button
                        type="button"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--danger-400)", padding: "3px 5px", opacity: 0,
                          borderRadius: "var(--radius-sm)", fontSize: "0.9rem",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                        onClick={() => handleDeleteRow(row.id)}
                        title="Delete row"
                      >🗑</button>
                    </div>
                  </td>
                  {/* Data cells */}
                  {colIndices.map(colIdx => {
                    const cellEntries = entries.filter(e => e.row_id === row.id && e.column_index === colIdx);
                    return (
                      <td key={colIdx} style={{ padding: "4px 6px", verticalAlign: "top", borderLeft: "1px solid var(--border-subtle)" }}>
                        <TeacherChipSelector
                          rowId={row.id}
                          colIdx={colIdx}
                          entries={cellEntries}
                          allTeachers={teachers}
                          onAdd={handleAddTeacher}
                          onRemove={handleRemoveTeacher}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Add period row */}
            <tr>
              <td colSpan={colIndices.length + 1} style={{ padding: "4px 0" }}>
                <button
                  type="button"
                  style={{
                    width: "100%", padding: "7px 0", background: "none",
                    border: "1.5px dashed var(--border-default)", borderRadius: "var(--radius-sm)",
                    color: "var(--slate-400)", fontSize: "0.8rem", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "#F8FAFC"; el.style.color = "var(--slate-600)"; el.style.borderColor = "var(--border-default)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "none"; el.style.color = "var(--slate-400)"; el.style.borderColor = "var(--border-default)";
                  }}
                  onClick={handleAddRow}
                >
                  + Add period / time slot
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
