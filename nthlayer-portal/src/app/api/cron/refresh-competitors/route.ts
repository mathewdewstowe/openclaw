import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createStrategySession } from "@/lib/agents/strategy-sessions";

// Called daily by cron worker — finds CompetitorProfiles due for refresh and kicks off new jobs.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all profiles where lastRefreshedAt is null or past their interval
  const profiles = await db.competitorProfile.findMany({
    where: {
      OR: [
        { lastRefreshedAt: null },
        {
          lastRefreshedAt: {
            lt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // will compare against interval per profile below
          },
        },
      ],
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          url: true,
          sector: true,
          location: true,
          profile: true,
          users: {
            select: { userId: true, role: true },
            where: { role: "owner" },
            take: 1,
          },
        },
      },
    },
  });

  let triggered = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    // Check interval per profile
    if (profile.lastRefreshedAt) {
      const daysSince = (now.getTime() - profile.lastRefreshedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < profile.refreshIntervalDays) continue;
    }

    const ownerId = profile.company.users[0]?.userId;
    if (!ownerId) continue;

    const contextFields = profile.jobContext as Record<string, string> | null;
    if (!contextFields?.competitor_name) continue;

    const companyProfile = (profile.company.profile ?? {}) as Record<string, unknown>;
    const competitors = Array.isArray(companyProfile.competitors)
      ? (companyProfile.competitors as string[]).filter(Boolean)
      : [];

    try {
      const questions = Object.keys(contextFields).map((key) => ({
        id: key,
        question: key.replace(/_/g, " "),
        type: "text",
      }));

      const sessionId = await createStrategySession({
        stageId: "competitor_intel",
        stageName: "Competitor Intelligence",
        questions,
        answers: contextFields,
        company: {
          name: profile.company.name,
          url: profile.company.url,
          sector: profile.company.sector,
          location: profile.company.location,
          icp1: companyProfile.icp1 as string | null ?? null,
          icp2: companyProfile.icp2 as string | null ?? null,
          icp3: companyProfile.icp3 as string | null ?? null,
          competitors,
          competitorTarget: {
            name: contextFields.competitor_name,
            url: contextFields.competitor_url ?? "",
          },
        },
        priorReports: [],
      });

      // Create a job record for polling
      await db.job.create({
        data: {
          companyId: profile.companyId,
          userId: ownerId,
          workflowType: "competitor_intel",
          status: "running",
          metadata: { context: contextFields, sessionId, scheduledRefresh: true },
        },
      });

      // Update lastRefreshedAt immediately so we don't double-trigger
      await db.competitorProfile.update({
        where: { id: profile.id },
        data: { lastRefreshedAt: now },
      });

      triggered++;
    } catch (err) {
      errors.push(`${profile.name}: ${String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, triggered, errors });
}
