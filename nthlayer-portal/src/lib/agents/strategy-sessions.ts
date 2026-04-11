import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
});

// ─── Agent IDs ────────────────────────────────────────────────
const AGENT_IDS: Record<string, string> = {
  frame: "agent_011CZxASTpo7h65YQMRVDDYN",
  diagnose: "agent_011CZumeXoZuFJ35jRA8Ta2R",
  decide: "agent_011CZvZtjfw9foNabrMh92ii",
  position: "agent_011CZvZtkfyRGNw3S3RMjHMj",
  commit: "agent_011CZvZtmvNzntBKmhqtcwAS",
};

const ENVIRONMENT_ID = "env_01BG6FT972a92oDBJcBMwt2y";

// ─── Types ────────────────────────────────────────────────────

export interface CompanyContext {
  name: string;
  url?: string | null;
  sector?: string | null;
  location?: string | null;
  territory?: string | null;
  icp1?: string | null;
  icp2?: string | null;
  icp3?: string | null;
  competitors?: string[];
}

export interface PriorStageSummary {
  stageId: string;
  stageName: string;
  summary: string; // executive_summary or formatted snippet from sections
}

export interface StrategySessionInput {
  stageId: string;
  stageName: string;
  questions: Array<{ id: string; question: string; type: string }>;
  answers: Record<string, string | string[] | { selection: string; freetext: string }>;
  persona?: string;
  company: CompanyContext;
  priorReports?: PriorStageSummary[];
}

// ─── Persona framing ──────────────────────────────────────────

function buildPersonaFraming(persona: string | undefined): string {
  if (!persona) return "";

  const lower = persona.toLowerCase();

  if (lower.includes("pe partner") || lower.includes("pe principal")) {
    return `## Advisor Persona: PE Partner / Principal
You are advising a PE partner or principal. Frame every insight through the lens of:
- Investment thesis validation and value creation events
- EBITDA trajectory, margin expansion, and multiple expansion opportunities
- Capital allocation efficiency and return on invested capital
- Exit readiness: what makes this business more or less attractive at sale
- Portfolio risk: what threatens the investment thesis
Be quantitative where possible. Prioritise commercially material findings over operational detail.`;
  }

  if (lower.includes("vc investor") || lower.includes("vc ")) {
    return `## Advisor Persona: VC Investor
You are advising a VC investor. Frame every insight through the lens of:
- Total addressable market size and growth trajectory
- Whether the company is on a path to a 10x outcome
- Funding positioning: what narrative wins the next round
- Competitive moat: what structural advantages are being built
- Founder risk, team risk, and market timing
Prioritise growth potential and defensibility over near-term profitability.`;
  }

  if (lower.includes("portfolio company ceo") || lower.includes("ceo")) {
    return `## Advisor Persona: Portfolio Company CEO
You are advising a portfolio company CEO. Be direct and execution-focused:
- P&L reality: what this means for revenue, costs, and margins
- Board accountability: what will be scrutinised at the next board meeting
- Organisational capacity: what the team can realistically execute
- Decision rights: who needs to be aligned for this to happen
- Near-term vs long-term trade-offs with explicit sequencing
Avoid strategic abstractions. Translate every recommendation into concrete actions.`;
  }

  if (lower.includes("portfolio leadership") || lower.includes("leadership team")) {
    return `## Advisor Persona: Portfolio Leadership Team
You are advising a portfolio company leadership team. Balance strategic insight with operational reality:
- Cross-functional implications: what this means for product, commercial, ops, and finance
- Resource constraints: prioritise given realistic team capacity
- Alignment: surface where leadership may have divergent views
- Execution risk: identify the highest-probability failure modes
- Quick wins vs strategic investments: make the sequencing explicit
Write for a senior operator audience, not just the CEO.`;
  }

  if (lower.includes("advisor") || lower.includes("fractional") || lower.includes("cpo")) {
    return `## Advisor Persona: Independent Advisor / Fractional CPO
You are operating as a senior independent strategic advisor or fractional CPO. Provide:
- Board-ready recommendations with clear rationale
- Reference to established frameworks (e.g. Helmer's 7 Powers, JTBD, Wardley mapping) where relevant
- Honest assessment of what the data does and does not support
- Explicit assumptions and confidence levels
- The options the leadership team may not be considering
Write with the authority of a trusted outside perspective. Do not hedge unnecessarily.`;
  }

  // Fallback for "Other" or unrecognised personas
  return `## Advisor Persona
You are acting as a senior strategic advisor. Write for a sophisticated executive audience.`;
}

// ─── Evidence discipline ──────────────────────────────────────

const EVIDENCE_DISCIPLINE = `## Evidence Discipline — MANDATORY
- Do NOT fabricate data, statistics, market share figures, or company-specific facts
- Only cite URLs you have actually retrieved via web search in this session
- If a fact is unverifiable, explicitly say "unverified" and reflect this in the confidence score
- Confidence scoring: 0.8+ = strong evidence base; 0.4–0.6 = directional signals only; 0.2 = speculative
- Quote specific phrases directly from the user inputs rather than paraphrasing them
- Do not invent competitor behaviours, market sizes, or growth rates`;

