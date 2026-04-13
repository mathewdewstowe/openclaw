import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { priorSections: Record<string, Record<string, unknown>> };
    const { priorSections } = body;

    // Build a summary of all prior stage outputs
    const stageSummaries = Object.entries(priorSections).map(([stageId, sections]) => {
      const s = sections as Record<string, unknown>;
      const parts: string[] = [`=== ${stageId.toUpperCase()} STAGE ===`];
      if (s.executive_summary) parts.push(`Executive Summary: ${String(s.executive_summary).slice(0, 500)}`);
      if (s.recommendation) parts.push(`Recommendation: ${String(s.recommendation).slice(0, 500)}`);
      if (Array.isArray(s.assumptions)) parts.push(`Assumptions: ${(s.assumptions as string[]).slice(0, 5).join("; ")}`);
      const conf = s.confidence as { score?: number } | undefined;
      if (conf?.score) parts.push(`Confidence: ${Math.round(conf.score * 100)}%`);
      return parts.join("\n");
    }).join("\n\n");

    const systemPrompt = `You are a senior strategy advisor acting as a red team challenger. Your job is to identify the most significant weaknesses, contradictions, and blind spots in a multi-stage strategic analysis before it is committed to. Be direct, specific, and commercially grounded. Do not be diplomatic about flaws.`;

    const userMessage = `Review this multi-stage strategic analysis and identify the 5-7 most important challenges, contradictions, or blind spots that should be addressed before committing to this strategy. For each, give a one-line title and a 2-3 sentence explanation of why it matters.

${stageSummaries}

Return ONLY a JSON array of challenge objects with this structure:
[
  { "title": "Short challenge title", "detail": "2-3 sentence explanation of the risk or contradiction", "severity": "critical" | "high" | "medium" }
]

Return raw JSON only, no markdown, no explanation.`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";

    // Parse JSON, handle potential markdown wrapping
    let challenges: unknown[] = [];
    try {
      const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      challenges = JSON.parse(clean);
    } catch {
      challenges = [];
    }

    return NextResponse.json({ challenges });
  } catch (err) {
    console.error("[red-team] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
