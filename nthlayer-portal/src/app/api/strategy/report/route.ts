import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import { createStrategySession, type PriorStageSummary } from "@/lib/agents/strategy-sessions";

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
    if (!VALID_STAGES.includes(stageId)) {
      return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
    }

    // Fetch legacy profile + new Company in parallel
    const [profile, companyAccess] = await Promise.all([
      db.companyProfile.findUnique({ where: { userId: user.id } }),
      getUserCompanies(user.id),
    ]);

    if (!profile || !profile.name) {
      return NextResponse.json({ error: "Company profile not found" }, { status: 404 });
    }

    const newCompany = companyAccess[0]?.company ?? null;

    const competitors = [
      profile.competitor1,
      profile.competitor2,
      profile.competitor3,
      profile.competitor4,
      profile.competitor5,
    ].filter((c): c is string => typeof c === "string" && c.trim().length > 0);

    const sessionId = await createStrategySession({
      stageId,
      stageName,
      questions,
      answers,
      persona,
      company: {
        name: profile.name,
        url: profile.url,
        sector: newCompany?.sector ?? null,
        location: profile.location,
        territory: Array.isArray(profile.territories) && profile.territories.length > 0
          ? profile.territories.join(", ")
          : null,
        icp1: profile.icp1,
        icp2: profile.icp2,
        icp3: profile.icp3,
        competitors,
      },
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
            metadata: { sessionId },
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
