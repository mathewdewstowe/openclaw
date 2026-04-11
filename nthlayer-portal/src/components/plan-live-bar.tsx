"use client";

import { useState, useEffect } from "react";

interface PlanLiveBarProps {
  outputId: string;
  createdAt: string;
  assumptionCount: number;
  competitorCount: number;
}

export function PlanLiveBar({ outputId, createdAt, assumptionCount, competitorCount }: PlanLiveBarProps) {
  const dayN = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid SSR flash

  useEffect(() => {
    const key = `plan_live_dismissed_${outputId}`;
    const alreadyDismissed = localStorage.getItem(key) === "1";
    if (!alreadyDismissed) {
      setDismissed(false);
    }
  }, [outputId]);

  function dismiss() {
    localStorage.setItem(`plan_live_dismissed_${outputId}`, "1");
    setDismissed(true);
  }

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Activation message */}
      {!dismissed && (
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px 20px",
          background: "#111827",
          borderRadius: 10,
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{
              flexShrink: 0,
              marginTop: 2,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px #4ade80",
              display: "inline-block",
            }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb", marginBottom: 4 }}>
                Your plan is live.
              </p>
              <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.55 }}>
                Inflexion is now watching for signals that could affect your assumptions, competitor moves, and action owners. You&apos;ll be alerted when something shifts.
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            style={{
              flexShrink: 0,
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              fontSize: 18,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Status strip */}
      <div style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
      }}>
        {/* Live badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#16a34a",
            display: "inline-block",
            flexShrink: 0,
            animation: "pulse 2s infinite",
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>
            Live
          </span>
          <span style={{ fontSize: 13, color: "#166534" }}>
            · Day {dayN} of 90
          </span>
        </div>

        {/* Assumptions badge */}
        {assumptionCount > 0 && (
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#2563eb" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span style={{ fontSize: 13, color: "#1e40af" }}>
              <strong style={{ fontWeight: 700 }}>{assumptionCount}</strong> assumption{assumptionCount !== 1 ? "s" : ""} active
            </span>
            <span style={{ fontSize: 12, color: "#60a5fa" }}>· Monitoring on</span>
          </div>
        )}

        {/* Competitors badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: competitorCount > 0 ? "#faf5ff" : "#f9fafb",
          border: `1px solid ${competitorCount > 0 ? "#e9d5ff" : "#e5e7eb"}`,
          borderRadius: 8,
        }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={competitorCount > 0 ? "#7c3aed" : "#9ca3af"} style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          {competitorCount > 0 ? (
            <>
              <span style={{ fontSize: 13, color: "#6d28d9" }}>
                Watching <strong style={{ fontWeight: 700 }}>{competitorCount}</strong> competitor{competitorCount !== 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: 12, color: "#a78bfa" }}>· No significant movement</span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: "#9ca3af" }}>
              No competitors tracked —{" "}
              <a href="/inflexion/competitors" style={{ color: "#7c3aed", textDecoration: "none", fontWeight: 500 }}>
                add some →
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
