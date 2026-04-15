import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

function buildPersonaChallengeGuidance(persona: string | undefined): string {
  if (!persona) return "";
  const lower = persona.toLowerCase();
  if (lower.includes("pe partner") || lower.includes("pe principal")) {
    return " You are challenging through the lens of a PE partner: prioritise EBITDA assumptions, capital efficiency, exit readiness, and whether the investment thesis holds under stress. Push hard on any claim not grounded in financial evidence.";
  }
  if (lower.includes("vc investor") || lower.includes("vc ")) {
    return " You are challenging through the lens of a VC investor: pressure-test TAM sizing, growth assumptions, competitive moat, and funding narrative. Flag any market sizing that lacks bottom-up validation.";
  }
  if (lower.includes("portfolio company ceo") || lower.includes("ceo")) {
    return " You are challenging through the lens of a portfolio company CEO: focus on execution risk, organisational capacity, P&L reality, and whether the team can actually deliver this. Translate strategic abstractions into concrete operational questions.";
  }
  if (lower.includes("portfolio leadership") || lower.includes("leadership team")) {
    return " You are challenging through the lens of a portfolio leadership team: surface cross-functional tensions, resource conflicts, and alignment gaps. Identify the highest-probability execution failure modes.";
  }
  if (lower.includes("advisor") || lower.includes("fractional") || lower.includes("cpo")) {
    return " You are challenging as a trusted independent advisor: apply the standard of a board-ready outside perspective. Do not validate what the evidence does not support. Flag framework misapplication and unexamined options.";
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      priorSections: Record<string, Record<string, unknown>>;
      currentStageId?: string;
      currentStageName?: string;
      currentAnswers?: Record<string, unknown>;
      persona?: string;
    };
    const { priorSections, currentStageId, currentStageName, currentAnswers, persona } = body;

    // Build a summary of all prior stage outputs
    const stageSummaries = Object.entries(priorSections).map(([stageId, sections]) => {
      const s = sections as Record<string, unknown>;
      const parts: string[] = [`=== ${stageId.toUpperCase()} STAGE ===`];
      if (s.executive_summary) parts.push(`Executive Summary: ${String(s.executive_summary).slice(0, 500)}`);
      if (s.recommendation) parts.push(`Recommendation: ${String(s.recommendation).slice(0, 500)}`);
      if (Array.isArray(s.assumptions)) {
        const texts = (s.assumptions as (string | Record<string, unknown>)[]).slice(0, 5).map((a) =>
          typeof a === "string" ? a : (a.text as string) ?? JSON.stringify(a)
        );
        parts.push(`Assumptions: ${texts.join("; ")}`);
      }
      if (Array.isArray(s.risks)) {
        const riskTexts = (s.risks as (string | Record<string, unknown>)[]).slice(0, 3).map((r) =>
          typeof r === "string" ? r : (r.risk as string) ?? JSON.stringify(r)
        );
        parts.push(`Risks: ${riskTexts.join("; ")}`);
      }
      if (Array.isArray(s.kill_criteria)) {
        const killTexts = (s.kill_criteria as Record<string, unknown>[]).slice(0, 3).map((k) =>
          typeof k.criterion === "string" ? k.criterion : JSON.stringify(k)
        );
        parts.push(`Kill Criteria: ${killTexts.join("; ")}`);
      }
      const conf = s.confidence as { score?: number } | undefined;
      if (conf?.score) parts.push(`Confidence: ${Math.round(conf.score * 100)}%`);
      return parts.join("\n");
    }).join("\n\n");

    // Add current stage answers as context
    let currentStageContext = "";
    if (currentStageId && currentStageName && currentAnswers && Object.keys(currentAnswers).length > 0) {
      const answerLines = Object.entries(currentAnswers)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: ${v.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ")}`;
          return `${k}: ${String(v).slice(0, 300)}`;
        });
      if (answerLines.length > 0) {
        currentStageContext = `\n\n=== CURRENT STAGE: ${currentStageName.toUpperCase()} (answers being submitted) ===\n${answerLines.join("\n")}`;
      }
    }

    const hasContext = stageSummaries.trim().length > 0 || currentStageContext.trim().length > 0;
    if (!hasContext) {
      return NextResponse.json({ challenges: [] });
    }

    const personaGuidance = buildPersonaChallengeGuidance(persona);
    const systemPrompt = `You are a senior strategy advisor acting as a red team challenger. Your job is to identify the most significant weaknesses, contradictions, and blind spots in a strategic analysis before the report is generated. Be direct, specific, and commercially grounded. Do not be diplomatic about flaws.${personaGuidance}`;

    const stageLabel = currentStageName ?? "this stage";
    const userMessage = `Review this strategic analysis and identify the 3-5 most important challenges, contradictions, or blind spots that should be addressed before generating the ${stageLabel} report. For each, give a one-line title and a 2-3 sentence explanation of why it matters.

${stageSummaries}${currentStageContext}

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
