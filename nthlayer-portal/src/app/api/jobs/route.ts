import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements, canAccessCompany, getRemainingJobsThisMonth } from "@/lib/entitlements";
import { canAccessWorkflow } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { createStrategySession } from "@/lib/agents/strategy-sessions";
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

  // Fetch company data for the agent session
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      url: true,
      sector: true,
      location: true,
      profile: true,
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const profile = (company.profile ?? {}) as Record<string, unknown>;
  const competitors = Array.isArray(profile.competitors)
    ? (profile.competitors as string[]).filter(Boolean)
    : [];

  // Build questions from context metadata (WorkflowHub sends these as key-value pairs)
  const contextFields = ((body.metadata ?? {}) as Record<string, unknown>).context as Record<string, string> | undefined;
  const questions = contextFields
    ? Object.keys(contextFields).map((key) => ({ id: key, question: key.replace(/_/g, " "), type: "text" }))
    : [];
  const answers = contextFields ?? {};

  const STAGE_NAMES: Record<string, string> = {
    frame: "Frame",
    diagnose: "Diagnose",
    decide: "Decide",
    position: "Position",
    commit: "Commit",
    act: "Commit",
    competitor_intel: "Competitor Intelligence",
  };

  // Map "act" to "commit" since the unified path uses "commit" for the final stage
  const stageId = workflowType === "act" ? "commit" : workflowType;
  const stageName = STAGE_NAMES[workflowType] ?? workflowType;

  // Fetch prior stage reports for context cascade
  const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"];
  const currentIdx = STAGE_ORDER.indexOf(stageId);
  const priorReports: Array<{ stageId: string; stageName: string; summary: string }> = [];

  if (currentIdx > 0) {
    const priorOutputs = await db.output.findMany({
      where: {
        companyId,
        workflowType: { in: STAGE_ORDER.slice(0, currentIdx) },
      },
      select: { workflowType: true, sections: true },
      orderBy: { createdAt: "desc" },
    });
    const seen = new Set<string>();
    for (const o of priorOutputs) {
      if (!seen.has(o.workflowType)) {
        seen.add(o.workflowType);
        const s = o.sections as Record<string, unknown>;
        const summary = [
          s.executive_summary ? String(s.executive_summary) : "",
          s.what_matters ? String(s.what_matters) : "",
          s.recommendation ? String(s.recommendation) : "",
          s.business_implications ? String(s.business_implications) : "",
        ].filter(Boolean).join("\n\n");
        priorReports.push({
          stageId: o.workflowType,
          stageName: STAGE_NAMES[o.workflowType] ?? o.workflowType,
          summary,
        });
      }
    }
  }

  // Create agent session via the unified path
  const sessionId = await createStrategySession({
    stageId,
    stageName,
    questions,
    answers,
    company: {
      name: company.name,
      url: company.url,
      sector: company.sector,
      location: company.location,
      icp1: profile.icp1 as string | null ?? null,
      icp2: profile.icp2 as string | null ?? null,
      icp3: profile.icp3 as string | null ?? null,
      competitors,
    },
    priorReports,
  });

  // Create job record with sessionId so polling can find it
  const job = await db.job.create({
    data: {
      companyId,
      userId: user.id,
      workflowType: stageId,
      status: "running",
      metadata: { ...(body.metadata ?? {}), sessionId },
    },
  });

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
