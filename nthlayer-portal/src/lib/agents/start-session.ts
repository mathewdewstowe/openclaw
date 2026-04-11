import { db } from "@/lib/db";
import { startDiagnoseSession } from "./diagnose";
import { startDecideSession } from "./decide";
import { startPositionSession } from "./position";
import { startActSession } from "./act";

/**
 * Routes to the correct start function based on the job's workflowType.
 * Called in the POST /api/jobs handler — awaited (~5s), then returns.
 */
export async function startAgentSession(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { workflowType: true } });
  if (!job) return;

  if (job.workflowType === "diagnose") return startDiagnoseSession(jobId);
  if (job.workflowType === "decide") return startDecideSession(jobId);
  if (job.workflowType === "position") return startPositionSession(jobId);
  if (job.workflowType === "act") return startActSession(jobId);

  // No-op for unsupported workflow types (mock fallback handles them)
}
