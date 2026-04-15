"use client";

import { useWalkthrough } from "./walkthrough-provider";

export function TourButton() {
  const { start } = useWalkthrough();

  return (
    <button
      onClick={start}
      title="Take a guided tour of Inflexion"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 16px",
        fontSize: 12,
        fontWeight: 700,
        color: "#fff",
        background: "#111827",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        transition: "background 150ms, transform 100ms",
        letterSpacing: "0.01em",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#374151";
        e.currentTarget.style.transform = "scale(1.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#111827";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
      Take the Tour
    </button>
  );
}
