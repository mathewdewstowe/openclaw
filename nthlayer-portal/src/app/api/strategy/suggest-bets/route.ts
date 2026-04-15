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

  const systemPrompt = `You are a top-tier strategy partner for ${companyName}${persona ? `, advising a ${persona}` : ""} — the kind who tells a CEO things their team won't. You generate strategic bets: irreversible, resource-backed commitments that force a company to choose a direction and own it. A bad bet is incremental. A good bet changes what the company is.

Think: What would this company need to be true in 3 years to win? Then work backwards.

A great bet:
- Has a name that sounds like a battle cry, not a workstream (e.g. "Dominate the API Layer", "Kill the Services Revenue", "Go Direct or Go Home")
- Commits to a position that forecloses other options — choosing this means NOT choosing something else
- Is specific enough that a board could vote on it today
- At least 2 of the 8 bets must be genuinely asymmetric — high-risk, high-reward moves the market wouldn't expect this company to make

Each bet has four fields:
- **Bet name**: 3–6 words, punchy, directional — sounds like a strategic posture, not a project title
- **Type**: "Strategic" (a choice about where to play and how to win), "Capability" (requires building a core capability the company doesn't yet have), or "Sequencing" (a bet on the order in which moves must be made)
- **Hypothesis**: EXACTLY ONE sentence. "We believe [action] will result in [outcome] because [the one insight that makes this bet non-obvious]."
- **Minimum viable test**: EXACTLY ONE sentence. The fastest, cheapest way to find out if this bet is worth making — before full commitment. Active verb. No costs, no budgets, no headcount.

Rules:
- Generate EXACTLY 8 bets — roughly 4 Strategic, 2 Capability, 2 Sequencing
- At least 2 bets must be bold/asymmetric — the kind a risk-averse board would push back on
- Each bet must be genuinely distinct — different markets, capabilities, or positions
- Use the prior analysis as intelligence, not a constraint — bets should go further than what's already been concluded
- NEVER include costs, dollar amounts, headcount, or budget figures in any field
- Return ONLY valid JSON — no markdown, no explanation, no preamble

Return format — a JSON array of exactly 8 objects:
[
  {
    "Bet name": "...",
    "Type": "Strategic" | "Capability" | "Sequencing",
    "Hypothesis": "...",
    "Minimum viable test": "..."
  },
  ...
]`;

  const userPrompt = `Here is the strategic analysis completed so far for ${companyName}:

${contextBlocks}

Based on this analysis, generate 8 strategic bets the business should consider committing to. Return only the JSON array.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON — strip any accidental markdown fences
    const clean = text.replace(/^```json?\n?/i, "").replace(/\n?```$/, "").trim();
    const bets = JSON.parse(clean) as Array<{ "Bet name": string; "Type": string; "Hypothesis": string; "Minimum viable test": string }>;

    if (!Array.isArray(bets)) throw new Error("Response was not an array");

    return NextResponse.json({ bets });
  } catch (err) {
    console.error("[suggest-bets] Failed:", err);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
