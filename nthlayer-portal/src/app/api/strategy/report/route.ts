import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import { createStrategySession, createTransformationSession, createSynthesisSession, TRANSFORMATION_STAGE_IDS, type PriorStageSummary } from "@/lib/agents/strategy-sessions";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { stageId, stageName, questions, answers, priorReports, persona } = body as {
      stageId: string;
      stageName: string;
      questions: Array<{ id: string; question: string; type: string }>;
      answers: Record<string, string | string[] | { selection: string; freetext: string }>;
      priorReports?: PriorStageSummary[];
      persona?: string;
    };

    if (!stageId || !stageName || !questions || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const VALID_STAGES = ["frame", "diagnose", "decide", "position", "commit"];
    const isTransformation = TRANSFORMATION_STAGE_IDS.includes(stageId);
    const isSynthesis = stageId === "synthesis";
    if (!VALID_STAGES.includes(stageId) && !isTransformation && !isSynthesis) {
      return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
    }

    // Fetch company from new Company model
    const companyAccess = await getUserCompanies(user.id);
    const newCompany = companyAccess[0]?.company ?? null;

    if (!newCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyProfile = (newCompany as unknown as { profile?: Record<string, unknown> | null }).profile ?? {};

    const competitors = (Array.isArray(companyProfile.competitors)
      ? (companyProfile.competitors as string[])
      : []
    ).filter((c) => typeof c === "string" && c.trim().length > 0);

    const companyContext = {
      name: newCompany.name,
      url: newCompany.url ?? null,
      sector: newCompany.sector ?? null,
      location: (newCompany as unknown as { location?: string | null }).location ?? null,
      territory: typeof companyProfile.territory === "string" ? companyProfile.territory : null,
      icp1: typeof companyProfile.icp1 === "string" ? companyProfile.icp1 : null,
      icp2: typeof companyProfile.icp2 === "string" ? companyProfile.icp2 : null,
      icp3: typeof companyProfile.icp3 === "string" ? companyProfile.icp3 : null,
      competitors,
    };

    if (isSynthesis) {
      // ── Synthesis trigger (or return existing running job) ──
      const companyId = newCompany?.id;
      if (!companyId) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }
      // Check for an already-running synthesis job
      const existingJob = await db.job.findFirst({
        where: { companyId, workflowType: "synthesis", status: "running" },
        select: { id: true },
      });
      if (existingJob) {
        return NextResponse.json({ jobId: existingJob.id });
      }
      const { jobId } = await createSynthesisSession(companyId, user.id, companyContext);
      return NextResponse.json({ jobId });
    }

    if (isTransformation) {
      // ── Transformation multi-agent flow ──
      const transformationState = await createTransformationSession({
        stageId,
        stageName,
        questions,
        answers,
        persona,
        company: companyContext,
        priorReports: priorReports ?? [],
      });

      const companyId = newCompany?.id;
      let jobId: string | undefined;
      if (companyId) {
        try {
          const job = await db.job.create({
            data: {
              companyId,
              userId: user.id,
              workflowType: stageId,
              status: "running",
              metadata: { transformationState, answers, questions } as object,
            },
          });
          jobId = job.id;

          // Mark any existing synthesis Output as stale when a prior stage is re-run
          const existingSynthesis = await db.output.findFirst({
            where: { companyId, workflowType: "synthesis" },
            orderBy: { createdAt: "desc" },
          });
          if (existingSynthesis) {
            await db.output.update({
              where: { id: existingSynthesis.id },
              data: {
                sections: {
                  ...(existingSynthesis.sections as object),
                  _stale: true,
                  _staledBy: stageId,
                } as object,
              },
            });
          }
        } catch {
          // Non-fatal
        }
      }

      return NextResponse.json({ jobId });
    }

    // ── Legacy single-agent flow ──
    const sessionId = await createStrategySession({
      stageId,
      stageName,
      questions,
      answers,
      persona,
      company: companyContext,
      priorReports: priorReports ?? [],
    });

    // Persist the running job so it survives logout/page reload
    try {
      const companyId = newCompany?.id;
      if (companyId) {
        await db.job.create({
          data: {
            companyId,
            userId: user.id,
            workflowType: stageId,
            status: "running",
            metadata: { sessionId, answers },
          },
        });
      }
    } catch {
      // Non-fatal — session still runs even if job record creation fails
    }

    return NextResponse.json({ sessionId });
  } catch (err) {
    console.error("Strategy report error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start strategy session" },
      { status: 500 }
    );
  }
}
