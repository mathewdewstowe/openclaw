import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
});

const ACT_AGENT_ID = "agent_011CZvZtmvNzntBKmhqtcwAS";
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

export async function startActSession(jobId: string): Promise<void> {
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
    await db.jobEvent.create({ data: { jobId, event: "started", metadata: { workflowType: "act" } } });

    let websiteSection = "";
    if (company.url) {
      const websiteText = await fetchWebsiteText(company.url);
      if (websiteText) websiteSection = `\n\n## Website Content\n${websiteText}`;
    }

    // Fetch all prior outputs for full strategic context
    const [diagnoseOutput, decideOutput, positionOutput] = await Promise.all([
      db.output.findFirst({
        where: { companyId: job.companyId, workflowType: "diagnose" },
        orderBy: { createdAt: "desc" },
        select: { sections: true },
      }),
      db.output.findFirst({
        where: { companyId: job.companyId, workflowType: "decide" },
        orderBy: { createdAt: "desc" },
        select: { sections: true },
      }),
      db.output.findFirst({
        where: { companyId: job.companyId, workflowType: "position" },
        orderBy: { createdAt: "desc" },
        select: { sections: true },
      }),
    ]);

    let priorOutputsSection = "";
    if (diagnoseOutput) {
      const ds = diagnoseOutput.sections as Record<string, unknown>;
      priorOutputsSection += `\n\n## Diagnose Output\n**Executive Summary:** ${ds.executive_summary ?? ""}\n**What Matters:** ${ds.what_matters ?? ""}\n**Recommendation:** ${ds.recommendation ?? ""}`;
    }
    if (decideOutput) {
      const ds = decideOutput.sections as Record<string, unknown>;
      priorOutputsSection += `\n\n## Decide Output\n**Executive Summary:** ${ds.executive_summary ?? ""}\n**Recommendation:** ${ds.recommendation ?? ""}`;
    }
    if (positionOutput) {
      const ds = positionOutput.sections as Record<string, unknown>;
      priorOutputsSection += `\n\n## Position Output\n**Executive Summary:** ${ds.executive_summary ?? ""}\n**Recommendation:** ${ds.recommendation ?? ""}`;
    }

    const jobMeta = (job.metadata ?? {}) as Record<string, unknown>;
    const ctx = jobMeta.context as Record<string, string> | undefined;
    let contextSection = "";
    if (ctx && Object.keys(ctx).length > 0) {
      const lines = [
        ctx.execution_owner ? `Execution owner: ${ctx.execution_owner}` : "",
        ctx.team_capacity ? `Team capacity for new strategic work: ${ctx.team_capacity}` : "",
        ctx.in_flight ? `Already in flight (can't move): ${ctx.in_flight}` : "",
        ctx.existing_okrs ? `Existing OKRs / board commitments: ${ctx.existing_okrs}` : "",
        ctx.biggest_blocker ? `Biggest single blocker: ${ctx.biggest_blocker}` : "",
      ].filter(Boolean);
      if (lines.length > 0) contextSection = `\n\n## Execution Context\n${lines.join("\n")}`;
    }

    const icps = [p.icp1, p.icp2, p.icp3].filter(Boolean).map((icp, i) => `${i + 1}. ${icp}`).join("\n");
    const competitors = Array.isArray(p.competitors) ? p.competitors.filter(Boolean).join(", ") : "";

    const userMessage = `Please produce a 90-day execution plan and decision memo for the following company.

## Company: ${company.name}
${company.url ? `Website: ${company.url}` : ""}
${company.sector ? `Sector: ${company.sector}` : ""}
${company.location ? `Location: ${company.location}` : ""}
${company.description ? `\nDescription: ${company.description}` : ""}
${icps ? `\n## Ideal Customer Profiles\n${icps}` : ""}
${p.bigBet ? `\n## One Big Bet\n${p.bigBet}` : ""}
${competitors ? `\n## Known Competitors\n${competitors}` : ""}
${websiteSection}${priorOutputsSection}${contextSection}

Produce a board-ready decision memo, a prioritised 90-day action plan with owners and deadlines, and the leading indicators that confirm the strategy is working.

Call the produce_strategic_diagnosis tool with your complete analysis.`;

    const session = await client.beta.sessions.create({
      agent: ACT_AGENT_ID,
      environment_id: ENVIRONMENT_ID,
      title: `Act — ${company.name}`,
      metadata: { jobId, companyName: company.name, workflowType: "act" },
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
