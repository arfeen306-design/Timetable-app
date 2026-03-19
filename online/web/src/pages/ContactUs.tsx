import { useTheme } from "../context/ThemeContext";

export default function ContactUs() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
        Contact Us
      </h1>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "2rem" }}>
        Get in touch with the Myzynca team for support, enterprise inquiries, or technical consultations.
      </p>

      {/* Contact Card */}
      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-default)",
        borderRadius: 14,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: isDark ? "rgba(56,178,172,0.12)" : "rgba(56,178,172,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem",
          }}>✉️</div>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>Myzynca Support</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>We typically respond within 24 hours</div>
          </div>
        </div>

        {/* Contact Items */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* General Email */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: isDark ? "rgba(56,178,172,0.1)" : "#F0FDFA",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.9rem", flexShrink: 0,
            }}>📧</div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                General Inquiries
              </div>
              <a href="mailto:info@myzynca.com" style={{
                fontSize: "0.88rem", fontWeight: 600, color: isDark ? "#38B2AC" : "#0D9488",
                textDecoration: "none",
              }}>
                info@myzynca.com
              </a>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>
                For pricing, demos, and partnership requests
              </div>
            </div>
          </div>

          {/* Dev Email */}
          <div style={{
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 18,
            display: "flex", alignItems: "flex-start", gap: 14,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: isDark ? "rgba(99,102,241,0.1)" : "#EEF2FF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.9rem", flexShrink: 0,
            }}>🛠️</div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                Technical & Architecture
              </div>
              <a href="mailto:arfeen306@live.com" style={{
                fontSize: "0.88rem", fontWeight: 600, color: isDark ? "#A5B4FC" : "#4F46E5",
                textDecoration: "none",
              }}>
                arfeen306@live.com
              </a>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>
                For technical consultations and enterprise integrations
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--border-subtle)",
          background: isDark ? "var(--surface-raised)" : "#F9FAFB",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: "0.75rem" }}>🌐</span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Built with ❤️ by Zain ul Arfeen — Data Scientist & Educator
          </span>
        </div>
      </div>
    </div>
  );
}
