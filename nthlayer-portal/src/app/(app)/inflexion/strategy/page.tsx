import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StrategyFlow } from "@/components/strategy-flow-v2";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch in-progress and completed jobs in parallel
  const [runningJobs, completedJobs] = await Promise.all([
    db.job.findMany({
      where: { userId: user.id, status: "running" },
      select: { id: true, workflowType: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.job.findMany({
      where: { userId: user.id, status: "completed", outputId: { not: null } },
      select: { id: true, workflowType: true, outputId: true, completedAt: true },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const initialRunningJobs = runningJobs
    .map((j) => ({
      stageId: j.workflowType,
      sessionId: (j.metadata as Record<string, unknown> | null)?.sessionId as string | undefined,
    }))
    .filter((j): j is { stageId: string; sessionId: string } => !!j.sessionId);

  // Load output sections for completed jobs (most recent per stage)
  // completedJobs is sorted newest first; build a map of outputId → stageId
  const outputIdToStage: Record<string, string> = {};
  const seenStages = new Set<string>();
  for (const j of completedJobs) {
    if (j.outputId && !seenStages.has(j.workflowType)) {
      outputIdToStage[j.outputId] = j.workflowType;
      seenStages.add(j.workflowType);
    }
  }
  const completedOutputIds = Object.keys(outputIdToStage);

  const outputs = completedOutputIds.length > 0
    ? await db.output.findMany({
        where: { id: { in: completedOutputIds } },
        select: { id: true, sections: true },
      })
    : [];

  // Build map: stageId → sections (JSON serialized)
  const completedOutputsByStage: Record<string, Record<string, unknown>> = {};
  for (const output of outputs) {
    const stageId = outputIdToStage[output.id];
    if (stageId) {
      completedOutputsByStage[stageId] = JSON.parse(JSON.stringify(output.sections)) as Record<string, unknown>;
    }
  }

  return (
    <StrategyFlow
      initialRunningJobs={initialRunningJobs}
      initialCompletedOutputs={completedOutputsByStage}
    />
  );
}
