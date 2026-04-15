"use client";

import { downloadStrategyDocument } from "@/lib/word-document";
import { useStrategyGeneration } from "@/lib/strategy-generation-context";

const SECTIONS = [
  { n: "01", label: "Executive Summary", source: "All stages", detail: "The answer stated quickly — strategic moment, recommended direction, why it is the right choice, and what the business is committing to now." },
  { n: "02", label: "The Strategic Moment", source: "Frame", detail: "What changed, why this decision matters now, the time horizon, and the scope of what is being decided." },
  { n: "03", label: "Current Reality", source: "Diagnose", detail: "The few facts that dominate the picture — constraints, contradictions, and the binding conditions the strategy must work within." },
  { n: "04", label: "Competitive Position", source: "Diagnose", detail: "Where the business sits relative to competitors, how the landscape shapes the decision, and what the competitive dynamics mean for strategy." },
  { n: "05", label: "Strategic Options Considered", source: "Decide", detail: "The real paths available — including doing nothing — with why each was or was not chosen. Shows the decision was made with alternatives in view." },
  { n: "06", label: "Recommended Direction", source: "Decide", detail: "One explicit recommended direction, the rationale for choosing it, and the trade-offs knowingly accepted." },
  { n: "07", label: "What Must Be True", source: "Decide", detail: "The testable assumptions the strategy rests on, the trade-offs accepted, and the conditions that would cause a reversal." },
  { n: "08", label: "Market Position", source: "Position", detail: "Target customer, primary economic buyer, buying trigger, value proposition, and competitive frame. How the company will be understood in market." },
  { n: "09", label: "Competitive Advantage", source: "Position", detail: "The initial wedge, what is real today versus what must be built, and how the position compounds over time." },
  { n: "10", label: "Strategic Bets", source: "Commit", detail: "3–5 named bets with hypotheses, what is committed now, what is deferred, and what changes if the hypothesis is wrong." },
  { n: "11", label: "First 100 Days & Success Measures", source: "Commit", detail: "Concrete milestones for the first phase with owners, plus the leading indicators that confirm the strategy is working." },
  { n: "12", label: "Governance, Risks & Kill Criteria", source: "Commit", detail: "Review cadence, strategic risks with mitigations, and pre-agreed triggers for when to pivot, pause, or stop." },
  { n: "13", label: "Strategic Trade-offs", source: "Commit", detail: "What is not being pursued and why — making explicit the paths rejected so the commitment to the chosen direction is unambiguous." },
  { n: "14", label: "Resource & Investment Implications", source: "Commit", detail: "What gets funded, protected, paused, or reallocated — connecting the strategy to actual capital and capacity decisions." },
  { n: "15", label: "Exit or Value-Creation Implications", source: "Commit", detail: "Why this strategy improves enterprise value, growth quality, defensibility, or exit attractiveness — the investor-grade rationale." },
  { n: "A",  label: "Appendix: Open Questions & Evidence Gaps", source: "All stages", detail: "Unresolved questions, major evidence gaps, and contradictions that could not be fully resolved — material to decision quality." },
];

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  "Frame":      { bg: "#f3f4f6", color: "#374151" },
  "Diagnose":   { bg: "#dbeafe", color: "#1e40af" },
  "Decide":     { bg: "#ede9fe", color: "#6d28d9" },
  "Position":   { bg: "#d1fae5", color: "#065f46" },
  "Commit":     { bg: "#fef3c7", color: "#92400e" },
  "All stages": { bg: "#f3f4f6", color: "#374151" },
};

const GEN_STEPS = [
  { label: "Resolve",        pct: 15 },
  { label: "Synthesise",     pct: 35 },
  { label: "Write sections", pct: 50 },
  { label: "Assemble",       pct: 82 },
  { label: "Done",           pct: 100 },
];

