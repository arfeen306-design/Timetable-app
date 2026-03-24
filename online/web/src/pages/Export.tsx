import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";

type LoadingKey = "excel" | "pdf" | "csv" | "all-classes" | "all-teachers" | null;

export default function Export() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const [loading, setLoading] = useState<LoadingKey>(null);
  const [error, setError] = useState("");

  async function download(format: "excel" | "pdf" | "csv") {
    if (isNaN(pid)) return;
    setError("");
    setLoading(format);
    try {
      const ext = format === "excel" ? "xlsx" : format;
      await api.downloadExport(pid, format, `timetable.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed. Ensure a timetable has been generated.");
    } finally {
      setLoading(null);
    }
  }

  async function downloadAll(type: "all-classes" | "all-teachers") {
    if (isNaN(pid)) return;
    setError("");
    setLoading(type);
    try {
      const filename = type === "all-classes" ? "school_timetable_all_classes.pdf" : "staff_timetable_all_teachers.pdf";
      await api.downloadPdfAll(pid, type, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed. Ensure a timetable has been generated.");
    } finally {
      setLoading(null);
    }
  }

  if (isNaN(pid)) return <div>Invalid project</div>;

  const busy = loading !== null;

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to={`/project/${pid}`}>← Editor</Link>
      </p>
      <h1>Export</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Consolidated PDF ── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Complete Timetable PDFs</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Download a single PDF containing every class or every teacher — one page each, ready to print.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadAll("all-classes")}
            disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>📚</span>
            <span>{loading === "all-classes" ? "Compiling…" : "Complete School Timetable (All Classes)"}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadAll("all-teachers")}
            disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>👨‍🏫</span>
            <span>{loading === "all-teachers" ? "Compiling…" : "Complete Staff Timetable (All Teachers)"}</span>
          </button>
        </div>
      </div>

      {/* ── Other formats ── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Other Formats</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Download the timetable data as a spreadsheet or single-view PDF.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            onClick={() => download("excel")}
            disabled={busy}
          >
            {loading === "excel" ? "Preparing…" : "📊 Excel (.xlsx)"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => download("csv")}
            disabled={busy}
          >
            {loading === "csv" ? "Preparing…" : "📄 CSV"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => download("pdf")}
            disabled={busy}
          >
            {loading === "pdf" ? "Preparing…" : "📋 PDF (current view)"}
          </button>
        </div>
      </div>
    </>
  );
}
