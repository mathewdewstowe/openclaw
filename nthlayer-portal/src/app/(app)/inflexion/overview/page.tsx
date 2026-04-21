import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { getUserEntitlements, getUserCompanies } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";
import { DeckCTA } from "./deck-cta";

function calcProfileScore(company: {
  url: string | null;
  sector: string | null;
  location: string | null;
  profile: Record<string, unknown> | null;
}): { score: number; missing: string[] } {
  const missing: string[] = [];
  const p = (company.profile ?? {}) as Record<string, unknown>;
  if (!company.url) missing.push("website URL");
  if (!company.sector) missing.push("sector");
  if (!company.location) missing.push("location");
  if (!p.icp1) missing.push("ideal customer profile");
  const hasCompetitors = Array.isArray(p.competitors) && (p.competitors as string[]).filter(Boolean).length > 0;
  if (!hasCompetitors) missing.push("competitors");
  const total = 5;
  return { score: Math.round(((total - missing.length) / total) * 100), missing };
}

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [entitlements, companyAccess] = await Promise.all([
    getUserEntitlements(user.id),
    getUserCompanies(user.id),
  ]);

  const activeCompany = companyAccess[0]?.company;

  // Fetch recent jobs and outputs for the active company
  let recentJobs: { id: string; workflowType: string; status: string; createdAt: Date }[] = [];
  let recentOutputs: { id: string; workflowType: string; outputType: string; title: string; createdAt: Date; confidence: number | null }[] = [];

  const profileCompletion = activeCompany
    ? calcProfileScore({
        url: activeCompany.url,
        sector: activeCompany.sector,
        location: (activeCompany as unknown as { location?: string | null }).location ?? null,
        profile: (activeCompany as unknown as { profile?: Record<string, unknown> }).profile ?? null,
      })
    : null;

  let totalShares = 0;
  if (activeCompany) {
    [recentJobs, recentOutputs] = await Promise.all([
      db.job.findMany({
        where: { companyId: activeCompany.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, workflowType: true, status: true, createdAt: true },
      }),
      db.output.findMany({
        where: { companyId: activeCompany.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, workflowType: true, outputType: true, title: true, createdAt: true, confidence: true },
      }),
    ]);
    // Share count (graceful if table not yet migrated)
    try {
      totalShares = await (db as unknown as { outputShare: { count: (args: unknown) => Promise<number> } }).outputShare.count({
        where: { companyId: activeCompany.id },
      });
    } catch {
      totalShares = 0;
    }
  }

  // Determine which strategy stages have completed outputs + fetch sections for deck
  const completedStages = new Set<string>();
  let deckOutputs: Record<string, unknown> = {};
  let knowledgeCounts = { actions: 0, risks: 0, assumptions: 0, metrics: 0 };
  let isTransformationUser = false;
  let transformationKnowledgeCounts = { moves: 0, risks: 0, signals: 0, proofPoints: 0, assumptions: 0, blockers: 0, aiTools: 0 };
  if (activeCompany) {
    const completedOutputs = await db.output.findMany({
      where: {
        companyId: activeCompany.id,
        workflowType: { in: ["frame", "diagnose", "decide", "position", "commit", "why_now", "current_state", "future_moves", "mobilise", "embed"] },
      },
      select: { workflowType: true, sections: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    // Deduplicate — keep most recent per stage
    const seen = new Set<string>();
    const transformationStageIds = new Set(["why_now", "current_state", "future_moves", "mobilise", "embed"]);
    for (const o of completedOutputs) {
      completedStages.add(o.workflowType);
      if (transformationStageIds.has(o.workflowType)) isTransformationUser = true;
      if (!seen.has(o.workflowType)) {
        seen.add(o.workflowType);
        deckOutputs[o.workflowType] = o.sections;
        const s = o.sections as Record<string, unknown>;
        // Legacy knowledge counts
        if (Array.isArray(s?.actions)) knowledgeCounts.actions += (s.actions as unknown[]).length;
        if (Array.isArray(s?.risks)) knowledgeCounts.risks += (s.risks as unknown[]).length;
        if (Array.isArray(s?.assumptions)) knowledgeCounts.assumptions += (s.assumptions as unknown[]).length;
        if (Array.isArray(s?.monitoring)) knowledgeCounts.metrics += (s.monitoring as unknown[]).length;
        // Transformation knowledge counts — extract from agent sub-results
        if (transformationStageIds.has(o.workflowType)) {
          if (Array.isArray(s?.recommendations)) transformationKnowledgeCounts.moves += (s.recommendations as unknown[]).length;
          if (Array.isArray(s?.key_findings)) transformationKnowledgeCounts.assumptions += (s.key_findings as unknown[]).length;
          // Count from specific agents
          const exposure = s?.Exposure as Record<string, unknown> | undefined;
          if (exposure && Array.isArray(exposure.recommendations)) transformationKnowledgeCounts.risks += (exposure.recommendations as unknown[]).length;
          const conviction = s?.Conviction as Record<string, unknown> | undefined;
          if (conviction && Array.isArray(conviction.key_findings)) transformationKnowledgeCounts.blockers += (conviction.key_findings as unknown[]).length;
          const proof = s?.Proof as Record<string, unknown> | undefined;
          if (proof && Array.isArray(proof.recommendations)) transformationKnowledgeCounts.proofPoints += (proof.recommendations as unknown[]).length;
          // Signals from Pressure/BenchmarkResearch
          const pressure = s?.Pressure as Record<string, unknown> | undefined;
          if (pressure && Array.isArray(pressure.key_findings)) transformationKnowledgeCounts.signals += (pressure.key_findings as unknown[]).length;
          // AI Tools from SaaSStackResearch/WorkflowAnalysis
          const saas = s?.SaaSStackResearch as Record<string, unknown> | undefined;
          if (saas && Array.isArray(saas.recommendations)) transformationKnowledgeCounts.aiTools += (saas.recommendations as unknown[]).length;
        }
      }
    }
  }

  const WORKFLOW_CARDS = [
    {
      num: "01", label: "Frame", stageId: "frame", href: "/inflexion/strategy",
      detail: "Build a clear frame around the decision: what has specifically changed, what winning looks like in 24 to 36 months, and where the boundaries sit. Sharper framing means fewer wasted cycles downstream.",
    },
    {
      num: "02", label: "Diagnose", stageId: "diagnose", href: "/inflexion/strategy",
      detail: "Build a structured fact base across product-market fit, competitive position, unit economics, and operational capability — separating the gaps that will constrain your options from the noise.",
    },
    {
      num: "03", label: "Decide", stageId: "decide", href: "/inflexion/strategy",
      detail: "Surface the genuine strategic options — including inaction — and pressure-test each one against what would need to be true for it to succeed. Work backwards from winning conditions with explicit kill criteria and staged investment logic.",
    },
    {
      num: "04", label: "Position", stageId: "position", href: "/inflexion/strategy",
      detail: "Translate strategic direction into a precise market stance — defining who the business serves, what it does better than any alternative, and which structural advantages it is building toward.",
    },
    {
      num: "05", label: "Commit", stageId: "commit", href: "/inflexion/strategy",
      detail: "Translate direction into execution: a portfolio of bets with clear ownership, an OKR architecture connecting strategy to team-level action, a 100-day plan, and a governance rhythm that keeps the strategy live.",
    },
  ];

  const INTEL_CARDS = [
    {
      href: "/inflexion/competitors",
      access: entitlements.access_decide,
      label: "Competitors",
      detail: "Track competitor moves, positioning changes, and market entries — know what your rivals are doing before it becomes a problem. Updated continuously as new signals emerge.",
      num: "06",
    },
    {
      href: "/inflexion/signals",
      access: entitlements.access_decide,
      label: "Signals",
      detail: "Surface weak signals before they become problems — market shifts and assumption drift flagged before they require a strategic response.",
      num: "07",
    },
    {
      href: "/inflexion/monitor",
      access: entitlements.access_decide,
      label: "Monitor",
      detail: "Watch your market, strategy assumptions, and macro environment continuously — get alerted the moment something material changes.",
      num: "08",
    },
    {
      href: "/inflexion/recommendations",
      access: entitlements.access_decide,
      label: "Recommendations",
      detail: "Synthesise your strategic outputs into a prioritised set of next actions — grounded in evidence, ranked by impact, and tied to the decisions you have already made.",
      num: "09",
    },
    {
      href: "/inflexion/decisions",
      access: entitlements.access_decide,
      label: "Decisions",
      detail: "Maintain a permanent ledger of every strategic decision — what was decided, the assumptions it rested on, and confidence at the time.",
      num: "10",
    },
  ];

  return (
    <div>
      {profileCompletion && profileCompletion.score < 100 && (
        <ProfileCompletionBanner score={profileCompletion.score} missing={profileCompletion.missing} />
      )}


      <div data-tour="dashboard-overview" style={{ marginBottom: 24 }}>
        <h1 className="text-2xl sm:text-4xl" style={{ fontWeight: 800, color: "#111827", marginBottom: 10 }}>Dashboard</h1>
        <p className="text-base sm:text-xl" style={{ color: "#374151", lineHeight: 1.7, margin: 0 }}>
          {activeCompany
            ? <>Inflexion builds your strategy from structured intelligence — AI-driven analysis across five stages that turns your market position, competitive landscape, and growth options into a board-ready plan with clear bets and accountability. Your judgement drives every decision; Inflexion sharpens it with evidence, surfaces the trade-offs, and gives you the conviction to commit.</>
            : "Set up a company to get started."}
        </p>
      </div>

      {/* Knowledge cards */}
      {activeCompany && !isTransformationUser && (
        <div data-tour="knowledge-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { href: "/inflexion/actions", label: "Actions", count: knowledgeCounts.actions, detail: "Prioritised tasks generated from your strategy reports — each tied to an owner, deadline, and priority." },
            { href: "/inflexion/risks", label: "Risks", count: knowledgeCounts.risks, detail: "Strategic and operational risks surfaced across stages — with severity ratings and mitigation options." },
            { href: "/inflexion/assumptions", label: "Assumptions", count: knowledgeCounts.assumptions, detail: "Key assumptions underlying your strategy — accept the ones that hold, reject the ones that don't." },
            { href: "/inflexion/monitoring", label: "Metrics", count: knowledgeCounts.metrics, detail: "Signals and KPIs to track — with targets and review cadences aligned to your strategic commitments." },
          ].map((card) => (
            <a
              key={card.href}
              href={card.href}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "24px",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                textDecoration: "none",
                background: card.count > 0 ? "#fff" : "#f3f4f6",
                transition: "border-color 150ms, box-shadow 150ms",
              }}
            >
              {card.count > 0 ? (
                <p className="text-3xl sm:text-4xl" style={{ fontWeight: 800, color: "#3f6212", margin: "0 0 8px", lineHeight: 1 }}>{card.count}</p>
              ) : (
                <p className="text-3xl sm:text-4xl" style={{ fontWeight: 800, color: "#d1d5db", margin: "0 0 8px", lineHeight: 1 }}>—</p>
              )}
              <p className="text-base sm:text-lg" style={{ fontWeight: 700, color: "#111827", marginBottom: 8 }}>{card.label}</p>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, flex: 1 }}>{card.detail}</p>
            </a>
          ))}
        </div>
      )}

      {/* Transformation knowledge cards — Moves / Risks / Signals / Proof Points / Assumptions / Blockers / AI Tools */}
      {activeCompany && isTransformationUser && (
        <div data-tour="knowledge-cards" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[
            { label: "Moves", count: transformationKnowledgeCounts.moves, color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe", detail: "Strategic moves and recommendations across all stages" },
            { label: "Risks", count: transformationKnowledgeCounts.risks, color: "#991b1b", bg: "#fef2f2", border: "#fecaca", detail: "Exposure risks and threats identified in your current state" },
            { label: "Signals", count: transformationKnowledgeCounts.signals, color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", detail: "Market pressure signals and competitive triggers" },
            { label: "Proof Points", count: transformationKnowledgeCounts.proofPoints, color: "#065f46", bg: "#f0fdf4", border: "#bbf7d0", detail: "Evidence and success criteria for board reporting" },
            { label: "Assumptions", count: transformationKnowledgeCounts.assumptions, color: "#92400e", bg: "#fffbeb", border: "#fde68a", detail: "Key findings and assumptions underlying your transformation" },
            { label: "Blockers", count: transformationKnowledgeCounts.blockers, color: "#9f1239", bg: "#fff1f2", border: "#fecdd3", detail: "Leadership and organisational blockers to execution" },
            { label: "AI Tools", count: transformationKnowledgeCounts.aiTools, color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc", detail: "SaaS and AI tooling recommendations" },
          ].map((card) => {
            const isLocked = card.count === 0;
            return (
              <div
                key={card.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "20px 16px",
                  border: `1px solid ${isLocked ? "#e5e7eb" : card.border}`,
                  borderRadius: 12,
                  background: isLocked ? "#f9fafb" : card.bg,
                  position: "relative",
                  transition: "border-color 150ms, box-shadow 150ms",
                }}
              >
                {isLocked ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <p className="text-2xl" style={{ fontWeight: 800, color: "#d1d5db", margin: 0, lineHeight: 1 }}>—</p>
                  </div>
                ) : (
                  <p className="text-2xl sm:text-3xl" style={{ fontWeight: 800, color: card.color, margin: "0 0 8px", lineHeight: 1 }}>{card.count}</p>
                )}
                <p style={{ fontSize: 14, fontWeight: 700, color: isLocked ? "#9ca3af" : "#111827", marginBottom: 4 }}>{card.label}</p>
                <p style={{ fontSize: 11, color: isLocked ? "#9ca3af" : "#6b7280", lineHeight: 1.5, margin: 0 }}>{card.detail}</p>
              </div>
            );
          })}
        </div>
      )}

      {!activeCompany && (
        <div style={{
          padding: "32px",
          border: "1px dashed #d1d5db",
          borderRadius: 12,
          textAlign: "center",
          color: "#6b7280",
          marginBottom: 32,
        }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No company configured</p>
          <p style={{ fontSize: 14, marginBottom: 16 }}>Add a company to start generating strategic intelligence.</p>
          <a
            href="/inflexion/settings"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "#111827",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Add Company
          </a>
        </div>
      )}

      {/* Strategy Deck CTA */}
      {activeCompany && (
        <div data-tour="strategy-deck" style={{ marginBottom: 32 }}>
          <DeckCTA
            completedStages={["frame", "diagnose", "decide", "position", "commit"].filter(s => completedStages.has(s)).length}
            companyName={activeCompany.name}
            companyId={activeCompany.id}
            outputs={deckOutputs}
            canExport={entitlements.access_export}
          />
        </div>
      )}

      {/* Strategy section header */}
      <div style={{ marginBottom: 12 }}>
        <h2 className="text-xl sm:text-2xl" style={{ fontWeight: 700, color: "#111827", margin: 0 }}>Strategy</h2>
      </div>

      {/* Strategy cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {WORKFLOW_CARDS.map((wf, cardIdx) => {
          const done = completedStages.has(wf.stageId);
          const dotCount = cardIdx + 1;
          // Sequential locking: card is locked if prior stage is not complete (except Frame)
          // Bet runs automatically — commit's visible prerequisite is position
          const stageOrder = ["frame", "diagnose", "decide", "position", "commit"];
          const stageIdx = stageOrder.indexOf(wf.stageId);
          const isLocked = stageIdx > 0 && !completedStages.has(stageOrder[stageIdx - 1]);
          const CardTag = isLocked ? "div" as const : "a" as const;
          return (
            <CardTag
              key={wf.num}
              data-tour={`stage-${wf.stageId}`}
              {...(!isLocked ? { href: wf.href } : {})}
              title={isLocked ? `Complete ${WORKFLOW_CARDS[cardIdx - 1]?.label ?? "previous stage"} first` : undefined}
              className="p-4 sm:p-6"
              style={{
                display: "flex",
                flexDirection: "column",
                border: done ? "1px solid #a7f3d0" : "1px solid #e5e7eb",
                borderRadius: 12,
                textDecoration: "none",
                background: done ? "#f0fdf4" : "#f3f4f6",
                cursor: isLocked ? "not-allowed" : "pointer",
                transition: "border-color 150ms, box-shadow 150ms",
                position: "relative",
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              {isLocked ? (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              ) : done ? (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              ) : (
                <p className="text-xl sm:text-2xl" style={{ fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", marginBottom: 8 }}>{wf.num}</p>
              )}
              <p className="text-2xl sm:text-3xl" style={{ fontWeight: 800, color: isLocked ? "#9ca3af" : "#111827", marginBottom: 8, letterSpacing: "-0.02em" }}>{wf.label}</p>
              <p style={{ fontSize: 12, color: isLocked ? "#9ca3af" : "#374151", lineHeight: 1.6, flex: 1 }}>{wf.detail}</p>
              {done && (
                <div style={{ marginTop: 16 }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#059669",
                    background: "#dcfce7",
                    padding: "3px 8px",
                    borderRadius: 999,
                  }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Report
                  </span>
                </div>
              )}
              {/* Progress dots — bottom right */}
              <div style={{ position: "absolute", bottom: 14, right: 14, display: "flex", gap: 4 }}>
                {Array.from({ length: dotCount }).map((_, di) => (
                  <div
                    key={di}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#a3e635",
                    }}
                  />
                ))}
              </div>
            </CardTag>
          );
        })}
      </div>



    </div>
  );
}