export function ProductStrategyModal({
  open,
  onClose,
  completedStages,
  companyName,
  companyId,
  outputs,
}: {
  open: boolean;
  onClose: () => void;
  completedStages: number;
  companyName: string;
  companyId: string;
  outputs: Record<string, unknown>;
}) {
  const { isGenerating, progress, step, detail, error, startGeneration, clearError } = useStrategyGeneration();

  if (!open) return null;

  const canDownload = completedStages >= 5;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 780, width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}
      >
        {/* Header */}
        <div style={{ background: "#111827", padding: "32px 40px 28px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Product Strategy Document</p>
              </div>
              <p style={{ fontSize: 15, color: "#9ca3af", margin: 0, lineHeight: 1.5, maxWidth: 560 }}>
                A single authored strategy document — 15 sections plus appendix, synthesised from your completed stages. Not 5 stitched reports.{" "}
                {completedStages < 5 ? "Complete all 5 stages to unlock." : isGenerating ? "Generating in background…" : "Ready to generate."}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Section list */}
        <div style={{ overflowY: "auto", padding: "28px 40px", flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 20px" }}>
            What you get — 15 sections + appendix
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SECTIONS.map((section) => {
              const stageStyle = STAGE_COLORS[section.source] ?? STAGE_COLORS["Frame"];
              return (
                <div key={section.n} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 18px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", width: 26, flexShrink: 0, paddingTop: 2 }}>{section.n}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>{section.label}</p>
                    <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{section.detail}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: stageStyle.bg, color: stageStyle.color, flexShrink: 0, whiteSpace: "nowrap" as const, alignSelf: "flex-start", marginTop: 2 }}>
                    {section.source}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 40px 28px", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>

          {/* Error */}
          {error && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 6, border: "1px solid #fecaca" }}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
              <button onClick={clearError} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 2, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {/* Progress panel — shown while generating (persists across navigation) */}
          {isGenerating && (
            <div style={{ marginBottom: 20, background: "#111827", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg style={{ animation: "spin 1.2s linear infinite", flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                  </svg>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{step || "Starting…"}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#a3e635" }}>{progress}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ height: "100%", background: "#a3e635", borderRadius: 2, width: `${progress}%`, transition: "width 600ms ease-out" }} />
              </div>
              {detail && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{detail}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
                {GEN_STEPS.map((s, i) => {
                  const done = progress >= s.pct;
                  const prevPct = i === 0 ? 1 : GEN_STEPS[i - 1].pct;
                  const active = progress >= prevPct && !done;
                  return (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: done ? "#a3e635" : active ? "rgba(163,230,53,0.4)" : "rgba(255,255,255,0.2)", transition: "background 400ms" }} />
                        <span style={{ fontSize: 10, color: done ? "#a3e635" : "rgba(255,255,255,0.35)", fontWeight: done ? 700 : 400, transition: "color 400ms" }}>{s.label}</span>
                      </div>
                      {i < GEN_STEPS.length - 1 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>›</span>}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "12px 0 0" }}>
                Takes 2–4 minutes · Running in background — you can navigate away and the download will start automatically when ready
              </p>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span style={{ fontSize: 14, color: "#6b7280" }}>{completedStages}/5 stages complete</span>
            </div>
            {canDownload ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { downloadStrategyDocument(companyName, outputs as Record<string, Record<string, unknown>>); onClose(); }}
                  disabled={isGenerating}
                  style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#374151", background: "#f3f4f6", borderRadius: 8, border: "none", cursor: isGenerating ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isGenerating ? 0.5 : 1 }}
                >
                  Word Document
                </button>
                <button
                  onClick={() => startGeneration(companyId, companyName)}
                  disabled={isGenerating}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: "#fff", background: isGenerating ? "#6b7280" : "#111827", borderRadius: 8, border: "none", cursor: isGenerating ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {isGenerating ? (
                    <>
                      <svg style={{ animation: "spin 1.2s linear infinite" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
                      Generating…
                    </>
                  ) : "Download Strategy Document"}
                </button>
              </div>
            ) : (
              <button disabled style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px", fontSize: 14, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", borderRadius: 8, border: "none", cursor: "not-allowed", fontFamily: "inherit" }}>
                Unlock when 5 stages complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
