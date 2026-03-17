import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

/**
 * OAuth callback page: receives JWT token from backend redirect,
 * stores it, and navigates to the home page.
 * Backend redirects to: /oauth-callback?token=<JWT>
 */
export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      localStorage.setItem("timetable_token", token);
      // Reload to pick up the auth context
      window.location.href = "/";
    } else {
      navigate("/login?error=OAuth+login+failed", { replace: true });
    }
  }, [params, navigate]);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", fontFamily: "var(--font-main, 'Sora', sans-serif)",
      color: "var(--slate-700, #334155)", fontSize: "1.1rem",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔄</div>
        <div>Signing you in...</div>
      </div>
    </div>
  );
}
