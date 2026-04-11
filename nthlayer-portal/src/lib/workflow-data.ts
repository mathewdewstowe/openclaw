import { db } from "./db";
import { getCurrentUser } from "./auth";
import { getUserCompanies } from "./entitlements";
import type { WorkflowType } from "./types/output";

export async function getWorkflowData(workflow: WorkflowType) {
  const user = await getCurrentUser();
  if (!user) return null;

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  if (!activeCompany) {
    return { outputs: [], activeJobs: [], diagnoseOutput: null };
  }

  const [outputs, activeJobs, latestDiagnose] = await Promise.all([
    db.output.findMany({
      where: { companyId: activeCompany.id, workflowType: workflow },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        outputType: true,
        title: true,
        createdAt: true,
        confidence: true,
        sections: true,
      },
    }),
    db.job.findMany({
      where: {
        companyId: activeCompany.id,
        workflowType: workflow,
        status: { in: ["pending", "running"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        progress: true,
        createdAt: true,
      },
    }),
    db.output.findFirst({
      where: { companyId: activeCompany.id, workflowType: "diagnose" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        sections: true,
        company: { select: { name: true } },
      },
    }),
  ]);

  const diagnoseOutput = latestDiagnose ? {
    id: latestDiagnose.id,
    title: latestDiagnose.title,
    companyName: latestDiagnose.company.name,
    sections: latestDiagnose.sections as Record<string, unknown>,
  } : null;

  return {
    outputs: outputs.map((o) => {
      const secs = (o.sections ?? {}) as Record<string, unknown>;
      const execSummary = typeof secs.executive_summary === "string" ? secs.executive_summary : null;
      const confObj = secs.confidence as Record<string, unknown> | undefined;
      const confidenceRationale = typeof confObj?.rationale === "string" ? confObj.rationale : null;
      return {
        id: o.id,
        outputType: o.outputType,
        title: o.title,
        createdAt: o.createdAt.toISOString(),
        confidence: o.confidence,
        executiveSummary: execSummary,
        confidenceRationale,
      };
    }),
    activeJobs: activeJobs.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
    })),
    diagnoseOutput,
  };
}
