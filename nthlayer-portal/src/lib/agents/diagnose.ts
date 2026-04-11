import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
});

// ─── Config ───────────────────────────────────────────────────
// Agent created in Claude Console workspace — appears in Sessions tab
const DIAGNOSE_AGENT_ID = "agent_011CZumeXoZuFJ35jRA8Ta2R";
const ENVIRONMENT_ID = "env_01BG6FT972a92oDBJcBMwt2y";

// ─── Website fetcher ──────────────────────────────────────────

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(normalized, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Inflexion/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip tags, collapse whitespace, cap at 4000 chars
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
    return text || null;
  } catch {
    return null;
  }
}

// ─── Context builder ──────────────────────────────────────────

function buildCompanyContext(company: {
  name: string;
  url: string | null;
  sector: string | null;
  location: string | null;
  description: string | null;
  profile: Record<string, unknown> | null;
}): string {
  const p = company.profile ?? {};
  const lines: string[] = [
    `## Company: ${company.name}`,
    company.url ? `Website: ${company.url}` : "",
    company.sector ? `Sector: ${company.sector}` : "",
    company.location ? `Location: ${company.location}` : "",
    company.description ? `\nDescription: ${company.description}` : "",
  ].filter(Boolean);

  if (p.userType) {
    lines.push(`\nUser type: ${p.userType === "operator" ? "Operator (CEO/leadership running the business)" : "Investor (portfolio oversight)"}`);
  }

  if (p.inflectionPoint) {
    lines.push(`\n## Inflection Point\n${p.inflectionPoint}`);
  }

  const icps = [p.icp1, p.icp2, p.icp3].filter(Boolean);
  if (icps.length > 0) {
    lines.push(`\n## Ideal Customer Profiles\n${icps.map((icp, i) => `${i + 1}. ${icp}`).join("\n")}`);
  }

  if (p.bigBet) {
    lines.push(`\n## One Big Bet\n${p.bigBet}`);
  }

  const risks = Array.isArray(p.risks) ? p.risks.filter(Boolean) : [];
  if (risks.length > 0) {
    lines.push(`\n## Known Risks (as stated by leadership)\n${risks.map((r: unknown, i: number) => `${i + 1}. ${r}`).join("\n")}`);
  }

  const competitors = Array.isArray(p.competitors) ? p.competitors.filter(Boolean) : [];
  if (competitors.length > 0) {
    lines.push(`\n## Known Competitors\n${competitors.join(", ")}`);
  }

  return lines.join("\n");
}

// ─── Start session (phase 1, ~5s) ────────────────────────────

export async function startDiagnoseSession(jobId: string): Promise<void> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      company: {
        select: {
          name: true,
          url: true,
          sector: true,
          location: true,
          description: true,
          profile: true,
        },
      },
    },
  });
  if (!job) return;

  const company = job.company;

  try {
    await db.job.update({ where: { id: jobId }, data: { status: "running", startedAt: new Date(), progress: 10 } });
    await db.jobEvent.create({ data: { jobId, event: "started", metadata: { workflowType: "diagnose" } } });

    const companyContext = buildCompanyContext({
      name: company.name,
      url: company.url,
      sector: company.sector,
      location: company.location,
      description: company.description,
      profile: company.profile as Record<string, unknown> | null,
    });

    // Fetch website content if URL is provided
    let websiteSection = "";
    if (company.url) {
      const websiteText = await fetchWebsiteText(company.url);
      if (websiteText) {
        websiteSection = `\n\n## Website Content (fetched from ${company.url})\n${websiteText}`;
      }
    }

    // Include additional context from the form if provided
    const jobMeta = (job.metadata ?? {}) as Record<string, unknown>;
    const additionalContext = jobMeta.context as Record<string, string> | undefined;
    let contextSection = "";
    if (additionalContext && Object.keys(additionalContext).length > 0) {
      const contextLines = [
        additionalContext.inflection_point ? `Inflection point: ${additionalContext.inflection_point}` : "",
        additionalContext.revenue_range ? `Revenue range: ${additionalContext.revenue_range}` : "",
        additionalContext.growth_rate ? `Growth rate: ${additionalContext.growth_rate}` : "",
        additionalContext.team_size ? `Team size: ${additionalContext.team_size}` : "",
        additionalContext.recent_change ? `Biggest change in last 6 months: ${additionalContext.recent_change}` : "",
        additionalContext.recent_win ? `Biggest recent win: ${additionalContext.recent_win}` : "",
        additionalContext.recent_loss ? `Biggest recent setback: ${additionalContext.recent_loss}` : "",
      ].filter(Boolean);
      if (contextLines.length > 0) {
        contextSection = `\n\n## Additional Context\n${contextLines.join("\n")}`;
      }
    }

    const userMessage = `Please produce a strategic diagnosis for the following company.

${companyContext}${websiteSection}${contextSection}

Analyse their strategic situation thoroughly. Consider:
- What the inflection point they've described actually means structurally
- What competitive forces are at play given their sector and known competitors
- Whether their stated "one big bet" is the right move given the evidence
- What risks they may have missed or underestimated
- What they should actually do, in what order

Call the produce_strategic_diagnosis tool with your complete analysis.`;

    // Create a session linked to the Diagnose agent — appears in Console Sessions tab
    const session = await client.beta.sessions.create({
      agent: DIAGNOSE_AGENT_ID,
      environment_id: ENVIRONMENT_ID,
      title: `Diagnose — ${company.name}`,
      metadata: { jobId, companyName: company.name, workflowType: "diagnose" },
    });

    // Send the user message to the session
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
