import { useState } from "react";
import { Link } from "react-router-dom";
import "./Login.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email.trim()) { setError("Please enter your email address"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
      setSuccess(data.message || "If an account exists with this email, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="login-card" style={{ maxWidth: 440, width: "100%" }}>
        <div className="login-card-header" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔐</div>
          <h2 className="login-card-title">Forgot password?</h2>
          <p className="login-card-sub">Enter your email and we'll send you a reset link.</p>
        </div>

        <form className="lf-form" onSubmit={handleSubmit} noValidate>
          <div className="lf-field">
            <label className="lf-label" htmlFor="fp-email">Email address</label>
            <div className="lf-input-wrap">
              <svg className="lf-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="12" height="9" rx="1" />
                <path d="M2 4l6 5 6-5" />
              </svg>
              <input id="fp-email" className="lf-input" type="email"
                placeholder="admin@yourschool.edu" autoComplete="email" autoFocus
                value={email} onChange={e => { setEmail(e.target.value); setError(""); setSuccess(""); }}
                disabled={loading} required />
            </div>
          </div>

          {error && <div className="lf-error" role="alert">{error}</div>}
          {success && <div className="lf-success">✅ {success}</div>}

          <button type="submit" className="lf-btn" disabled={loading}>
            {loading ? <><span className="lf-btn-spinner" />Sending…</> : "Send reset link"}
          </button>
        </form>

        <div className="lf-footer-row" style={{ marginTop: 16 }}>
          <Link to="/login" style={{ color: "#00CEC8", fontSize: 13, textDecoration: "none" }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
