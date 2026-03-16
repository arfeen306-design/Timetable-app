import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useProjectProgress } from "../hooks/useProjectProgress";
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
    id:           "zynca",
    label:        "Myzynca",
    icon:         "🛡",
    pathSegments: ["/zynca"],
    segment:      "zynca",
  },
  {
    id:           "timetable",
    label:        "New Timetable",
    icon:         "🗓",
    pathSegments: ["/new-timetable", "/settings", "/subjects", "/classes", "/rooms", "/teachers",
                   "/lessons", "/constraints", "/generate", "/review", "/workload",
                   "/academic-year"],
    hasDropdown:  true,
    segment:      "settings",
  },
  {
    id:           "dashboard",
    label:        "Dashboard",
    icon:         "📊",
    pathSegments: ["/dashboard"],
    segment:      null,
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
      { name: "Classrooms",  icon: "🚪", segment: "rooms" },
      { name: "Teachers",    icon: "👨‍🏫", segment: "teachers" },
      { name: "Subjects",    icon: "📚", segment: "subjects" },
      { name: "Classes",     icon: "🎓", segment: "classes" },
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
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Parse projectId from pathname
  const projectIdMatch = location.pathname.match(/\/project\/([^/]+)/);
  const projectId = projectIdMatch ? projectIdMatch[1] : undefined;

  // Project progress for tab locking
  const progress = useProjectProgress(projectId ? Number(projectId) : undefined);

  // Compute which tabs are enabled
  const enabledTabs = useMemo(() => {
    const set = new Set<string>(["zynca", "timetable"]); // always enabled
    if (progress.hasGenerated) {
      set.add("dashboard");
      set.add("substitution");
      set.add("duty-roster");
      set.add("exam-duties");
      set.add("committees");
    }
    return set;
  }, [progress.hasGenerated]);

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
    // Check if tab is locked
    if (!enabledTabs.has(tab.id)) {
      toast("info", "Complete your timetable setup first to unlock this tab");
      return;
    }
    if (tab.hasDropdown) {
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



        {/* Tabs */}
        <nav className="top-tabs" role="tablist">
          {TABS.map((tab) => {
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
                  className={`top-tab ${isActive ? "active" : ""} ${!enabledTabs.has(tab.id) ? "tab-locked" : ""}`}
                  onClick={() => handleTabClick(tab)}
                  title={!enabledTabs.has(tab.id) ? "Generate a timetable first" : undefined}
                >
                  <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                  {tab.hasDropdown && (
                    <span className={`tab-chevron ${dropdownOpen ? "open" : ""}`}>▾</span>
                  )}
                  {!enabledTabs.has(tab.id) && <span className="tab-lock-icon">🔒</span>}
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

          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

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

      {/* ── Minimalist Roadmap Strip ── */}
      {projectId && !progress.loading && (
        <div className="roadmap-strip">
          {(() => {
            const STEPS = [
              { key: "myzynca",     label: "Myzynca",     link: "zynca" },
              { key: "school",      label: "School",      link: "settings",    done: true },
              { key: "classrooms",  label: "Classrooms",  link: "rooms",       done: true },
              { key: "teachers",    label: "Teachers",    link: "teachers",    done: progress.teachers > 0 },
              { key: "subjects",    label: "Subjects",    link: "subjects",    done: progress.subjects > 0 },
              { key: "classes",     label: "Classes",     link: "classes",     done: progress.classes > 0 },
              { key: "lessons",     label: "Lessons",     link: "lessons",     done: progress.lessons > 0 },
              { key: "constraints", label: "Constraints", link: "constraints", done: progress.lessons > 0 },
              { key: "generate",    label: "Generate",    link: "generate",    done: progress.hasGenerated },
              { key: "review",      label: "Review",      link: "review",      done: progress.hasGenerated },
            ];
            // First step (Myzynca) is always "done" since it's the starting page
            STEPS[0].done = true;
            const currentIdx = STEPS.findIndex(s => !s.done);
            const doneCount = STEPS.filter(s => s.done).length;

            // Detect which step is active based on current URL
            const activeKey = STEPS.find(s => location.pathname.includes(`/${s.link}`))?.key;

            return (
              <>
                <div className="roadmap-steps">
                  {STEPS.map((step, i) => {
                    const isDone = step.done;
                    const isCurrent = i === currentIdx;
                    const isActive = step.key === activeKey;
                    return (
                      <div key={step.key} className="roadmap-step-group" style={{ flex: 1 }}>
                        {i > 0 && (
                          <div className={`roadmap-line ${isDone ? "done" : ""}`} />
                        )}
                        <button
                          className={`roadmap-dot ${isDone ? "done" : ""} ${isCurrent ? "current" : ""} ${isActive ? "active" : ""}`}
                          onClick={() => navigate(`/project/${projectId}/${step.link}`)}
                          title={step.label}
                        >
                          {isDone ? "✓" : (i + 1)}
                        </button>
                        <span className={`roadmap-label ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <span className="roadmap-counter">{doneCount}/{STEPS.length}</span>
              </>
            );
          })()}
        </div>
      )}

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
