import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import "./AdminUsers.css";

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  school_name: string;
  role: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string | null;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  // Password reset modal
  const [resetModal, setResetModal] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [resetting, setResetting] = useState(false);

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const token = localStorage.getItem("timetable_token") || "";

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status === 403 ? "Access denied" : "Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleToggleStatus(u: UserRow, action: "approve" | "deactivate") {
    // Optimistic update
    setUsers(prev => prev.map(x => x.id === u.id ? {
      ...x,
      is_approved: action === "approve",
      is_active: action === "approve",
    } : x));
    try {
      const res = await fetch(`/api/admin/users/${u.id}/toggle-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      showToast(data.message || `${u.email} ${action}d`);
    } catch (err) {
      // Revert on error
      setUsers(prev => prev.map(x => x.id === u.id ? u : x));
      showToast(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleResetPassword() {
    if (!resetModal || newPwd.length < 6) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${resetModal.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      showToast(data.message || "Password reset");
      setResetModal(null);
      setNewPwd("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed");
    } finally { setResetting(false); }
  }

  async function handleDeleteUser() {
    if (!deleteModal) return;
    const target = deleteModal;
    setDeleting(true);
    // Optimistic: remove from list immediately
    setUsers(prev => prev.filter(x => x.id !== target.id));
    setDeleteModal(null);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      showToast(data.message || "User deleted");
    } catch (err) {
      // Revert on error
      setUsers(prev => [...prev, target].sort((a, b) => b.id - a.id));
      showToast(err instanceof Error ? err.message : "Failed");
    } finally { setDeleting(false); }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      || (u.phone || "").includes(q) || u.school_name.toLowerCase().includes(q);
  });

  if (user?.role !== "platform_admin") {
    return (
      <div className="admin-denied">
        <div style={{ fontSize: "3rem" }}>🚫</div>
        <h2>Access Denied</h2>
        <p>This page is restricted to platform administrators.</p>
      </div>
    );
  }

  return (
    <div className="admin-users">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">User Management</h1>
          <p className="admin-subtitle">{users.length} registered accounts</p>
        </div>
        <div className="admin-search-wrap">
          <input
            className="admin-search"
            type="text"
            placeholder="Search by name, email, phone, school…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="admin-loading">Loading users…</div>}
      {error && <div className="admin-error">{error}</div>}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>School</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="admin-empty">No users found</td></tr>
              )}
              {filtered.map((u, i) => (
                <tr key={u.id} className={!u.is_approved ? "row-pending" : !u.is_active ? "row-inactive" : ""}>
                  <td className="col-num">{i + 1}</td>
                  <td className="col-name">
                    <span className="user-avatar">{(u.name || "?")[0].toUpperCase()}</span>
                    {u.name || "—"}
                    {u.role === "platform_admin" && <span className="badge-admin">Admin</span>}
                  </td>
                  <td className="col-email">{u.email}</td>
                  <td className="col-phone">{u.phone || "—"}</td>
                  <td className="col-school">{u.school_name || "—"}</td>
                  <td className="col-status">
                    {u.is_approved && u.is_active ? (
                      <span className="status-badge active">Active</span>
                    ) : !u.is_approved ? (
                      <span className="status-badge pending">Pending</span>
                    ) : (
                      <span className="status-badge inactive">Inactive</span>
                    )}
                  </td>
                  <td className="col-date">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="col-actions">
                    {!u.is_approved ? (
                      <button className="action-btn approve" onClick={() => handleToggleStatus(u, "approve")}>✓ Approve</button>
                    ) : (
                      <button className="action-btn deactivate" onClick={() => handleToggleStatus(u, "deactivate")}>✕ Deactivate</button>
                    )}
                    <button className="action-btn reset" onClick={() => { setResetModal(u); setNewPwd(""); }}>🔑 Reset</button>
                    {u.role !== "platform_admin" && (
                      <button className="action-btn delete" onClick={() => setDeleteModal(u)}>🗑 Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🔑 Reset Password</h3>
            <p className="modal-sub">Setting new password for <strong>{resetModal.email}</strong></p>
            <input
              className="modal-input"
              type="text"
              placeholder="Enter new password (min 6 chars)"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setResetModal(null)}>Cancel</button>
              <button className="modal-btn confirm" onClick={handleResetPassword} disabled={resetting || newPwd.length < 6}>
                {resetting ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🗑 Delete User Permanently</h3>
            <p className="modal-sub">
              You are about to permanently delete <strong>{deleteModal.name}</strong> ({deleteModal.email}).
            </p>
            <div className="modal-warning">
              ⚠️ This action cannot be undone. The following will be permanently deleted:
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                <li>User account and profile</li>
                <li>Their school and all projects</li>
                <li>All timetables, lessons, and settings</li>
                <li>All cached data and memory</li>
              </ul>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="modal-btn danger" onClick={handleDeleteUser} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}
