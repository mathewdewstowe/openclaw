import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import { StrategyFlow } from "@/components/strategy-flow-v2";

export const dynamic = "force-dynamic";

function checkProfileReady(company: {
  name: string;
  url: string | null;
  sector: string | null;
  profile: Record<string, unknown> | null;
}): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  const p = company.profile ?? {};
  if (!company.url) missing.push("Website URL");
  if (!company.sector) missing.push("Sector");
  if (!p.icp1) missing.push("Ideal Customer Profile (ICP)");
  const hasCompetitors = Array.isArray(p.competitors) && (p.competitors as string[]).filter(Boolean).length > 0;
  if (!hasCompetitors) missing.push("At least one competitor");
  return { ready: missing.length === 0, missing };
}

export default async function StrategyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Gate: profile must be complete before Frame can run
  const [companyAccess, legacyProfile] = await Promise.all([
    getUserCompanies(user.id),
    db.companyProfile.findUnique({ where: { userId: user.id } }),
  ]);
  const activeCompany = companyAccess[0]?.company;

  if (!activeCompany || !legacyProfile) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>No company set up yet</h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>You need to add a company profile before you can run strategy analysis.</p>
        <a href="/inflexion/settings" style={{ display: "inline-block", padding: "12px 24px", background: "#111827", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Go to Settings
        </a>
      </div>
    );
  }

  const profileCheck = checkProfileReady({
    name: activeCompany.name,
    url: activeCompany.url,
    sector: activeCompany.sector,
    profile: (activeCompany as unknown as { profile?: Record<string, unknown> }).profile ?? null,
  });

  if (!profileCheck.ready) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Complete your profile first</h2>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
            The Frame stage needs a complete company profile to produce accurate strategic analysis. The following fields are missing:
          </p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          {profileCheck.missing.map((field) => (
            <div key={field} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </div>
              <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{field}</span>
            </div>
          ))}
        </div>
        <a
          href="/inflexion/settings"
          style={{ display: "block", textAlign: "center", padding: "14px 24px", background: "#111827", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          Complete Profile in Settings →
        </a>
      </div>
    );
  }

  // Fetch in-progress and completed jobs in parallel
  const [runningJobs, completedJobs] = await Promise.all([
    db.job.findMany({
      where: { userId: user.id, status: "running" },
      select: { id: true, workflowType: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.job.findMany({
      where: { userId: user.id, status: "completed", outputId: { not: null } },
      select: { id: true, workflowType: true, outputId: true, completedAt: true, metadata: true },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const initialRunningJobs = runningJobs
    .map((j) => ({
      stageId: j.workflowType,
      sessionId: (j.metadata as Record<string, unknown> | null)?.sessionId as string | undefined,
    }))
    .filter((j): j is { stageId: string; sessionId: string } => !!j.sessionId);

  // Collect all output IDs per stage (for version history) and most-recent per stage
  const outputIdsByStage: Record<string, string[]> = {};
  for (const j of completedJobs) {
    if (j.outputId) {
      if (!outputIdsByStage[j.workflowType]) outputIdsByStage[j.workflowType] = [];
      outputIdsByStage[j.workflowType].push(j.outputId);
    }
  }

  // Most-recent outputId per stage
  const mostRecentOutputIdByStage: Record<string, string> = {};
  const seenStages = new Set<string>();
  for (const j of completedJobs) {
    if (j.outputId && !seenStages.has(j.workflowType)) {
      mostRecentOutputIdByStage[j.workflowType] = j.outputId;
      seenStages.add(j.workflowType);
    }
  }

  const allOutputIds = Object.values(outputIdsByStage).flat();

  const outputs = allOutputIds.length > 0
    ? await db.output.findMany({
        where: { id: { in: allOutputIds } },
        select: { id: true, sections: true, createdAt: true, version: true, confidence: true, tags: true },
        orderBy: { version: "desc" },
      })
    : [];

  // Build map: stageId → sections for most recent output
  const completedOutputsByStage: Record<string, Record<string, unknown>> = {};
  // Build map: stageId → outputId for most recent output
  const completedOutputIds: Record<string, string> = {};
  // Build map: stageId → all versions array
  const allOutputsByStage: Record<string, Array<{ id: string; sections: Record<string, unknown>; createdAt: string; version: number; confidence: number | null; tags: string[] }>> = {};

  for (const output of outputs) {
    // Find which stage this output belongs to
    for (const [stageId, ids] of Object.entries(outputIdsByStage)) {
      if (ids.includes(output.id)) {
        if (!allOutputsByStage[stageId]) allOutputsByStage[stageId] = [];
        allOutputsByStage[stageId].push({
          id: output.id,
          sections: JSON.parse(JSON.stringify(output.sections)) as Record<string, unknown>,
          createdAt: output.createdAt.toISOString(),
          version: output.version,
          confidence: output.confidence,
          tags: output.tags,
        });

        if (mostRecentOutputIdByStage[stageId] === output.id) {
          completedOutputsByStage[stageId] = JSON.parse(JSON.stringify(output.sections)) as Record<string, unknown>;
          completedOutputIds[stageId] = output.id;
        }
        break;
      }
    }
  }

  // Build map: stageId → saved answers from most recent completed job per stage
  const savedAnswersByStage: Record<string, Record<string, unknown>> = {};
  const seenAnswerStages = new Set<string>();
  for (const j of completedJobs) {
    if (!seenAnswerStages.has(j.workflowType)) {
      const meta = j.metadata as Record<string, unknown> | null;
      if (meta?.answers && typeof meta.answers === "object") {
        savedAnswersByStage[j.workflowType] = meta.answers as Record<string, unknown>;
      }
      seenAnswerStages.add(j.workflowType);
    }
  }

  return (
    <StrategyFlow
      initialRunningJobs={initialRunningJobs}
      initialCompletedOutputs={completedOutputsByStage}
      initialSavedAnswers={savedAnswersByStage}
      initialCompletedOutputIds={completedOutputIds}
      allOutputsByStage={allOutputsByStage}
    />
  );
}
