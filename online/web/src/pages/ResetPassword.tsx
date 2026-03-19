import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import "./Login.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const mismatch = !!confirm && confirm !== password;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (!token) { setError("Reset token missing. Please request a new link."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
      setSuccess(data.message || "Password updated! You can now sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="login-card" style={{ maxWidth: 440, width: "100%" }}>
        <div className="login-card-header" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔑</div>
          <h2 className="login-card-title">Set new password</h2>
          <p className="login-card-sub">Choose a strong password for your account.</p>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div className="lf-success" style={{ marginBottom: 16 }}>✅ {success}</div>
            <Link to="/login" className="lf-btn" style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}>
              Go to Sign In
            </Link>
          </div>
        ) : (
          <form className="lf-form" onSubmit={handleSubmit} noValidate>
            <div className="lf-field">
              <label className="lf-label" htmlFor="rp-pwd">New password</label>
              <div className="lf-input-wrap">
                <svg className="lf-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="7" width="10" height="7" rx="1" />
                  <path d="M5 7V5a3 3 0 016 0v2" />
                </svg>
                <input id="rp-pwd" className="lf-input"
                  type={showPass ? "text" : "password"} placeholder="••••••••"
                  autoComplete="new-password" autoFocus
                  value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                  disabled={loading} required />
                <button type="button" className="lf-toggle-pass"
                  onClick={() => setShowPass(s => !s)} tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="rp-confirm">Confirm password</label>
              <div className="lf-input-wrap">
                <svg className="lf-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="7" width="10" height="7" rx="1" />
                  <path d="M5 7V5a3 3 0 016 0v2" />
                </svg>
                <input id="rp-confirm" className="lf-input" type="password" placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirm} onChange={e => { setConfirm(e.target.value); setError(""); }}
                  disabled={loading} required
                  style={{ borderColor: mismatch ? "rgba(239,68,68,0.6)" : undefined }} />
              </div>
              {mismatch && <div className="lf-input-err">Passwords do not match</div>}
            </div>

            {error && <div className="lf-error" role="alert">{error}</div>}

            <button type="submit" className="lf-btn" disabled={loading || mismatch}>
              {loading ? <><span className="lf-btn-spinner" />Updating…</> : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
