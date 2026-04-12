import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/entitlements";
import { db } from "@/lib/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectorColour(sector: string | null): { bg: string; text: string } {
  if (!sector) return { bg: "#f3f4f6", text: "#6b7280" };
  const s = sector.toLowerCase();
  if (s.includes("fintech") || s.includes("finance")) return { bg: "#eff6ff", text: "#1d4ed8" };
  if (s.includes("health") || s.includes("medtech")) return { bg: "#f0fdf4", text: "#166534" };
  if (s.includes("saas") || s.includes("software")) return { bg: "#faf5ff", text: "#7c3aed" };
  if (s.includes("market")) return { bg: "#fff7ed", text: "#c2410c" };
  return { bg: "#f3f4f6", text: "#374151" };
}

const WORKFLOW_LABELS: Record<string, string> = {
  diagnose: "Diagnose",
  decide: "Decide",
  position: "Position",
  act: "Act",
};

const WORKFLOW_COLOURS: Record<string, { bg: string; text: string }> = {
  diagnose: { bg: "#eff6ff", text: "#1d4ed8" },
  decide:   { bg: "#f0fdf4", text: "#166534" },
  position: { bg: "#faf5ff", text: "#7c3aed" },
  act:      { bg: "#fff7ed", text: "#c2410c" },
};

const STAGE_KEYS = ["diagnose", "decide", "position", "act"] as const;
const TOTAL_STAGES = 5;

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.access_portfolio) redirect("/inflexion/portfolio");

  const { portfolioId } = await params;

  const portfolio = await db.portfolio.findUnique({
    where: { id: portfolioId, createdById: user.id },
    include: {
      companies: {
        include: {
          outputs: {
            select: {
              id: true,
              workflowType: true,
              title: true,
              confidence: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!portfolio) notFound();

  const allOutputs = portfolio.companies.flatMap((c) => c.outputs);
  const totalReports = allOutputs.length;
  const confScores = allOutputs.map((o) => o.confidence).filter((c): c is number => c !== null);
  const avgConf = confScores.length > 0 ? confScores.reduce((a, b) => a + b, 0) / confScores.length : null;

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <a href="/inflexion/portfolio" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Portfolio</a>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{portfolio.name}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{portfolio.name}</h1>
        {portfolio.description && (
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 0 }}>{portfolio.description}</p>
        )}
      </div>

      {/* Stat bar */}
      {portfolio.companies.length > 0 && (
        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", marginBottom: 28, overflow: "hidden" }}>
          {[
            { label: "Companies", value: String(portfolio.companies.length) },
            { label: "Total Reports", value: String(totalReports) },
            { label: "Avg Confidence", value: avgConf != null ? `${Math.round(avgConf * 100)}%` : "—" },
          ].map((s, i) => (
            <div key={s.label} style={{ flex: 1, padding: "16px 20px", borderRight: i < 2 ? "1px solid #e5e7eb" : undefined }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Companies */}
      {portfolio.companies.length === 0 ? (
        <div style={{ padding: 40, border: "1px dashed #d1d5db", borderRadius: 12, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          No companies in this portfolio yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {portfolio.companies.map((company) => {
            // Group outputs by workflow — latest per type
            const latestByWorkflow: Record<string, typeof company.outputs[0] | null> = {
              diagnose: null, decide: null, position: null, act: null,
            };
            for (const key of STAGE_KEYS) {
              const matches = company.outputs.filter((o) => o.workflowType === key);
              latestByWorkflow[key] = matches[0] ?? null;
            }
            const stagesDone = new Set(company.outputs.map((o) => o.workflowType));
            const workflowsDone = STAGE_KEYS.filter((k) => stagesDone.has(k)).length;
            const completion = workflowsDone > 0 ? workflowsDone + 1 : 0;
            const lastUpdated = company.outputs[0]?.createdAt ?? null;
            const companyOutputs = company.outputs;
            const companyConfScores = companyOutputs.map((o) => o.confidence).filter((c): c is number => c !== null);
            const companyAvgConf = companyConfScores.length > 0
              ? companyConfScores.reduce((a, b) => a + b, 0) / companyConfScores.length
              : null;
            const sc = sectorColour(company.sector);

            return (
              <div
                key={company.id}
                style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", overflow: "hidden" }}
              >
                {/* Company header */}
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{company.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {company.sector && (
                          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text }}>
                            {company.sector}
                          </span>
                        )}
                        {lastUpdated && (
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            Updated {formatDate(lastUpdated)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>{completion}/{TOTAL_STAGES} stages</p>
                      {companyAvgConf != null && (
                        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Avg {Math.round(companyAvgConf * 100)}% confidence</p>
                      )}
                    </div>
                    <a
                      href="/inflexion/strategy"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", textDecoration: "none" }}
                    >
                      Open
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </a>
                  </div>
                </div>

                {/* Workflow outputs row */}
                <div style={{ padding: "14px 24px", display: "flex", gap: 0 }}>
                  {STAGE_KEYS.map((key, i) => {
                    const output = latestByWorkflow[key];
                    const col = WORKFLOW_COLOURS[key];
                    const isLast = i === STAGE_KEYS.length - 1;
                    return (
                      <div
                        key={key}
                        style={{ flex: 1, paddingRight: isLast ? 0 : 16, borderRight: isLast ? "none" : "1px solid #f3f4f6", marginRight: isLast ? 0 : 16 }}
                      >
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                          {WORKFLOW_LABELS[key]}
                        </p>
                        {output ? (
                          <div>
                            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: col.bg, color: col.text, marginBottom: 4 }}>
                              {output.confidence != null ? `${Math.round(output.confidence * 100)}%` : "Done"}
                            </span>
                            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{formatDate(output.createdAt)}</p>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "#d1d5db" }}>Not run</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
