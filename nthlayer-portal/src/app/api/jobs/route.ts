import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements, canAccessCompany, getRemainingJobsThisMonth } from "@/lib/entitlements";
import { canAccessWorkflow } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { startAgentSession } from "@/lib/agents/start-session";
import type { WorkflowType } from "@/lib/types/output";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { companyId, workflowType } = body as { companyId: string; workflowType: WorkflowType };

  if (!companyId || !workflowType) {
    return NextResponse.json({ error: "companyId and workflowType required" }, { status: 400 });
  }

  // Check company access
  const hasAccess = await canAccessCompany(user.id, companyId);
  if (!hasAccess) return NextResponse.json({ error: "No access to company" }, { status: 403 });

  // Check entitlements
  const entitlements = await getUserEntitlements(user.id);
  if (!canAccessWorkflow(entitlements, workflowType)) {
    return NextResponse.json({ error: "upgrade_required", feature: `access_${workflowType}` }, { status: 403 });
  }

  // Check job limits
  const remaining = await getRemainingJobsThisMonth(user.id, entitlements);
  if (remaining === 0) {
    return NextResponse.json({ error: "job_limit_reached" }, { status: 429 });
  }

  // Create job
  const job = await db.job.create({
    data: {
      companyId,
      userId: user.id,
      workflowType,
      status: "pending",
      metadata: body.metadata ?? {},
    },
  });

  // Start agent session (awaited — short ~5s, creates session and sends initial message)
  await startAgentSession(job.id);

  return NextResponse.json({ jobId: job.id });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");

  const where: Record<string, unknown> = { userId: user.id };
  if (companyId) where.companyId = companyId;

  const jobs = await db.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      workflowType: true,
      status: true,
      progress: true,
      outputId: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ jobs });
}
