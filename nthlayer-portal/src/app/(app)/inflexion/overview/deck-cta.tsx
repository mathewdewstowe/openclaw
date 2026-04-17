"use client";

import { useState } from "react";
import { ProductStrategyModal } from "@/components/product-strategy-modal";

export function DeckCTA({
  completedStages,
  companyName,
  companyId,
  outputs,
  canExport = false,
}: {
  completedStages: number;
  companyName: string;
  companyId: string;
  outputs: Record<string, unknown>;
  canExport?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  if (completedStages < 5) {
    return (
      <>
        <style>{`
          @keyframes ctaBorderPulse {
            0%, 100% { border-color: rgba(163,230,53,0.2); box-shadow: 0 0 0 0 rgba(163,230,53,0); }
            50% { border-color: rgba(163,230,53,0.7); box-shadow: 0 0 28px 4px rgba(163,230,53,0.12); }
          }
          @keyframes learnMoreBounce {
            0%, 100% { transform: scale(1) translateY(0); background: rgba(163,230,53,0.12); border-color: rgba(163,230,53,0.4); box-shadow: 0 0 0 0 rgba(163,230,53,0); }
            30% { transform: scale(1.07) translateY(-4px); background: rgba(163,230,53,0.28); border-color: rgba(163,230,53,1); box-shadow: 0 8px 24px 0 rgba(163,230,53,0.35); }
            50% { transform: scale(1.04) translateY(-2px); background: rgba(163,230,53,0.2); border-color: rgba(163,230,53,0.8); box-shadow: 0 4px 16px 0 rgba(163,230,53,0.2); }
            70% { transform: scale(1.07) translateY(-4px); background: rgba(163,230,53,0.28); border-color: rgba(163,230,53,1); box-shadow: 0 8px 24px 0 rgba(163,230,53,0.35); }
          }
        `}</style>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
          background: "#0d1117",
          border: "1.5px solid rgba(163,230,53,0.2)",
          borderRadius: 16,
          padding: "28px 36px", flexWrap: "wrap",
          animation: "ctaBorderPulse 3s ease-in-out infinite",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Lock icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "rgba(163,230,53,0.1)",
              border: "1px solid rgba(163,230,53,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                Unlock your Strategy
              </p>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 14px" }}>
                Complete all five stages to generate your full product strategy document
              </p>
              {/* Progress bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {["Frame", "Diagnose", "Decide", "Position", "Commit"].map((label, i) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: 44, height: 5, borderRadius: 4,
                      background: i < completedStages ? "#a3e635" : "rgba(255,255,255,0.1)",
                      transition: "background 0.3s",
                    }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: i < completedStages ? "#a3e635" : "rgba(255,255,255,0.2)", letterSpacing: "0.04em" }}>
                      {label}
                    </span>
                  </div>
                ))}
                <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                  {completedStages}/5
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: "14px 32px", fontSize: 15, fontWeight: 800, color: "#a3e635",
              background: "rgba(163,230,53,0.12)", border: "1.5px solid rgba(163,230,53,0.4)",
              borderRadius: 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              letterSpacing: "0.01em",
              animation: "learnMoreBounce 2.8s ease-in-out infinite",
            }}
          >
            Learn More
          </button>
        </div>

        <ProductStrategyModal open={modalOpen} onClose={() => setModalOpen(false)} completedStages={completedStages} companyName={companyName} companyId={companyId} outputs={outputs} />
      </>
    );
  }

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        background: "#111827", borderRadius: 14, padding: "24px 32px", flexWrap: "wrap",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Your Product Strategy is ready</p>
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
            All 5 stages complete. Generate your full 15-section strategy document — synthesised from your reports, not stitched together.
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
          Generate Product Strategy
        </button>
      </div>

      <ProductStrategyModal open={modalOpen} onClose={() => setModalOpen(false)} completedStages={completedStages} companyName={companyName} companyId={companyId} outputs={outputs} />
    </>
  );
}
