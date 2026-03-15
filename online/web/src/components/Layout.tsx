import { Outlet, Link, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ErrorBoundary from "./ErrorBoundary";

/* ── Nav structure with groups, icons, and badges ── */
const NAV_GROUPS = [
  {
    label: "MAIN",
    items: [
      { num: 1, label: "Dashboard",  icon: "⊞", path: "/project/:projectId/dashboard", segment: "dashboard" },
    ],
  },
  {
    label: "SETUP",
    items: [
      { num: 2, label: "New Timetable",icon: "🗓️", path: "/project/:projectId/academic-year", segment: "academic-year" },
      { num: 3, label: "School",      icon: "🏫", path: "/project/:projectId/settings",      segment: "settings" },
      { num: 4, label: "Subjects",     icon: "📚", path: "/project/:projectId/subjects",      segment: "subjects" },
      { num: 5, label: "Classes",      icon: "🎓", path: "/project/:projectId/classes",       segment: "classes" },
      { num: 6, label: "Classrooms",   icon: "🚪", path: "/project/:projectId/rooms",         segment: "rooms" },
      { num: 7, label: "Teachers",     icon: "👩‍🏫", path: "/project/:projectId/teachers",      segment: "teachers" },
      { num: 8, label: "Lessons",      icon: "📋", path: "/project/:projectId/lessons",       segment: "lessons" },
      { num: 9, label: "Constraints",  icon: "⚙️", path: "/project/:projectId/constraints",   segment: "constraints" },
    ],
  },
  {
    label: "SCHEDULE",
    items: [
      { num: 10, label: "Generate",       icon: "⚡", path: "/project/:projectId/generate",       segment: "generate" },
      { num: 11, label: "Review & Export", icon: "📊", path: "/project/:projectId/review",         segment: "review" },
    ],
  },
  {
    label: "DAILY OPS",
    items: [
      { num: 12, label: "Workload",       icon: "📈", path: "/project/:projectId/workload",       segment: "workload",       badge: "New" },
      { num: 13, label: "Substitution",   icon: "🔄", path: "/project/:projectId/substitutions",  segment: "substitutions",  badge: "New" },
    ],
  },
];

function getActiveNum(pathname: string): number {
  if (pathname === "/") return 1;
  const map: [string, number][] = [
    ["/dashboard", 1], ["/academic-year", 2], ["/substitutions", 13], ["/workload", 12],
    ["/export", 11], ["/review", 11], ["/generate", 10],
    ["/constraints", 9], ["/lessons", 8], ["/teachers", 7],
    ["/rooms", 6], ["/classes", 5], ["/subjects", 4], ["/settings", 3],
  ];
  for (const [seg, num] of map) {
    if (pathname.includes(seg)) return num;
  }
  return 1;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  const location = useLocation();
  const activeStep = getActiveNum(location.pathname);

  // User initials for avatar
  const email = user?.email || "";
  const initials = email.split("@")[0].slice(0, 2).toUpperCase();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        {/* ── Logo ── */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">📅</div>
          <div>
            <div className="sidebar-logo-text">Schedulr</div>
            <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 500, letterSpacing: "0.04em" }}>School OS</div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => {
                const href = item.num === 1 ? "/" : projectId ? item.path.replace(":projectId", projectId) : "#";
                const isActive = item.num === activeStep;
                const disabled = item.num > 1 && !projectId;
                return (
                  <Link
                    key={item.num}
                    to={href}
                    className={`sidebar-item ${isActive ? "active" : ""} ${disabled ? "disabled" : ""}`}
                    onClick={(e) => disabled && e.preventDefault()}
                    aria-disabled={disabled}
                  >
                    <span style={{ fontSize: "0.88rem", width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {"badge" in item && item.badge && (
                      <span style={{
                        fontSize: "0.58rem", fontWeight: 700, padding: "1px 6px",
                        borderRadius: 4, background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
                        letterSpacing: "0.03em",
                      }}>{item.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── User footer ── */}
        <div style={{
          padding: "0.75rem 1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.65rem", fontWeight: 700, color: "#fff",
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email.split("@")[0]}
            </div>
            <div style={{ fontSize: "0.6rem", color: "#64748b" }}>Administrator</div>
          </div>
          <button type="button" onClick={logout} title="Sign out"
            style={{
              background: "none", border: "none", color: "#64748b", cursor: "pointer",
              fontSize: "1rem", padding: 4, borderRadius: 4, transition: "color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; }}
          >⏻</button>
        </div>
      </aside>

      <div className="main-wrap">
        <main className="main-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
