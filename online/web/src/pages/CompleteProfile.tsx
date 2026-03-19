import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Login.css";

const COUNTRIES = [
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+1",   flag: "🇺🇸", name: "United States" },
  { code: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait" },
  { code: "+90",  flag: "🇹🇷", name: "Turkey" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+39",  flag: "🇮🇹", name: "Italy" },
  { code: "+34",  flag: "🇪🇸", name: "Spain" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+86",  flag: "🇨🇳", name: "China" },
  { code: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "+82",  flag: "🇰🇷", name: "South Korea" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+62",  flag: "🇮🇩", name: "Indonesia" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+20",  flag: "🇪🇬", name: "Egypt" },
  { code: "+55",  flag: "🇧🇷", name: "Brazil" },
  { code: "+52",  flag: "🇲🇽", name: "Mexico" },
  { code: "+7",   flag: "🇷🇺", name: "Russia" },
  { code: "+380", flag: "🇺🇦", name: "Ukraine" },
  { code: "+48",  flag: "🇵🇱", name: "Poland" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+46",  flag: "🇸🇪", name: "Sweden" },
  { code: "+47",  flag: "🇳🇴", name: "Norway" },
  { code: "+45",  flag: "🇩🇰", name: "Denmark" },
  { code: "+41",  flag: "🇨🇭", name: "Switzerland" },
  { code: "+63",  flag: "🇵🇭", name: "Philippines" },
  { code: "+66",  flag: "🇹🇭", name: "Thailand" },
  { code: "+84",  flag: "🇻🇳", name: "Vietnam" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+93",  flag: "🇦🇫", name: "Afghanistan" },
  { code: "+98",  flag: "🇮🇷", name: "Iran" },
  { code: "+964", flag: "🇮🇶", name: "Iraq" },
  { code: "+962", flag: "🇯🇴", name: "Jordan" },
  { code: "+961", flag: "🇱🇧", name: "Lebanon" },
];

/**
 * CompleteProfile — shown after OAuth when the user has no phone number.
 * They must enter a mobile number before accessing the app.
 */
export default function CompleteProfile() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [phone, setPhone] = useState("");
  const [countryIdx, setCountryIdx] = useState(0);
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
      const fullPhone = `${COUNTRIES[countryIdx].code} ${phone.trim()}`;
      const res = await fetch("/api/auth/update-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: fullPhone }),
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
            <div className="lf-phone-row">
              <select
                className="lf-country-select"
                value={countryIdx}
                onChange={(e) => setCountryIdx(Number(e.target.value))}
                disabled={loading}
              >
                {COUNTRIES.map((c, i) => (
                  <option key={c.code} value={i}>
                    {c.flag} {c.code} {c.name}
                  </option>
                ))}
              </select>
              <div className="lf-input-wrap" style={{ flex: 1 }}>
                <input
                  className="lf-input no-icon"
                  type="tel"
                  placeholder="300 1234567"
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
