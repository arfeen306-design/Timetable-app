import { useState } from "react";
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

export default function ClassroomsTab({ pid, rooms, onChange, onNext }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);

  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fType, setFType] = useState("Classroom");
  const [fCapacity, setFCapacity] = useState(40);
  const [fColor, setFColor] = useState("#9B59B6");

  function openAdd() {
    setEditRoom(null);
    setFName(""); setFCode(""); setFType("Classroom"); setFCapacity(40); setFColor("#9B59B6");
    setModalOpen(true);
  }

  function openEdit(r?: Room) {
    const room = r || rooms.find(x => x.id === selectedId);
    if (!room) return;
    setEditRoom(room);
    setFName(room.name); setFCode(room.code); setFType(room.room_type); setFCapacity(room.capacity); setFColor(room.color || "#9B59B6");
    setModalOpen(true);
  }

  async function saveRoom() {
    if (!fName.trim()) return;
    const data = { name: fName.trim(), code: fCode.trim(), room_type: fType, capacity: fCapacity };
    try {
      if (editRoom) {
        await api.updateRoom(pid, editRoom.id, data);
        onChange(rooms.map(r => r.id === editRoom.id ? { ...r, ...data } : r));
        toast("success", "Room updated.");
      } else {
        const created = await api.createRoom(pid, data);
        onChange([...rooms, { ...created, ...data, color: fColor } as Room]);
        toast("success", "Room added.");
      }
      setModalOpen(false);
    } catch (err) { toast("error", err instanceof Error ? err.message : "Save failed"); }
  }

  async function deleteSelected() {
    if (selectedId == null) return;
    const name = rooms.find(r => r.id === selectedId)?.name ?? "";
    if (!confirm(`Delete room "${name}"?`)) return;
    try {
      await api.deleteRoom(pid, selectedId);
      onChange(rooms.filter(r => r.id !== selectedId));
      setSelectedId(null);
      toast("success", "Room deleted.");
    } catch (err) { toast("error", err instanceof Error ? err.message : "Delete failed"); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Classrooms</h2>
      <p className="subheading">Add and manage rooms, labs, and other teaching spaces.</p>

      <div className="toolbar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" onClick={openAdd}>+ Add Room</button>
        <button type="button" className="btn" onClick={() => openEdit()} disabled={selectedId == null}>Edit</button>
        <button type="button" className="btn btn-danger" onClick={deleteSelected} disabled={selectedId == null}>Delete</button>
      </div>

      {rooms.length === 0 && <p className="subheading" style={{ textAlign: "center" }}>No rooms added yet.</p>}
      <table className="data-table">
        <thead><tr><th style={{ width: 40 }}>#</th><th>Name</th><th>Code</th><th>Type</th><th>Capacity</th><th style={{ width: 60 }}>Color</th></tr></thead>
        <tbody>
          {rooms.map((r, i) => (
            <tr key={r.id} className={selectedId === r.id ? "selected" : ""} onClick={() => setSelectedId(r.id)} onDoubleClick={() => openEdit(r)}>
              <td>{i + 1}</td><td>{r.name}</td><td>{r.code}</td><td>{r.room_type}</td><td>{r.capacity}</td>
              <td><span className="color-swatch" style={{ backgroundColor: r.color || "#9B59B6" }} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="nav-footer">
        <button type="button" className="btn" onClick={onNext}>Next: Teachers →</button>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{editRoom ? "Edit Room" : "New Room"}</h3>
            <div className="modal-form">
              <div className="modal-field"><label className="modal-label required">Name:</label><input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g., Room 101" autoFocus /></div>
              <div className="modal-field"><label className="modal-label">Code:</label><input value={fCode} onChange={e => setFCode(e.target.value)} placeholder="e.g., R101" /></div>
              <div className="modal-field">
                <label className="modal-label">Type:</label>
                <select value={fType} onChange={e => setFType(e.target.value)}>
                  {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="modal-field"><label className="modal-label">Capacity:</label><input type="number" min={1} value={fCapacity} onChange={e => setFCapacity(Number(e.target.value))} style={{ width: 80 }} /></div>
              <div className="modal-field"><label className="modal-label">Color:</label><input type="color" value={fColor} onChange={e => setFColor(e.target.value)} style={{ width: 48, height: 32, padding: 0 }} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveRoom}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
