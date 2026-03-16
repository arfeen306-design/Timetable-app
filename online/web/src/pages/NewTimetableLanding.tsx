import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import "./NewTimetableLanding.css";

const OPTIONS = [
  {
    id:    "start-new",
    icon:  "\u2728",
    title: "Start New Timetable",
    desc:  "Build a fresh timetable from scratch. Set up school, teachers, and generate.",
    color: "#4F46E5",
    bg:    "#EEF2FF",
    segment: "settings",
  },
  {
    id:    "upload",
    icon:  "\uD83D\uDCE4",
    title: "Upload Your Timetable",
    desc:  "Import an existing timetable from Excel or PDF. We'll parse it automatically.",
    color: "#0891B2",
    bg:    "#E0F2FE",
    segment: "settings",
  },
  {
    id:    "amend",
    icon:  "\u270F\uFE0F",
    title: "Amend Current Timetable",
    desc:  "Make changes to an already generated timetable without starting over.",
    color: "#16A34A",
    bg:    "#F0FDF4",
    segment: "review",
  },
  {
    id:    "demo",
    icon:  "\uD83C\uDFAE",
    title: "Load Demo Data",
    desc:  "Populate with sample school data to explore all features instantly.",
    color: "#D97706",
    bg:    "#FEF3C7",
    action: "load-demo",
  },
];

export default function NewTimetableLanding() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOption = async (opt: typeof OPTIONS[number]) => {
    if (opt.action === "load-demo") {
      setLoading("demo");
      try {
        await api(`/api/projects/${projectId}/load-demo`, { method: "POST" });
      } catch { /* ignore — demo endpoint may not exist yet */ }
      setLoading(null);
      navigate(`/project/${projectId}/settings`);
      return;
    }
    navigate(`/project/${projectId}/${opt.segment}`);
  };

  return (
    <div className="ntl-page">
      <div className="ntl-header">
        <h1 className="ntl-title">New Timetable</h1>
        <p className="ntl-sub">How would you like to get started?</p>
      </div>

      <div className="ntl-grid">
        {OPTIONS.map(opt => (
          <button
            key={opt.id}
            className="ntl-card"
            style={{ "--card-color": opt.color, "--card-bg": opt.bg } as React.CSSProperties}
            onClick={() => handleOption(opt)}
            disabled={loading === opt.id}
          >
            <div className="ntl-card-icon">{opt.icon}</div>
            <div className="ntl-card-title">{opt.title}</div>
            <div className="ntl-card-desc">{opt.desc}</div>
            {loading === opt.id && <div className="ntl-card-spinner" />}
          </button>
        ))}
      </div>
    </div>
  );
}
