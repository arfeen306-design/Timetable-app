import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api";

export default function Generate() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof api.validateProject>> | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.generateTimetable>> | null>(null);
  const [error, setError] = useState("");
  const genLock = useRef(false); // prevent double-click

  async function handleValidate() {
    if (isNaN(pid)) return;
    setError(""); setValidation(null); setValidating(true);
    try {
      const v = await api.validateProject(pid);
      setValidation(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally { setValidating(false); }
  }

  async function handleGenerate() {
    if (isNaN(pid) || genLock.current) return;
    genLock.current = true;
    setError(""); setResult(null); setGenerating(true);
    try {
      // Auto-validate first
      const v = await api.validateProject(pid);
      setValidation(v);
      if (!v.is_valid) {
        setError("Please fix validation errors before generating.");
        return;
      }
      const r = await api.generateTimetable(pid);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
      // Release lock after short delay to prevent double-click
      setTimeout(() => { genLock.current = false; }, 1000);
    }
  }

  if (isNaN(pid)) return <div>Invalid project</div>;

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to={`/project/${pid}`}>← Editor</Link>
      </p>
      <h1>Generate timetable</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <p>Validate project data before generating. Then run the solver to produce a timetable.</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button type="button" className="btn btn-primary" onClick={handleValidate} disabled={validating}>
            {validating ? "Validating…" : "Validate"}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating || genLock.current}
            style={{ background: generating ? "#94a3b8" : "#22c55e", borderColor: generating ? "#94a3b8" : "#22c55e" }}>
            {generating ? "⏳ Generating…" : "🚀 Generate"}
          </button>
        </div>
      </div>
      {validation && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Validation result</h2>
          <p><strong>Valid:</strong> {validation.is_valid ? "✅ Yes" : "❌ No"}</p>
          {validation.errors.length > 0 && (
            <div className="alert alert-error">
              <strong>Errors</strong>
              <ul style={{ margin: "0.5rem 0 0 1rem" }}>{validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="alert alert-warning">
              <strong>Warnings</strong>
              <ul style={{ margin: "0.5rem 0 0 1rem" }}>{validation.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {Object.keys(validation.grouped_errors || {}).length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              {Object.entries(validation.grouped_errors as Record<string, string[]>).map(([category, msgs]) => (
                <div key={category} className="alert alert-error" style={{ marginBottom: 8 }}>
                  <strong>{category}</strong>
                  <ul style={{ margin: "0.4rem 0 0 1rem" }}>
                    {msgs.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result && (
        <div className={`card ${result.success ? "alert-success" : "alert-error"}`}>
          <h2 style={{ marginTop: 0 }}>Generation result</h2>
          <p><strong>Success:</strong> {result.success ? "✅ Yes" : "❌ No"}</p>
          <p>{result.message}</p>
          {result.entries_count != null && <p>Entries: {result.entries_count}</p>}
          {result.messages && result.messages.length > 0 && (
            <ul>{result.messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
          )}
          {result.success && (
            <Link to={`/project/${pid}/review`} className="btn btn-primary" style={{ marginTop: "1rem", display: "inline-block" }}>
              View Timetable →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
