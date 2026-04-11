import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { getUserEntitlements, getUserCompanies } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";

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

  // Determine which strategy stages have completed outputs
  const completedStages = new Set<string>();
  if (activeCompany) {
    const completedOutputs = await db.output.findMany({
      where: {
        companyId: activeCompany.id,
        workflowType: { in: ["frame", "diagnose", "decide", "position", "commit"] },
      },
      select: { workflowType: true },
    });
    completedOutputs.forEach((o) => completedStages.add(o.workflowType));
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


      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Dashboard</h1>
        <p style={{ fontSize: 16, color: "#6b7280" }}>
          {activeCompany
            ? `Strategic clarity at every inflection point.`
            : "Set up a company to get started"}
        </p>
      </div>

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

      {/* Stats row */}
      {activeCompany && (
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Reports completed", value: completedStages.size },
            { label: "Stages remaining", value: 5 - completedStages.size },
            { label: "Reports shared", value: totalShares },
          ].map((stat) => (
            <div key={stat.label} style={{
              flex: 1, padding: "20px 24px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff",
            }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{stat.value}</p>
              <p style={{ fontSize: 13, color: "#6b7280" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Strategy cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 32 }}>
        {WORKFLOW_CARDS.map((wf) => {
          const done = completedStages.has(wf.stageId);
          return (
            <a
              key={wf.num}
              href={wf.href}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "24px",
                border: done ? "1px solid #a7f3d0" : "1px solid #e5e7eb",
                borderRadius: 12,
                textDecoration: "none",
                background: done ? "#f0fdf4" : "#f3f4f6",
                cursor: "pointer",
                transition: "border-color 150ms, box-shadow 150ms",
              }}
            >
              <p style={{ fontSize: 28, fontWeight: 700, color: done ? "#059669" : "#9ca3af", letterSpacing: "0.08em", marginBottom: 8 }}>{wf.num}</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{wf.label}</p>
              <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, flex: 1 }}>{wf.detail}</p>
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
                    Completed
                  </span>
                </div>
              )}
            </a>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 32 }} />

      {/* Intelligence & Platform cards */}
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Intelligence</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 40 }}>
        {INTEL_CARDS.map((card) => (
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
              background: "#f3f4f6",
              opacity: card.access ? 1 : 0.5,
              cursor: "pointer",
              transition: "border-color 150ms, box-shadow 150ms",
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", marginBottom: 8 }}>{card.num}</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{card.label}</p>
            <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, flex: 1 }}>{card.detail}</p>
            <div style={{ marginTop: 16, minHeight: 22 }}>
              {!card.access && (
                <span style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#6b7280",
                  background: "rgba(255,255,255,0.6)",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}>
                  Coming Soon
                </span>
              )}
            </div>
          </a>
        ))}
      </div>

      {/* Recent outputs */}
      {recentOutputs.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12 }}>Recent Outputs</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentOutputs.map((o) => (
              <a
                key={o.id}
                href={`/inflexion/${o.workflowType === "competitor_intel" ? "competitors" : o.workflowType}/${o.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  textDecoration: "none",
                  background: "#fff",
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{o.title}</p>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>{o.workflowType} &middot; {o.createdAt.toLocaleDateString("en-GB")}</p>
                </div>
                {o.confidence !== null && (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: o.confidence >= 0.7 ? "#059669" : o.confidence >= 0.4 ? "#d97706" : "#dc2626",
                  }}>
                    {Math.round(o.confidence * 100)}%
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
