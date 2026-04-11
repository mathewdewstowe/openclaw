"use client";

import { useEffect, useRef } from "react";

interface Risk {
  risk: string;
  severity: "high" | "medium" | "low";
  mitigation: string;
}

interface DiagnoseOutput {
  id: string;
  title: string;
  companyName: string;
  sections: {
    executive_summary?: string;
    what_matters?: string;
    risks?: Risk[];
  };
}

const STAGE_COPY: Record<string, { label: string; description: string; placeholder: string[] }> = {
  decide: {
    label: "Decide",
    description: "Your strategic choices, bets, and trade-offs",
    placeholder: [
      "Strategic option 1: Double down on mid-market ICP with deeper integrations",
      "Strategic option 2: Expand to enterprise with a new SKU and sales motion",
      "Walk away from: horizontal feature expansion until core is category-defining",
      "Critical bet: PLG → SLG transition in Q2, funded by reallocation from brand spend",
    ],
  },
  position: {
    label: "Position",
    description: "How you win in market against named competitors",
    placeholder: [
      "Category narrative: Own the 'strategy execution layer' for mid-market SaaS",
      "Primary differentiation: Depth of workflow integration vs. point solutions",
      "Against Competitor A: Lead with implementation speed and data portability",
      "Against Competitor B: Lead with pricing transparency and no-lock-in model",
    ],
  },
  act: {
    label: "Act",
    description: "Board-ready 90-day plan with named owners and metrics",
    placeholder: [
      "Week 1–2: Restructure GTM team around mid-market motion (Owner: Revenue)",
      "Week 3–6: Ship integration roadmap v2 (Owner: Engineering)",
      "Week 7–10: Launch repositioned pricing and packaging (Owner: Product)",
      "KPI: Mid-market win rate >40% by end of cycle · NRR >110% QoQ",
    ],
  },
};

const UNLOCK_ITEMS = [
  { stage: "Decide", text: "The strategic choices that matter, and the ones to walk away from" },
  { stage: "Position", text: "Your category narrative and how you win against named competitors" },
  { stage: "Act", text: "A board-ready 90-day plan with named owners and clear metrics" },
  { stage: "Monitor", text: "Live tracking of every assumption your strategy rests on" },
  { stage: "Decisions ledger", text: "A permanent record of what you decided and why" },
];

// Blurred stage preview card
function LockedStagePreview({ stage }: { stage: string }) {
  const copy = STAGE_COPY[stage];
  if (!copy) return null;
  return (
    <div style={{
      padding: "16px 20px",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      background: "#fff",
      marginBottom: 10,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{copy.label} — {copy.description}</p>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 999,
        }}>Locked</span>
      </div>
      <div style={{ filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>
        {copy.placeholder.map((line, i) => (
          <p key={i} style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, lineHeight: 1.5 }}>· {line}</p>
        ))}
      </div>
      {/* Gradient overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, transparent 40%, rgba(255,255,255,0.85))",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// Pulsing dot component
function PulsingDot() {
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = dotRef.current;
    if (!el) return;
    let frame: number;
    let start: number | null = null;

    function animate(ts: number) {
      if (!start) start = ts;
      const progress = ((ts - start) % 2000) / 2000;
      const opacity = 0.3 + 0.7 * Math.abs(Math.sin(progress * Math.PI));
      if (el) el.style.opacity = String(opacity);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span ref={dotRef} style={{
      display: "inline-block",
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "#dc2626",
      flexShrink: 0,
    }} />
  );
}

export function PaywallGate({
  stage,
  diagnoseOutput,
}: {
  stage: "decide" | "position" | "act";
  diagnoseOutput: DiagnoseOutput;
}) {
  const summary = diagnoseOutput.sections.executive_summary ?? "";
  const risks = (diagnoseOutput.sections.risks ?? []).slice(0, 2);
  const truncatedSummary = summary.length > 280 ? summary.slice(0, 280) + "…" : summary;
  const riskCount = (diagnoseOutput.sections.risks ?? []).length;

  return (
    <div>
      {/* Main two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24, marginBottom: 0 }}>

        {/* Left — Diagnose preview + blurred stages */}
        <div>
          {/* Diagnose output preview */}
          <div style={{
            padding: "20px 24px",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            background: "#eff6ff",
            marginBottom: 10,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2563eb", marginBottom: 8 }}>
              What Diagnose found for {diagnoseOutput.companyName}
            </p>
            <p style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.6, marginBottom: 12 }}>
              {truncatedSummary}
            </p>
            {risks.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {risks.map((r, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "8px 12px",
                    background: "#fff",
                    borderRadius: 7,
                    border: "1px solid #dbeafe",
                  }}>
                    <span style={{
                      flexShrink: 0,
                      marginTop: 2,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: r.severity === "high" ? "#dc2626" : r.severity === "medium" ? "#d97706" : "#6b7280",
                      background: r.severity === "high" ? "#fef2f2" : r.severity === "medium" ? "#fffbeb" : "#f9fafb",
                      padding: "1px 6px",
                      borderRadius: 4,
                    }}>{r.severity}</span>
                    <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{r.risk}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blurred locked stages */}
          {(["decide", "position", "act"] as const).map((s) => (
            <LockedStagePreview key={s} stage={s} />
          ))}
        </div>

        {/* Right — Paywall panel */}
        <div style={{
          padding: "32px 28px",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          alignSelf: "start",
          position: "sticky",
          top: 24,
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.25, marginBottom: 16 }}>
            You can see what&apos;s wrong.<br />Unlock what to do about it.
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65, marginBottom: 24 }}>
            Inflexion has mapped your strategic gaps, ranked your risks, and identified where your competitors are moving. Decide, Position, and Act convert that diagnosis into strategic choices, a market narrative, and a board-ready 90-day plan.
          </p>

          {/* Unlock list */}
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 12 }}>
            What you unlock
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {UNLOCK_ITEMS.map((item) => (
              <div key={item.stage} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{
                  flexShrink: 0,
                  marginTop: 3,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#111827",
                  display: "block",
                }} />
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.45 }}>
                  <strong>{item.stage}</strong> — {item.text}
                </p>
              </div>
            ))}
          </div>

          {/* CTA stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a
              href="/inflexion/settings/plan"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                background: "#111827",
                borderRadius: 9,
                textDecoration: "none",
              }}
            >
              Unlock Full Platform →
            </a>
            <a
              href="/inflexion/settings/plan"
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                background: "#f3f4f6",
                borderRadius: 9,
                textDecoration: "none",
              }}
            >
              See what&apos;s included →
            </a>
            <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 2 }}>
              14-day trial · No card required · Cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* Anxiety bar — full width */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 20px",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: 10,
        marginTop: 16,
      }}>
        <PulsingDot />
        <p style={{ fontSize: 13, color: "#991b1b", lineHeight: 1.4 }}>
          Your diagnosis identified <strong>{riskCount} risk{riskCount !== 1 ? "s" : ""}</strong>. Every day without a decision is a day your competitors are making one.
        </p>
      </div>
    </div>
  );
}
