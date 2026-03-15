import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No verification token provided."); return; }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json();
        if (r.ok) { setStatus("success"); setMessage(data.message || "Email verified!"); }
        else { setStatus("error"); setMessage(data.detail || "Verification failed."); }
      })
      .catch(() => { setStatus("error"); setMessage("Network error. Please try again."); });
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a, #1e293b)",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "2.5rem", maxWidth: 420, width: "90%",
        textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>
          {status === "loading" ? "⏳" : status === "success" ? "✅" : "❌"}
        </div>
        <h2 style={{ margin: "0 0 0.5rem", color: "#0f172a", fontSize: "1.3rem" }}>
          {status === "loading" ? "Verifying…" : status === "success" ? "Email Verified!" : "Verification Failed"}
        </h2>
        <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
          {message}
        </p>
        {status !== "loading" && (
          <Link to="/login" style={{
            display: "inline-block", padding: "0.65rem 2rem", borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff",
            textDecoration: "none", fontWeight: 700, fontSize: "0.9rem",
          }}>
            Go to Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
