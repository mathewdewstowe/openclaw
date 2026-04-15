import React from "react";

const STAGE_CITATION_COLORS: Record<string, { bg: string; color: string }> = {
  frame:    { bg: "#f3f4f6", color: "#374151" },
  diagnose: { bg: "#dbeafe", color: "#1e40af" },
  decide:   { bg: "#ede9fe", color: "#6d28d9" },
  position: { bg: "#d1fae5", color: "#065f46" },
  bet:      { bg: "#fef3c7", color: "#b45309" },
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
    // Render with bold + newlines
    return part.split("\n").map((line, j, arr) => {
      const boldParts = line.split(/(\*\*[^*]+\*\*)/g).map((chunk, k) => {
        if (chunk.startsWith("**") && chunk.endsWith("**")) {
          return <strong key={k} style={{ fontWeight: 700, color: "#111827" }}>{chunk.slice(2, -2)}</strong>;
        }
        return chunk;
      });
      return (
        <span key={`${i}-${j}`}>
          {boldParts}
          {j < arr.length - 1 && <br />}
        </span>
      );
    });
  });
}