// ─── Stage-specific instructions ─────────────────────────────

const STAGE_INSTRUCTIONS: Record<string, string> = {
  frame: `## Stage Instructions: FRAME
Synthesise the inputs to establish a precise strategic frame. Determine:
- What the real challenge is (not just the stated one)
- What winning looks like in 24–36 months, specifically
- Who has the authority and capacity to act on this strategy
- The critical constraints that cannot be designed around

Use web search to validate market context and industry signals relevant to this company's sector. Output must be the foundation all subsequent stages build on — it will be passed forward as context. Be precise: vague frames produce vague strategies.`,

  diagnose: `## Stage Instructions: DIAGNOSE
Build a structured fact base. Investigate:
- Product-market fit signals: where the product is genuinely working vs where it is forced
- Competitive dynamics: who is winning, why, and at whose expense
- Unit economics: whether the business model is structurally sound
- Operational capability: whether the org can execute what is required

Use web search to verify competitor positioning, recent market developments, and sector-specific signals. Cite URLs for all externally sourced claims. Separate the constraining gaps from operational noise. Output must include an honest assessment of where the business genuinely stands — do not soften difficult findings.`,

  decide: `## Stage Instructions: DECIDE
Surface genuine strategic options, including the option of inaction. For each option:
- Apply the "What Would Have to Be True" (WWHTBT) framework: what assumptions must hold for this to be the right choice?
- Work backwards from the winning conditions identified in the Frame stage
- Set explicit kill criteria: at what point would you abandon this path?
- Structure staged investment logic: what is the smallest bet that validates the hypothesis?

Use web search to validate the market viability of each option. Output is a committed strategic direction — not a list of possibilities — with assumptions and trade-offs visible.`,

  position: `## Stage Instructions: POSITION
Translate the strategic direction into a precise market stance. Define:
- Who the business serves (be specific — a position that serves everyone serves no one)
- What it does materially better than the alternatives available to that customer
- What structural advantages are being built (reference Helmer's 7 Powers: scale economies, network effects, counter-positioning, switching costs, branding, cornered resource, process power)
- How the position will hold as competitors respond

Use web search to verify competitor positioning and identify genuine market gaps. Output gives product, GTM, and commercial teams a single coherent position to build from.`,

  commit: `## Stage Instructions: COMMIT (FINAL SYNTHESIS)
This is the FINAL strategic report. You MUST synthesise ALL prior stage findings into a single cohesive, board-ready strategic document. Do NOT simply repeat or summarise what was said in prior stages — synthesise it into a unified direction.

The output must include:
- Strategic bets: name each bet with its hypothesis
- OKRs: at least 3, each with an objective and 2–3 key results
- 30-day actions: specific, named owners, concrete deliverables
- Kill criteria: the conditions that would cause you to change direction
- Governance rhythm: how and how often progress is reviewed
- Horizon allocation: how resources are split across now / next / later

Do NOT use web search — all evidence has been gathered in prior stages. Synthesise from the prior stage context provided. Make the strategy coherent, not a composite of five separate reports.`,
};

// ─── Format Q&A ──────────────────────────────────────────────

type AnswerValue =
  | string
  | string[]
  | { selection: string; freetext?: string }
  | Record<string, string>[]
  | { h1: number; h2: number; h3: number };

