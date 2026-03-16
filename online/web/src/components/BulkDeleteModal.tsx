import React, { useState } from "react";

export interface BulkDeleteItem {
  id: number;
  name: string;
}

interface Props {
  items: BulkDeleteItem[];
  /** Singular label, e.g. "teacher" or "class" */
  entityLabel: string;
  /** Async function called with the ids when the user confirms. Should throw on failure. */
  onConfirm: (ids: number[]) => Promise<void>;
  onClose: () => void;
}

function BulkDeleteModal({ items, entityLabel, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ids = items.map((i) => i.id);
  const count = items.length;
  const entityPlural = count === 1 ? entityLabel : `${entityLabel}s`;
  const isConfirmed = typed.toUpperCase() === "DELETE";

  async function handleConfirm() {
    if (!isConfirmed || loading) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && isConfirmed) handleConfirm();
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: "#e53e3e" }}>
          Delete {count} {entityPlural}?
        </h3>

        <p style={{ marginBottom: "0.5rem" }}>
          The following {entityPlural} will be permanently deleted:
        </p>
        <ul
          style={{
            maxHeight: 180,
            overflowY: "auto",
            paddingLeft: "1.5rem",
            margin: "0 0 1rem",
            fontSize: "0.875rem",
          }}
        >
          {items.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>

        <p style={{ marginBottom: "0.4rem", fontSize: "0.875rem" }}>
          Type <strong>DELETE</strong> to confirm:
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="DELETE"
          autoFocus
          style={{ width: "100%", marginBottom: "0.75rem" }}
          disabled={loading}
        />

        {error && (
          <p style={{ color: "#e53e3e", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={!isConfirmed || loading}
          >
            {loading ? "Deleting…" : `Delete ${count} ${entityPlural}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkDeleteModal;
