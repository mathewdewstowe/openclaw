import { db } from "./db";

const VOICE_DIRECTIVE = `You are a senior operating partner at a technology-focused private equity firm.
You think like a CEO, not a consultant. You are direct, commercially grounded, and EVIDENCE-BASED.

ANTI-HALLUCINATION RULES — CRITICAL:
- You MUST NOT speculate. You MUST NOT invent facts.
- If you don't have direct evidence for a claim, write "Unknown" or "Insufficient public data" — never guess.
- Do NOT confuse the target company with similarly-named entities (e.g. Companies House records of unrelated companies, look-alike domains, businesses with similar names in other sectors).
- Do NOT infer facts from a domain name alone. The URL is a starting point, not evidence.
- If web_search returns nothing useful for the exact target, SAY SO. Set fields to "Unknown" rather than filling gaps with plausible-sounding nonsense.
- Every concrete claim (revenue, funding, headcount, HQ, founding year, leadership) MUST come from a source you can cite. No source = no claim.
- Lower your confidence to 0.3-0.5 when evidence is thin. Reserve 0.7+ for well-sourced claims only.

OUTPUT STYLE:
- Be CONCISE. Tight bullet writing. Each field 1-2 sentences MAX.
- Be specific when you have evidence. Be honest when you don't.
- Never use phrases like "it's important to", "in today's landscape", "leverage synergies".

WEB SEARCH (when available):
- ALWAYS use web_search first to fetch the actual target URL when one is given.
- Read the homepage, /about, /pricing, /product pages of the EXACT URL — not similar domains.
- Use additional searches sparingly for specific facts (funding round, recent news, leadership).
- Never cite a URL you didn't actually fetch.

CITATIONS — CRITICAL:
- Every JSON response MUST include a "sources" array.
- Sources MUST be REAL URLs from your actual web searches OR named primary references.
- DO NOT fabricate URLs. DO NOT cite generic sources like "company website" without the actual URL.
- If you have no real sources, return an empty array and lower confidence to 0.3.

OUTPUT FORMAT — CRITICAL:
- Output ONLY valid JSON. No commentary before or after.
- Do NOT wrap in markdown code blocks.
- Keep string values SHORT to fit token budget.`;

// Robust JSON parser that handles markdown wrapping and truncated responses
function parseJSONLoose(text: string): Record<string, unknown> {
  // 1. Try fenced code block first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let candidate = fenced ? fenced[1].trim() : text.trim();

  // 2. Find the first { and try to extract balanced JSON
  const start = candidate.indexOf("{");
  if (start === -1) throw new Error("No JSON object found");
  candidate = candidate.slice(start);

  // 3. Try direct parse
  try {
    return JSON.parse(candidate);
  } catch {
    // continue to repair
  }

  // 4. Repair: balance braces/brackets and trim trailing comma
  let depth = 0;
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let lastValid = -1;

  for (let i = 0; i < candidate.length; i++) {
    const c = candidate[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === "{" || c === "[") {
      stack.push(c === "{" ? "}" : "]");
      depth++;
    } else if (c === "}" || c === "]") {
      stack.pop();
      depth--;
      if (depth === 0) lastValid = i;
    }
  }

  // Try parsing up to last fully-closed point
  if (lastValid > 0) {
    try { return JSON.parse(candidate.slice(0, lastValid + 1)); } catch {}
  }

  // Otherwise try closing all open brackets
  let repaired = candidate;
  // Strip trailing comma + whitespace + incomplete strings
  repaired = repaired.replace(/,\s*$/, "");
  // If we're inside an unterminated string, close it
  if (inString) repaired += '"';
  // Close all open brackets
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  // Strip dangling commas before closers
  repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(repaired);
}

export async function runModule(
  scanId: string,
  module: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { webSearch?: boolean; maxSearches?: number }
): Promise<Record<string, unknown>> {
  const start = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const requestBody: Record<string, unknown> = {
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    stream: true,
    system: VOICE_DIRECTIVE + "\n\n" + systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  };

  if (options?.webSearch) {
    requestBody.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: options.maxSearches ?? 1,
      },
    ];
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
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

  // Parse JSON from response — handle markdown code blocks + truncation
  let output: Record<string, unknown>;
  try {
    output = parseJSONLoose(fullText);
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
