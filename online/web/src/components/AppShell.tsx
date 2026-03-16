import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { TimetableSidebar } from "./TimetableSidebar";
import ErrorBoundary from "./ErrorBoundary";
import "./AppShell.css";

interface Tab {
  id:      string;
  label:   string;
  icon:    string;
  paths:   string[];
  segment: string | null; // null = navigate to "/"
}

const TOP_TABS: Tab[] = [
  {
    id:      "timetable",
    label:   "New Timetable",
    icon:    "🗓",
    paths:   ["/settings", "/subjects", "/classes", "/rooms", "/teachers",
              "/lessons", "/constraints", "/generate", "/review", "/workload",
              "/academic-year", "/dashboard"],
    segment: null,
  },
  {
    id:      "substitution",
    label:   "Substitution",
    icon:    "🔄",
    paths:   ["/substitutions"],
    segment: "substitutions",
  },
  {
    id:      "duty-roster",
    label:   "Duty Roster",
    icon:    "🛡",
    paths:   ["/duty-roster"],
    segment: "duty-roster",
  },
  {
    id:      "exam-duties",
    label:   "Exam Duties",
    icon:    "📋",
    paths:   ["/exam-duties"],
    segment: "exam-duties",
  },
  {
    id:      "committees",
    label:   "Committees",
    icon:    "👥",
    paths:   ["/committees"],
    segment: "committees",
  },
];

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Parse projectId from pathname (e.g. /project/42/teachers → "42")
  const projectIdMatch = location.pathname.match(/\/project\/([^/]+)/);
  const projectId = projectIdMatch ? projectIdMatch[1] : undefined;

  // Determine active tab (first tab whose paths contain a segment from the URL)
  const activeTab =
    TOP_TABS.find(tab =>
      tab.paths.some(p => location.pathname.includes(p))
    ) ?? TOP_TABS[0];

  const isInTimetableTab = activeTab.id === "timetable";

  function handleTabClick(tab: Tab) {
    if (tab.segment === null) {
      navigate("/");
    } else if (projectId) {
      navigate(`/project/${projectId}/${tab.segment}`);
    } else {
      navigate("/");
    }
  }

  const email    = user?.email ?? "";
  const initials = email.split("@")[0].slice(0, 2).toUpperCase() || "A";
  const name     = user?.name || email.split("@")[0] || "Admin";

  return (
    <div className="app-shell">

      {/* ── Top tab bar ── */}
      <header className="top-tab-bar">

        {/* Logo */}
        <div className="app-logo">
          <div className="app-logo-mark">
            <svg viewBox="0 0 16 16" fill="none" stroke="white"
                 strokeWidth="1.8" strokeLinecap="round">
              <rect x="1" y="1" width="6" height="6" rx="1.2" />
              <rect x="9" y="1" width="6" height="6" rx="1.2" />
              <rect x="1" y="9" width="6" height="6" rx="1.2" />
              <rect x="9" y="9" width="6" height="6" rx="1.2" />
            </svg>
          </div>
          <span className="app-logo-name">Schedulr</span>
        </div>

        {/* Tabs */}
        <nav className="top-tabs" role="tablist">
          {TOP_TABS.map((tab, idx) => {
            const isActive = activeTab.id === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`top-tab ${isActive ? "active" : ""}`}
                onClick={() => handleTabClick(tab)}
              >
                <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
                {idx > 0 && <span className="tab-new-badge">New</span>}
              </button>
            );
          })}
        </nav>

        {/* User pill */}
        <div className="app-user-area">
          <div className="user-pill">
            <div className="user-av">{initials}</div>
            <div className="user-info">
              <span className="user-name-text">{name}</span>
              <span className="user-role-text">Administrator</span>
            </div>
            <button
              type="button"
              className="user-logout-btn"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
            >
              ⏻
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="app-body">

        {isInTimetableTab && (
          <TimetableSidebar projectId={projectId} activePath={location.pathname} />
        )}

        <main className={`app-main ${isInTimetableTab ? "with-sidebar" : "full-width"}`}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

    </div>
  );
}
