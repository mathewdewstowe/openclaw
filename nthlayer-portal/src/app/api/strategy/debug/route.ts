import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import { checkStrategySession } from "@/lib/agents/strategy-sessions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyAccess = await getUserCompanies(user.id);
    const company = companyAccess[0]?.company;
    if (!company) {
      return NextResponse.json({ error: "No company" }, { status: 404 });
    }

    // Find running transformation jobs
    const runningJobs = await db.job.findMany({
      where: { companyId: company.id, status: "running" },
      select: { id: true, workflowType: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const results = [];

    for (const job of runningJobs) {
      const metadata = job.metadata as Record<string, unknown> | null;
      const transformationState = metadata?.transformationState as {
        stageId: string;
        stageName: string;
        agents: Record<string, { status: string; sessionId?: string }>;
      } | undefined;

      if (!transformationState) {
        results.push({
          jobId: job.id,
          workflowType: job.workflowType,
          type: "legacy",
          sessionId: metadata?.sessionId,
        });
        continue;
      }

      const agentChecks: Record<string, unknown> = {};

      for (const [name, agentState] of Object.entries(transformationState.agents)) {
        if (agentState.sessionId) {
          try {
            const check = await checkStrategySession(agentState.sessionId);
            agentChecks[name] = {
              storedStatus: agentState.status,
              liveCheck: check.status,
              sessionId: agentState.sessionId,
              hasSections: !!check.sections,
            };
          } catch (err) {
            agentChecks[name] = {
              storedStatus: agentState.status,
              liveCheck: "error",
              error: String(err),
              sessionId: agentState.sessionId,
            };
          }
        } else {
          agentChecks[name] = {
            storedStatus: agentState.status,
            sessionId: null,
            note: "No session created",
          };
        }
      }

      results.push({
        jobId: job.id,
        workflowType: job.workflowType,
        stageId: transformationState.stageId,
        createdAt: job.createdAt,
        agents: agentChecks,
      });
    }

    return NextResponse.json({ jobs: results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
