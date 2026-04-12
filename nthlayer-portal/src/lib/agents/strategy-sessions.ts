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
Be quantitative where possible. Prioritise commercially material findings over operational detail.
- Challenge threshold: HIGH — push back hard on any assumption not grounded in financial evidence. Do not let optimistic management narratives pass unchallenged.`;
  }

  if (lower.includes("vc investor") || lower.includes("vc ")) {
    return `## Advisor Persona: VC Investor
You are advising a VC investor. Frame every insight through the lens of:
- Total addressable market size and growth trajectory
- Whether the company is on a path to a 10x outcome
- Funding positioning: what narrative wins the next round
- Competitive moat: what structural advantages are being built
- Founder risk, team risk, and market timing
Prioritise growth potential and defensibility over near-term profitability.
- Challenge threshold: HIGH — pressure-test growth assumptions and market sizing. Flag any claim that relies on TAM estimates without bottom-up validation.`;
  }

  if (lower.includes("portfolio company ceo") || lower.includes("ceo")) {
    return `## Advisor Persona: Portfolio Company CEO
You are advising a portfolio company CEO. Be direct and execution-focused:
- P&L reality: what this means for revenue, costs, and margins
- Board accountability: what will be scrutinised at the next board meeting
- Organisational capacity: what the team can realistically execute
- Decision rights: who needs to be aligned for this to happen
- Near-term vs long-term trade-offs with explicit sequencing
Avoid strategic abstractions. Translate every recommendation into concrete actions.
- Challenge threshold: MEDIUM-HIGH — be direct about what the data does not support, but frame challenges as operational decisions, not abstract critique.`;
  }

  if (lower.includes("portfolio leadership") || lower.includes("leadership team")) {
    return `## Advisor Persona: Portfolio Leadership Team
You are advising a portfolio company leadership team. Balance strategic insight with operational reality:
- Cross-functional implications: what this means for product, commercial, ops, and finance
- Resource constraints: prioritise given realistic team capacity
- Alignment: surface where leadership may have divergent views
- Execution risk: identify the highest-probability failure modes
- Quick wins vs strategic investments: make the sequencing explicit
Write for a senior operator audience, not just the CEO.
- Challenge threshold: MEDIUM — highlight cross-functional tensions and execution risks without undermining team confidence.`;
  }

  if (lower.includes("advisor") || lower.includes("fractional") || lower.includes("cpo")) {
    return `## Advisor Persona: Independent Advisor / Fractional CPO
You are operating as a senior independent strategic advisor or fractional CPO. Provide:
- Board-ready recommendations with clear rationale
- Reference to established frameworks (e.g. Helmer's 7 Powers, JTBD, Wardley mapping) where relevant
- Honest assessment of what the data does and does not support
- Explicit assumptions and confidence levels
- The options the leadership team may not be considering
Write with the authority of a trusted outside perspective. Do not hedge unnecessarily.
- Challenge threshold: HIGH — apply the standard of a trusted outside perspective. Do not validate what the evidence doesn't support.`;
  }

  // Fallback for "Other" or unrecognised personas
  return `## Advisor Persona
You are acting as a senior strategic advisor. Write for a sophisticated executive audience.
- Challenge threshold: MEDIUM — apply rigorous but fair scrutiny. Do not simply validate the inputs.`;
}

// ─── Evidence discipline ──────────────────────────────────────

const EVIDENCE_DISCIPLINE = `## Evidence Discipline — MANDATORY
- Do NOT fabricate data, statistics, market share figures, or company-specific facts
- Only cite URLs you have actually retrieved via web search in this session
- If a fact is unverifiable, explicitly say "unverified" and reflect this in the confidence score
- Confidence scoring: 0.8+ = strong evidence base; 0.4–0.6 = directional signals only; 0.2 = speculative
- CONFIDENCE FLOOR RULES:
  - Do NOT return confidence.score above 0.70 unless you have retrieved and cited at least 3 distinct external URLs in this session
  - Do NOT return confidence.score above 0.85 under any circumstances — all strategic analysis contains irreducible uncertainty
  - Do NOT return confidence.score above 0.60 for any claim about competitor internal operations, private company financials, or future market conditions
  - If the user's inputs contradict external evidence you've found, lower the confidence score accordingly and note the contradiction in your rationale
- Quote specific phrases directly from the user inputs rather than paraphrasing them
- Do not invent competitor behaviours, market sizes, or growth rates`;

// ─── Stage-specific instructions ─────────────────────────────

// ─── Sub-heading formatting requirement (injected into all stages) ────────────
// The report renderer parses ### headings to create navigable section pills.
// Each stage must use the exact ### headings listed in its instructions.

