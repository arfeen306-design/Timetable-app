import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../../api";
import type { Room } from "../../api";
import { useToast } from "../../context/ToastContext";
import { ROOM_TYPES } from "../../constants";

interface Props {
  pid: number;
  rooms: Room[];
  onChange: (r: Room[]) => void;
  onNext: () => void;
}

const COLOR_PALETTE = [
  "#9B59B6","#3498DB","#2ECC71","#E67E22","#E74C3C","#1ABC9C",
  "#6366F1","#0891B2","#D97706","#7C3AED","#0369A1","#16A34A",
];

function generateCode(name: string, existing: string[]): string {
  const base = name.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
  if (!base) return "";
  let code = base;
  let i = 2;
  while (existing.includes(code)) { code = base + i++; }
  return code;
}

/* ═══════════════════════════════════════════════════════
   InlineColorPicker — mini swatch picker
   ═══════════════════════════════════════════════════════ */
function InlineColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function click(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          width: 22, height: 22, borderRadius: 6, backgroundColor: color,
          cursor: "pointer", border: "2px solid var(--border-default)",
        }}
        title="Click to change color"
      />
      {open && (
        <div style={{
          position: "absolute", top: 28, left: -20, zIndex: 100,
          background: "var(--surface-card, #fff)", border: "1px solid var(--border-default)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          padding: 6, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
        }}>
          {COLOR_PALETTE.map(c => (
            <div
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              style={{
                width: 22, height: 22, borderRadius: 6, backgroundColor: c,
                cursor: "pointer", border: c === color ? "2px solid var(--text-primary)" : "2px solid transparent",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EditableRow — one inline-editable room row
   ═══════════════════════════════════════════════════════ */
interface RowProps {
  row: { id: number; name: string; code: string; room_type: string; capacity: number; color: string };
  index: number;
  isNew: boolean;
  existingCodes: string[];
  onSave: (data: { id: number; name: string; code: string; room_type: string; capacity: number; color: string }) => Promise<void>;
  onDelete: (id: number) => void;
  pid: number;
  checked?: boolean;
  onCheck?: (id: number) => void;
}

function EditableRow({ row, index, isNew, existingCodes, onSave, onDelete, checked, onCheck }: RowProps) {
  const [name, setName] = useState(row.name);
  const [code, setCode] = useState(row.code);
  const [codeManual, setCodeManual] = useState(false);
  const [roomType, setRoomType] = useState(row.room_type || "Classroom");
  const [capacity, setCapacity] = useState(row.capacity || 40);
  const [color, setColor] = useState(row.color || "#9B59B6");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Sync external changes
  useEffect(() => {
    setName(row.name); setCode(row.code); setRoomType(row.room_type || "Classroom");
    setCapacity(row.capacity || 40); setColor(row.color || "#9B59B6");
    setDirty(false);
  }, [row.id, row.name, row.code, row.room_type, row.capacity, row.color]);

  function markDirty() { setDirty(true); }

  function autoCode(n: string) {
    if (!codeManual && n.trim()) {
      setCode(generateCode(n, existingCodes));
    }
  }

  const doSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: row.id, name: name.trim(), code: code.trim(), room_type: roomType, capacity, color });
      setDirty(false);
      if (isNew) {
        setName(""); setCode(""); setRoomType("Classroom"); setCapacity(40);
        setColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
        setCodeManual(false);
      }
    } catch { /* handled by parent */ }
    setSaving(false);
  }, [name, code, roomType, capacity, color, row.id, isNew, onSave]);

  function handleBlur() {
    if (dirty && !isNew && name.trim()) doSave();
  }

  function handleColorChange(c: string) {
    setColor(c); markDirty();
    if (row.id && name.trim()) setTimeout(doSave, 100);
  }

  const rowBg = isNew ? "var(--surface-input)" : dirty ? "var(--surface-dirty)" : undefined;

  return (
    <tr style={{ background: rowBg, transition: "background 0.2s" }}>
      {/* Checkbox */}
      <td style={{ textAlign: "center", width: 36 }} onClick={e => e.stopPropagation()}>
        {!isNew && row.id && onCheck ? (
          <input
            type="checkbox"
            checked={!!checked}
            onChange={() => onCheck(row.id)}
            style={{ width: "auto" }}
          />
        ) : null}
      </td>
      {/* # */}
      <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 500, width: 36 }}>
        {isNew ? "+" : index + 1}
      </td>
      {/* Name */}
      <td>
        <input
          ref={nameRef}
          value={name}
          onChange={e => { setName(e.target.value); markDirty(); }}
          onBlur={() => { autoCode(name); handleBlur(); }}
          placeholder={isNew ? "Type to add new room…" : "Room name"}
          style={{
            width: "100%", border: "none", background: "transparent",
            fontSize: "0.82rem", fontWeight: 500, padding: "4px 6px",
            outline: "none", borderRadius: 4, color: "inherit",
          }}
          onFocus={e => { e.target.style.background = "var(--surface-input, #f8fafc)"; }}
          onKeyDown={e => {
            if (e.key === "Enter" && isNew && name.trim()) { autoCode(name); doSave(); }
            if (e.key === "Tab") autoCode(name);
          }}
        />
      </td>
      {/* Code */}
      <td>
        <input
          value={code}
          onChange={e => { setCode(e.target.value); setCodeManual(true); markDirty(); }}
          onBlur={handleBlur}
          placeholder="Auto"
          style={{
            width: 60, border: "none", background: "transparent",
            fontSize: "0.78rem", fontWeight: 700, padding: "4px 6px",
            textAlign: "center", outline: "none", borderRadius: 4,
            color: "var(--primary-700)",
          }}
          onFocus={e => { e.target.style.background = "var(--surface-input, #f8fafc)"; }}
        />
      </td>
      {/* Type */}
      <td>
        <select
          value={roomType}
          onChange={e => { setRoomType(e.target.value); markDirty(); if (!isNew) setTimeout(doSave, 100); }}
          style={{
            border: "none", background: "transparent", fontSize: "0.78rem",
            cursor: "pointer", outline: "none", padding: "2px 0", color: "inherit",
          }}
        >
          {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </td>
      {/* Capacity */}
      <td>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={capacity}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            if (raw === '') { setCapacity(0); markDirty(); return; }
            setCapacity(Math.max(1, Math.min(999, Number(raw)))); markDirty();
          }}
          onKeyDown={e => {
            if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
            if (e.ctrlKey || e.metaKey) return;
            if (!/^[0-9]$/.test(e.key)) e.preventDefault();
          }}
          onBlur={e => {
            if (!e.target.value || Number(e.target.value) < 1) { setCapacity(40); markDirty(); }
            handleBlur();
          }}
          min={1} max={999}
          style={{
            width: 50, border: "none", background: "transparent",
            textAlign: "center", fontSize: "0.82rem", fontWeight: 600,
            fontFamily: "var(--font-mono)", outline: "none", borderRadius: 4,
            color: "inherit",
          }}
          onFocus={e => { e.target.style.background = "var(--surface-input, #f8fafc)"; }}
        />
      </td>
      {/* Color */}
      <td style={{ width: 40 }}>
        <InlineColorPicker color={color} onChange={handleColorChange} />
      </td>
      {/* Actions */}
      <td style={{ width: 70, textAlign: "center" }}>
        {isNew ? (
          <button
            type="button"
            onClick={() => { autoCode(name); doSave(); }}
            disabled={!name.trim() || saving}
            style={{
              background: "var(--primary-500)", color: "#fff", border: "none", borderRadius: 6,
              padding: "4px 12px", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
              opacity: !name.trim() ? 0.4 : 1,
            }}
          >{saving ? "…" : "Save"}</button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (confirmDelete) { onDelete(row.id); setConfirmDelete(false); }
              else setConfirmDelete(true);
            }}
            onBlur={() => setConfirmDelete(false)}
            style={{
              background: "none", border: "none", cursor: "pointer", fontSize: "0.88rem",
              padding: "2px 6px", borderRadius: 4,
              color: confirmDelete ? "#fff" : "var(--text-muted)",
              backgroundColor: confirmDelete ? "var(--danger-500, #dc2626)" : "transparent",
            }}
            title={confirmDelete ? "Click again to confirm" : "Delete room"}
          >{confirmDelete ? "Sure?" : "🗑"}</button>
        )}
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════
   ClassroomsTab — main component
   ═══════════════════════════════════════════════════════ */
