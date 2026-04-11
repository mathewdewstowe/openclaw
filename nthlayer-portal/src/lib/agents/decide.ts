import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
});

const DECIDE_AGENT_ID = "agent_011CZvZtjfw9foNabrMh92ii";
const ENVIRONMENT_ID = "env_01BG6FT972a92oDBJcBMwt2y";

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(normalized, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Inflexion/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000) || null;
  } catch {
    return null;
  }
}

// ─── Start session (phase 1, ~5s) ────────────────────────────

export async function startDecideSession(jobId: string): Promise<void> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      company: {
        select: { name: true, url: true, sector: true, location: true, description: true, profile: true },
      },
    },
  });
  if (!job) return;

  const company = job.company;
  const p = (company.profile ?? {}) as Record<string, unknown>;

  try {
    await db.job.update({ where: { id: jobId }, data: { status: "running", startedAt: new Date(), progress: 10 } });
    await db.jobEvent.create({ data: { jobId, event: "started", metadata: { workflowType: "decide" } } });

    // Fetch website
    let websiteSection = "";
    if (company.url) {
      const websiteText = await fetchWebsiteText(company.url);
      if (websiteText) websiteSection = `\n\n## Website Content\n${websiteText}`;
    }

    // Fetch latest diagnose output for this company
    const diagnoseOutput = await db.output.findFirst({
      where: { companyId: job.companyId, workflowType: "diagnose" },
      orderBy: { createdAt: "desc" },
      select: { sections: true, createdAt: true },
    });

    let diagnoseSection = "";
    if (diagnoseOutput) {
      const ds = diagnoseOutput.sections as Record<string, unknown>;
      diagnoseSection = `\n\n## Diagnose Output (${diagnoseOutput.createdAt.toLocaleDateString()})
**Executive Summary:** ${ds.executive_summary ?? ""}
**What Matters:** ${ds.what_matters ?? ""}
**Recommendation:** ${ds.recommendation ?? ""}`;
    }

    // Additional context from job metadata
    const jobMeta = (job.metadata ?? {}) as Record<string, unknown>;
    const ctx = jobMeta.context as Record<string, string> | undefined;
    let contextSection = "";
    if (ctx && Object.keys(ctx).length > 0) {
      const bets = [ctx.big_bet_1, ctx.big_bet_2, ctx.big_bet_3].filter(Boolean);
      const lines = [
        bets.length > 0 ? `Strategic bets being considered:\n${bets.map((b, i) => `  ${i + 1}. ${b}`).join("\n")}` : "",
        ctx.budget ? `Budget available: ${ctx.budget}` : "",
        ctx.time_horizon ? `Time horizon: ${ctx.time_horizon}` : "",
        ctx.decisions_in_play ? `Decisions actively in play: ${ctx.decisions_in_play}` : "",
        ctx.ruled_out ? `Already ruled out: ${ctx.ruled_out}` : "",
        ctx.board_constraints ? `Board/investor constraints: ${ctx.board_constraints}` : "",
      ].filter(Boolean);
      if (lines.length > 0) contextSection = `\n\n## Decision Context\n${lines.join("\n")}`;
    }

    // ICPs and competitors
    const icps = [p.icp1, p.icp2, p.icp3].filter(Boolean).map((icp, i) => `${i + 1}. ${icp}`).join("\n");
    const competitors = Array.isArray(p.competitors) ? p.competitors.filter(Boolean).join(", ") : "";

    const userMessage = `Please produce a strategic decision analysis for the following company.

## Company: ${company.name}
${company.url ? `Website: ${company.url}` : ""}
${company.sector ? `Sector: ${company.sector}` : ""}
${company.location ? `Location: ${company.location}` : ""}
${company.description ? `\nDescription: ${company.description}` : ""}
${icps ? `\n## Ideal Customer Profiles\n${icps}` : ""}
${p.inflectionPoint ? `\n## Inflection Point\n${p.inflectionPoint}` : ""}
${p.bigBet ? `\n## One Big Bet\n${p.bigBet}` : ""}
${competitors ? `\n## Known Competitors\n${competitors}` : ""}
${websiteSection}${diagnoseSection}${contextSection}

Map their real strategic options, pressure-test build/buy/partner decisions, identify which investments compound, and make a clear recommendation.

Call the produce_strategic_diagnosis tool with your complete analysis.`;

    const session = await client.beta.sessions.create({
      agent: DECIDE_AGENT_ID,
      environment_id: ENVIRONMENT_ID,
      title: `Decide — ${company.name}`,
      metadata: { jobId, companyName: company.name, workflowType: "decide" },
    });

    await client.beta.sessions.events.send(session.id, {
      events: [{ type: "user.message", content: [{ type: "text", text: userMessage }] }],
    });

    // Save sessionId to job metadata so check phase can find it
    await db.job.update({
      where: { id: jobId },
      data: {
        progress: 20,
        metadata: { ...jobMeta, sessionId: session.id },
      },
    });
    await db.jobEvent.create({ data: { jobId, event: "session_created", metadata: { sessionId: session.id } } });

  } catch (err) {
    await db.job.update({ where: { id: jobId }, data: { status: "failed", errorMessage: String(err) } });
    await db.jobEvent.create({ data: { jobId, event: "failed", metadata: { error: String(err) } } });
    throw err;
  }
}
