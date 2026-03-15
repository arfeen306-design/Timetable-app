import { useState } from "react";
import type { YearlyWeek } from "../api";

/**
 * Stacked bar chart — 40 bars (one per school week).
 * Bottom segment = scheduled lessons (indigo), top = substitutions (coral).
 * Hover shows tooltip with breakdown.
 */
export default function YearlyWorkloadChart({
  weeks,
  max,
  teacherName,
}: {
  weeks: YearlyWeek[];
  max: number;
  teacherName: string;
}) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const chartW = 700;
  const chartH = 200;
  const barGap = 2;
  const barCount = weeks.length || 40;
  const barW = Math.max(3, (chartW - barGap * barCount) / barCount);
  const maxVal = Math.max(max, ...weeks.map((w) => w.total)) || 30;
  const scale = (v: number) => Math.min((v / maxVal) * (chartH - 20), chartH - 20);

  return (
    <div className="card" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--slate-900)" }}>Yearly Workload</div>
          <div style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>{teacherName} — 40 school weeks</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: "0.68rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--primary-500)", display: "inline-block" }} />
            Scheduled
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f97316", display: "inline-block" }} />
            Substitutions
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 1.5, background: "var(--danger-400)", display: "inline-block" }} />
            Max ({max})
          </span>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg width={chartW} height={chartH} style={{ display: "block", overflow: "visible" }}>
          {/* Max line */}
          <line
            x1={0} y1={chartH - scale(max)} x2={chartW} y2={chartH - scale(max)}
            stroke="var(--danger-300)" strokeWidth={1} strokeDasharray="4 3"
          />
          <text x={chartW - 2} y={chartH - scale(max) - 3} fontSize={8} fill="var(--danger-400)" textAnchor="end">
            max {max}
          </text>

          {/* Bars */}
          {weeks.map((w, i) => {
            const x = i * (barW + barGap);
            const schedH = scale(w.scheduled);
            const subH = scale(w.substitutions);
            const isHovered = hoveredWeek === i;

            return (
              <g key={w.week_number}
                onMouseEnter={() => setHoveredWeek(i)}
                onMouseLeave={() => setHoveredWeek(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Scheduled (bottom) */}
                <rect
                  x={x} y={chartH - schedH - subH}
                  width={barW} height={schedH}
                  rx={1.5}
                  fill={isHovered ? "var(--primary-600)" : "var(--primary-400)"}
                  opacity={isHovered ? 1 : 0.85}
                />
                {/* Substitutions (top) */}
                {subH > 0 && (
                  <rect
                    x={x} y={chartH - schedH - subH}
                    width={barW} height={subH}
                    rx={1.5}
                    fill={isHovered ? "#ea580c" : "#f97316"}
                    opacity={isHovered ? 1 : 0.85}
                    transform={`translate(0, ${-0})`}
                  />
                )}
                {/* Hover indicator */}
                {isHovered && (
                  <rect x={x - 1} y={0} width={barW + 2} height={chartH}
                    fill="var(--primary-50)" opacity={0.3} rx={2}
                  />
                )}
              </g>
            );
          })}

          {/* Week labels every 5 */}
          {weeks.map((w, i) =>
            i % 5 === 0 ? (
              <text key={`l${w.week_number}`}
                x={i * (barW + barGap) + barW / 2}
                y={chartH + 12}
                fontSize={7} fill="var(--slate-400)" textAnchor="middle"
              >W{w.week_number}</text>
            ) : null
          )}
        </svg>

        {/* Tooltip */}
        {hoveredWeek !== null && weeks[hoveredWeek] && (
          <div style={{
            position: "absolute",
            left: Math.min(hoveredWeek * (barW + barGap), chartW - 140),
            top: -50,
            background: "var(--slate-900)", color: "#fff",
            padding: "6px 10px", borderRadius: "var(--radius-md)",
            fontSize: "0.68rem", lineHeight: 1.5,
            boxShadow: "var(--shadow-md)", zIndex: 10,
            pointerEvents: "none", whiteSpace: "nowrap",
          }}>
            <div style={{ fontWeight: 700 }}>Week {weeks[hoveredWeek].week_number}</div>
            <div>Scheduled: {weeks[hoveredWeek].scheduled}</div>
            <div style={{ color: "#f97316" }}>Subs: {weeks[hoveredWeek].substitutions}</div>
            <div style={{ fontWeight: 700 }}>Total: {weeks[hoveredWeek].total} / {max}</div>
          </div>
        )}
      </div>
    </div>
  );
}