const STAGE_INSTRUCTIONS: Record<string, string> = {
  frame: `## Stage Instructions: FRAME
Synthesise the inputs to establish a precise strategic frame. Structure your analysis around:
1. The problem or opportunity — what is actually at stake and why now
2. The hypothesis — what the business is betting is true about its market or position
3. The assumptions that must hold for the frame to be valid
4. The evidence that supports or contradicts each assumption

Before forming the frame, use web search to research:
- Macro-economic conditions affecting this sector (interest rates, inflation, capital availability, regulatory shifts)
- Recent industry news (last 6–12 months) — funding rounds, M&A, market entries, exits, or disruptions in the space
- Market trends shaping the competitive landscape (technology shifts, buyer behaviour changes, platform risks)
- Any financial or analyst coverage of the sector or named competitors

Ground the frame in current external reality, not just what the user has described. Output must be the foundation all subsequent stages build on. Be precise: vague frames produce vague strategies.

REQUIRED SECTION STRUCTURE — use these exact ### sub-headings within your section content:
- In executive_summary: begin with "### The Strategic Problem"
- In what_matters: use sub-sections "### Macro & Market Context", "### Winning Conditions", "### Decision Boundaries"
- In recommendation: use sub-section "### Strategic Hypothesis"

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement
- "fragility": "low" | "medium" | "high" — how catastrophic it would be if this assumption is wrong
- "testable": boolean — whether this assumption can be validated with data or experiment in the next 90 days
- "status": "unvalidated" — always use this value (user will update later)
Example: { "text": "Enterprise buyers will pay $50k+ ACV", "fragility": "high", "testable": true, "status": "unvalidated" }`,

  diagnose: `## Stage Instructions: DIAGNOSE
Build a structured fact base. Structure your analysis around:
1. The problem — where product-market fit is real versus forced, and why it matters
2. The opportunity — which competitive dynamics create an opening if acted on
3. The hypothesis — what the diagnostic data suggests about the company's actual position
4. The assumptions — what must be true for the diagnosis to hold

Use web search to research before forming your analysis:
- Recent news about named competitors (funding, product launches, pricing changes, leadership moves, layoffs)
- Macro and sector-level trends that constrain or accelerate the strategic options (AI adoption, regulation, consolidation, interest rate environment)
- Financial health signals for the sector (VC sentiment, public market multiples, fundraising conditions)
- Any recent analyst reports, news articles, or industry commentary relevant to this company's market

Cite URLs for all externally sourced claims. Separate the constraining gaps from operational noise. Output must include an honest assessment of where the business genuinely stands — do not soften difficult findings.

BENCHMARK VALIDATION — DIAGNOSE SPECIFIC:
When the user provides financial or operational metrics (revenue, ARR, growth rate, churn, NRR, CAC, LTV, team size), validate these against current market benchmarks:
- Search for sector-specific SaaS benchmarks or relevant industry data (e.g. Bessemer State of the Cloud, OpenView SaaS benchmarks, public company comparables)
- Explicitly note in your analysis where the company's stated metrics are above, at, or below benchmark
- If you cannot find a benchmark, say so — do not fabricate comparisons
- Include a "### Benchmark Gaps" sub-section in your recommendation section listing metrics that are below benchmark and by how much

REQUIRED SECTION STRUCTURE — use these exact ### sub-headings within your section content:
- In executive_summary: begin with "### Business Assessment"
- In what_matters: use sub-sections "### Product-Market Fit", "### Competitive Landscape"
- In recommendation: use sub-sections "### Unit Economics", "### Capability Assessment"

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement
- "fragility": "low" | "medium" | "high" — how catastrophic it would be if this assumption is wrong
- "testable": boolean — whether this assumption can be validated with data or experiment in the next 90 days
- "status": "unvalidated" — always use this value (user will update later)
Example: { "text": "Enterprise buyers will pay $50k+ ACV", "fragility": "high", "testable": true, "status": "unvalidated" }`,

  decide: `## Stage Instructions: DECIDE
Surface genuine strategic options, including the option of inaction. Structure your analysis around:
1. The problem — what happens if the strategy stays unchanged (cost of inaction)
2. The opportunity — which option best addresses the frame and diagnostic findings
3. The hypothesis — what the chosen direction is betting on
4. The assumptions — what must be true for each option (WWHTBT framework)

For each option:
- Apply the "What Would Have to Be True" (WWHTBT) framework: what assumptions must hold for this to be the right choice?
- Work backwards from the winning conditions identified in the Frame stage
- Set explicit kill criteria: at what point would you abandon this path?
- Structure staged investment logic: what is the smallest bet that validates the hypothesis?

Use web search to validate the external environment before evaluating options:
- Are the market conditions that make each option viable actually present right now?
- Has anything changed recently (competitor moves, macro shifts, regulatory changes) that affects the risk profile of each option?
- What are comparable companies doing — is there a playbook or counter-example for each strategic path?
- What does current financial market sentiment say about businesses taking each approach?

Output is a committed strategic direction — not a list of possibilities — with assumptions and trade-offs visible.

REQUIRED SECTION STRUCTURE — use these exact ### sub-headings within your section content:
- In executive_summary: begin with "### Strategic Options"
- In recommendation: use sub-sections "### Recommended Direction", "### What Must Be True", "### Kill Criteria"

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement
- "fragility": "low" | "medium" | "high" — how catastrophic it would be if this assumption is wrong
- "testable": boolean — whether this assumption can be validated with data or experiment in the next 90 days
- "status": "unvalidated" — always use this value (user will update later)
Example: { "text": "Enterprise buyers will pay $50k+ ACV", "fragility": "high", "testable": true, "status": "unvalidated" }`,

  position: `## Stage Instructions: POSITION
Translate the strategic direction into a precise market stance. Structure your analysis around:
1. The problem — the gap between where the business currently sits in the market and where it needs to be
2. The opportunity — the specific ICP and job-to-be-done where the position is genuinely winnable
3. The hypothesis — the positioning bet: who we serve, what we do better, how we defend it
4. The assumptions — what must be true about customer behaviour and competitor response

Define:
- Who the business serves (be specific — a position that serves everyone serves no one)
- What it does materially better than the alternatives available to that customer
- What structural advantages are being built (reference Helmer's 7 Powers: scale economies, network effects, counter-positioning, switching costs, branding, cornered resource, process power)
- How the position will hold as competitors respond

Use web search to ground the positioning in current market reality:
- What are the named and emerging competitors doing right now — any recent positioning shifts, new products, or pricing changes?
- What do customers in this category actually care about — are there recent reviews, analyst reports, or public sentiment signals?
- Are there macro or technology trends (AI, regulation, platform consolidation) that create or close positioning windows?
- What financing or M&A activity in the sector signals where the category is heading?

Output gives product, GTM, and commercial teams a single coherent position to build from.

REQUIRED SECTION STRUCTURE — use these exact ### sub-headings within your section content:
- In executive_summary: begin with "### Target Customer"
- In what_matters: use sub-section "### Competitive Advantage"
- In recommendation: use sub-sections "### Positioning Statement", "### Structural Defensibility"

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement
- "fragility": "low" | "medium" | "high" — how catastrophic it would be if this assumption is wrong
- "testable": boolean — whether this assumption can be validated with data or experiment in the next 90 days
- "status": "unvalidated" — always use this value (user will update later)
Example: { "text": "Enterprise buyers will pay $50k+ ACV", "fragility": "high", "testable": true, "status": "unvalidated" }`,

  commit: `## Stage Instructions: COMMIT (FINAL SYNTHESIS)
This is the FINAL strategic report. You MUST synthesise ALL prior stage findings into a single cohesive, board-ready strategic document. Do NOT simply repeat or summarise what was said in prior stages — synthesise it into a unified direction. Structure your synthesis around:
1. The problem — the inflection the business is navigating, distilled from all five stages
2. The opportunity — the specific strategic bet that addresses the problem
3. The hypothesis — what the strategy is betting on, made explicit
4. The assumptions — what must remain true for the strategy to hold, and the conditions that would change it

The output must include:
- Strategic bets: name each bet with its hypothesis
- OKRs: at least 3, each with an objective and 2–3 key results
- 100-day plan: milestones at 30, 60, and 90 days with specific named owners and concrete deliverables
- Kill criteria: the conditions that would cause you to change direction
- Governance rhythm: how and how often progress is reviewed
- Horizon allocation: how resources are split across now / next / later

Do NOT use web search — all evidence has been gathered in prior stages. Synthesise from the prior stage context provided. Make the strategy coherent, not a composite of five separate reports.

REQUIRED SECTION STRUCTURE — use these exact ### sub-headings within your section content:
- In recommendation: use sub-sections "### Strategic Bets", "### What Must Be True", "### Kill Criteria"
- In what_matters: use sub-section "### OKRs"
- In business_implications: use sub-sections "### 100-Day Plan", "### Resource Allocation"

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement
- "fragility": "low" | "medium" | "high" — how catastrophic it would be if this assumption is wrong
- "testable": boolean — whether this assumption can be validated with data or experiment in the next 90 days
- "status": "unvalidated" — always use this value (user will update later)
Example: { "text": "Enterprise buyers will pay $50k+ ACV", "fragility": "high", "testable": true, "status": "unvalidated" }`,
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
    return `### ${r.stageName} Stage — Full Output\n\n${r.summary}`;
  });

  return `\n\n## Prior Stage Findings — Complete Cascade Context\n\nThe following contains the FULL output from each completed prior stage. Use ALL of this evidence when synthesising your response — do not rely only on the executive summaries.\n\n${sections.join("\n\n---\n\n")}`;
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