export default function ClassroomsTab({ pid, rooms, onChange, onNext }: Props) {
  const toast = useToast();
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const existingCodes = rooms.map(r => r.code);
  const allChecked = rooms.length > 0 && checkedIds.size === rooms.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  function toggleCheckAll(checked: boolean) {
    setCheckedIds(checked ? new Set(rooms.map(r => r.id)) : new Set());
  }

  async function handleSave(data: { id: number; name: string; code: string; room_type: string; capacity: number; color: string }) {
    if (data.id) {
      await api.updateRoom(pid, data.id, {
        name: data.name, code: data.code, room_type: data.room_type, capacity: data.capacity,
      });
      onChange(rooms.map(r => r.id === data.id ? { ...r, ...data } : r));
      toast("success", "Room saved.");
    } else {
      const created = await api.createRoom(pid, {
        name: data.name, code: data.code, room_type: data.room_type, capacity: data.capacity,
      });
      onChange([...rooms, { ...created, name: data.name, code: data.code, room_type: data.room_type, capacity: data.capacity, color: data.color } as Room]);
      toast("success", `Room "${data.name}" added.`);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteRoom(pid, id);
      onChange(rooms.filter(r => r.id !== id));
      setCheckedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast("success", "Room deleted.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleBulkDelete() {
    if (checkedIds.size === 0) return;
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
    setBulkDeleting(true);
    // Optimistic UI: remove from list immediately
    const ids = Array.from(checkedIds);
    onChange(rooms.filter(r => !ids.includes(r.id)));
    setCheckedIds(new Set());
    setConfirmBulkDelete(false);
    try {
      const result = await api.bulkDeleteRooms(pid, ids);
      toast("success", `${result.deleted} classroom${result.deleted !== 1 ? "s" : ""} deleted.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Bulk delete failed");
    }
    setBulkDeleting(false);
  }

  const emptyRow = { id: 0, name: "", code: "", room_type: "Classroom", capacity: 40, color: COLOR_PALETTE[rooms.length % COLOR_PALETTE.length] };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Classrooms</h2>
      <p className="subheading">
        Add rooms, labs, and teaching spaces. Click any cell to edit inline.
      </p>

      {/* Optional info note */}
      <div style={{
        marginBottom: "1rem", padding: "10px 14px", borderRadius: 8,
        background: "var(--surface-input, var(--surface-raised))",
        border: "1px solid var(--border-subtle)",
        fontSize: "0.78rem", color: "var(--text-muted)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: "1rem" }}>ℹ️</span>
        <span>
          <strong>Classrooms are optional.</strong> If left empty, rooms will not be assigned in the final timetable.
          You can skip this step entirely.
        </span>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn" onClick={() => api.downloadTemplate("rooms")}>
          📋 Download Template
        </button>

        {checkedIds.size > 0 && !confirmBulkDelete && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            🗑 Delete ({checkedIds.size})
          </button>
        )}

        {confirmBulkDelete && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 8,
            background: "var(--danger-50, #fef2f2)", border: "1px solid var(--danger-200, #fecaca)",
          }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--danger-700, #b91c1c)" }}>
              Delete {checkedIds.size} classroom{checkedIds.size !== 1 ? "s" : ""}? This cannot be undone.
            </span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              style={{ fontSize: "0.72rem", padding: "4px 12px" }}
            >{bulkDeleting ? "Deleting…" : "Yes, Delete"}</button>
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmBulkDelete(false)}
              style={{ fontSize: "0.72rem", padding: "4px 10px" }}
            >Cancel</button>
          </div>
        )}

        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>
          {rooms.length} room{rooms.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Inline editable table */}
      <div style={{ overflowX: "auto", overflowY: "visible", position: "relative" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={e => toggleCheckAll(e.target.checked)}
                  title="Select all"
                  style={{ width: "auto" }}
                />
              </th>
              <th style={{ width: 36 }}>#</th>
              <th style={{ minWidth: 160 }}>Name</th>
              <th style={{ width: 80 }}>Code</th>
              <th style={{ width: 120 }}>Type</th>
              <th style={{ width: 70 }}>Capacity</th>
              <th style={{ width: 50 }}>Color</th>
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r, i) => (
              <EditableRow
                key={r.id}
                row={r}
                index={i}
                isNew={false}
                existingCodes={existingCodes}
                onSave={handleSave}
                onDelete={handleDelete}
                pid={pid}
                checked={checkedIds.has(r.id)}
                onCheck={id => setCheckedIds(prev => {
                  const n = new Set(prev);
                  n.has(id) ? n.delete(id) : n.add(id);
                  return n;
                })}
              />
            ))}
            {/* New entry row */}
            <EditableRow
              key="new"
              row={emptyRow}
              index={rooms.length}
              isNew={true}
              existingCodes={existingCodes}
              onSave={handleSave}
              onDelete={() => {}}
              pid={pid}
            />
          </tbody>
        </table>
      </div>

      {rooms.length === 0 && (
        <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.5rem 0 0" }}>
          Type in the row above to add your first room, or skip to the next step.
        </p>
      )}

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Subjects →</button>
      </div>
    </div>
  );
}