function formatAnswers(
  questions: Array<{ id: string; question: string; type: string }>,
  answers: Record<string, AnswerValue>
): string {
  return questions
    .map((q) => {
      const answer = answers[q.id];
      if (answer === undefined || answer === null) return null;

      let answerText = "";

      if (typeof answer === "string") {
        // free-text or single-select
        answerText = answer.trim();
      } else if (Array.isArray(answer)) {
        if (answer.length === 0) return null;
        if (typeof answer[0] === "object") {
          // RepeaterEntry[] — format each entry as a numbered block
          answerText = (answer as Record<string, string>[])
            .map((entry, i) => {
              const fields = Object.entries(entry)
                .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
                .map(([k, v]) => `  ${k}: ${v}`)
                .join("\n");
              return `Entry ${i + 1}:\n${fields}`;
            })
            .join("\n");
        } else {
          // string[] — multi-select
          answerText = (answer as string[]).join(", ");
        }
      } else if (typeof answer === "object" && "selection" in answer) {
        // single-select with optional other freetext
        const a = answer as { selection: string; freetext?: string };
        answerText = a.selection;
        if (a.freetext) answerText += ` — ${a.freetext}`;
      } else if (typeof answer === "object" && "h1" in answer) {
        // percentage-split: now/next/later horizon allocation
        const s = answer as { h1: number; h2: number; h3: number };
        answerText = `Now: ${s.h1}%, Next: ${s.h2}%, Later: ${s.h3}%`;
      }

      if (!answerText) return null;
      return `Q: ${q.question}\nA: ${answerText}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

// ─── Build company context block ──────────────────────────────

function buildCompanyBlock(company: CompanyContext): string {
  const lines: string[] = [`## Company: ${company.name}`];
  if (company.url) lines.push(`Website: ${company.url}`);
  if (company.sector) lines.push(`Sector: ${company.sector}`);
  if (company.location) lines.push(`Location: ${company.location}`);
  if (company.territory) lines.push(`Primary market territory: ${company.territory}`);

  const icps = [company.icp1, company.icp2, company.icp3].filter(Boolean);
  if (icps.length > 0) {
    lines.push(`\n### Ideal Customer Profiles`);
    icps.forEach((icp, i) => lines.push(`${i + 1}. ${icp}`));
  }

  const competitors = (company.competitors ?? []).filter(Boolean);
  if (competitors.length > 0) {
    lines.push(`\n### Known Competitors`);
    lines.push(competitors.join(", "));
  }

  return lines.join("\n");
}

// ─── Build prior stage context ────────────────────────────────

function buildPriorStageContext(priorReports: PriorStageSummary[]): string {
  if (!priorReports || priorReports.length === 0) return "";

  const sections = priorReports.map((r) => {
    return `### Prior Stage: ${r.stageName}\n${r.summary}`;
  });

  return `\n\n## Prior Stage Findings (Cascade Context)\n${sections.join("\n\n")}`;
}

// ─── Resolve agent ID ─────────────────────────────────────────

function resolveAgentId(stageId: string): string {
  const id = AGENT_IDS[stageId];
  if (!id) throw new Error(`No agent configured for stage: ${stageId}`);
  return id;
}

// ─── Public: createStrategySession ───────────────────────────

export async function createStrategySession(input: StrategySessionInput): Promise<string> {
  const { stageId, stageName, questions, answers, persona, company, priorReports } = input;

  const agentId = resolveAgentId(stageId);

  const personaFraming = buildPersonaFraming(persona);
  const stageInstruction = STAGE_INSTRUCTIONS[stageId] ?? STAGE_INSTRUCTIONS.frame;
  const companyBlock = buildCompanyBlock(company);
  const formattedAnswers = formatAnswers(questions, answers);
  const priorContext = buildPriorStageContext(priorReports ?? []);

  const userMessage = [
    personaFraming,
    "",
    EVIDENCE_DISCIPLINE,
    "",
    stageInstruction,
    "",
    companyBlock,
    priorContext,
    "",
    `## ${stageName} — User Inputs`,
    "",
    formattedAnswers,
    "",
    `Call the produce_strategic_diagnosis tool with your complete analysis when you are done.`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: ENVIRONMENT_ID,
    title: `Strategy ${stageName} — ${company.name}`,
    metadata: { stageId, stageName, companyName: company.name },
  });

  await client.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: userMessage }] }],
  });

  return session.id;
}

// ─── Public: checkStrategySession ────────────────────────────

export async function checkStrategySession(sessionId: string): Promise<{
  status: "pending" | "complete" | "failed";
  sections?: Record<string, unknown>;
}> {
  try {
    const session = await client.beta.sessions.retrieve(sessionId);

    // Fetch all events in a single call (sessions rarely exceed 1000 events)
    const eventsPage = await client.beta.sessions.events.list(sessionId, {
      limit: 1000,
    });
    const events = (eventsPage as { data?: unknown[] }).data ?? [];

    // ── Check for agent.custom_tool_use (agent complete) ──
    const toolEvent = events.find(
      (e) => (e as Record<string, unknown>).type === "agent.custom_tool_use"
    );

    if (toolEvent) {
      const te = toolEvent as Record<string, unknown>;
      const sections = (te.input ?? {}) as Record<string, unknown>;

      // Archive session to keep Console tidy
      await client.beta.sessions.archive(sessionId).catch(() => {});

      return { status: "complete", sections };
    }

    // ── Session terminated without output ──
    if (session.status === "terminated") {
      return { status: "failed" };
    }

    // ── Check if idle with requires_action → auto-approve MCP tool calls ──
    if (session.status === "idle") {
      const lastIdleEvent = [...events].reverse().find(
        (e) => (e as Record<string, unknown>).type === "session.status_idle"
      );
      const stopReason = lastIdleEvent
        ? ((lastIdleEvent as Record<string, unknown>).stop_reason as Record<string, unknown> | undefined)
        : undefined;

      if (stopReason?.type === "requires_action") {
        const pendingIds = (stopReason.event_ids as string[]) ?? [];

        if (pendingIds.length > 0) {
          await client.beta.sessions.events.send(sessionId, {
            events: pendingIds.map((id) => ({
              type: "user.tool_confirmation" as const,
              tool_use_id: id,
              result: "allow" as const,
            })),
          }).catch(() => {});
        }
      }
    }

    return { status: "pending" };
  } catch (err) {
    // Non-fatal — next poll will retry
    console.error("[checkStrategySession] Error:", err);
    return { status: "pending" };
  }
}
