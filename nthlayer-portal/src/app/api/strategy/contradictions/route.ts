import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      currentStageId: string;
      currentAnswers: Record<string, unknown>;
      priorSections: Record<string, Record<string, unknown>>;
    };
    const { currentStageId, currentAnswers, priorSections } = body;

    if (!priorSections || Object.keys(priorSections).length === 0) {
      return NextResponse.json({ contradictions: [] });
    }

    const answerText = Object.entries(currentAnswers)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("\n");

    const priorText = Object.entries(priorSections).map(([stageId, s]) => {
      const sec = s as Record<string, unknown>;
      return `${stageId.toUpperCase()}: ${String(sec.executive_summary ?? "").slice(0, 300)} | Assumptions: ${Array.isArray(sec.assumptions) ? (sec.assumptions as string[]).slice(0, 3).join("; ") : ""}`;
    }).join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `You are a strategy consistency checker. Identify direct contradictions between the user's current answers and what prior stage analysis found. Only flag genuine contradictions, not differences of emphasis.

Current stage (${currentStageId}) answers:
${answerText}

Prior stage findings:
${priorText}

Return ONLY a JSON array. If no contradictions found return []. Format:
[{ "field": "which answer field", "issue": "one sentence explaining the contradiction", "priorStage": "which stage found the conflict" }]

Return raw JSON only.`
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    let contradictions: unknown[] = [];
    try {
      const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      contradictions = JSON.parse(clean);
      if (!Array.isArray(contradictions)) contradictions = [];
    } catch {
      contradictions = [];
    }

    return NextResponse.json({ contradictions });
  } catch (err) {
    console.error("[contradictions] Error:", err);
    return NextResponse.json({ contradictions: [] });
  }
}
