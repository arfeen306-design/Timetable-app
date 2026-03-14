import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";

export default function Export() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const [loading, setLoading] = useState<"excel" | "pdf" | "csv" | null>(null);
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

  if (isNaN(pid)) return <div>Invalid project</div>;

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to={`/project/${pid}`}>← Editor</Link>
      </p>
      <h1>Export</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <p>Download the current timetable (from the latest completed run).</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => download("excel")}
            disabled={loading !== null}
          >
            {loading === "excel" ? "Preparing…" : "Download Excel"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => download("pdf")}
            disabled={loading !== null}
          >
            {loading === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => download("csv")}
            disabled={loading !== null}
          >
            {loading === "csv" ? "Preparing…" : "Download CSV"}
          </button>
        </div>
      </div>
    </>
  );
}
