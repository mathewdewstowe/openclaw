/**
 * Inflexion Unit Test — Haiilo
 *
 * Runs all 5 strategy stages (Frame → Diagnose → Decide → Position → Commit)
 * for a fixed company definition without going through the UI.
 *
 * Usage:
 *   npx dotenvx run -f .env.local -- npx tsx scripts/unit-test-inflexion.ts
 *
 * Outputs:
 *   - scripts/output/haiilo-<timestamp>.json   (raw sections from all stages)
 *   - scripts/output/haiilo-<timestamp>.html   (printable report → File > Print > Save as PDF)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

// ─── Load .env.local (if running outside Next.js / without --env-file) ───────

(function loadEnv() {
  const envFile = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
})();

// ─── Anthropic client ────────────────────────────────────────────────────────

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
});

const AGENT_IDS: Record<string, string> = {
  frame:    "agent_011CZxASTpo7h65YQMRVDDYN",
  diagnose: "agent_011CZumeXoZuFJ35jRA8Ta2R",
  decide:   "agent_011CZvZtjfw9foNabrMh92ii",
  position: "agent_011CZvZtkfyRGNw3S3RMjHMj",
  commit:   "agent_011CZzKHr5KTkHYsLYcn2ke7",
};

const ENVIRONMENT_ID = "env_01BG6FT972a92oDBJcBMwt2y";

// ─── Company definition ──────────────────────────────────────────────────────
// Edit this block to change the company being tested.

const COMPANY = {
  name: "Haiilo",
  url: "https://www.haiilo.com/",
  sector: "Employee Communications & Engagement (SaaS)",
  location: "United Kingdom",
  territory: "UK, Germany, United States",
  icp1: "Lower enterprise (250–2,500 employees) in professional services — law firms, consulting, accountancy",
  icp2: "Lower enterprise in financial services — insurance, asset management, banking",
  icp3: null,
  competitors: ["Staffbase", "Simpplr", "Workvivo", "Interact", "LumApps"],
};

// ─── Stage answers ────────────────────────────────────────────────────────────
// Edit these to change the inputs passed to each stage agent.

const STAGE_ANSWERS = {

  // ── FRAME ──────────────────────────────────────────────────────────────────
  frame: {
    questions: [
      { id: "persona",           question: "Who is completing this session?",                                       type: "single-select" },
      { id: "trigger",           question: "What triggered this strategic review?",                                  type: "multi-select"  },
      { id: "lifecycle_stage",   question: "Where is the business in its lifecycle?",                               type: "single-select" },
      { id: "winning_definition",question: "What does winning look like in 24–36 months?",                         type: "multi-select"  },
      { id: "risk_appetite",     question: "What is the risk appetite for this move?",                              type: "single-select" },
      { id: "investment_horizon",question: "What is the investment horizon for this strategy?",                     type: "single-select" },
      { id: "decision_maker",    question: "Who is the primary decision-maker for this strategy?",                  type: "single-select" },
      { id: "strategic_question",question: "In one sentence — what is the core strategic question?",               type: "free-text"     },
    ],
    answers: {
      persona:            "Independent Advisor / Fractional CPO",
      trigger:            ["Growth has stalled or decelerated", "A competitor has made a significant move", "Technology shift is disrupting the category"],
      lifecycle_stage:    "Optimising — mature core, driving efficiency",
      winning_definition: ["Becoming the clear category leader in our segment", "Expanding into new geographies or verticals", "Demonstrating strong NRR and retention benchmarks"],
      risk_appetite:      "Moderate — improve trajectory with selective adjacencies",
      investment_horizon: "Medium-term (18–36 months)",
      decision_maker:     "CEO + Board jointly",
      strategic_question: "Should Haiilo sharpen its focus on lower enterprise professional and financial services across UK, Germany and US to build category leadership, or broaden its ICP to chase faster near-term growth?",
    },
  },

  // ── DIAGNOSE ───────────────────────────────────────────────────────────────
  diagnose: {
    questions: [
      { id: "pmf_status",         question: "How would you characterise current product-market fit?",              type: "single-select" },
      { id: "competitive_forces", question: "Which competitive forces are intensifying most right now?",           type: "multi-select"  },
      { id: "unit_economics",     question: "What does the unit economics picture look like?",                     type: "single-select" },
      { id: "arr_growth",         question: "What is the current ARR growth rate?",                                type: "single-select" },
      { id: "customer_signals",   question: "What is the customer base telling you?",                              type: "multi-select"  },
      { id: "capability_gaps",    question: "Where are the most significant internal capability gaps?",            type: "multi-select"  },
      { id: "moat_status",        question: "Which best describes the competitive moat today?",                    type: "single-select" },
      { id: "biggest_constraint", question: "What is the single biggest constraint on the business right now?",   type: "free-text"     },
    ],
    answers: {
      pmf_status:         "Partial — works well for a subset, not broadly",
      competitive_forces: ["New well-funded entrants targeting our space", "Existing competitors improving significantly", "Pricing pressure compressing margins"],
      unit_economics:     "Mixed — strong on some metrics, weak on others",
      arr_growth:         "10–25% YoY",
      customer_signals:   ["Best customers are highly engaged and expanding", "Clear ICP but winning too often outside it", "Win rates declining against specific competitors"],
      capability_gaps:    ["Sales capacity and process maturity", "Marketing and demand generation", "GTM alignment across sales, marketing, and product"],
      moat_status:        "Narrow moat in a specific niche or segment",
      biggest_constraint: "We have a strong product but inconsistent sales execution across territories, with unclear ICP prioritisation causing diluted focus. Professional and financial services buyers have specific compliance and integration requirements that our generic GTM motion does not fully address.",
    },
  },

  // ── DECIDE ────────────────────────────────────────────────────────────────
  decide: {
    questions: [
      { id: "strategic_options",  question: "Which strategic directions are genuinely on the table?",             type: "multi-select"  },
      { id: "cost_of_inaction",   question: "What is the cost of inaction if strategy stays unchanged?",          type: "single-select" },
      { id: "decision_criteria",  question: "Which criteria matter most when evaluating options?",                type: "rank"          },
      { id: "commitment_level",   question: "How much strategic commitment can be made right now?",               type: "single-select" },
      { id: "bold_move_concern",  question: "What is the biggest concern about making a bold strategic move?",    type: "single-select" },
      { id: "wwhtbt",             question: "For the preferred option — what would have to be true to succeed?",  type: "free-text"     },
      { id: "kill_criteria",      question: "What evidence would confirm this strategy is working or should be abandoned?", type: "free-text" },
    ],
    answers: {
      strategic_options:  ["Double down on core — optimise what's working", "Move upmarket (enterprise or larger customers)", "Enter new geographies or verticals", "Reposition to own a new or redefined category"],
      cost_of_inaction:   "Significant — competitors pulling ahead, gap widening",
      decision_criteria:  ["Revenue impact within 24 months", "Competitive moat strengthening", "Customer retention improvement"],
      commitment_level:   "Staged — commit to initial investment with gates before full commitment",
      bold_move_concern:  "Distraction from the core business",
      wwhtbt:             "Enterprise buyers in professional services and financial services in UK, Germany and US would need to view Haiilo as the clear specialist for their sector. Sales teams would need vertical-specific playbooks, reference customers in each territory, and the product would need to address FCA/BaFin compliance requirements and deep HRIS integrations without custom development.",
      kill_criteria:      "If the professional services and financial services win rate does not improve to above 35% within 6 months, or if NRR in these segments falls below 100%, or if pipeline coverage in the ICP drops below 3:1 by day 90, trigger a strategic review and consider reverting to a broader ICP motion.",
    },
  },

  // ── POSITION ──────────────────────────────────────────────────────────────
  position: {
    questions: [
      { id: "target_customer",       question: "Who is the primary target customer?",                                       type: "single-select" },
      { id: "competitive_alternative",question: "What is the clearest alternative your target customer has to you?",       type: "multi-select"  },
      { id: "value_prop_type",       question: "What does the value proposition primarily deliver?",                        type: "single-select" },
      { id: "market_stance",         question: "Where do you want to compete on the market map?",                          type: "single-select" },
      { id: "power_type",            question: "Which best describes the primary competitive advantage being built?",       type: "single-select" },
      { id: "differentiation",       question: "What are the 2–3 dimensions on which you are genuinely differentiated?",  type: "free-text"     },
      { id: "positioning_statement", question: "Draft your positioning statement.",                                         type: "free-text"     },
      { id: "moat_building",         question: "Which moat-building activities are actively being pursued?",               type: "multi-select"  },
    ],
    answers: {
      target_customer:        "A specific firmographic profile (size, sector, geography)",
      competitive_alternative:["A direct competitor with a similar product", "A legacy system or incumbent they're locked into"],
      value_prop_type:        "Gives customers strategic capability they couldn't otherwise have",
      market_stance:          "Big fish, small pond — dominate a specific underserved niche",
      power_type:             "Switching costs — customers locked in by data, integrations, or workflow",
      differentiation:        "1. Unified employee communications, advocacy and listening in a single platform — not a patchwork of point solutions. 2. Sector-specific compliance and security architecture built for financial services and professional services regulatory requirements. 3. Multi-territory deployment with genuine localisation for UK, Germany and US workforces, including works council and data residency requirements.",
      positioning_statement:  "For lower enterprise professional services and financial services firms in the UK, Germany and US who need to communicate and engage a distributed, regulated workforce, Haiilo is an employee communications platform that unifies intranet, advocacy and listening in one compliant, enterprise-ready solution. Unlike competitors who require multiple vendors or cannot meet sector compliance standards, we deliver the full communications stack with regulatory requirements built in.",
      moat_building:          ["Deepening integrations that increase switching costs", "Locking in reference customers that validate category leadership"],
    },
  },

  // ── COMMIT ────────────────────────────────────────────────────────────────
  commit: {
    questions: [
      { id: "strategic_bets",    question: "What are the strategic bets being made in the next 12 months?",               type: "structured-repeater" },
      { id: "okrs",              question: "What are the top 3 company-level objectives for the next 12 months?",         type: "structured-repeater" },
      { id: "horizon_allocation",question: "How will investment be allocated across horizons?",                            type: "percentage-split"    },
      { id: "thirty_day_actions",question: "What are the first 3 actions that must happen in the next 30 days?",          type: "structured-repeater" },
      { id: "bet_kill_criteria", question: "What are the predefined kill criteria for the strategic bets?",                type: "free-text"           },
      { id: "bet_classification",question: "How would you characterise each strategic bet?",                               type: "single-select"       },
      { id: "governance_rhythm", question: "What governance rhythm will hold this strategy accountable?",                  type: "multi-select"        },
      { id: "capability_needs",  question: "Which capabilities must be built, bought, or partnered for in the next 6 months?", type: "multi-select"  },
    ],
    answers: {
      strategic_bets: [
        { "Bet name": "Own professional services in UK", "Action": "Hire 2 sector specialist AEs, build professional services sales playbook and reference case pack", "Outcome": "10 net-new professional services logos by Q4, average ACV 20% above current mean", "Hypothesis": "A specialist vertical sales motion with peer reference customers converts at 2× the current rate because professional services buyers buy through trusted sector communities" },
        { "Bet name": "Financial services compliance module", "Action": "Build FCA/BaFin compliance certification pack and audit-ready data architecture documentation", "Outcome": "5 financial services enterprise deals in UK and Germany by H2, compliance objection removed from >80% of deals", "Hypothesis": "Compliance certification removes the primary blocking objection in financial services and unlocks pipeline currently stalled at security review" },
        { "Bet name": "US lower enterprise beachhead", "Action": "Establish dedicated US customer success and pre-sales capability, build US-specific professional services territory playbook with UK reference customers", "Outcome": "3 US anchor accounts in professional services by EOY, establish referenceable US presence", "Hypothesis": "UK professional services reference customers provide the proof credibility needed to accelerate US enterprise sales cycle from 9 months to under 6" },
      ],
      okrs: [
        { "Objective": "Establish clear category leadership in professional services and financial services", "Key Result": "Achieve 40% of net-new ARR from professional services and financial services ICP segments" },
        { "Objective": "Build defensible retention in core ICP", "Key Result": "Reach 110% NRR across professional services and financial services accounts" },
        { "Objective": "Activate US territory with referenceable customers", "Key Result": "Close 3 US enterprise accounts in target ICP segments" },
      ],
      horizon_allocation: { h1: 65, h2: 25, h3: 10 },
      thirty_day_actions: [
        { "Action": "Define professional services ICP scoring criteria and apply to 100% of active pipeline", "Owner": "Head of Sales", "Success measure": "Every active opportunity tagged with ICP score; top 20 prioritised for vertical specialist pursuit" },
        { "Action": "Identify 3 existing professional services customers for reference case study development", "Owner": "Head of Customer Success", "Success measure": "3 case studies in production and approved by customers" },
        { "Action": "Audit FCA and BaFin compliance requirements and produce a gap analysis against current product", "Owner": "CTO / Head of Product", "Success measure": "Compliance gap analysis delivered with prioritised roadmap items and estimated timelines" },
      ],
      bet_kill_criteria:  "If professional services qualified pipeline coverage drops below 3:1 by day 90, or if the financial services compliance module is delayed past Q3 with no interim solution, or if UK professional services win rate does not improve by at least 10 percentage points within 6 months — trigger a board-level review and assess whether to revert to a broader ICP motion.",
      bet_classification: "Solid bet — good evidence, moderate risk, significant upside",
      governance_rhythm:  ["Monthly strategic progress review (CEO + direct reports)", "Quarterly board or sponsor strategy review", "30/60/90-day milestone gates with go/no-go decisions"],
      capability_needs:   ["Senior sales leadership for enterprise motion", "Customer success and onboarding", "Strategic partnerships or channel"],
    },
  },
};

// ─── Persona & evidence prompts (copied from strategy-sessions.ts) ─────────────

function buildPersonaFraming(): string {
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

const EVIDENCE_DISCIPLINE = `## Evidence Discipline — MANDATORY
- Do NOT fabricate data, statistics, market share figures, or company-specific facts
- Only cite URLs you have actually retrieved via web search in this session
- If a fact is unverifiable, explicitly say "unverified" and reflect this in the confidence score
- Confidence scoring: 0.8+ = strong evidence base; 0.4–0.6 = directional signals only; 0.2 = speculative
- CONFIDENCE FLOOR RULES:
  - Do NOT return confidence.score above 0.70 unless you have retrieved and cited at least 3 distinct external URLs in this session
  - Do NOT return confidence.score above 0.85 under any circumstances — all strategic analysis contains irreducible uncertainty
  - Do NOT return confidence.score above 0.60 for any claim about competitor internal operations, private company financials, or future market conditions
- Do not invent competitor behaviours, market sizes, or growth rates

## Cost & Revenue Rules — MANDATORY
- NEVER include cost estimates, budget figures, dollar amounts, headcount numbers, or salary ranges
- NEVER include revenue projections, ARR targets, or expected financial outcomes
- Focus on direction, position, and strategic logic — not financial specifics`;

const FIELD_CONCISENESS_RULES = `## Structured Field Conciseness — MANDATORY
ACTIONS — actions[].action: ONE sentence. Maximum 12 words. Start with a strong active verb.
RISKS — risks[].risk: ONE sentence. Maximum 12 words. Name the risk sharply.
ASSUMPTIONS — assumptions[].text: ONE sentence. Maximum 15 words. State the assumption cleanly. NEVER append metadata.
MONITORING — monitoring[].metric: ONE phrase or short sentence. Maximum 10 words.`;

const STAGE_INSTRUCTIONS: Record<string, string> = {
  frame: `## Stage Instructions: FRAME
Define the decision. Establish the strategic context, clarify what has changed, identify winning conditions in 24–36 months, and surface key constraints. Do NOT choose a direction. Do NOT recommend a strategy.

RESEARCH — use web search before forming the frame:
- Macro-economic conditions affecting this sector
- Recent industry news (last 6–12 months)
- Market trends shaping the competitive landscape
- Analyst or financial coverage of the sector or named competitors

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### The Strategic Problem"
- In what_matters: use "### Macro & Market Context", "### Winning Conditions", "### Decision Boundaries"
- In recommendation: use "### Core Strategic Question"

STAGE OUTPUT RULES — FRAME:
- recommendation = CORE STRATEGIC QUESTION only. Do NOT return actions.
- DO populate monitoring with 2–3 watch signals.
- Focus risks on threats to the frame itself.

ASSUMPTION FORMAT — MANDATORY: array of objects with text, fragility ("low"|"medium"|"high"), testable (boolean), status ("unvalidated").`,

  diagnose: `## Stage Instructions: DIAGNOSE
Build a structured fact base. Diagnose reality — do not choose a direction.

RESEARCH — use web search:
- Recent news about named competitors
- Macro and sector-level trends
- Financial health signals for the sector
- Recent analyst reports

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Business Assessment"
- In what_matters: use "### Product-Market Fit", "### Competitive Landscape"
- In recommendation: use "### Emerging Direction", "### Benchmark Gaps"

STAGE OUTPUT RULES — DIAGNOSE:
- recommendation = EMERGING DIRECTION. Do NOT return actions.
- DO populate monitoring with 3–4 diagnostic metrics.
- Mark inherited Frame assumptions with "[From Frame]".

ASSUMPTION FORMAT — MANDATORY: array of objects with text, fragility, testable, status.`,

  decide: `## Stage Instructions: DECIDE
Surface genuine strategic options, pressure-test each, choose a direction.

RESEARCH — use web search:
- Are market conditions for each option present right now?
- Recent competitor moves or macro shifts
- Comparable company playbooks

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Strategic Options"
- In recommendation: use "### Recommended Direction", "### What Must Be True"

STAGE OUTPUT RULES — DECIDE:
- recommendation = committed direction. Be definitive.
- Return actions as strategic-level next steps.
- DO populate monitoring with 3–4 decision-validation metrics.
- KILL CRITERIA array (mandatory): at least 3 objects with criterion, trigger, response.

ASSUMPTION FORMAT — MANDATORY: array of objects with text, fragility, testable, status.`,

  position: `## Stage Instructions: POSITION
Translate the chosen direction into a precise market stance. Define who you serve, what you do materially better, and what structural advantages you are building.

RESEARCH — use web search:
- What are named competitors doing right now?
- What do customers in this category actually care about?
- Macro or technology trends that create or close positioning windows?

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Target Customer"
- In what_matters: use "### Competitive Advantage"
- In recommendation: use "### Positioning Statement", "### Structural Defensibility"

STAGE OUTPUT RULES — POSITION:
- recommendation = POSITIONING RECOMMENDATION. Do NOT return actions.
- DO populate monitoring with 2–3 positioning validation metrics.

ASSUMPTION FORMAT — MANDATORY: array of objects with text, fragility, testable, status.`,

  commit: `## Stage Instructions: COMMIT (FINAL SYNTHESIS)
Synthesise all prior stages into a single board-ready strategic document. Do NOT use web search — synthesise from prior stage context.

REQUIRED SECTION STRUCTURE:
- In recommendation: use "### What Must Be True", "### Governance Rhythm"
- In business_implications: use "### Resource Allocation"

STRUCTURED ARRAYS — MANDATORY:
strategic_bets: 3–5 bets. Each: bet (3–6 words), hypothesis, investment.
okrs: 3+ OKRs. Each: objective, key_results (string[]).
hundred_day_plan: 30/60/90 day milestones. Each: milestone, timeline, owner, deliverable.
kill_criteria: 3+ objects. Each: criterion, trigger, response.

ASSUMPTION FORMAT — MANDATORY: array of objects with text, fragility, testable, status.`,
};

// ─── Build prompt ─────────────────────────────────────────────────────────────

function buildCompanyBlock(): string {
  const c = COMPANY;
  const lines = [`## Company: ${c.name}`];
  if (c.url)       lines.push(`Website: ${c.url}`);
  if (c.sector)    lines.push(`Sector: ${c.sector}`);
  if (c.location)  lines.push(`Location: ${c.location}`);
  if (c.territory) lines.push(`Primary market territory: ${c.territory}`);
  const icps = [c.icp1, c.icp2, c.icp3].filter(Boolean);
  if (icps.length > 0) {
    lines.push(`\n### Ideal Customer Profiles`);
    icps.forEach((icp, i) => lines.push(`${i + 1}. ${icp}`));
  }
  if (c.competitors.length > 0) {
    lines.push(`\n### Known Competitors`);
    lines.push(c.competitors.join(", "));
  }
  return lines.join("\n");
}

function formatAnswers(stageId: string): string {
  const stage = STAGE_ANSWERS[stageId as keyof typeof STAGE_ANSWERS];
  return stage.questions.map((q) => {
    const answer = (stage.answers as Record<string, unknown>)[q.id];
    if (answer === undefined || answer === null) return null;
    let text = "";
    if (typeof answer === "string") {
      text = answer;
    } else if (Array.isArray(answer)) {
      if (answer.length === 0) return null;
      if (typeof answer[0] === "object") {
        text = (answer as Record<string, string>[]).map((entry, i) => {
          const fields = Object.entries(entry)
            .filter(([, v]) => typeof v === "string" && v.trim())
            .map(([k, v]) => `  ${k}: ${v}`)
            .join("\n");
          return `Entry ${i + 1}:\n${fields}`;
        }).join("\n");
      } else {
        text = (answer as string[]).join(", ");
      }
    } else if (typeof answer === "object" && "h1" in (answer as object)) {
      const s = answer as { h1: number; h2: number; h3: number };
      text = `Now/H1: ${s.h1}%, Next/H2: ${s.h2}%, Later/H3: ${s.h3}%`;
    }
    if (!text) return null;
    return `Q: ${q.question}\nA: ${text}`;
  }).filter(Boolean).join("\n\n");
}

function buildPriorContext(priorOutputs: Array<{ stageId: string; stageName: string; sections: Record<string, unknown> }>): string {
  if (priorOutputs.length === 0) return "";
  const sections = priorOutputs.map(r => {
    const s = r.sections;
    const content = [
      s.executive_summary ? String(s.executive_summary) : "",
      s.what_matters      ? String(s.what_matters)      : "",
      s.recommendation    ? String(s.recommendation)    : "",
      s.business_implications ? String(s.business_implications) : "",
    ].filter(Boolean).join("\n\n");
    return `### ${r.stageName} Stage — Full Output\n\n${content}`;
  });
  return `\n\n## Prior Stage Findings — Complete Cascade Context\n\n${sections.join("\n\n---\n\n")}`;
}

function buildMessage(stageId: string, stageName: string, priorOutputs: Array<{ stageId: string; stageName: string; sections: Record<string, unknown> }>): string {
  return [
    buildPersonaFraming(),
    "",
    EVIDENCE_DISCIPLINE,
    "",
    FIELD_CONCISENESS_RULES,
    "",
    STAGE_INSTRUCTIONS[stageId],
    "",
    buildCompanyBlock(),
    buildPriorContext(priorOutputs),
    "",
    `## ${stageName} — User Inputs`,
    "",
    formatAnswers(stageId),
    "",
    `Call the produce_strategic_diagnosis tool with your complete analysis when you are done.`,
  ].join("\n");
}

// ─── Session helpers ──────────────────────────────────────────────────────────

async function createSession(stageId: string, stageName: string, message: string): Promise<string> {
  const session = await client.beta.sessions.create({
    agent: AGENT_IDS[stageId],
    environment_id: ENVIRONMENT_ID,
    title: `Unit Test ${stageName} — ${COMPANY.name}`,
    metadata: { stageId, stageName, companyName: COMPANY.name, unitTest: "true" },
  });

  await client.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: message }] }],
  });

  return session.id;
}

async function pollSession(sessionId: string): Promise<Record<string, unknown> | null> {
  while (true) {
    await new Promise(r => setTimeout(r, 5000)); // poll every 5s

    try {
      const session = await client.beta.sessions.retrieve(sessionId);
      const eventsPage = await client.beta.sessions.events.list(sessionId, { limit: 1000 });
      const events = ((eventsPage as { data?: unknown[] }).data ?? []);

      // Check for completed tool call
      const toolEvent = events.find((e) => (e as Record<string, unknown>).type === "agent.custom_tool_use");
      if (toolEvent) {
        const sections = ((toolEvent as Record<string, unknown>).input ?? {}) as Record<string, unknown>;
        await client.beta.sessions.archive(sessionId).catch(() => {});
        return sections;
      }

      if (session.status === "terminated") {
        return null;
      }

      // Auto-approve MCP tool calls if requires_action
      if (session.status === "idle") {
        const lastIdle = [...events].reverse().find(
          (e) => (e as Record<string, unknown>).type === "session.status_idle"
        );
        const stopReason = lastIdle
          ? ((lastIdle as Record<string, unknown>).stop_reason as Record<string, unknown> | undefined)
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
        } else if (stopReason?.type === "end_turn") {
          console.error("  ✗ Agent finished without calling produce_strategic_diagnosis");
          return null;
        }
      }

    } catch (err) {
      console.error("  Poll error:", err);
    }
  }
}

// ─── HTML report generator ───────────────────────────────────────────────────

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(str: unknown): string {
  if (!str) return "";
  return escapeHtml(str)
    .replace(/### (.+)/g, "<h3>$1</h3>")
    .replace(/## (.+)/g, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

function generateHtml(allOutputs: Array<{ stageId: string; stageName: string; sections: Record<string, unknown> }>): string {
  const stageSections = allOutputs.map(({ stageName, stageId, sections: s }) => {
    const confidence = (s.confidence as { score?: number; rationale?: string } | undefined);
    const evidenceBase = (s.evidence_base as { sources?: Array<{ title: string; url: string }>; quotes?: string[] } | undefined);
    const assumptions = (s.assumptions as Array<{ text: string; fragility: string; testable: boolean }> | undefined) ?? [];
    const risks = (s.risks as Array<{ risk: string; severity: string; mitigation: string }> | undefined) ?? [];
    const actions = (s.actions as Array<{ action: string; owner: string; deadline: string; priority: string }> | undefined) ?? [];
    const monitoring = (s.monitoring as Array<{ metric: string; target: string; frequency: string }> | undefined) ?? [];

    // Commit-specific
    const bets = (s.strategic_bets as Array<{ bet: string; hypothesis: string; investment: string }> | undefined) ?? [];
    const okrs = (s.okrs as Array<{ objective: string; key_results: string[] }> | undefined) ?? [];
    const hdp = (s.hundred_day_plan as Array<{ milestone: string; timeline: string; owner: string; deliverable: string }> | undefined) ?? [];
    const kill = (s.kill_criteria as Array<{ criterion: string; trigger: string; response: string }> | undefined) ?? [];

    const stageColor: Record<string, string> = {
      frame: "#374151", diagnose: "#1e40af", decide: "#6d28d9", position: "#065f46", commit: "#92400e",
    };
    const color = stageColor[stageId] ?? "#111827";

    return `
    <div class="stage">
      <div class="stage-header" style="border-left: 4px solid ${color}; padding-left: 16px;">
        <h2 style="color: ${color}; margin: 0 0 4px;">${escapeHtml(stageName)}</h2>
        ${confidence ? `<span class="confidence">Confidence: ${Math.round((confidence.score ?? 0) * 100)}%</span>` : ""}
      </div>

      <div class="section">
        <h3>Executive Summary</h3>
        <div class="prose"><p>${renderMarkdown(s.executive_summary)}</p></div>
      </div>

      <div class="section">
        <h3>What Matters</h3>
        <div class="prose"><p>${renderMarkdown(s.what_matters)}</p></div>
      </div>

      <div class="section">
        <h3>${stageId === "frame" ? "Core Strategic Question" : stageId === "diagnose" ? "Emerging Direction" : stageId === "position" ? "Positioning Recommendation" : "Recommendation"}</h3>
        <div class="prose"><p>${renderMarkdown(s.recommendation)}</p></div>
      </div>

      <div class="section">
        <h3>Business Implications</h3>
        <div class="prose"><p>${renderMarkdown(s.business_implications)}</p></div>
      </div>

      ${risks.length > 0 ? `
      <div class="section">
        <h3>Risks</h3>
        <table class="data-table">
          <thead><tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr></thead>
          <tbody>
            ${risks.map(r => `<tr><td>${escapeHtml(r.risk)}</td><td class="severity-${r.severity}">${escapeHtml(r.severity)}</td><td>${escapeHtml(r.mitigation)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${assumptions.length > 0 ? `
      <div class="section">
        <h3>Assumptions</h3>
        <table class="data-table">
          <thead><tr><th>Assumption</th><th>Fragility</th><th>Testable</th></tr></thead>
          <tbody>
            ${assumptions.map(a => `<tr><td>${escapeHtml(a.text)}</td><td class="severity-${a.fragility}">${escapeHtml(a.fragility)}</td><td>${a.testable ? "Yes" : "No"}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${actions.length > 0 ? `
      <div class="section">
        <h3>Actions</h3>
        <table class="data-table">
          <thead><tr><th>Action</th><th>Owner</th><th>Deadline</th><th>Priority</th></tr></thead>
          <tbody>
            ${actions.map(a => `<tr><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.owner)}</td><td>${escapeHtml(a.deadline)}</td><td>${escapeHtml(a.priority)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${monitoring.length > 0 ? `
      <div class="section">
        <h3>Monitoring</h3>
        <table class="data-table">
          <thead><tr><th>Metric</th><th>Target</th><th>Frequency</th></tr></thead>
          <tbody>
            ${monitoring.map(m => `<tr><td>${escapeHtml(m.metric)}</td><td>${escapeHtml(m.target)}</td><td>${escapeHtml(m.frequency)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${bets.length > 0 ? `
      <div class="section">
        <h3>Strategic Bets</h3>
        <table class="data-table">
          <thead><tr><th>Bet</th><th>Hypothesis</th><th>Investment</th></tr></thead>
          <tbody>
            ${bets.map(b => `<tr><td><strong>${escapeHtml(b.bet)}</strong></td><td>${escapeHtml(b.hypothesis)}</td><td>${escapeHtml(b.investment)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${okrs.length > 0 ? `
      <div class="section">
        <h3>OKRs</h3>
        ${okrs.map(o => `
          <div class="okr-block">
            <div class="okr-objective">${escapeHtml(o.objective)}</div>
            <ul>${(o.key_results ?? []).map(kr => `<li>${escapeHtml(kr)}</li>`).join("")}</ul>
          </div>
        `).join("")}
      </div>` : ""}

      ${hdp.length > 0 ? `
      <div class="section">
        <h3>100-Day Plan</h3>
        <table class="data-table">
          <thead><tr><th>Timeline</th><th>Milestone</th><th>Owner</th><th>Deliverable</th></tr></thead>
          <tbody>
            ${hdp.map(m => `<tr><td><strong>${escapeHtml(m.timeline)}</strong></td><td>${escapeHtml(m.milestone)}</td><td>${escapeHtml(m.owner)}</td><td>${escapeHtml(m.deliverable)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${kill.length > 0 ? `
      <div class="section">
        <h3>Kill Criteria</h3>
        <table class="data-table">
          <thead><tr><th>Criterion</th><th>Trigger</th><th>Response</th></tr></thead>
          <tbody>
            ${kill.map(k => `<tr><td>${escapeHtml(k.criterion)}</td><td>${escapeHtml(k.trigger)}</td><td>${escapeHtml(k.response)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${evidenceBase?.sources && evidenceBase.sources.length > 0 ? `
      <div class="section evidence">
        <h3>Evidence Base</h3>
        <ul>${evidenceBase.sources.map(src => `<li><a href="${escapeHtml(src.url)}">${escapeHtml(src.title || src.url)}</a></li>`).join("")}</ul>
        ${evidenceBase.quotes && evidenceBase.quotes.length > 0 ? `<ul class="quotes">${evidenceBase.quotes.map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ul>` : ""}
      </div>` : ""}

      ${confidence?.rationale ? `
      <div class="section confidence-block">
        <h3>Confidence Rationale</h3>
        <p>${escapeHtml(confidence.rationale)}</p>
      </div>` : ""}
    </div>`;
  }).join('<div class="page-break"></div>');

  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inflexion Strategy — ${COMPANY.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.7; color: #111827; max-width: 900px; margin: 0 auto; padding: 48px 32px; }
    h1 { font-size: 36px; font-weight: 800; letter-spacing: -0.02em; color: #111827; }
    h2 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 12px; }
    h3 { font-size: 15px; font-weight: 700; color: #374151; margin: 20px 0 8px; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; }
    p { margin-bottom: 12px; }
    .cover { border-bottom: 3px solid #111827; padding-bottom: 32px; margin-bottom: 48px; }
    .cover-meta { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; margin-bottom: 12px; font-family: system-ui, sans-serif; }
    .cover-sub { font-size: 16px; color: #374151; margin-top: 8px; }
    .stage { margin-bottom: 48px; }
    .stage-header { margin-bottom: 24px; }
    .confidence { font-size: 12px; font-weight: 600; color: #6b7280; font-family: system-ui, sans-serif; background: #f3f4f6; padding: 2px 10px; border-radius: 20px; display: inline-block; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .prose p { color: #374151; }
    .prose h2, .prose h3 { font-family: Georgia, serif; text-transform: none; letter-spacing: 0; font-size: 15px; color: #111827; margin-top: 16px; }
    .data-table { width: 100%; border-collapse: collapse; font-family: system-ui, sans-serif; font-size: 13px; margin-top: 8px; }
    .data-table th { text-align: left; padding: 6px 10px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .data-table tr:last-child td { border-bottom: none; }
    .severity-high { color: #dc2626; font-weight: 600; }
    .severity-medium { color: #d97706; font-weight: 600; }
    .severity-low { color: #059669; font-weight: 600; }
    .okr-block { margin-bottom: 16px; padding: 12px 16px; background: #f9fafb; border-radius: 6px; }
    .okr-objective { font-weight: 700; color: #111827; font-family: system-ui, sans-serif; font-size: 13px; margin-bottom: 6px; }
    .okr-block ul { padding-left: 20px; }
    .okr-block li { font-size: 13px; color: #374151; font-family: system-ui, sans-serif; margin-bottom: 2px; }
    .evidence { background: #f9fafb; padding: 16px; border-radius: 6px; }
    .evidence ul { padding-left: 20px; }
    .evidence li { font-size: 12px; color: #374151; font-family: system-ui, sans-serif; margin-bottom: 4px; }
    .evidence a { color: #1e40af; }
    .quotes { margin-top: 8px; font-style: italic; }
    .confidence-block p { font-size: 13px; color: #6b7280; font-family: system-ui, sans-serif; font-style: italic; }
    .page-break { page-break-after: always; margin: 48px 0; border-top: 1px solid #e5e7eb; }
    @media print {
      body { padding: 24px; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <p class="cover-meta">Nth Layer · Inflexion · Unit Test Output</p>
    <h1>${escapeHtml(COMPANY.name)}</h1>
    <p class="cover-sub">Five-stage strategy analysis — ${now}</p>
    <p class="cover-sub" style="margin-top: 4px; font-size: 13px; color: #6b7280; font-family: system-ui, sans-serif;">
      Territory: ${escapeHtml(COMPANY.territory)} &nbsp;·&nbsp; ICP: ${escapeHtml(COMPANY.icp1 ?? "")}; ${escapeHtml(COMPANY.icp2 ?? "")}
    </p>
  </div>
  ${stageSections}
  <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; font-family: system-ui, sans-serif; text-align: center;">
    Generated by Inflexion · Nth Layer · ${now} · Powered by Claude
  </div>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STAGES = [
  { id: "frame",    name: "Frame"    },
  { id: "diagnose", name: "Diagnose" },
  { id: "decide",   name: "Decide"   },
  { id: "position", name: "Position" },
  { id: "commit",   name: "Commit"   },
];

async function main() {
  console.log(`\n🚀 Inflexion Unit Test — ${COMPANY.name}`);
  console.log(`   Territories: ${COMPANY.territory}`);
  console.log(`   ICP: ${COMPANY.icp1}\n`);

  const outputDir = path.resolve("scripts", "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const allOutputs: Array<{ stageId: string; stageName: string; sections: Record<string, unknown> }> = [];

  for (const stage of STAGES) {
    console.log(`⏳ Running Stage: ${stage.name}...`);

    const message = buildMessage(stage.id, stage.name, allOutputs);
    const sessionId = await createSession(stage.id, stage.name, message);
    console.log(`   Session: ${sessionId}`);

    const sections = await pollSession(sessionId);
    if (!sections) {
      console.error(`   ✗ Stage ${stage.name} failed — agent produced no output`);
      process.exit(1);
    }

    allOutputs.push({ stageId: stage.id, stageName: stage.name, sections });
    const conf = (sections.confidence as { score?: number } | undefined)?.score;
    console.log(`   ✓ ${stage.name} complete${conf !== undefined ? ` (confidence: ${Math.round(conf * 100)}%)` : ""}`);
  }

  // Write JSON
  const jsonPath = path.join(outputDir, `haiilo-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(allOutputs, null, 2));
  console.log(`\n📄 JSON saved: ${jsonPath}`);

  // Write HTML
  const htmlPath = path.join(outputDir, `haiilo-${timestamp}.html`);
  fs.writeFileSync(htmlPath, generateHtml(allOutputs));
  console.log(`📄 HTML saved: ${htmlPath}`);
  console.log(`\n✅ Done. Open the HTML file in a browser and use File → Print → Save as PDF.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
