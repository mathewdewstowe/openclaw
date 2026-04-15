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
              <p style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
                Strategy Deck — unlocks when all 5 stages are complete
              </p>
              <p style={{ fontSize: 17, color: "#fff", margin: 0 }}>
                {completedStages} of 5 stages done · {5 - completedStages} remaining
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#d1d5db",
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              Learn More
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {["frame", "diagnose", "decide", "position", "commit"].map((s, i) => (
                <div key={s} style={{ width: 28, height: 4, borderRadius: 3, background: i < completedStages ? "#a3e635" : "rgba(255,255,255,0.15)" }} />
              ))}
            </div>
          </div>
        </div>

        <ProductStrategyModal open={modalOpen} onClose={() => setModalOpen(false)} completedStages={completedStages} companyName={companyName} companyId={companyId} outputs={outputs} />
      </>
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
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, whiteSpace: "nowrap" }}>
            All stages complete. Generate your product strategy document and board deck — fully sourced from your strategy reports.
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
          Product Strategy Document
        </button>
      </div>

      <ProductStrategyModal open={modalOpen} onClose={() => setModalOpen(false)} completedStages={completedStages} companyName={companyName} companyId={companyId} outputs={outputs} />
    </>
  );
}
