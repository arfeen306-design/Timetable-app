import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Login.css";

/**
 * CompleteProfile — shown after OAuth when the user has no phone number.
 * They must enter a mobile number before accessing the app.
 */
export default function CompleteProfile() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (!phone.trim() || digits.length < 7) {
      setError("Please enter a valid mobile number (at least 7 digits)");
      return;
    }
    if (!token) {
      setError("Authentication token missing. Please sign in again.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail)
        );

      // Success — store token and go to app
      localStorage.setItem("timetable_token", token);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="login-page"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div className="login-card" style={{ maxWidth: 440, width: "100%" }}>
        <div className="login-card-header" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📱</div>
          <h2 className="login-card-title">Almost there!</h2>
          <p className="login-card-sub">
            Enter your mobile number to complete your profile.
            <br />
            This is required and cannot be skipped.
          </p>
        </div>

        <form className="lf-form" onSubmit={handleSubmit} noValidate>
          <div className="lf-field">
            <label className="lf-label">Mobile number</label>
            <div className="lf-input-wrap">
              <svg
                className="lf-input-icon"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="4" y="1" width="8" height="14" rx="1.5" />
                <line x1="6.5" y1="12" x2="9.5" y2="12" />
              </svg>
              <input
                className="lf-input"
                type="tel"
                placeholder="+92 300 1234567"
                autoFocus
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError("");
                }}
                disabled={loading}
                required
              />
            </div>
          </div>

          {error && (
            <div className="lf-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="lf-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="lf-btn-spinner" />
                Saving…
              </>
            ) : (
              "Continue to Myzynca →"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
