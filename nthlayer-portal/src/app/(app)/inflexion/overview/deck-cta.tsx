"use client";

import { useState } from "react";
import { DeckDownloadButton } from "@/components/deck-download-button";

const SLIDES = [
  { n: "01", label: "The Inflection Point", source: "Frame", detail: "The strategic problem, why now, and what's at stake" },
  { n: "02", label: "Market Reality", source: "Frame", detail: "3 external forces shaping the next 24 months" },
  { n: "03", label: "Where We Stand", source: "Diagnose", detail: "Honest scorecard across PMF, competitive position, and capability" },
  { n: "04", label: "The Competitive Gap", source: "Diagnose", detail: "The gaps that would constrain the strategy if not addressed" },
  { n: "05", label: "Options Considered", source: "Decide", detail: "The paths evaluated, including the cost of inaction" },
  { n: "06", label: "The Strategic Direction", source: "Decide", detail: "One clear direction and what it's betting on" },
  { n: "07", label: "What Must Be True", source: "Decide", detail: "The 5 critical assumptions — validated vs unvalidated" },
  { n: "08", label: "Our Position", source: "Position", detail: "Target customer, differentiation, and structural defensibility" },
  { n: "09", label: "Strategic Bets", source: "Commit", detail: "Named bets with hypothesis and horizon allocation" },
  { n: "10", label: "OKRs", source: "Commit", detail: "Company-level objectives with 2–3 key results each" },
  { n: "11", label: "100-Day Plan", source: "Commit", detail: "30/60/90 day milestones with named owners" },
  { n: "12", label: "Kill Criteria & Governance", source: "Commit", detail: "When to change course and how often progress is reviewed" },
  { n: "13", label: "Evidence & Confidence", source: "All stages", detail: "Sources, confidence scores, and assumptions log" },
];

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  "Frame":      { bg: "#f3f4f6", color: "#374151" },
  "Diagnose":   { bg: "#dbeafe", color: "#1e40af" },
  "Decide":     { bg: "#ede9fe", color: "#6d28d9" },
  "Position":   { bg: "#d1fae5", color: "#065f46" },
  "Commit":     { bg: "#fef3c7", color: "#92400e" },
  "All stages": { bg: "#f3f4f6", color: "#374151" },
};

export function DeckCTA({
  completedStages,
  companyName,
  outputs,
}: {
  completedStages: number;
  companyName: string;
  outputs: Record<string, unknown>;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  if (completedStages < 5) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        background: "#111827", borderRadius: 14,
        padding: "20px 28px", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
              Strategy Deck — unlocks when all 5 stages are complete
            </p>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              {completedStages} of 5 stages done · {5 - completedStages} remaining
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {["frame", "diagnose", "decide", "position", "commit"].map((s, i) => (
            <div key={s} style={{ width: 28, height: 4, borderRadius: 3, background: i < completedStages ? "#a3e635" : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* CTA Banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        background: "#111827", borderRadius: 14, padding: "24px 32px", flexWrap: "wrap",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Your Strategy Deck is ready</p>
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, maxWidth: 480 }}>
            All 5 stages complete. Generate a board-ready PowerPoint — 13 slides, fully sourced from your strategy reports.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, background: "#a3e635", color: "#111827",
            borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 700, border: "none",
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Unlock Strategy Deck
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 16, maxWidth: 600, width: "100%",
              maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            }}
          >
            {/* Modal header */}
            <div style={{ background: "#111827", padding: "28px 32px 24px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                    </svg>
                    <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>Strategy Deck</p>
                  </div>
                  <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                    A 13-slide board-ready PowerPoint, generated entirely from your 5 completed strategy reports. No editing required.
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, flexShrink: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Slide list — scrollable */}
            <div style={{ overflowY: "auto", padding: "24px 32px", flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>
                What&apos;s included — {SLIDES.length} slides
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SLIDES.map((slide) => {
                  const stageStyle = STAGE_COLORS[slide.source] ?? STAGE_COLORS["Frame"];
                  return (
                    <div
                      key={slide.n}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 14,
                        padding: "10px 14px", background: "#f9fafb",
                        borderRadius: 8, border: "1px solid #f3f4f6",
                      }}
                    >
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: "#9ca3af",
                        width: 24, flexShrink: 0, paddingTop: 1,
                      }}>
                        {slide.n}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "0 0 2px" }}>{slide.label}</p>
                        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{slide.detail}</p>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                        background: stageStyle.bg, color: stageStyle.color, flexShrink: 0,
                        whiteSpace: "nowrap", alignSelf: "center",
                      }}>
                        {slide.source}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 20, padding: "14px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                <p style={{ fontSize: 12, color: "#065f46", margin: 0, lineHeight: 1.6 }}>
                  <strong>Fully sourced.</strong> Every slide is pulled directly from your strategy reports — no generic content, no placeholders. Download, open in PowerPoint, and present.
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "16px 32px 24px", borderTop: "1px solid #f3f4f6", flexShrink: 0, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#6b7280",
                  background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <DeckDownloadButton companyName={companyName} outputs={outputs} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
