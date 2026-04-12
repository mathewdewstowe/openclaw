import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messages, context, stageId } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      context: string;
      stageId?: string;
    };

    if (!Array.isArray(messages)) {
      return Response.json({ error: "messages must be an array" }, { status: 400 });
    }
    if (typeof context !== "string") {
      return Response.json({ error: "context must be a string" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

    const systemPrompt = `You are a strategic advisor embedded within the Nth Layer Inflexion system. You have access to the following strategy report content and must answer questions based on it.

${context}

CITATION RULES — mandatory for every response:
- Every factual claim, recommendation, or finding you state MUST be followed by a citation in this exact format: [Stage · Section] — for example: [Frame · The Strategic Problem] or [Diagnose · Competitive Landscape] or [Commit · OKRs]
- The Stage is one of: Frame, Diagnose, Decide, Position, Commit
- The Section is the specific part of the report the information comes from (e.g. Executive Summary, What Matters Most, Recommendation, Business Implications, Assumptions, Risks, Actions, Monitoring, or a sub-heading like "Strategic Bets" or "100-Day Plan")
- Place the citation immediately after the relevant sentence, inline
- If a point draws from multiple stages, cite all of them: [Frame · Strategic Hypothesis] [Decide · Kill Criteria]
- If the answer cannot be found in the provided reports, say so explicitly — do not cite phantom sources

STYLE RULES:
- Be concise, direct, and board-ready in tone
- Use bullet points for lists of 3 or more items
- Do not fabricate data, statistics, or conclusions not present in the reports
- Keep responses under 400 words unless the question genuinely requires more depth`;

    const stream = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("Strategy chat error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to process chat" },
      { status: 500 }
    );
  }
}
