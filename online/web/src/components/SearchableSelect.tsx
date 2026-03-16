import { useState, useRef, useEffect } from "react";

interface Option {
  value: number | string;
  label: string;
}

interface Props {
  options: Option[];
  value: number | string;
  onChange: (value: number | string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function SearchableSelect({ options, value, onChange, placeholder = "— select —", style, disabled, autoFocus }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // auto-focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selectedLabel = options.find(o => o.value === value)?.label;
  const filtered = options.filter(o => {
    if (!search.trim()) return true;
    return o.label.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div ref={wrapRef} style={{ position: "relative", ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "0.55rem 0.75rem",
          border: "1.5px solid var(--border-default, #E2E8F0)",
          borderRadius: "var(--radius-md, 8px)",
          background: "var(--surface-card, #fff)",
          color: selectedLabel ? "var(--text-primary, #0F172A)" : "var(--text-muted, #94A3B8)",
          fontSize: "0.85rem", fontFamily: "var(--font-sans, inherit)",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left", boxSizing: "border-box",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selectedLabel || placeholder}
        </span>
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted, #94A3B8)", marginLeft: 8, flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface-card, #fff)",
          border: "1.5px solid var(--border-default, #E2E8F0)",
          borderRadius: "var(--radius-md, 8px)",
          boxShadow: "var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))",
          zIndex: 999, overflow: "hidden",
          animation: "slideDown 0.12s ease",
        }}>
          {/* Search input */}
          <div style={{ padding: "8px 8px 4px", borderBottom: "1px solid var(--border-subtle, #F1F5F9)" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--text-muted, #94A3B8)", pointerEvents: "none" }}>🔍</span>
              <input
                ref={inputRef}
                autoFocus={autoFocus}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                onClick={e => e.stopPropagation()}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "6px 8px 6px 28px",
                  border: "1px solid var(--border-default, #E2E8F0)",
                  borderRadius: "var(--radius-sm, 6px)",
                  fontSize: "0.82rem",
                  background: "var(--surface-raised, #F8FAFC)",
                  color: "var(--text-primary, #0F172A)",
                  maxWidth: "100%",
                }}
              />
            </div>
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 200, overflowY: "auto", padding: "4px 0" }}>
            {/* Empty/reset option */}
            <div
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              style={{
                padding: "7px 12px", cursor: "pointer",
                fontSize: "0.82rem", color: "var(--text-muted, #94A3B8)",
                fontStyle: "italic",
                background: !value ? "var(--primary-50, #EEF2FF)" : "transparent",
              }}
              onMouseEnter={e => { if (value) e.currentTarget.style.background = "var(--surface-raised, #F8FAFC)"; }}
              onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent"; }}
            >
              {placeholder}
            </div>
            {filtered.map(o => {
              const isActive = o.value === value;
              return (
                <div
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  style={{
                    padding: "7px 12px", cursor: "pointer",
                    fontSize: "0.82rem", fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--primary-600, #4F46E5)" : "var(--text-primary, #0F172A)",
                    background: isActive ? "var(--primary-50, #EEF2FF)" : "transparent",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-raised, #F8FAFC)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {isActive && <span style={{ fontSize: "0.72rem" }}>✓</span>}
                  {o.label}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "12px", textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted, #94A3B8)" }}>
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
