import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStrategySession } from "@/lib/agents/strategy-sessions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await db.job.findUnique({
    where: { id },
    select: { status: true, progress: true, outputId: true, errorMessage: true, metadata: true, companyId: true, workflowType: true },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Advance the agent on each poll (short operation ~1s)
  if (job.status === "running" || job.status === "pending") {
    const meta = (job.metadata ?? {}) as Record<string, unknown>;
    const sessionId = meta.sessionId as string | undefined;

    if (sessionId) {
      try {
        const result = await checkStrategySession(sessionId);

        if (result.status === "complete" && result.sections) {
          const sections = result.sections as Record<string, unknown>;
          const confidence =
            typeof sections.confidence === "object" &&
            sections.confidence !== null &&
            "score" in sections.confidence
              ? Number((sections.confidence as { score: number }).score)
              : null;

          const output = await db.output.create({
            data: {
              companyId: job.companyId,
              workflowType: job.workflowType,
              outputType: `${job.workflowType}_report`,
              title: `${job.workflowType.charAt(0).toUpperCase() + job.workflowType.slice(1)} Report`,
              sections: sections as object,
              confidence,
              sources: [],
              version: 1,
            },
          });

          await db.job.update({
            where: { id },
            data: { status: "completed", outputId: output.id, completedAt: new Date(), progress: 100 },
          });

          const updated = await db.job.findUnique({
            where: { id },
            select: { status: true, progress: true, outputId: true, errorMessage: true },
          });
          return NextResponse.json(updated ?? job);
        }

        if (result.status === "failed") {
          await db.job.update({
            where: { id },
            data: { status: "failed", errorMessage: "Agent session terminated without producing output" },
          });
        }
      } catch (err) {
        console.error(`[job-status] Error checking session for job ${id}:`, err);
      }
    }

    // Re-fetch after potential update
    const updated = await db.job.findUnique({
      where: { id },
      select: { status: true, progress: true, outputId: true, errorMessage: true },
    });
    return NextResponse.json(updated ?? job);
  }

  return NextResponse.json(job);
}
