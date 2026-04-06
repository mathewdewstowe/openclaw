import { db } from "./db";

const VOICE_DIRECTIVE = `You are a senior operating partner at a technology-focused private equity firm.
You have 20+ years of experience building and scaling B2B software companies.
You think like a CEO, not a consultant. You are direct, opinionated, and commercially grounded.

Rules:
- Be specific. Name patterns, not platitudes.
- Be opinionated. If something is weak, say so.
- Be concise. Board-level writing. No filler.
- Ground claims in observable evidence.
- If you lack evidence, say so and state your confidence level.
- Never use phrases like "it's important to", "in today's landscape", "leverage synergies".`;

export async function runModule(
  scanId: string,
  module: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const start = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      stream: true,
      system: VOICE_DIRECTIVE + "\n\n" + systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(180000), // 3 minute max per AI call
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${err}`);
  }

  // Read the SSE stream — keeps connection alive in Cloudflare Workers
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload);
        if (event.type === "content_block_delta" && event.delta?.text) {
          fullText += event.delta.text;
        } else if (event.type === "message_start" && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === "message_delta" && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  const durationMs = Date.now() - start;

  // Parse JSON from response — handle markdown code blocks
  let output: Record<string, unknown>;
  try {
    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
    output = JSON.parse(jsonMatch ? jsonMatch[1].trim() : fullText.trim());
  } catch {
    output = { rawText: fullText };
  }

  const confidence = typeof output.confidence === "number" ? output.confidence : 0.7;
  const sources = Array.isArray(output.sources) ? output.sources as string[] : [];

  await db.analysisResult.create({
    data: {
      scanId,
      module,
      output: output as unknown as Parameters<typeof db.analysisResult.create>[0]["data"]["output"],
      confidence,
      sources,
      durationMs,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
    },
  });

  return output;
}

export async function executeStep(
  scanId: string,
  stepName: string,
  stepNumber: number,
  totalSteps: number,
  fn: () => Promise<unknown>,
  options?: { retries?: number; critical?: boolean }
): Promise<unknown> {
  const retries = options?.retries ?? 0;
  const critical = options?.critical ?? true;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();

      await db.scan.update({
        where: { id: scanId },
        data: { progress: Math.round((stepNumber / totalSteps) * 100) },
      });

      await db.scanEvent.create({
        data: {
          scanId,
          event: `step_${stepName}_complete`,
          metadata: { attempt },
        },
      });

      return result;
    } catch (error) {
      if (attempt === retries) {
        if (critical) throw error;
        await db.scanEvent.create({
          data: {
            scanId,
            event: `step_${stepName}_failed`,
            metadata: { error: error instanceof Error ? error.message : "Unknown" },
          },
        });
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Unreachable");
}
