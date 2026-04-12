"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 600,
        color: "#fff",
        background: "#111827",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        flexShrink: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      Download as PDF
    </button>
  );
}
