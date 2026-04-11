import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStrategySession } from "@/lib/agents/strategy-sessions";
import { getUserCompanies } from "@/lib/entitlements";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const result = await checkStrategySession(sessionId);

  // When complete, persist the output and mark the job done
  if (result.status === "complete" && result.sections) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.warn("[status] No user found — skipping DB persist");
        return NextResponse.json(result);
      }

      // Find the job by sessionId in metadata (any status, so we don't miss it)
      const allJobs = await db.job.findMany({
        where: { userId: user.id },
        select: { id: true, companyId: true, workflowType: true, status: true, outputId: true, metadata: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      const job = allJobs.find(
        (j) => (j.metadata as Record<string, unknown> | null)?.sessionId === sessionId
      );

      // If the job already has an outputId, it was already persisted — skip
      if (job?.outputId) {
        return NextResponse.json(result);
      }

      // Determine companyId: from job if it exists, or from user's first company
      let companyId = job?.companyId;
      let workflowType = job?.workflowType ?? "frame";
      if (!companyId) {
        const companies = await getUserCompanies(user.id);
        companyId = companies[0]?.company?.id;
      }

      if (!companyId) {
        console.warn("[status] No companyId found — cannot persist output");
        return NextResponse.json(result);
      }

      const sections = result.sections as Record<string, unknown>;
      const confidence =
        typeof sections.confidence === "object" &&
        sections.confidence !== null &&
        "score" in sections.confidence
          ? Number((sections.confidence as { score: number }).score)
          : null;

      const output = await db.output.create({
        data: {
          companyId,
          workflowType,
          outputType: `${workflowType}_report`,
          title: `${workflowType.charAt(0).toUpperCase() + workflowType.slice(1)} Report`,
          sections: sections,
          confidence,
          sources: [],
          version: 1,
        },
      });

      if (job) {
        await db.job.update({
          where: { id: job.id },
          data: {
            status: "completed",
            outputId: output.id,
            completedAt: new Date(),
            progress: 100,
          },
        });
      } else {
        // No job record existed — create a completed one so the strategy page can find it
        await db.job.create({
          data: {
            companyId,
            userId: user.id,
            workflowType,
            status: "completed",
            outputId: output.id,
            completedAt: new Date(),
            progress: 100,
            metadata: { sessionId },
          },
        });
      }
    } catch (err) {
      console.error("[status] Failed to persist output:", err);
    }
  }

  return NextResponse.json(result);
}
