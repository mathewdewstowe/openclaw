import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyName, persona, priorSections } = await req.json() as {
    companyName: string;
    persona?: string;
    priorSections: Record<string, Record<string, unknown>>;
  };

  // Build context from each completed prior stage
  const stageOrder = ["frame", "diagnose", "decide", "position"];
  const stageNames: Record<string, string> = { frame: "Frame", diagnose: "Diagnose", decide: "Decide", position: "Position" };

  const contextBlocks = stageOrder
    .filter((s) => priorSections[s])
    .map((s) => {
      const secs = priorSections[s];
      const execSummary = typeof secs.executive_summary === "string" ? secs.executive_summary : "";
      const rec = typeof secs.recommendation === "string" ? secs.recommendation : "";
      const actions = Array.isArray(secs.actions) ? (secs.actions as Array<{ action?: string; priority?: string }>).slice(0, 3).map((a) => `- ${a.action ?? ""}`).join("\n") : "";
      return `### ${stageNames[s]} Stage\n${execSummary}\n\nRecommendation: ${rec}\n${actions ? `\nTop actions:\n${actions}` : ""}`;
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a senior strategy advisor generating strategic bet suggestions for ${companyName}${persona ? `, framed for a ${persona}` : ""}.

A strategic bet is a resource-backed, time-bound commitment to a specific direction. Each bet has four components:
- **Bet name**: A short, memorable label (3–6 words)
- **Action**: The specific thing the business will DO (concrete, resourced, owned)
- **Outcome**: The measurable result expected if the action succeeds (quantified where possible)
- **Hypothesis**: "We believe [action] will result in [outcome] because [rationale drawn from evidence]"

Rules:
- Generate EXACTLY 8 bets
- Derive every bet directly from the prior stage analysis — nothing invented
- Range from core/safe bets to bold/transformational bets
- Each bet must be genuinely distinct — no near-duplicates
- Actions must be specific enough to assign an owner
- Outcomes must be measurable within 12 months
- Hypotheses must reference the evidence from prior stages
- Return ONLY valid JSON — no markdown, no explanation, no preamble

Return format — a JSON array of exactly 8 objects:
[
  {
    "Bet name": "...",
    "Action": "...",
    "Outcome": "...",
    "Hypothesis": "..."
  },
  ...
]`;

  const userPrompt = `Here is the strategic analysis completed so far for ${companyName}:

${contextBlocks}

Based on this analysis, generate 8 strategic bets the business should consider committing to. Return only the JSON array.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON — strip any accidental markdown fences
    const clean = text.replace(/^```json?\n?/i, "").replace(/\n?```$/, "").trim();
    const bets = JSON.parse(clean) as Array<{ "Bet name": string; "Action": string; "Outcome": string; "Hypothesis": string }>;

    if (!Array.isArray(bets)) throw new Error("Response was not an array");

    return NextResponse.json({ bets });
  } catch (err) {
    console.error("[suggest-bets] Failed:", err);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
