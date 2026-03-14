import { Outlet, Link, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ErrorBoundary from "./ErrorBoundary";

const STEPS = [
  { num: 1, label: "Introduction", path: "/" },
  { num: 2, label: "School", path: "/project/:projectId/settings", segment: "settings" },
  { num: 3, label: "Subjects", path: "/project/:projectId/subjects", segment: "subjects" },
  { num: 4, label: "Classes", path: "/project/:projectId/classes", segment: "classes" },
  { num: 5, label: "Classrooms", path: "/project/:projectId/rooms", segment: "rooms" },
  { num: 6, label: "Teachers", path: "/project/:projectId/teachers", segment: "teachers" },
  { num: 7, label: "Lessons", path: "/project/:projectId/lessons", segment: "lessons" },
  { num: 8, label: "Constraints", path: "/project/:projectId/constraints", segment: "constraints" },
  { num: 9, label: "Generate", path: "/project/:projectId/generate", segment: "generate" },
  { num: 10, label: "Review & Export", path: "/project/:projectId/review", segment: "review" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  const location = useLocation();
  const pathname = location.pathname;

  const activeStep =
    pathname === "/"
      ? 1
      : pathname.includes("/export") || pathname.includes("/review")
        ? 10
        : pathname.includes("/generate")
          ? 9
          : pathname.includes("/constraints")
            ? 8
            : pathname.includes("/lessons")
              ? 7
              : pathname.includes("/teachers")
                ? 6
                : pathname.includes("/rooms")
                  ? 5
                  : pathname.includes("/classes")
                    ? 4
                    : pathname.includes("/subjects")
                      ? 3
                      : pathname.includes("/settings")
                        ? 2
                        : 2;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-title">School Timetable Generator</div>
        <nav className="sidebar-nav">
          {STEPS.map((step) => {
            const href = step.num === 1 ? "/" : projectId ? step.path.replace(":projectId", projectId) : "#";
            const isActive = step.num === activeStep;
            const disabled = step.num > 1 && !projectId;
            return (
              <Link
                key={step.num}
                to={href}
                className={`sidebar-item ${isActive ? "active" : ""} ${disabled ? "disabled" : ""}`}
                onClick={(e) => disabled && e.preventDefault()}
                aria-disabled={disabled}
              >
                {step.num}. {step.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <span className="topbar-spacer" />
          <span className="topbar-user">{user?.email}</span>
          <button type="button" className="btn btn-topbar" onClick={logout}>
            Logout
          </button>
        </header>
        <main className="main-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
