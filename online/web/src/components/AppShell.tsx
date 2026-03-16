import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ErrorBoundary from "./ErrorBoundary";
import "./AppShell.css";

interface Tab {
  id:           string;
  label:        string;
  icon:         string;
  pathSegments: string[];
  segment:      string | null;
  hasDropdown?: boolean;
}

const TABS: Tab[] = [
  {
    id:           "dashboard",
    label:        "Dashboard",
    icon:         "📊",
    pathSegments: ["/dashboard"],
    segment:      null,
  },
  {
    id:           "timetable",
    label:        "Home",
    icon:         "🗓",
    pathSegments: ["/new-timetable", "/settings", "/subjects", "/classes", "/rooms", "/teachers",
                   "/lessons", "/constraints", "/generate", "/review", "/workload",
                   "/academic-year"],
    hasDropdown:  true,
    segment:      "settings",
  },
  {
    id:           "substitution",
    label:        "Substitution",
    icon:         "🔄",
    pathSegments: ["/substitutions"],
    segment:      "substitutions",
  },
  {
    id:           "duty-roster",
    label:        "Duty Roster",
    icon:         "🛡",
    pathSegments: ["/duty-roster"],
    segment:      "duty-roster",
  },
  {
    id:           "exam-duties",
    label:        "Exam Duties",
    icon:         "📋",
    pathSegments: ["/exam-duties"],
    segment:      "exam-duties",
  },
  {
    id:           "committees",
    label:        "Committees",
    icon:         "👥",
    pathSegments: ["/committees"],
    segment:      "committees",
  },
];

const DROPDOWN_GROUPS = [
  {
    label: "SETUP",
    items: [
      { name: "School",      icon: "🏫", segment: "settings" },
      { name: "Teachers",    icon: "👨‍🏫", segment: "teachers" },
      { name: "Subjects",    icon: "📚", segment: "subjects" },
      { name: "Classes",     icon: "🎓", segment: "classes" },
      { name: "Classrooms",  icon: "🚪", segment: "rooms" },
      { name: "Lessons",     icon: "📖", segment: "lessons" },
      { name: "Constraints", icon: "⚙️", segment: "constraints" },
    ],
  },
  {
    label: "SCHEDULE",
    items: [
      { name: "Generate",        icon: "▶️", segment: "generate" },
      { name: "Review & Export",  icon: "📤", segment: "review" },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { name: "Workload", icon: "📊", segment: "workload" },
    ],
  },
];

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Parse projectId from pathname
  const projectIdMatch = location.pathname.match(/\/project\/([^/]+)/);
  const projectId = projectIdMatch ? projectIdMatch[1] : undefined;

  // Determine active tab
  const activeTab =
    TABS.find(tab =>
      tab.pathSegments.some(p => location.pathname.includes(p))
    ) ?? TABS[0];

  // Close dropdowns on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  function handleTabClick(tab: Tab) {
    if (tab.hasDropdown) {
      // On the landing page itself, just navigate (no dropdown needed)
      const isOnLanding = location.pathname.includes("/new-timetable");
      if (isOnLanding) {
        return;
      }
      // Always toggle dropdown from any other page
      setDropdownOpen(prev => !prev);
      return;
    }
    setDropdownOpen(false);
    if (tab.id === "dashboard") {
      navigate(projectId ? `/project/${projectId}/dashboard` : "/");
    } else if (tab.segment && projectId) {
      navigate(`/project/${projectId}/${tab.segment}`);
    } else {
      navigate("/");
    }
  }

  function handleDropdownItemClick(segment: string) {
    setDropdownOpen(false);
    if (projectId) {
      navigate(`/project/${projectId}/${segment}`);
    } else {
      navigate("/");
    }
  }

  const email    = user?.email ?? "";
  const initials = email.split("@")[0].slice(0, 2).toUpperCase() || "A";
  const name     = user?.name || email.split("@")[0] || "Admin";
  const role     = "Administrator";

  return (
    <div className="app-shell">

      {/* ── Top tab bar ── */}
      <header className="top-tab-bar">

        {/* Logo */}
        <div className="app-logo" onClick={() => navigate("/")} role="button" tabIndex={0}>
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
          {TABS.map((tab, idx) => {
            const isActive = activeTab.id === tab.id;
            return (
              <div
                key={tab.id}
                className="top-tab-wrap"
                ref={tab.hasDropdown ? dropdownRef : undefined}
              >
                <button
                  role="tab"
                  aria-selected={isActive}
                  className={`top-tab ${isActive ? "active" : ""}`}
                  onClick={() => handleTabClick(tab)}
                >
                  <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                  {tab.hasDropdown && (
                    <span className={`tab-chevron ${dropdownOpen ? "open" : ""}`}>▾</span>
                  )}
                  {idx > 1 && <span className="tab-new-badge">New</span>}
                </button>

                {/* Dropdown for Home tab */}
                {tab.hasDropdown && dropdownOpen && (
                  <div className="tab-dropdown">
                    <button
                      className={`tab-dropdown-item ${location.pathname.includes("/new-timetable") ? "active" : ""}`}
                      onClick={() => handleDropdownItemClick("new-timetable")}
                      style={{ fontWeight: 600 }}
                    >
                      <span className="tab-dropdown-icon">🏠</span>
                      Home
                    </button>
                    <div className="tab-dropdown-divider" />
                    {DROPDOWN_GROUPS.map(group => (
                      <div key={group.label}>
                        <div className="tab-dropdown-group-label">{group.label}</div>
                        {group.items.map(item => {
                          const itemActive = location.pathname.includes(`/${item.segment}`);
                          return (
                            <button
                              key={item.segment}
                              className={`tab-dropdown-item ${itemActive ? "active" : ""}`}
                              onClick={() => handleDropdownItemClick(item.segment)}
                            >
                              <span className="tab-dropdown-icon">{item.icon}</span>
                              {item.name}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="top-bar-right">
          {/* Live Now pill */}
          <div
            className="live-now-pill"
            onClick={() => navigate(projectId ? `/project/${projectId}/dashboard` : "/")}
            role="button"
            tabIndex={0}
          >
            <span className="live-dot" />
            <span className="live-text">Live Now</span>
          </div>

          {/* Profile */}
          <div className="profile-wrap" ref={profileRef}>
            <button
              className="profile-btn"
              onClick={() => setProfileOpen(prev => !prev)}
              aria-label="My Profile"
            >
              <span className="profile-av">{initials}</span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-av">{initials}</div>
                  <div>
                    <div className="profile-dropdown-name">{name}</div>
                    <div className="profile-dropdown-email">{email}</div>
                    <div className="profile-dropdown-email">{role}</div>
                  </div>
                </div>
                <div className="profile-dropdown-divider" />
                <button className="profile-dropdown-item" onClick={logout}>
                  ⏻ Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body: full-width content ── */}
      <div className="app-body">
        <main className="app-main full-width">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

    </div>
  );
}
