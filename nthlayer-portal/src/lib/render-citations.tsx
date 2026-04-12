import React from "react";

const STAGE_CITATION_COLORS: Record<string, { bg: string; color: string }> = {
  frame:    { bg: "#f3f4f6", color: "#374151" },
  diagnose: { bg: "#dbeafe", color: "#1e40af" },
  decide:   { bg: "#ede9fe", color: "#6d28d9" },
  position: { bg: "#d1fae5", color: "#065f46" },
  commit:   { bg: "#fef3c7", color: "#92400e" },
};

export function renderWithCitations(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+·[^\]]+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]·]+)·([^\]]+)\]$/);
    if (match) {
      const stage = match[1].trim().toLowerCase();
      const section = match[2].trim();
      const colors = STAGE_CITATION_COLORS[stage] ?? { bg: "#f3f4f6", color: "#374151" };
      return (
        <span key={i} style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: 10,
          fontWeight: 600,
          padding: "1px 7px",
          borderRadius: 20,
          background: colors.bg,
          color: colors.color,
          marginLeft: 4,
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          letterSpacing: "0.01em",
        }}>
          {match[1].trim()} · {section}
        </span>
      );
    }
    return part.split("\n").map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}
