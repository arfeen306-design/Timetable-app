import { NavLink } from "react-router-dom";
import "./TimetableSidebar.css";

interface SidebarItem {
  segment: string;
  label:   string;
  icon:    string;
}

const SETUP_ITEMS: SidebarItem[] = [
  { segment: "settings",    label: "School",        icon: "🏫" },
  { segment: "teachers",    label: "Teachers",       icon: "👩‍🏫" },
  { segment: "subjects",    label: "Subjects",       icon: "📚" },
  { segment: "classes",     label: "Classes",        icon: "🎓" },
  { segment: "rooms",       label: "Classrooms",     icon: "🚪" },
  { segment: "lessons",     label: "Lessons",        icon: "📋" },
  { segment: "constraints", label: "Constraints",    icon: "⚙️" },
];

const SCHEDULE_ITEMS: SidebarItem[] = [
  { segment: "generate", label: "Generate",        icon: "⚡" },
  { segment: "review",   label: "Review & Export", icon: "📊" },
];

const ANALYTICS_ITEMS: SidebarItem[] = [
  { segment: "workload", label: "Workload", icon: "📈" },
];

interface Props {
  projectId:  string | undefined;
  activePath: string;
}

export function TimetableSidebar({ projectId, activePath }: Props) {
  function buildLink(segment: string): string {
    return projectId ? `/project/${projectId}/${segment}` : "#";
  }

  function isActive(segment: string): boolean {
    return activePath.includes(`/${segment}`);
  }

  return (
    <aside className="timetable-sidebar">
      <nav className="ts-nav">

        <div className="ts-section">
          <div className="ts-section-label">Setup</div>
          {SETUP_ITEMS.map(item => (
            <NavLink
              key={item.segment}
              to={buildLink(item.segment)}
              className={`ts-link ${isActive(item.segment) ? "active" : ""}`}
              onClick={e => !projectId && e.preventDefault()}
            >
              <span className="ts-icon" aria-hidden="true">{item.icon}</span>
              <span className="ts-label">{item.label}</span>
              {isActive(item.segment) && <div className="ts-active-bar" />}
            </NavLink>
          ))}
        </div>

        <div className="ts-divider" />

        <div className="ts-section">
          <div className="ts-section-label">Schedule</div>
          {SCHEDULE_ITEMS.map(item => (
            <NavLink
              key={item.segment}
              to={buildLink(item.segment)}
              className={`ts-link ${isActive(item.segment) ? "active" : ""}`}
              onClick={e => !projectId && e.preventDefault()}
            >
              <span className="ts-icon" aria-hidden="true">{item.icon}</span>
              <span className="ts-label">{item.label}</span>
              {isActive(item.segment) && <div className="ts-active-bar" />}
            </NavLink>
          ))}
        </div>

        <div className="ts-divider" />

        <div className="ts-section">
          <div className="ts-section-label">Analytics</div>
          {ANALYTICS_ITEMS.map(item => (
            <NavLink
              key={item.segment}
              to={buildLink(item.segment)}
              className={`ts-link ${isActive(item.segment) ? "active" : ""}`}
              onClick={e => !projectId && e.preventDefault()}
            >
              <span className="ts-icon" aria-hidden="true">{item.icon}</span>
              <span className="ts-label">{item.label}</span>
              {isActive(item.segment) && <div className="ts-active-bar" />}
            </NavLink>
          ))}
        </div>

      </nav>
    </aside>
  );
}
