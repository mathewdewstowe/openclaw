import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import { StrategyDocument } from "@/components/strategy-document";

export const dynamic = "force-dynamic";

const STAGES = ["frame", "diagnose", "decide", "position", "commit"] as const;

export default async function DocumentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  if (!activeCompany) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>No company configured</h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>Set up a company profile first.</p>
        <a href="/inflexion/settings" style={{ padding: "12px 24px", background: "#111827", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Go to Settings
        </a>
      </div>
    );
  }

  // Fetch the most recent completed output for each stage
  const jobs = await db.job.findMany({
    where: {
      companyId: activeCompany.id,
      status: "completed",
      outputId: { not: null },
    },
    select: { workflowType: true, outputId: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });

  // Most recent output per stage
  const outputIdByStage: Record<string, string> = {};
  const seen = new Set<string>();
  for (const j of jobs) {
    if (j.outputId && !seen.has(j.workflowType)) {
      outputIdByStage[j.workflowType] = j.outputId;
      seen.add(j.workflowType);
    }
  }

  const outputIds = Object.values(outputIdByStage);
  const outputs = outputIds.length > 0
    ? await db.output.findMany({
        where: { id: { in: outputIds } },
        select: { id: true, workflowType: true, sections: true, confidence: true, createdAt: true },
      })
    : [];

  // Build sections map: stage → sections
  const stageData: Record<string, { sections: Record<string, unknown>; confidence: number | null; createdAt: string }> = {};
  for (const output of outputs) {
    stageData[output.workflowType] = {
      sections: JSON.parse(JSON.stringify(output.sections)) as Record<string, unknown>,
      confidence: output.confidence,
      createdAt: output.createdAt.toISOString(),
    };
  }

  const completedStages = STAGES.filter((s) => !!stageData[s]);
  const companyName = activeCompany.name;

  return (
    <StrategyDocument
      companyName={companyName}
      stageData={stageData}
      completedStages={completedStages}
    />
  );
}
