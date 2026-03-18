import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";
import { cachedFetch } from "../hooks/prefetchCache";
import SearchableSelect from "../components/SearchableSelect";

type Teacher   = Awaited<ReturnType<typeof api.listTeachers>>[0];
type Committee = api.Committee;

const ROLES = ["member", "chair", "secretary", "deputy"];

/** Three-dot menu that closes on outside click */
function ThreeDotMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--slate-400)", fontSize: "1.1rem", padding: "2px 6px",
          borderRadius: "var(--radius-sm)", lineHeight: 1,
          transition: "background var(--t-fast)",
        }}
        title="More options"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >⋮</button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "100%", zIndex: 100,
          background: "var(--surface-card)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
          minWidth: 130, padding: "4px 0",
          animation: "fadeIn var(--duration-fast) var(--ease-out)",
        }}>
          {[
            { label: "✏️ Edit name", action: onEdit, danger: false },
            { label: "🗑️ Delete",    action: onDelete, danger: true },
          ].map(item => (
            <button
              key={item.label}
              type="button"
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: "none", border: "none", cursor: "pointer",
                padding: "7px 14px", fontSize: "0.8rem",
                color: item.danger ? "var(--danger-600)" : "var(--slate-700)",
                fontFamily: "var(--font-sans)", fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = item.danger ? "var(--danger-50)" : "var(--slate-50)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
              onClick={e => { e.stopPropagation(); setOpen(false); item.action(); }}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommitteesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid   = Number(projectId);
  const toast = useToast();

  const [loading,    setLoading]    = useState(true);
  const [teachers,   setTeachers]   = useState<Teacher[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set());

  // Inline delete confirm for committees
  const [confirmDeleteCid, setConfirmDeleteCid] = useState<number | null>(null);
  // Inline remove-member confirm: stores member id
  const [confirmRemoveMid, setConfirmRemoveMid] = useState<{ cid: number; mid: number } | null>(null);

  // Committee create/edit modal
  const [cModal,  setCModal]  = useState<{ mode: "add" | "edit"; committee?: Committee } | null>(null);
  const [fName,   setFName]   = useState("");
  const [fDesc,   setFDesc]   = useState("");
  const [cSaving, setCsaving] = useState(false);

  // Add-member modal
  const [mModal,   setMModal]   = useState<{ committeeId: number } | null>(null);
  const [mTeacher, setMTeacher] = useState<number | "">("");
  const [mRole,    setMRole]    = useState("member");
  const [mError,   setMError]   = useState("");
  const [mSaving,  setMsaving]  = useState(false);

  const load = useCallback(async () => {
    try {
      const [tList, cList] = await Promise.all([
        cachedFetch(`comm-teachers-${pid}`, () => api.listTeachers(pid), 60_000),
        cachedFetch(`comm-list-${pid}`, () => api.listCommittees(pid), 30_000),
      ]);
      setTeachers(tList);
      setCommittees(cList);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to load committees");
    } finally {
      setLoading(false);
    }
  }, [pid, toast]);

  useEffect(() => { load(); }, [load]);

  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Committee CRUD ─────────────────────────────────────────────────────────

  function openAddCommittee() { setFName(""); setFDesc(""); setCModal({ mode: "add" }); }

  function openEditCommittee(c: Committee) {
    setFName(c.name); setFDesc(c.description || "");
    setCModal({ mode: "edit", committee: c });
  }

  async function saveCommittee() {
    if (!fName.trim()) return;
    setCsaving(true);
    try {
      if (cModal?.mode === "edit" && cModal.committee) {
        const updated = await api.updateCommittee(pid, cModal.committee.id, {
          name: fName.trim(), description: fDesc.trim() || undefined,
        });
        setCommittees(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast("success", "Committee updated.");
      } else {
        const created = await api.createCommittee(pid, {
          name: fName.trim(), description: fDesc.trim() || undefined,
        });
        setCommittees(prev => [created, ...prev]);
        setExpanded(prev => new Set([...prev, created.id]));
        toast("success", "Committee created.");
      }
      setCModal(null);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setCsaving(false);
    }
  }

  async function deleteCommittee(c: Committee) {
    try {
      await api.deleteCommittee(pid, c.id);
      setCommittees(prev => prev.filter(x => x.id !== c.id));
      setConfirmDeleteCid(null);
      toast("success", "Committee deleted.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── Member CRUD ────────────────────────────────────────────────────────────

  function openAddMember(committeeId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setMTeacher(""); setMRole("member"); setMError("");
    setMModal({ committeeId });
  }

  async function addMember() {
    if (!mModal || mTeacher === "") return;
    setMError("");
    // Inline duplicate check
    const committee = committees.find(c => c.id === mModal.committeeId);
    if (committee?.members.some(m => m.teacher_id === (mTeacher as number))) {
      setMError("This teacher is already in this committee.");
      return;
    }
    setMsaving(true);
    try {
      const member = await api.addCommitteeMember(pid, mModal.committeeId, {
        teacher_id: mTeacher as number, role: mRole,
      });
      setCommittees(prev => prev.map(c =>
        c.id !== mModal.committeeId ? c : { ...c, members: [...c.members, member] }
      ));
      toast("success", "Member added.");
      setMModal(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Add member failed";
      if (msg.toLowerCase().includes("already") || msg.includes("409") || msg.includes("duplicate")) {
        setMError("This teacher is already in this committee.");
      } else {
        toast("error", msg);
      }
    } finally {
      setMsaving(false);
    }
  }

  async function removeMember(committeeId: number, memberId: number) {
    try {
      await api.removeCommitteeMember(pid, committeeId, memberId);
      setCommittees(prev => prev.map(c =>
        c.id !== committeeId ? c : { ...c, members: c.members.filter(m => m.id !== memberId) }
      ));
      setConfirmRemoveMid(null);
      toast("success", "Member removed.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Remove failed");
    }
  }

  async function changeMemberRole(committeeId: number, memberId: number, role: string) {
    try {
      const updated = await api.updateMemberRole(pid, committeeId, memberId, role);
      setCommittees(prev => prev.map(c =>
        c.id !== committeeId ? c : { ...c, members: c.members.map(m => m.id === memberId ? updated : m) }
      ));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update role failed");
    }
  }

  if (loading) return <div className="card"><p className="subheading">Loading…</p></div>;

  return (
    <div className="card">
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Committees</h2>
          <p className="subheading" style={{ margin: 0 }}>Manage school committees and their members.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" style={{ fontSize: "0.78rem" }}
            onClick={async () => {
              try {
                const r = await api.publishSnapshot(pid, "committees");
                toast("success", `Published: ${r.title} (${r.record_count} records)`);
              } catch (e) { toast("error", e instanceof Error ? e.message : "Publish failed"); }
            }}>📦 Publish</button>
          <button type="button" className="btn" style={{ fontSize: "0.78rem" }}
            onClick={async () => {
              try { await api.exportCommitteesPdf(pid); }
              catch (e) { toast("error", e instanceof Error ? e.message : "PDF export failed. Please log in again."); }
            }}>
            📄 Export PDF
          </button>
          <button type="button" className="btn btn-primary" onClick={openAddCommittee}>+ New Committee</button>
        </div>
      </div>

      {committees.length === 0 && (
        <p className="subheading" style={{ textAlign: "center", padding: "2.5rem 0" }}>
          No committees yet. Create one to get started.
        </p>
      )}

      {/* Committee cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {committees.map(c => {
          const isOpen = expanded.has(c.id);

          return (
            <div key={c.id} className="anim-card" style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)", overflow: "hidden",
              background: "var(--surface-card)",
            }}>
              {/* ── Card header ── */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.7rem 1rem", cursor: "pointer",
                  borderBottom: isOpen ? "1px solid var(--border-subtle)" : "none",
                  background: isOpen ? "var(--primary-50)" : "transparent",
                  transition: "background var(--t-fast)",
                }}
                onClick={() => toggleExpand(c.id)}
              >
                <span style={{
                  fontSize: "0.6rem", transition: "transform var(--t-normal)",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}>▶</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>📋 {c.name}</div>
                  {c.description && (
                    <div style={{ fontSize: "0.72rem", color: "var(--slate-500)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.description}
                    </div>
                  )}
                </div>

                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, padding: "2px 9px",
                  borderRadius: "var(--radius-full)", background: "var(--primary-100)", color: "var(--primary-700)",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {c.members.length} member{c.members.length !== 1 ? "s" : ""}
                </span>

                {/* Three-dot menu — stops propagation internally */}
                <div onClick={e => e.stopPropagation()}>
                  <ThreeDotMenu
                    onEdit={() => openEditCommittee(c)}
                    onDelete={() => setConfirmDeleteCid(c.id)}
                  />
                </div>
              </div>

              {/* ── Inline delete confirm ── */}
              {confirmDeleteCid === c.id && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.6rem 1rem", background: "var(--danger-50)",
                  borderBottom: "1px solid var(--danger-100)", fontSize: "0.8rem",
                  color: "var(--danger-700)", fontWeight: 600,
                }}>
                  <span>Delete "{c.name}" and all its members?</span>
                  <button type="button" className="btn btn-danger"
                    style={{ fontSize: "0.73rem", padding: "3px 10px" }}
                    onClick={() => deleteCommittee(c)}>Yes, delete</button>
                  <button type="button" className="btn"
                    style={{ fontSize: "0.73rem", padding: "3px 10px" }}
                    onClick={() => setConfirmDeleteCid(null)}>Cancel</button>
                </div>
              )}

              {/* ── Expanded member list ── */}
              {isOpen && (
                <div className="period-body-open" style={{ padding: "0.75rem 1rem 0.9rem" }}>
                  {c.members.length === 0 && (
                    <p style={{ color: "var(--slate-400)", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>No members yet.</p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.6rem" }}>
                    {c.members.map(m => {
                      const t = teacherMap.get(m.teacher_id);
                      const inits = t ? (t.code || (t.first_name[0] + (t.last_name?.[0] ?? "")).toUpperCase()) : "?";
                      const isConfirmRemove = confirmRemoveMid?.cid === c.id && confirmRemoveMid?.mid === m.id;

                      return (
                        <div key={m.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {/* Avatar */}
                            <span style={{
                              width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                              background: t?.color || "var(--primary-500)",
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.62rem", fontWeight: 700, color: "#fff",
                            }}>{inits}</span>

                            {/* Name */}
                            <span style={{ flex: 1, fontSize: "0.84rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t ? `${t.first_name} ${t.last_name}`.trim() : `Teacher #${m.teacher_id}`}
                            </span>

                            {/* Role selector */}
                            <select
                              value={m.role}
                              onChange={e => changeMemberRole(c.id, m.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{ fontSize: "0.73rem", padding: "2px 5px", borderRadius: "var(--radius-sm)" }}
                            >
                              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>

                            {/* Remove button */}
                            <button
                              type="button"
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--danger-400)", fontSize: "0.85rem", padding: "2px 4px",
                                fontFamily: "var(--font-sans)", fontWeight: 600, borderRadius: "var(--radius-sm)",
                                transition: "color var(--t-fast)",
                              }}
                              title="Remove member"
                              onMouseEnter={e => { e.currentTarget.style.color = "var(--danger-600)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "var(--danger-400)"; }}
                              onClick={e => { e.stopPropagation(); setConfirmRemoveMid({ cid: c.id, mid: m.id }); }}
                            >Remove</button>
                          </div>

                          {/* Inline remove confirm tooltip */}
                          {isConfirmRemove && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: "0.5rem",
                              margin: "4px 0 4px 36px", padding: "5px 10px",
                              background: "var(--danger-50)", border: "1px solid var(--danger-100)",
                              borderRadius: "var(--radius-sm)", fontSize: "0.75rem",
                              color: "var(--danger-700)", fontWeight: 600,
                            }}>
                              Remove {t?.first_name || "this teacher"} from this committee?
                              <button type="button" className="btn btn-danger"
                                style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                                onClick={() => removeMember(c.id, m.id)}>Yes</button>
                              <button type="button" className="btn"
                                style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                                onClick={() => setConfirmRemoveMid(null)}>No</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button" className="btn"
                    style={{ fontSize: "0.76rem", padding: "4px 12px" }}
                    onClick={e => openAddMember(c.id, e)}
                  >+ Add Member</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Committee create/edit modal ── */}
      {cModal && (
        <div className="modal-overlay" onClick={() => !cSaving && setCModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{cModal.mode === "edit" ? "Edit Committee" : "New Committee"}</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Name:</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Academic Committee" autoFocus />
              </div>
              <div className="modal-field">
                <label className="modal-label">Description:</label>
                <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Optional description…" />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setCModal(null)} disabled={cSaving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveCommittee} disabled={cSaving || !fName.trim()}>
                {cSaving ? "Saving…" : cModal.mode === "edit" ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-member modal ── */}
      {mModal && (
        <div className="modal-overlay" onClick={() => !mSaving && setMModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Member</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Teacher:</label>
                <SearchableSelect
                  value={mTeacher}
                  onChange={v => { setMTeacher(v ? Number(v) : ""); setMError(""); }}
                  options={teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name} (${t.code})` }))}
                  placeholder="— select teacher —"
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Role:</label>
                <select value={mRole} onChange={e => setMRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {mError && <p style={{ color: "var(--danger-600)", fontSize: "0.8rem", margin: "0.25rem 0 0 160px" }}>{mError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setMModal(null)} disabled={mSaving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={addMember} disabled={mSaving || mTeacher === ""}>
                {mSaving ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
