import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
});

const POSITION_AGENT_ID = "agent_011CZvZtkfyRGNw3S3RMjHMj";
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

export async function startPositionSession(jobId: string): Promise<void> {
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
    await db.jobEvent.create({ data: { jobId, event: "started", metadata: { workflowType: "position" } } });

    let websiteSection = "";
    if (company.url) {
      const websiteText = await fetchWebsiteText(company.url);
      if (websiteText) websiteSection = `\n\n## Website Content\n${websiteText}`;
    }

    // Fetch latest diagnose + decide outputs
    const [diagnoseOutput, decideOutput] = await Promise.all([
      db.output.findFirst({
        where: { companyId: job.companyId, workflowType: "diagnose" },
        orderBy: { createdAt: "desc" },
        select: { sections: true, createdAt: true },
      }),
      db.output.findFirst({
        where: { companyId: job.companyId, workflowType: "decide" },
        orderBy: { createdAt: "desc" },
        select: { sections: true, createdAt: true },
      }),
    ]);

    let priorOutputsSection = "";
    if (diagnoseOutput) {
      const ds = diagnoseOutput.sections as Record<string, unknown>;
      priorOutputsSection += `\n\n## Diagnose Output\n**Executive Summary:** ${ds.executive_summary ?? ""}\n**Recommendation:** ${ds.recommendation ?? ""}`;
    }
    if (decideOutput) {
      const ds = decideOutput.sections as Record<string, unknown>;
      priorOutputsSection += `\n\n## Decide Output\n**Executive Summary:** ${ds.executive_summary ?? ""}\n**Recommendation:** ${ds.recommendation ?? ""}`;
    }

    const jobMeta = (job.metadata ?? {}) as Record<string, unknown>;
    const ctx = jobMeta.context as Record<string, string> | undefined;
    let contextSection = "";
    if (ctx && Object.keys(ctx).length > 0) {
      const lines = [
        ctx.pricing_model ? `Current pricing model: ${ctx.pricing_model}` : "",
        ctx.avg_deal_size ? `Average deal size / ACV: ${ctx.avg_deal_size}` : "",
        ctx.why_win ? `Why they win deals: ${ctx.why_win}` : "",
        ctx.why_lose ? `Why they lose deals: ${ctx.why_lose}` : "",
        ctx.customer_language ? `How customers describe them: ${ctx.customer_language}` : "",
      ].filter(Boolean);
      if (lines.length > 0) contextSection = `\n\n## Positioning Context\n${lines.join("\n")}`;
    }

    const icps = [p.icp1, p.icp2, p.icp3].filter(Boolean).map((icp, i) => `${i + 1}. ${icp}`).join("\n");
    const competitors = Array.isArray(p.competitors) ? p.competitors.filter(Boolean).join(", ") : "";

    const userMessage = `Please produce a positioning analysis for the following company.

## Company: ${company.name}
${company.url ? `Website: ${company.url}` : ""}
${company.sector ? `Sector: ${company.sector}` : ""}
${company.location ? `Location: ${company.location}` : ""}
${company.description ? `\nDescription: ${company.description}` : ""}
${icps ? `\n## Ideal Customer Profiles\n${icps}` : ""}
${p.inflectionPoint ? `\n## Inflection Point\n${p.inflectionPoint}` : ""}
${p.bigBet ? `\n## One Big Bet\n${p.bigBet}` : ""}
${competitors ? `\n## Known Competitors\n${competitors}` : ""}
${websiteSection}${priorOutputsSection}${contextSection}

Stress-test their ICP fit, pricing model, GTM motion, narrative, and competitive moat. Tell them where they're exposed and what to tighten.

Call the produce_strategic_diagnosis tool with your complete analysis.`;

    const session = await client.beta.sessions.create({
      agent: POSITION_AGENT_ID,
      environment_id: ENVIRONMENT_ID,
      title: `Position — ${company.name}`,
      metadata: { jobId, companyName: company.name, workflowType: "position" },
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
