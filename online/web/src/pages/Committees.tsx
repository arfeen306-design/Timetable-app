import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { useToast } from "../context/ToastContext";

type Teacher   = Awaited<ReturnType<typeof api.listTeachers>>[0];
type Committee = api.Committee;

const ROLES = ["member", "chair", "secretary", "deputy"];

export default function CommitteesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid   = Number(projectId);
  const toast = useToast();

  const [loading,     setLoading]     = useState(true);
  const [teachers,    setTeachers]    = useState<Teacher[]>([]);
  const [committees,  setCommittees]  = useState<Committee[]>([]);
  const [expanded,    setExpanded]    = useState<Set<number>>(new Set());

  // Committee create/edit modal
  const [cModal,  setCModal]  = useState<{ mode: "add" | "edit"; committee?: Committee } | null>(null);
  const [fName,   setFName]   = useState("");
  const [fDesc,   setFDesc]   = useState("");
  const [cSaving, setCsaving] = useState(false);

  // Add-member modal
  const [mModal,   setMModal]   = useState<{ committeeId: number } | null>(null);
  const [mTeacher, setMTeacher] = useState<number | "">("");
  const [mRole,    setMRole]    = useState("member");
  const [mSaving,  setMsaving]  = useState(false);

  const load = useCallback(async () => {
    try {
      const [tList, cList] = await Promise.all([
        api.listTeachers(pid),
        api.listCommittees(pid),
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

  function openAddCommittee() {
    setFName(""); setFDesc("");
    setCModal({ mode: "add" });
  }

  function openEditCommittee(c: Committee, e: React.MouseEvent) {
    e.stopPropagation();
    setFName(c.name); setFDesc(c.description || "");
    setCModal({ mode: "edit", committee: c });
  }

  async function saveCommittee() {
    if (!fName.trim()) return;
    setCsaving(true);
    try {
      if (cModal?.mode === "edit" && cModal.committee) {
        const updated = await api.updateCommittee(pid, cModal.committee.id, {
          name: fName.trim(),
          description: fDesc.trim() || undefined,
        });
        setCommittees(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast("success", "Committee updated.");
      } else {
        const created = await api.createCommittee(pid, {
          name: fName.trim(),
          description: fDesc.trim() || undefined,
        });
        setCommittees(prev => [...prev, created]);
        toast("success", "Committee created.");
      }
      setCModal(null);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setCsaving(false);
    }
  }

  async function deleteCommittee(c: Committee, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete committee "${c.name}"? All members will also be removed.`)) return;
    try {
      await api.deleteCommittee(pid, c.id);
      setCommittees(prev => prev.filter(x => x.id !== c.id));
      toast("success", "Committee deleted.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── Member CRUD ────────────────────────────────────────────────────────────

  function openAddMember(committeeId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setMTeacher(""); setMRole("member");
    setMModal({ committeeId });
  }

  async function addMember() {
    if (!mModal || mTeacher === "") return;
    setMsaving(true);
    try {
      const member = await api.addCommitteeMember(pid, mModal.committeeId, {
        teacher_id: mTeacher as number,
        role: mRole,
      });
      setCommittees(prev => prev.map(c =>
        c.id !== mModal.committeeId ? c : { ...c, members: [...c.members, member] }
      ));
      toast("success", "Member added.");
      setMModal(null);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Add member failed");
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
        <button type="button" className="btn btn-primary" onClick={openAddCommittee}>
          + New Committee
        </button>
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
          const chairMember = c.members.find(m => m.role === "chair");
          const chair = chairMember ? teacherMap.get(chairMember.teacher_id) : null;

          return (
            <div
              key={c.id}
              style={{
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 10,
                overflow: "hidden",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              {/* Card header row */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.7rem 1rem", cursor: "pointer",
                  borderBottom: isOpen ? "1px solid rgba(99,102,241,0.15)" : "none",
                  background: isOpen ? "rgba(99,102,241,0.06)" : "transparent",
                  transition: "background 0.15s",
                }}
                onClick={() => toggleExpand(c.id)}
              >
                <span style={{
                  fontSize: "0.65rem", transition: "transform 0.2s",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}>▶</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{c.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
                    {c.description
                      ? c.description
                      : chair
                        ? `Chair: ${chair.first_name} ${chair.last_name}`
                        : null}
                  </div>
                </div>

                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, padding: "2px 9px",
                  borderRadius: 12, background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                  whiteSpace: "nowrap",
                }}>
                  {c.members.length} member{c.members.length !== 1 ? "s" : ""}
                </span>

                <button
                  type="button" className="btn"
                  style={{ fontSize: "0.73rem", padding: "3px 10px" }}
                  onClick={e => openEditCommittee(c, e)}
                >Edit</button>
                <button
                  type="button" className="btn btn-danger"
                  style={{ fontSize: "0.73rem", padding: "3px 10px" }}
                  onClick={e => deleteCommittee(c, e)}
                >Delete</button>
              </div>

              {/* Expanded member list */}
              {isOpen && (
                <div style={{ padding: "0.75rem 1rem 0.9rem" }}>
                  {c.members.length === 0 && (
                    <p style={{ color: "#64748b", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>
                      No members yet.
                    </p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.6rem" }}>
                    {c.members.map(m => {
                      const t = teacherMap.get(m.teacher_id);
                      const initials = t
                        ? (t.code || (t.first_name[0] + (t.last_name?.[0] ?? "")).toUpperCase())
                        : "?";
                      return (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {/* Avatar */}
                          <span style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: t?.color || "#6366f1",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.62rem", fontWeight: 700, color: "#fff",
                          }}>{initials}</span>

                          {/* Name */}
                          <span style={{ flex: 1, fontSize: "0.84rem", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t ? `${t.first_name} ${t.last_name}`.trim() : `Teacher #${m.teacher_id}`}
                          </span>

                          {/* Role selector */}
                          <select
                            value={m.role}
                            onChange={e => { e.stopPropagation(); changeMemberRole(c.id, m.id, e.target.value); }}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: "0.73rem", padding: "2px 5px", borderRadius: 5 }}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>

                          {/* Remove button */}
                          <button
                            type="button"
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "#e53e3e", fontSize: "0.95rem", padding: "2px 4px", lineHeight: 1,
                            }}
                            title="Remove member"
                            onClick={e => { e.stopPropagation(); removeMember(c.id, m.id); }}
                          >✕</button>
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
            <h3 style={{ marginTop: 0 }}>
              {cModal.mode === "edit" ? "Edit Committee" : "New Committee"}
            </h3>
            <div className="modal-form">
              <div className="modal-field">
                <label className="modal-label required">Name:</label>
                <input
                  value={fName}
                  onChange={e => setFName(e.target.value)}
                  placeholder="e.g., Academic Committee"
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Description:</label>
                <input
                  value={fDesc}
                  onChange={e => setFDesc(e.target.value)}
                  placeholder="Optional description…"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setCModal(null)} disabled={cSaving}>Cancel</button>
              <button
                type="button" className="btn btn-primary"
                onClick={saveCommittee}
                disabled={cSaving || !fName.trim()}
              >
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
                <select value={mTeacher} onChange={e => setMTeacher(Number(e.target.value))} autoFocus>
                  <option value="">— select teacher —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Role:</label>
                <select value={mRole} onChange={e => setMRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setMModal(null)} disabled={mSaving}>Cancel</button>
              <button
                type="button" className="btn btn-primary"
                onClick={addMember}
                disabled={mSaving || mTeacher === ""}
              >
                {mSaving ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
