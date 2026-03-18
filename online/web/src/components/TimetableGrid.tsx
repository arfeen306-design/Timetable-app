import { useState, useCallback, useRef } from "react";
import * as api from "../api";
import "./timetable-grid.css";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

interface SlotValidity {
  valid: boolean;
  current: boolean;
  conflicts: string[];
}

interface Props {
  projectId: number;
  entries: Entry[];
  days: number;
  periods: number;
  viewType: "class" | "teacher" | "room" | "master";
  onEntriesChange: (entries: Entry[]) => void;
}

/** Lighten a hex color for card background */
function lightenColor(hex: string, amount = 0.85): string {
  if (!hex || !hex.startsWith("#")) return "#e2e8f0";
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

/** Darken a color for text */
function darkenColor(hex: string, amount = 0.4): string {
  if (!hex || !hex.startsWith("#")) return "#334155";
  const num = parseInt(hex.slice(1), 16);
  const r = Math.round(((num >> 16) & 0xff) * (1 - amount));
  const g = Math.round(((num >> 8) & 0xff) * (1 - amount));
  const b = Math.round((num & 0xff) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function TimetableGrid({ projectId, entries, days, periods, onEntriesChange }: Props) {
  const [dragEntryId, setDragEntryId] = useState<number | null>(null);
  const [validSlots, setValidSlots] = useState<SlotValidity[][] | null>(null);
  const [conflictToast, setConflictToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Build grid from entries
  const grid: (Entry | null)[][] = [];
  for (let d = 0; d < days; d++) {
    const row: (Entry | null)[] = [];
    for (let p = 0; p < periods; p++) {
      const entry = entries.find((e) => e.day_index === d && e.period_index === p);
      row.push(entry || null);
    }
    grid.push(row);
  }

  // Show conflict toast briefly
  const showConflict = useCallback((msg: string) => {
    setConflictToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setConflictToast(null), 4000);
  }, []);

  // On drag start: fetch valid slots from backend
  const handleDragStart = useCallback(
    async (e: React.DragEvent, entry: Entry) => {
      if (entry.locked) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(entry.id));
      setDragEntryId(entry.id);

      // Fetch valid slots
      try {
        const result = await api.api<{
          entry_id: number;
          days: number;
          periods: number;
          slots: SlotValidity[][];
        }>(`/api/projects/${projectId}/review/valid-slots/${entry.id}`);
        setValidSlots(result.slots);
      } catch {
        setValidSlots(null);
      }
    },
    [projectId]
  );

  const handleDragEnd = useCallback(() => {
    setDragEntryId(null);
    setValidSlots(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // On drop: attempt to move entry
  const handleDrop = useCallback(
    async (e: React.DragEvent, targetDay: number, targetPeriod: number) => {
      e.preventDefault();
      const entryIdStr = e.dataTransfer.getData("text/plain");
      const entryId = Number(entryIdStr);
      if (!entryId) return;

      setDragEntryId(null);
      setValidSlots(null);

      try {
        const result = await api.api<{
          success: boolean;
          conflicts: { type: string; message: string }[];
          message?: string;
        }>(`/api/projects/${projectId}/review/move-entry`, {
          method: "POST",
          body: JSON.stringify({
            entry_id: entryId,
            new_day_index: targetDay,
            new_period_index: targetPeriod,
          }),
        });

        if (result.success) {
          // Update entries locally
          const updated = entries.map((entry) =>
            entry.id === entryId
              ? { ...entry, day_index: targetDay, period_index: targetPeriod }
              : entry
          );
          onEntriesChange(updated);
        } else if (result.conflicts && result.conflicts.length > 0) {
          showConflict(result.conflicts.map((c) => c.message).join(" · "));
        }
      } catch (err) {
        showConflict(err instanceof Error ? err.message : "Move failed");
      }
    },
    [projectId, entries, onEntriesChange, showConflict]
  );

  // Get cell CSS class based on drag state
  const getCellClass = (day: number, period: number): string => {
    if (!dragEntryId || !validSlots) return "tt-cell";
    const slot = validSlots[day]?.[period];
    if (!slot) return "tt-cell";
    if (slot.current) return "tt-cell tt-cell--drag-current";
    if (slot.valid) return "tt-cell tt-cell--drag-valid";
    return "tt-cell tt-cell--drag-conflict";
  };

  // Grid CSS: columns = [period-label] + [days]
  const gridStyle = {
    gridTemplateColumns: `80px repeat(${days}, 1fr)`,
    gridTemplateRows: `auto repeat(${periods}, minmax(64px, auto))`,
  };

  return (
    <div className="tt-container">
      <div className="tt-grid" style={gridStyle}>
        {/* Corner cell */}
        <div className="tt-header tt-header--corner">Page</div>

        {/* Day headers */}
        {Array.from({ length: days }, (_, d) => (
          <div key={`dh-${d}`} className="tt-header">
            {DAY_NAMES[d] || `Day ${d + 1}`}
          </div>
        ))}

        {/* Rows: one per period */}
        {Array.from({ length: periods }, (_, p) => (
          <>
            {/* Period label */}
            <div key={`pl-${p}`} className="tt-period-label">
              <span>Page {p + 1}</span>
            </div>

            {/* Day cells for this period */}
            {Array.from({ length: days }, (_, d) => {
              const entry = grid[d]?.[p] || null;
              const cellClass = getCellClass(d, p);

              return (
                <div
                  key={`c-${d}-${p}`}
                  className={cellClass}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, d, p)}
                >
                  {entry ? (
                    <div
                      className={`tt-card${entry.id === dragEntryId ? " tt-card--dragging" : ""}${entry.locked ? " tt-card--locked" : ""}`}
                      draggable={!entry.locked}
                      onDragStart={(e) => handleDragStart(e, entry)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background: lightenColor(entry.subject_color),
                        borderLeftColor: entry.subject_color || "#94a3b8",
                        color: darkenColor(entry.subject_color),
                      }}
                    >
                      <span className="tt-card__subject">{entry.subject_name || entry.subject_code}</span>
                      <span className="tt-card__teacher">{entry.teacher_name}</span>
                      {entry.room_name && <span className="tt-card__room">{entry.room_name}</span>}
                    </div>
                  ) : (
                    <div className="tt-cell--empty">—</div>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {/* Conflict toast */}
      {conflictToast && (
        <div className="tt-conflict-toast">
          ⚠️ {conflictToast}
        </div>
      )}
    </div>
  );
}
