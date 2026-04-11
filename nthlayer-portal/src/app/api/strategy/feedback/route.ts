import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      workflowType: string;
      overallRating: number;
      accuracy?: number;
      depth?: number;
      actionability?: number;
      relevance?: number;
      comment?: string;
    };

    const { workflowType, overallRating, accuracy, depth, actionability, relevance, comment } = body;
    if (!workflowType || !overallRating) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Resolve companyId + outputId/jobId from most recent completed job
    const companies = await getUserCompanies(user.id);
    const companyId = companies[0]?.company?.id;
    if (!companyId) return NextResponse.json({ error: "No company found" }, { status: 404 });

    const latestJob = await db.job.findFirst({
      where: { userId: user.id, companyId, workflowType, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { id: true, outputId: true },
    });

    // Upsert: one feedback record per user+company+workflowType
    const existing = await (db as unknown as Record<string, unknown> & {
      outputFeedback: { findFirst: (args: unknown) => Promise<{ id: string } | null>; create: (args: unknown) => Promise<unknown>; update: (args: unknown) => Promise<unknown> }
    }).outputFeedback.findFirst({
      where: { userId: user.id, companyId, workflowType },
    });

    const data = {
      companyId,
      userId: user.id,
      workflowType,
      jobId: latestJob?.id ?? null,
      outputId: latestJob?.outputId ?? null,
      overallRating,
      ...(accuracy !== undefined ? { accuracy } : {}),
      ...(depth !== undefined ? { depth } : {}),
      ...(actionability !== undefined ? { actionability } : {}),
      ...(relevance !== undefined ? { relevance } : {}),
      ...(comment !== undefined ? { comment } : {}),
      updatedAt: new Date(),
    };

    const fb = (db as unknown as Record<string, unknown> & {
      outputFeedback: { create: (args: unknown) => Promise<{ id: string }>; update: (args: unknown) => Promise<{ id: string }> }
    }).outputFeedback;

    if (existing) {
      await fb.update({ where: { id: existing.id }, data });
    } else {
      await fb.create({ data });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Error:", err);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
