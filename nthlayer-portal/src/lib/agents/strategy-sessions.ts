import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

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
  commit: "agent_011CZzKHr5KTkHYsLYcn2ke7",
  // competitor_intel: uses the diagnose agent as base (web research + produce_strategic_diagnosis tool)
  // TODO: create a dedicated competitor intel agent in Anthropic console and replace this ID
  competitor_intel: "agent_011CZumeXoZuFJ35jRA8Ta2R",
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
  // competitor_intel only — the target competitor to analyse
  competitorTarget?: { name: string; url: string };
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
  - Do NOT return confidence.score above 0.70 unless you have retrieved and cited at least 10 distinct external URLs in this session
  - Do NOT return confidence.score above 0.80 unless you have retrieved and cited at least 15 distinct external URLs
  - Do NOT return confidence.score above 0.85 under any circumstances — all strategic analysis contains irreducible uncertainty
  - Do NOT return confidence.score above 0.60 for any claim about competitor internal operations, private company financials, or future market conditions
  - If the user's inputs contradict external evidence you've found, lower the confidence score accordingly and note the contradiction in your rationale
- RESEARCH VOLUME REQUIREMENT: A high-quality strategic report requires substantial research. Do not call the output tool until you have fetched and read at least 10 distinct URLs. For Frame and Diagnose stages the minimum is 15 URLs. Depth of research is directly correlated with report quality.
- Quote specific phrases directly from the user inputs rather than paraphrasing them
- Do not invent competitor behaviours, market sizes, or growth rates
- NEVER summarise from search snippets alone — always fetch and read the actual page before citing it

## Cost & Revenue Rules — MANDATORY (applies to ALL output fields)
- NEVER include cost estimates, budget figures, dollar amounts, headcount numbers, or salary ranges in any field
- NEVER include revenue projections, ARR targets, or expected financial outcomes — these are unknowable without financial modelling
- Focus on direction, position, and strategic logic — not financial specifics
- If the user has provided financial data as context, you may reference it analytically (e.g. "current ARR suggests mid-market pricing pressure") but do not project forward or estimate costs`;

// ─── Field conciseness rules (injected into all stages) ──────

const FIELD_CONCISENESS_RULES = `## Structured Field Conciseness — MANDATORY

Every headline field in the structured arrays must be SHORT and SCANNABLE. These are displayed as card titles in the UI — the detail belongs in the report sections, not here.

ACTIONS — actions[].action:
- ONE sentence. Maximum 12 words. Start with a strong active verb. No sub-clauses, no context, no rationale.
- BAD: "Redirect MC2 engagement to produce analyst-ready positioning and briefing pack as first deliverable. The narrative must articulate the advocacy-intranet-listening integration as a unique platform proposition — not a feature list."
- GOOD: "Commission an analyst-ready positioning and briefing pack from MC2."

RISKS — risks[].risk:
- ONE sentence. Maximum 12 words. Name the risk sharply — not the full explanation.
- BAD: "[PORTFOLIO-LEVEL] Advocacy concentration risk — the portfolio is anchored on advocacy as the primary differentiator. Bets 1, 2, 5 and 7 all depend on advocacy resonating with enterprise buyers."
- GOOD: "Portfolio bets cluster on advocacy as a single unvalidated differentiator."
- Do NOT use [PORTFOLIO-LEVEL] or [From Stage] prefixes in the risk headline. Those belong in the mitigation.

ASSUMPTIONS — assumptions[].text:
- ONE sentence. Maximum 15 words. State the assumption cleanly.
- NEVER append metadata in the text field. No pipes (|), no "Fragility:", no "Testable:", no "Status:" — those are separate fields.
- BAD: "Enterprise buyers will value the integrated proposition enough to shortlist Haiilo over Gartner Leaders. | Fragility: high | Testable: yes (first 15 enterprise conversations) | Status: unvalidated"
- GOOD: "Enterprise buyers will shortlist Haiilo over intranet-only vendors based on platform integration."

MONITORING — monitoring[].metric:
- ONE phrase or short sentence. Maximum 10 words. Name the metric only.
- Put targets in the target field. Put cadence in the frequency field. Do not append them to the metric name.
- BAD: "Advocacy qualification rate — percentage of new enterprise conversations under advocacy-integrated positioning that produce qualified pipeline"
- GOOD: "Advocacy qualification rate from enterprise conversations"`;

// ─── Red Gate instruction (injected per stage) ───────────────

const RED_GATE_INSTRUCTIONS: Record<string, string> = {
  frame: `## RED GATE ANALYSIS — MANDATORY STRUCTURED FIELD
At the end of your analysis, populate the red_gate object. This is a stage-gate assessment: can the team proceed to Diagnose, or must something be resolved first?

The red_gate object MUST use exactly these field names:
- "next_stage": "Diagnose"
- "criteria": array of objects, each with:
  - "criterion": string — what must be true to proceed (max 12 words)
  - "status": exactly one of "pass" | "risk" | "fail"
  - "evidence": string — one sentence of evidence for this status (from your research or user inputs)
- "verdict": exactly one of "proceed" | "proceed_with_caution" | "pause"
- "rationale": string — 2–3 sentences: what the overall gate status means for timing and confidence

Produce exactly 5 criteria for Frame → Diagnose:
1. "Inflection event is defined, material, and time-bounded" — pass if the user has described a specific trigger; risk if vague; fail if absent
2. "Strategic question is crisp and answerable in 6–12 weeks" — pass if it can be answered with evidence; risk if too broad; fail if unanswerable
3. "Winning conditions are articulated for 24–36 month horizon" — pass if specific and grounded; risk if aspirational but vague; fail if absent
4. "Competitive landscape is mapped with at least 3 named rivals" — pass if web research identified 3+ competitors with positioning; risk if coverage is thin; fail if unknown
5. "Hypothesis register populated with 8+ testable hypotheses" — pass if 8+ hypotheses produced; risk if 5–7; fail if fewer than 5

Set verdict to "proceed" if 0 fails and ≤1 risk, "proceed_with_caution" if ≤1 fail or 2–3 risks, "pause" if 2+ fails.`,

  diagnose: `## RED GATE ANALYSIS — MANDATORY STRUCTURED FIELD
At the end of your analysis, populate the red_gate object. This is a stage-gate assessment: can the team proceed to Decide, or must something be resolved first?

The red_gate object MUST use exactly these field names:
- "next_stage": "Decide"
- "criteria": array of 5 objects
- "verdict": "proceed" | "proceed_with_caution" | "pause"
- "rationale": 2–3 sentences on timing and confidence

Produce exactly 5 criteria for Diagnose → Decide:
1. "Fact base is sufficient to evaluate 3+ strategic options" — pass if web research + user data supports evaluation; risk if gaps remain; fail if evidence base is too thin
2. "Binding constraint is identified and explicitly ranked" — pass if clearly named and ranked; risk if suggested but not confirmed; fail if absent
3. "ICP signal assessed: stated vs. actual ICP compared" — pass if comparison done with evidence (TrustRadius, case studies); risk if partial evidence; fail if not assessed
4. "Current competitive position is mapped against top 3 rivals" — pass if differentiation and gaps are clear; risk if one or more gaps unanalysed; fail if not done
5. "Frame hypotheses tested with evidence — none silently dropped" — pass if all hypotheses carry updated status and evidence; risk if some untested; fail if register incomplete

Set verdict: "proceed" if 0 fails ≤1 risk, "proceed_with_caution" if ≤1 fail or 2–3 risks, "pause" if 2+ fails.`,

  decide: `## RED GATE ANALYSIS — MANDATORY STRUCTURED FIELD
At the end of your analysis, populate the red_gate object. Stage gate: can the team proceed to Position?

The red_gate object fields:
- "next_stage": "Position"
- "criteria": array of 5 objects
- "verdict": "proceed" | "proceed_with_caution" | "pause"
- "rationale": 2–3 sentences

Produce exactly 5 criteria for Decide → Position:
1. "A single committed strategic direction is chosen — not a shortlist" — pass if one direction is named and defended; risk if hedged or conditional; fail if no direction chosen
2. "Decision matrix completed with 3+ options including status quo" — pass if matrix is present and scored; risk if incomplete; fail if absent
3. "Kill criteria defined for the chosen direction" — pass if 3+ kill criteria with triggers; risk if present but vague; fail if absent
4. "Trade-offs are explicitly accepted — not deferred" — pass if the report names what is being sacrificed; risk if trade-offs are acknowledged but not accepted; fail if ignored
5. "Analogous case studies validate this direction is achievable" — pass if 2+ real cases referenced with outcomes; risk if 1 case or analogies are weak; fail if no comparable cases found

Set verdict: "proceed" if 0 fails ≤1 risk, "proceed_with_caution" if ≤1 fail or 2–3 risks, "pause" if 2+ fails.`,

  position: `## RED GATE ANALYSIS — MANDATORY STRUCTURED FIELD
At the end of your analysis, populate the red_gate object. Stage gate: can the team proceed to Commit?

The red_gate object fields:
- "next_stage": "Commit"
- "criteria": array of 5 objects
- "verdict": "proceed" | "proceed_with_caution" | "pause"
- "rationale": 2–3 sentences

Produce exactly 5 criteria for Position → Commit:
1. "Primary economic buyer is defined with specificity (role, size, trigger)" — pass if named precisely; risk if broad; fail if undefined
2. "Positioning is differentiated vs. top 2 named competitors with evidence" — pass if differentiation tested against real competitor copy; risk if based on assumption; fail if generic
3. "Narrative gap analysis completed: current vs. recommended positioning" — pass if gap is explicitly named with evidence; risk if identified but unquantified; fail if absent
4. "GTM motion is aligned to how buyers actually discover and evaluate" — pass if buyer discovery channel is identified and matched to motion; risk if assumed; fail if not assessed
5. "Buyer job posting signals incorporated into positioning language" — pass if verbatim job posting language used in positioning; risk if referenced but not integrated; fail if not done

Set verdict: "proceed" if 0 fails ≤1 risk, "proceed_with_caution" if ≤1 fail or 2–3 risks, "pause" if 2+ fails.`,

  commit: `## RED GATE ANALYSIS — MANDATORY STRUCTURED FIELD
At the end of your analysis, populate the red_gate object. This is the FINAL GATE — a readiness assessment for execution.

The red_gate object fields:
- "next_stage": "Execution"
- "criteria": array of 5 objects
- "verdict": "proceed" | "proceed_with_caution" | "pause"
- "rationale": 2–3 sentences on execution readiness

Produce exactly 5 criteria for the Commit final review:
1. "Strategic bet portfolio is sized to stated capacity — no more bets than the team can resource" — pass if bet count ≤ bet_capacity input; risk if at the limit with no slack; fail if over-committed
2. "OKRs are connected to the revenue target with measurable key results" — pass if each KR has a number and deadline; risk if qualitative only; fail if OKRs absent or disconnected from revenue
3. "100-day plan has named owner roles and concrete deliverables at 30/60/90" — pass if all three milestones have owners and deliverables; risk if some are vague; fail if plan is incomplete
4. "Anti-portfolio is explicitly named — the team knows what they are NOT doing" — pass if named options that were rejected are listed with rationale; risk if partial; fail if absent
5. "Governance cadence defined: who reviews what, and how often" — pass if weekly/monthly/quarterly rhythm is set; risk if cadence exists but is vague; fail if not defined

Set verdict: "proceed" if 0 fails ≤1 risk, "proceed_with_caution" if ≤1 fail or 2–3 risks, "pause" if 2+ fails.`,
};

// ─── Stage-specific instructions ─────────────────────────────

// ─── Sub-heading formatting requirement (injected into all stages) ────────────
// The report renderer parses ### headings to create navigable section pills.
// Each stage must use the exact ### headings listed in its instructions.

const STAGE_INSTRUCTIONS: Record<string, string> = {
  frame: `## Stage Instructions: FRAME
Define the decision. Do not answer it.

Your role is to: DEFINE the strategic problem, FRAME what changed and why it matters now, SURFACE key tensions and constraints, BOUND the decision space, PRESENT the competitive landscape overview, POPULATE a hypothesis register from user inputs and research, and ARTICULATE winning conditions without pre-committing to a path.

FRAME MUST NOT:
- Recommend a chosen direction or imply the answer is already known
- Produce business implications, operational metrics, or action plans
- Hard-code geographic sequencing or market entry sequence as if already decided
- Embed winning conditions that pre-solve the decision rather than frame it
- Use verbs from later stages: commit, choose, assign, govern, target, position

EPISTEMIC DISCIPLINE — MANDATORY:
Preserve the difference between user input and established fact:
- "Leadership hypothesis: ..." — a belief the team holds but has not validated
- "Stated preference: ..." — a direction leadership is inclined toward
- "Candidate direction: ..." — something to pressure-test in Diagnose
Do NOT rewrite user-stated beliefs as conclusions, facts, or recommendations.

INVESTOR CONTEXT — IF PROVIDED:
When investor_owner is provided, frame governance expectations accordingly. PE-backed companies face different return timelines and board accountability than VC-backed or bootstrapped companies. Note the implications for the investment_horizon.

ARR BAND + HEADCOUNT + GROWTH RATE — IF PROVIDED:
Use these to contextualise the strategic moment. Flag if growth rate appears above or below what web research suggests is median for this ARR band and sector.

TOP CONCERNS — IF PROVIDED:
Each concern stated by the user becomes a hypothesis in the Hypothesis Register. Label them: "User-stated concern: [concern] → Hypothesis: [testable statement]".

ASSUMPTIONS TO TEST — IF PROVIDED:
Each assumption becomes an explicit, labelled hypothesis. Tag: Source: user-stated. Tested in: Diagnose.

RESEARCH — MANDATORY DEEP READ. This is not optional and not a skim. Do ALL of the following before writing a single word of output. Search first to find URLs, then fetch_url to read the actual page. Snippets alone are never sufficient — you must fetch and read the full page content for every mandatory item below.

MINIMUM RESEARCH BAR: You must retrieve and cite at least 15 distinct external URLs before calling the output tool. If you have fewer than 15 cited sources, do more research.

── COMPANY DEEP READ (fetch ALL of these) ──────────────────────────────────────

1. fetch_url(company homepage) — read the full page: hero copy, tagline, sub-headline, primary CTA, value proposition language verbatim
2. fetch_url(company /about or /about-us) — founding story, mission, leadership team names and backgrounds, office locations
3. fetch_url(company /product or /platform or /features or /solution) — full feature set, capability language, product positioning verbatim
4. fetch_url(company /customers or /case-studies or /clients) — which logos are featured, which sectors, what outcomes are claimed, what use cases are highlighted
5. fetch_url(company /pricing) — exact tier names, pricing model (seat/usage/flat), enterprise vs. self-serve signals, trial availability, what's gated
6. fetch_url(company /blog or /resources or /insights) — most recent 3–5 posts: what topics are they publishing on? What narrative are they building? This reveals product investment direction and market positioning intent.
7. fetch_url(company /partners or /integrations or /marketplace) — who are their technology partners? What ecosystem are they embedded in?
8. Search "site:linkedin.com/company [company name]" → fetch the LinkedIn company page — employee count, HQ, description, recent company updates visible in snippets

── MARKET & ANALYST CONTEXT (fetch ALL of these) ────────────────────────────────

9. Search "Gartner Magic Quadrant [category] 2024 2025" → fetch the report summary page — read exact quadrant placements, Leader names, challenger tier, published date
10. Search "Forrester Wave [category] 2024 2025" → fetch the report page — tier placements, Strong Performer vs. Leader distinction
11. Search "[category] market size forecast CAGR 2024 2025 2026" → fetch the top analyst or market research page (Grand View Research, MarketsandMarkets, IDC, Gartner) — read the headline TAM figure, CAGR, key growth drivers
12. Search "[category] market trends 2025" → fetch top trade press article — what are analysts and practitioners saying is changing in this space right now?
13. Search "[company name] TrustRadius reviews" → fetch_url the full TrustRadius profile — read: category placement, overall rating, review count, top 5 reviewer quotes verbatim, recurring praise and complaint themes (NOTE: use TrustRadius not G2 — G2 blocks automated access)
14. Search "[company name] Capterra reviews" → fetch_url the Capterra profile — read rating, review count, top reviewer quotes, feature ratings
15. Search "[company name] funding Crunchbase" → read the search snippet carefully for: total funding amount, last round type and size, lead investors, founding year. Also search "[company name] funding announcement" → fetch the most recent press release for primary source confirmation.

── COMPETITOR DEEP READ (fetch ALL of these) ────────────────────────────────────

16. Search "[company name] alternatives TrustRadius" → fetch_url the alternatives page — read the full list of competitors returned (typically 8–15). Note which ones appear repeatedly.
17. Search "[category] top vendors 2024 2025" → fetch top analyst or review site article listing the competitive landscape
18. For each of the TOP 5 COMPETITORS identified: fetch_url(competitor homepage) — read the hero headline, sub-headline, primary CTA, and positioning language verbatim. What category do they claim? What pain do they lead with?
19. For the TOP 2–3 COMPETITORS: fetch_url(competitor /pricing) — read actual tier names, price points, packaging. What's their pricing model vs. the company?
20. For the TOP 2–3 COMPETITORS: fetch_url(competitor /customers or /case-studies) — who are their reference customers? Do they overlap with the company's ICP?
21. Search "[category] consolidation OR acquisition OR merger 2024 2025" → fetch top article — is M&A activity reshaping the competitive landscape?
22. Search "[category] AI features OR [category] AI integration 2024 2025" → fetch top article — how is AI changing the product expectations in this category?

── RECENT NEWS & SIGNALS (fetch ALL of these) ───────────────────────────────────

23. Search "[company name] news 2024 2025" → fetch the top 2 news articles — any funding, acquisitions, leadership changes, product launches, customer wins, layoffs, or strategic pivots
24. Search "[company name] press release 2024 2025" → fetch the company's most recent press release — what are they announcing publicly?
25. Search "[company name] CEO OR CPO interview 2024 2025" → fetch any recent executive interview — what is the leadership saying about strategy and direction?
26. Search "[category] news 2025" → fetch top trade press article — what macro forces, platform changes, or category shifts are happening right now?

── HIRING PULSE (fetch ALL of these) ────────────────────────────────────────────

27. fetch_url(company /careers or /jobs) — read the full list of open roles: total count, which functions are hiring, any new senior leadership roles, geographic signals
28. Search "site:greenhouse.io [company name]" OR "site:lever.co [company name]" OR "site:ashbyhq.com [company name]" → fetch the ATS results page — structured list of live roles
29. For TOP 3 COMPETITORS: search "[competitor name] jobs site:indeed.com" → scan result snippets for role titles and functions being hired (snippets are sufficient for Frame — full fetch in Diagnose)
30. Interpret hiring as strategy: heavy sales hiring = commercial push; ML/AI engineering surge = product investment; first "Head of Partnerships" = ecosystem play; "Country Manager [city]" = geo expansion confirmed; CS expansion = retention or upsell motion

ALL SOURCES MUST BE CITED. Every factual claim in your output must trace to a URL you actually fetched in this session. Do not use search snippet text as a citation — you must have fetched the page.

Ground the frame in what pages actually say. Do not infer from domain names or snippet previews.

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### The Strategic Moment", then "### Winning Conditions"
- In what_matters: use "### Competitive Landscape Overview", "### Decision Boundaries", "### Hiring Signal"
- In recommendation: use "### Core Strategic Question"
- In business_implications: use "### Strategic Tensions" — surface the key tensions the cascade must resolve. The Hypothesis Register is now a separate structured field (see below) — do NOT list hypotheses in the business_implications text.

STAGE OUTPUT RULES — FRAME:
- The recommendation field is the CORE STRATEGIC QUESTION — the decision this workflow must answer, carried into Diagnose. Frame as: "The core strategic question this workflow must answer is..." Capture any user-stated beliefs here with explicit labels (leadership hypothesis, stated preference) so they are visible but not concluded.
- Do NOT return actions — execution steps are premature before diagnosis.
- DO populate monitoring with 2–3 watch signals: market or competitor moves that would shift the frame.
- Focus risks on threats to the frame itself: what would invalidate the question or change the winning conditions.

HYPOTHESIS REGISTER — MANDATORY STRUCTURED ARRAY:
Populate the hypothesis_register array with 8–15 testable hypotheses drawn from user inputs and research. Each object MUST use exactly these field names:
- "hypothesis": string — the testable statement (one sentence, max 20 words). Start with "We believe..." or "The assumption is that..."
- "source": exactly one of "user_input" | "web_research" | "inferred"
- "tested_in": exactly one of "diagnose" | "decide" | "position" | "commit" — which stage should resolve this
- "status": "untested" — ALWAYS this value in Frame
- "evidence": "" — ALWAYS empty string in Frame; downstream stages populate this
Example: { "hypothesis": "Enterprise buyers in DACH convert at 2× the rate of UK buyers", "source": "user_input", "tested_in": "diagnose", "status": "untested", "evidence": "" }

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement (max 15 words, no pipes or metadata in this field)
- "fragility": "low" | "medium" | "high" — how catastrophic it would be if wrong
- "testable": boolean — whether this can be validated with data or experiment in 90 days
- "status": "unvalidated" — always use this value
Example: { "text": "Enterprise buyers will pay $50k+ ACV", "fragility": "high", "testable": true, "status": "unvalidated" }

${RED_GATE_INSTRUCTIONS.frame}`,

  diagnose: `## Stage Instructions: DIAGNOSE
Assess, test, identify, explain, compare, isolate, and infer. Do not choose a direction.

Your role is to establish what is true: across product, market, commercial performance, and operating constraints. Identify root causes. Surface contradictions. Pressure-test the candidate theses from Frame.

DIAGNOSE MUST NOT:
- Make the final strategic choice or sound as though the direction has already been selected
- Introduce named strategic bets, portfolio language, or a bet stack
- Assign ownership, deadlines, or action plans
- Define market entry sequencing or geographic commitment — that is Decide's role
- Use verbs from later stages: commit, choose, assign, position, govern

WHERE WINNING / ICP SIGNAL — MANDATORY:
This is the single most important diagnostic data point. For the where_winning and winning_outside_target inputs:
- Compare stated ICP against evidence from web research (TrustRadius reviews, case studies, comparison articles)
- Analyse out-of-ICP wins: are they noise (sales indiscipline) or signal (market pulling toward a broader/different use case)?
- If signal: identify what the out-of-ICP wins have in common (industry, size, buying trigger, use case)
- Label the section clearly: "### The ICP Signal"

BINDING CONSTRAINT — RANKED:
The user has ranked constraints most-binding-first. Use this ordering throughout the report. The top constraint shapes every other finding. Name it explicitly in Section: "The binding constraint is [X]. This shapes what the strategy can realistically do."

RETENTION SIGNAL + WIN RATE + NRR:
If provided, validate against current SaaS benchmarks (search for these). State explicitly whether metrics are above, at, or below benchmark. Quantify the gap.

BUYING TRIGGER — CRITICAL:
If "Don't know" is selected, flag this as the #1 evidence gap in the report. State: "The buying trigger is unknown. This is the most critical data gap in the diagnosis — it makes it impossible to optimise the sales motion or position the product accurately."

MOAT ASSESSMENT:
Test each claimed moat against evidence. Do not validate what the evidence doesn't support. Be explicit about claimed advantages that don't survive scrutiny.

RESEARCH — use web search AND fetch_url. Search to find URLs, then fetch to read actual content.

COMPANY REVIEW SITES — fetch full pages, not just snippets:
- Search "[company name] TrustRadius reviews" → fetch_url the TrustRadius profile — read the category, average rating, review count, and representative review quotes verbatim (PREFERRED: TrustRadius is fully accessible)
- Search "[company name] Capterra reviews" → fetch_url — read category and top reviews
- Search "[company name] G2 reviews" → use the Brave Search SNIPPETS only — G2 blocks automated fetching, but the snippet often surfaces the star rating and a short review excerpt
- Compare what customers say on review sites vs. what the company claims on its own website (fetched in Frame)

COMPETITIVE BENCHMARKING — fetch actual data pages:
- Search "Gartner Magic Quadrant [category] 2024" → fetch_url the result page — confirm exact quadrant placement, Leader count, whether the company is included
- Search "Forrester Wave [category] 2024" → fetch_url — tier, inclusion, publication date
- For each major competitor (top 3): fetch_url(competitor /product or /platform page) — identify AI features, recent capability additions, integration depth
- Search "[competitor name] funding 2024 2025" → fetch_url top result — confirm scale and burn rate signals

BENCHMARKS — fetch the source data:
- Search "SaaS growth benchmarks [ARR band] 2024" → fetch_url top result (SaaS Capital, OpenView, or Benchmarkit)
- Search "NRR benchmarks SaaS 2024" → fetch_url top result — compare against the user's stated NRR

TALENT & CULTURE:
- Search "[company name] Glassdoor" → fetch_url the Glassdoor company page — gets overall rating number and page structure, but individual review text requires login. Use what loads (rating, CEO approval %) and supplement with search snippet quotes.
- Search "[company name] LinkedIn jobs" → fetch_url the LinkedIn company page — gets headcount, location, description, and "1,001–5,000 employees" size bands. Job listings themselves require login — use job board sources below instead.

HIRING SIGNAL ANALYSIS — HIGH IMPACT. Do all of these:

COMPANY JOB POSTINGS (own hiring):
- Fetch the company's careers page directly (/careers, /jobs, /join-us) — get a full list of open roles
- Search "site:greenhouse.io [company name]" OR "site:lever.co [company name]" OR "site:ashbyhq.com [company name]" → fetch the ATS page — gets the actual live job list without login
- Search "[company name] jobs site:indeed.com" → fetch the Indeed company page — publicly accessible job listings with full descriptions
- Search "[company name] jobs site:wellfound.com" → fetch Wellfound company page — shows role count, functions, seniority, equity bands (good for early-stage companies)
- From these listings, extract and report:
  * Total open role count and trend signal (if detectable)
  * Function breakdown: what % engineering vs. sales vs. CS vs. marketing vs. ops?
  * Seniority mix: building IC layers vs. hiring senior leaders — which functions are being led vs. built?
  * New functions appearing for the first time (signals strategic expansion)
  * Geographic signals: new city/country in job titles = expansion in flight
  * Named technology requirements in job specs (what tools/platforms do they expect hires to already know?)
  * Any roles that reveal product direction (e.g. "ML Infrastructure Engineer" = AI investment; "Enterprise Account Executive, DACH" = geographic push)

COMPETITOR HIRING SIGNALS (for top 2–3 competitors):
- For each competitor: search "[competitor name] jobs site:indeed.com" → fetch the Indeed company page or scan snippets
- Search "site:greenhouse.io [competitor name]" → fetch their ATS listing page
- Extract: total open roles vs. company (are they hiring faster/slower?), which functions are growing, any geographic expansion signals, new technical capability signals
- Interpret gaps: if a competitor is hiring ML engineers at 3× your rate, they are building a capability you are not — name this explicitly

BUYER ROLE JOB SIGNALS (what your buyers are hiring for):
- Search "[primary ICP role e.g. Head of Internal Comms, VP Marketing Ops] [category e.g. intranet software, employee engagement] tools" → fetch 2–3 job postings from Indeed, Wellfound, or company careers pages
- From these listings extract: what tools/platforms are listed as required or preferred? What skills are expected? What outcomes are buyers being hired to deliver?
- This reveals what the buyer's tech stack looks like TODAY — not what they wish for, but what they're already using and expected to know

Report all hiring signals under "### Hiring Signals" in what_matters. Use concrete numbers where available. Cite the source URLs.

CUSTOMER USE CASES:
- fetch_url(company /customers or /case-studies) if not already fetched in Frame — which logos, sectors, use cases
- Search "[company name] customer story [sector]" → fetch_url 2–3 case study pages — what problems are being solved, what measurable outcomes are claimed

Cite URLs for all externally sourced claims. Do not soften difficult findings.

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Business Assessment"
- In what_matters: use "### Product-Market Fit", "### Competitive Landscape", "### Growth Rate & Benchmark Position", "### Hiring Signals"
- In recommendation: use "### Emerging Direction", "### Benchmark Gaps"
- In business_implications: use "### The ICP Signal", "### Resource-Capability-Ambition Gap", "### Buyer Stack & Tool Environment"

WHAT MUST BE PRESSURE-TESTED:
End the Emerging Direction section with an explicit list: "Before Decide can commit, these must be pressure-tested:" followed by 3–5 specific questions or hypotheses the Decide stage must resolve.

STAGE OUTPUT RULES — DIAGNOSE:
- The recommendation field is EMERGING DIRECTION — what the diagnostic evidence points toward. This is NOT a committed direction. Frame as: "The evidence suggests the priority direction is..." and explain what the data supports.
- Do NOT return actions — you are diagnosing, not prescribing.
- DO populate monitoring with 3–4 diagnostic metrics: signals that would confirm the diagnosis or reveal it needs revision.
- Distinguish NEW assumptions from those inherited from Frame. Mark inherited assumptions with "[From Frame]".

ICP SIGNAL — MANDATORY STRUCTURED FIELD:
Populate the icp_signal object by comparing the stated ICPs (from the company context block) against what public evidence shows:
- "stated_icp": copy the stated ICP(s) from the company context block verbatim (1–2 sentences)
- "actual_icp": describe what review sites (TrustRadius, Capterra), case study logos, and G2 snippets actually suggest about who uses and values the product (1–2 sentences)
- "alignment": "aligned" if stated and actual match well | "partial" if there's one notable gap | "divergent" if the evidence contradicts the stated ICP materially
- "divergence_note": if aligned → "" | if partial or divergent → one sentence on the specific gap (e.g. "Case studies skew SMB but stated ICP is mid-market enterprise")
- "signal_strength": "strong" if 3+ evidence sources found | "moderate" if 1–2 | "weak" if evidence was thin

HYPOTHESIS REGISTER — MANDATORY. Carry forward and update:
Look in the prior Frame output for the hypothesis_register array. Populate your hypothesis_register with ALL entries from Frame, updated based on what this stage found. For each entry:
- Keep "hypothesis", "source", and "tested_in" unchanged
- Update "status": "validated" if evidence confirms it | "at_risk" if evidence weakens it | "invalidated" if evidence contradicts it | "untested" if this stage was not able to test it
- Add "evidence": one concise sentence of what you found (from web research or user inputs) that informs the status. Empty string if untested.
- You MAY add NEW hypotheses surfaced by Diagnose research — set tested_in to "decide" | "position" | "commit", status to "untested", evidence to ""
- Do NOT remove any hypotheses from Frame. Carry all forward.

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement (max 15 words, no pipes or metadata in this field)
- "fragility": "low" | "medium" | "high"
- "testable": boolean
- "status": "unvalidated"
Example: { "text": "Enterprise buyers will pay $50k+ ACV", "fragility": "high", "testable": true, "status": "unvalidated" }

${RED_GATE_INSTRUCTIONS.diagnose}`,

  decide: `## Stage Instructions: DECIDE
Compare, reject, choose, prioritise, state, gate. This is the first stage where a committed strategic direction is produced.

Your role is to surface genuine strategic options (including inaction), pressure-test each against the investor success criteria and priority outcome the user has stated, then CHOOSE ONE DIRECTION. Explain why this path beats the alternatives. Define what must be true, the trade-offs accepted, and the conditions under which this decision reverses.

DECIDE MUST NOT:
- Assign owners, titles, or named individuals to workstreams
- Include day-30, day-60, or day-90 action plans, milestones, or execution workstreams
- Include OKRs, governance cadence, or resource allocation
- Define GTM motions, buyer personas in detail, or messaging
- Name a formal strategic bet portfolio
- Include operational governance or team structure
These belong in Commit. Including them here contaminates the cascade.

LEADERSHIP INSTINCT — USE AS INPUT, NOT CONCLUSION:
The user's instinct is a directional signal, not the answer. Evaluate it honestly against the evidence. If the evidence contradicts their instinct, say so directly.

WILLING TO GIVE UP — FLAG "NOTHING":
If the user selected "Nothing — unwilling to give anything up", flag this explicitly: "The stated willingness to give up nothing creates strategic tension. Real strategic choice requires accepting trade-offs. The report will note this constraint and its implications."

MANDATED DIRECTION — IF PROVIDED:
Treat it as a constraint. Evaluate it against the evidence. If the evidence contradicts it, say so directly: "The mandated direction is [X]. The evidence [supports / partially supports / contradicts] this. Specifically: [evidence]."

INVESTOR SUCCESS CRITERIA:
Use the investor's evaluation criteria to weight the decision matrix. The recommended option must score well against these criteria — or the report must explain why qualitative factors override the scoring.

DECISION MATRIX — MANDATORY:
Produce a weighted decision matrix scoring all options (3–5 options including status quo). Criteria and weights:
- Resource fit: HIGH
- Competitive defensibility: HIGH
- Investor/board alignment: HIGH
- Time-to-validation: MEDIUM
- Risk profile: MEDIUM
- Market size: MEDIUM
Score each option 1–5 on each criterion. Show the matrix. If the recommended option doesn't score highest, explain why.

COST OF INACTION — MANDATORY SECTION:
Quantify where possible: growth gap vs. competitors over 12–18 months, analyst position erosion timeline, window closure risk.

RESEARCH — validate the external environment. Search to find URLs, then fetch_url to read the actual content.

MARKET CONDITIONS VALIDATION:
- For each strategic option being evaluated: search for evidence that the conditions enabling it exist right now
- Search "[category] consolidation trend 2024 2025" → fetch_url top analyst or trade press article
- Search "Niche Players [category] Gartner acquisition 2024" → fetch_url — what has happened to sub-scale players?

COMPARABLE CASE STUDIES — fetch, don't summarise from snippets:
- Search "[analogous company] repositioning [direction] case study" → fetch_url 2–3 articles
- Read what actually happened: timeline, outcome, investor reaction, market response
- Quote specific outcomes: ARR change, valuation multiple change, analyst category shift

COMPETITOR PRICING & PACKAGING — fetch actual pricing pages:
- For the top 2–3 competitors: fetch_url(competitor /pricing) — read actual tiers, price points, packaging logic
- Note what capabilities are bundled vs. add-on, what tier enterprise features sit at
- Search "[competitor name] pricing change 2024" → fetch_url — any recent repricing signals

CATEGORY ADJACENCY:
- Search "TrustRadius [recommended direction] category" → fetch_url the TrustRadius category page — does the category exist? How many vendors are listed? (NOTE: G2 category pages block automated access — use TrustRadius instead)
- Search "Gartner [recommended direction] market guide 2024" → fetch_url — is this a recognised category?

COMPETITOR HIRING AS OPTION VALIDATOR — mandatory for each strategic option being evaluated:
- For the top 2–3 competitors relevant to each option: search "[competitor name] jobs site:indeed.com" or "site:greenhouse.io [competitor name]" → check whether they are hiring to pursue the SAME direction
- If a competitor is aggressively hiring sales reps in a geography you are considering: they are moving there too — adjust timing and defensibility score accordingly
- If a competitor is hiring ML/AI engineers at scale while you are not: their product capability gap is closing — factor into the "Competitive defensibility" criterion in the decision matrix
- If a competitor has posted multiple "Country Manager" or "Regional Director" roles in a new market: they have committed before you — consider whether first-mover advantage is still available
- State clearly in the decision matrix notes what competitor hiring signals tell you about each option's competitive window

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Strategic Options Considered"
- In what_matters: use "### Decision Matrix", "### Cost of Inaction", "### Competitive Window Signal"
- In recommendation: use "### Recommended Direction", "### What Must Be True", "### Kill Criteria"
- In business_implications: use "### Strategic Trade-offs", "### Analogies"

STAGE OUTPUT RULES — DECIDE:
- This is the FIRST stage where the recommendation is a genuine committed direction. Be definitive.
- Return actions ONLY as strategic-level decision actions — the 3–5 major moves that activate the chosen direction. NO owners, NO deadlines, NO operational sub-tasks.
- DO populate monitoring with 3–4 decision-validation metrics: signals that confirm the chosen direction or trigger a course-correction.
- Distinguish NEW assumptions from those inherited from Frame and Diagnose.

KILL CRITERIA — STRUCTURED ARRAY (MANDATORY):
Populate the kill_criteria array with at least 3 explicit kill criteria. Each object must have:
- "criterion": string — what condition would cause abandonment of this path
- "trigger": string — the specific threshold or signal that activates this criterion
- "response": string — what the business should do if the trigger fires

HYPOTHESIS REGISTER — MANDATORY. Carry forward and update:
Look in the prior stage outputs for the most recent hypothesis_register. Populate your hypothesis_register with ALL entries, updated based on what Decide found. Apply the same rules: update status (validated / at_risk / invalidated / untested), add evidence sentences, carry all entries forward unchanged. Add new hypotheses only if Decide surfaces material new ones.

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement (max 15 words, no pipes or metadata in this field)
- "fragility": "low" | "medium" | "high"
- "testable": boolean
- "status": "unvalidated"

${RED_GATE_INSTRUCTIONS.decide}`,

  position: `## Stage Instructions: POSITION
Define, target, frame, differentiate, position, defend.

Your role is to translate the chosen strategic direction into a precise market stance. Define who you serve, what you do materially better, and what structural advantages you are building. This stage sharpens how to win — it does not create an execution plan, a funding allocation, or a strategic bet portfolio.

POSITION MUST NOT:
- Produce a formal bet portfolio, funding allocation, milestones, OKRs, or governance cadence
- Assign owners or deliverables
- Override the geographic sequencing chosen in Decide
- Overstate product capabilities that have not been validated
- Treat multiple buyer personas as equal primaries if the strategy requires focus
- Use verbs from Commit: commit, assign, govern, sequence

PRIMARY ECONOMIC BUYER — MANDATORY:
Use the primary_buyer_role input as the anchor. The positioning must specify:
- PRIMARY ECONOMIC BUYER: the person who signs off on purchase and owns the budget
- MOBILISER / INFLUENCER: the person who drives the internal case for change
- SECONDARY STAKEHOLDERS: other roles who must be satisfied but do not decide

WIN/LOSS LANGUAGE — IF PROVIDED:
This is gold. Use exact verbatim phrases in the positioning analysis. Win language reveals the real differentiator. Loss language reveals the real objection. Quote both directly and build the positioning statement to amplify the win language and directly address the loss language.

ACTIVE POSITIONING ENGAGEMENT — IF IN PROGRESS:
Flag the report as TIME-SENSITIVE: "An active positioning engagement is underway. This report provides strategic framing inputs — not a finished messaging document. The agency/consultant should receive this as context."

NARRATIVE GAP ANALYSIS — MANDATORY:
Compare:
1. Current self-description (from web research — website hero copy, tagline, meta description)
2. Market description (TrustRadius reviews, comparison articles, analyst descriptions — use TrustRadius not G2 as G2 blocks access)
3. Recommended positioning (from this stage)
State the gap explicitly: "The company says [X]. The market says [Y]. The positioning must become [Z]."

KEY OBJECTIONS — IF PROVIDED:
Address each objection directly in the positioning framework. The positioning statement must neutralise the most critical objection.

BUYER DISCOVERY — IF PROVIDED:
Use this to shape GTM implications. If buyers find the company primarily through review sites (TrustRadius, G2) but the sales motion is outbound-led, flag the misalignment.

HELMER'S 7 POWERS:
Where relevant, reference the structural advantages being built. Be honest — only cite a power if there is genuine structural evidence for it. Be explicit about claimed advantages that don't survive scrutiny.

RESEARCH — ground positioning in current market reality. Search to find URLs, then fetch_url to read actual page content.

COMPETITOR POSITIONING — fetch the actual pages, do not infer from snippets:
- For each major competitor (top 3–4): fetch_url(competitor homepage) — copy the hero headline, subheadline, and primary CTA verbatim
- fetch_url(competitor /about) — read their stated mission and differentiator language
- Note exact positioning language: what category do they claim? What pain do they lead with?

COMPANY'S OWN POSITIONING (if not already fetched):
- fetch_url(company homepage) — current hero copy, tagline, meta description
- This is the baseline for the Narrative Gap Analysis

BUYER LANGUAGE & DISCOVERY:
- Search "[category] reviews TrustRadius" → fetch_url the TrustRadius category page — read buyer-written descriptions of what they're looking for (NOTE: TrustRadius is fully accessible; G2 blocks automated fetching)
- Search "[company name] TrustRadius reviews" → fetch_url the company's TrustRadius profile — read 5+ review excerpts verbatim, note recurring language about value and pain points
- Search "[category] buyer guide 2024" or "[category] comparison 2024" → fetch_url top result — what evaluation criteria are buyers using?

BUYER JOB POSTING ANALYSIS — HIGH IMPACT. Do all of these:
- Search "[primary buyer role] [category]" on Indeed: fetch_url the search results page (e.g. indeed.com/jobs?q=[role]+[category]) — read 5–10 actual job descriptions. These are publicly accessible without login.
- Search "[primary buyer role] [category] site:wellfound.com" → fetch_url — startup hiring for this role shows emerging tool stacks and expectations
- Search "[primary buyer role] [category]" on Greenhouse/Lever: search "site:greenhouse.io [buyer role title]" → fetch a few listing pages
- From these job postings extract verbatim:
  * REQUIRED TOOLS: what software platforms are listed as mandatory? (e.g. "Experience with Salesforce required", "Must have used Asana") — these are your buyer's existing stack
  * PREFERRED TOOLS: what are listed as nice-to-have? — these are adjacency opportunities
  * OUTCOMES EXPECTED: what results is the buyer being hired to deliver? (e.g. "drive 30% reduction in employee churn") — this is the buyer's definition of success
  * PAIN POINTS NAMED: what problems are they trying to solve? (e.g. "consolidate our fragmented internal comms stack") — this is your messaging hook
  * SKILLS VALUED: what capabilities does the buyer need to do their job? (e.g. "experience with change management") — this reveals buyer sophistication level
- For competitor positioning: search "[top 2 competitors] [buyer role]" on Indeed — what do buyers who use competitors get hired to do differently?
- Use this to sharpen the positioning statement: your messaging must speak to what this buyer is measured on, use the tools they already know, and solve the problem they were hired to fix

Report extracted job posting signals under "### Buyer Stack & Tool Environment" in business_implications.

SEO & CATEGORY SIGNALS:
- Search "[category term] site:trends.google.com" or search "Google Trends [category]" → fetch_url — is demand rising, flat, or declining?
- Search "[category] Gartner definition" → fetch_url — how do analysts define the category?
- Search "People also ask [category term]" — note the questions buyers are actually asking

REVIEW SITE PERCEPTION:
- fetch_url company TrustRadius profile → read the "What do you like best?" and "What do you dislike?" verbatim themes across reviews (use TrustRadius — G2 blocks automated access and returns an empty page)
- Search "[company name] vs [competitor]" → fetch_url top comparison article — how is the company positioned against its closest competitor in buyers' minds?

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Target Customer", then "### Positioning Statement"
- In what_matters: use "### Competitive Advantage", "### Narrative Gap Analysis"
- In recommendation: use "### Positioning Statement (Full)", "### Structural Defensibility"
- In business_implications: use "### Buyer Persona & Buying Motion", "### GTM Motion Implications", "### Packaging Implications", "### Buyer Stack & Tool Environment"

STAGE OUTPUT RULES — POSITION:
- The recommendation field is the POSITIONING RECOMMENDATION — the precise market stance. Include the full positioning statement: "For [target], who [need], [company] is the only [category frame] that [key differentiator] — unlike [alternatives] which [limitation]."
- Do NOT return actions — the execution plan belongs in Commit.
- DO populate monitoring with 2–3 positioning validation metrics: signals that confirm the position is landing with buyers.
- Distinguish NEW assumptions from those inherited from prior stages.

HYPOTHESIS REGISTER — MANDATORY. Carry forward and update:
Look in the prior stage outputs for the most recent hypothesis_register. Populate your hypothesis_register with ALL entries, updated based on what Position found. Apply the same rules: update status (validated / at_risk / invalidated / untested), add evidence sentences for newly tested entries, carry all entries forward unchanged. Add new hypotheses only if Position surfaces material new ones about buyer behaviour, positioning assumptions, or competitive dynamics.

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement (max 15 words, no pipes or metadata in this field)
- "fragility": "low" | "medium" | "high"
- "testable": boolean
- "status": "unvalidated"

${RED_GATE_INSTRUCTIONS.position}`,

  competitor_intel: `## Stage Instructions: COMPETITOR INTELLIGENCE

You are producing a deep competitive intelligence briefing for a PE-backed portfolio company or growth-stage business. This is not a generic competitor analysis. It is strategic intelligence through an investor and operator lens — the kind of briefing an Inflexion deal partner or portfolio CEO would actually use to make a decision.

The company context provided is the PORTFOLIO COMPANY or INFLEXION CLIENT — the strategic perspective holder. The competitor to analyse is provided in the Q&A inputs below (competitor URL, name, and relationship context).

RESEARCH FIRST — MANDATORY. Do not produce output until you have retrieved real data:
1. Fetch the competitor's homepage, /about, /product, /pricing pages. Read what the site actually says — do not infer from the domain name.
2. Search for recent news (last 6–12 months): funding rounds, leadership changes, product launches, partnerships, customer wins/losses, headcount signals.
3. Search "[competitor name] TrustRadius reviews" → fetch_url the TrustRadius profile for review volume, rating, and recurring customer themes. Also fetch_url Glassdoor company page — gets overall rating and page basics (individual reviews need login, but rating score and search snippet quotes are useful). NOTE: G2 blocks automated fetching — use search snippet only for G2 data.
4. Search "[competitor name] funding Crunchbase" → use search SNIPPETS for total funding, last round type/amount/date, and investors — do NOT fetch the Crunchbase page (requires Pro login for full data). Search "[competitor name] funding press release" for primary source confirmation.
5. Search "site:linkedin.com/company [competitor name]" → fetch_url the LinkedIn company page — gets headcount band, description, HQ, and follower count. Posts and employee details require login.
6. JOB POSTING INTELLIGENCE — HIGH IMPACT. Do ALL of these:
   - Fetch the competitor's own careers page (/careers, /jobs) — get a live count of open roles and a full list of current openings
   - Search "site:greenhouse.io [competitor name]" OR "site:lever.co [competitor name]" OR "site:ashbyhq.com [competitor name]" → fetch the ATS results page for a structured list of live roles
   - Search "[competitor name] jobs site:indeed.com" → fetch the Indeed company page — get full job descriptions. Read 5–10 listings in detail.
   - From job listings, extract and analyse:
     * ROLE MIX: what % of roles are engineering vs. sales vs. CS vs. marketing vs. ops? Compare to their stated strategy.
     * SENIORITY SIGNALS: are they hiring ICs into existing functions (scale) or recruiting senior leaders (new capability)? Which functions are being led?
     * PRODUCT DIRECTION: what technical skills appear in engineering roles? "ML infrastructure", "LLM fine-tuning", "data pipeline", "mobile SDK" — each signals product investment direction
     * GEOGRAPHIC EXPANSION: any "Country Manager", "Regional VP", or location-specific roles not previously seen?
     * NEW CAPABILITIES: any roles for functions they don't appear to have had before (e.g. first "Head of Partnerships", "Enterprise Architect", "Professional Services Lead")?
     * TALENT ACQUISITION FROM: if job specs mention "experience at [specific company type]", it reveals who they're trying to hire away from
   - Interpret the TOTAL ROLE COUNT relative to revenue/stage — are they hiring ahead of revenue (VC-style burn) or behind it (PE-style efficiency)?
   - If headcount is growing faster than their stated market (from news/Crunchbase) this signals confidence or pressure — name which
   - Quote specific job titles and role descriptions as evidence for predicted next moves

EVIDENCE DISCIPLINE: if you cannot verify a fact, mark it "Unknown" or "Not publicly disclosed". Do not fill gaps with speculation. Every claim must trace to something you actually retrieved.

OUTPUT STRUCTURE — populate all 8 active sections precisely as follows:

executive_summary — COMPANY SNAPSHOT
  Begin with "### Company Snapshot"
  What they do in 2–3 sentences (from their actual website copy, not paraphrase).
  Key facts in a tight block: founded year | HQ | estimated headcount | funding status | PE/VC ownership if applicable.
  Their market category and where they sit in it (market leader / challenger / niche player).
  End with one-line verdict: "Strategic threat — act now" | "Strong watch — monitor quarterly" | "Tactical extract — learn and move" | "Low priority — revisit in 12 months".

what_matters — MARKET SIGNAL
  Use these exact sub-headings:

  ### Industry Growth Signal
  One of: Growing | Stable | Declining. One substantive paragraph on the structural forces shaping this market right now — not just "the market is growing" but WHY and for whom. Cite specific signals (funding trends, M&A activity, analyst commentary, macro forces).

  ### AI Disruption Exposure
  One of: High | Medium | Low. Who is the platform threat? Is AI eroding the standalone value proposition or accelerating it? How asymmetric is the risk — can incumbents absorb the cost or must challengers prove new ROI?

  ### People Signal
  From Glassdoor/reviews: Positive | Mixed | Negative. Three specific themes from actual reviews (e.g. "PE efficiency pressure surfacing in headcount reviews", "Strong product pride despite commercial instability"). If no review data available, state this explicitly.

  ### Hiring Intelligence
  From job postings (Indeed, ATS pages, careers page): report the TOTAL open role count. Break down by function. Identify the top 3 signals from their current hiring:
  - Signal 1: [what a specific cluster of roles reveals about strategic intent]
  - Signal 2: [what seniority patterns reveal about capability building vs. scaling]
  - Signal 3: [what geographic or technical roles reveal about next moves]
  Quote specific role titles as evidence. State explicitly: "Based on current hiring, we predict their next move is [X]" with a confidence level (high/medium/low).

  ### Funding & Ownership Context
  If PE-backed: estimated hold period position (early / mid / late based on acquisition date + typical 4–7 year hold), exit pathway likelihood, acquirer landscape. If VC-backed: runway signals, next round positioning. If bootstrapped or public: note this. This is the commercial context that shapes every strategic decision they make.

recommendation — STRATEGIC VERDICT
  Begin with "### Our Recommendation"
  Lead with the verdict label: one of [Strategic threat — act now | Strong watch — monitor quarterly | Tactical extract — learn and move | Low priority].
  Then 2–3 paragraphs making the honest PE-grade case:
  - What this company genuinely does well (cite evidence — not flattery)
  - What the category ceiling is and whether it is falling, rising, or stable
  - The honest risk/opportunity this represents for the portfolio company given their specific strategic position
  End with: "### Timeframe" — the window in which this assessment remains valid and why it changes.

business_implications — PORTFOLIO IMPLICATIONS
  Begin with "### What This Means for [portfolio company name]"
  Be commercially specific — not "they compete in the same space" but:
  - Where do they directly overlap with the portfolio company's ICP or active pipeline?
  - Where does their weakness or market exit open a gap the portfolio company can take?
  - Which customer conversations does this competitor make harder or easier?
  - What does their product roadmap or GTM signal about where the market is going?
  2–4 concrete implications. No generic observations.

risks — COMPETITIVE THREATS
  3–5 risks this competitor poses to the portfolio company. Each risk:
  - risk field: one sharp sentence naming the specific threat (max 12 words)
  - severity: high | medium | low — based on evidence, not instinct
  - mitigation: one sentence on what the portfolio company should do to counter it

actions — WHAT TO DO ABOUT IT
  3–5 concrete strategic actions. Not "monitor this space" — actual moves:
  - Attack their documented weakness
  - Defend against their documented strength or next move
  - Exploit the market signal gap
  - One action must address the portfolio company's positioning against this competitor specifically
  Each action: max 12 words. Active verb. No hedging.

monitoring — SIGNALS TO WATCH
  4–5 specific signals that would change this assessment materially. Each:
  - metric field: the specific thing to watch (e.g. "Series B announcement", "Headcount drops below 300", "Viva launches native search feature")
  - target: the threshold that triggers a reassessment
  - frequency: how often to check

INFLEXION FRAMING — MANDATORY:
- Every finding must answer the commercial question: what does this mean for a company competing with them or trying to outposition them?
- Reference PE dynamics wherever relevant. A PE-backed competitor in year 5 of a typical hold is not making the same decisions as one in year 1. This matters.
- Be direct. PE-grade intelligence has no room for hedge language. "It depends" with no directional call is worthless output.
- Do NOT produce a feature comparison matrix. Do NOT write "they are strong in X" without evidence. Do NOT produce generic advice that could apply to any competitor in any market.
- The portfolio company context matters: frame every implication in terms of that specific company's stage, sector, and strategic position.

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array MUST be objects (not strings). Each:
- "text": string — the analytical assumption (max 15 words, no metadata in this field)
- "fragility": "low" | "medium" | "high"
- "testable": boolean
- "status": "unvalidated"
Example: { "text": "Microsoft Viva will absorb intranet market share within 24 months", "fragility": "high", "testable": true, "status": "unvalidated" }`,

  commit: `## Stage Instructions: COMMIT — FINAL SYNTHESIS
Commit, sequence, assign, track, govern, review, gate.

This is the final stage. Synthesise all five prior stages into a single cohesive, board-ready strategic document. Do NOT simply repeat or summarise what prior stages said — synthesise into a unified direction.

COMMIT IS THE FIRST AND ONLY STAGE WHERE:
- Strategic bets are named as formal commitments (using the Strategic / Capability / Sequencing taxonomy)
- The word "portfolio" is used for the set of bets
- Ownership is assigned to specific bets or workstreams (use the execution_owner role provided)
- Resourcing logic is articulated
- Milestones and OKRs are set
- Governance cadence is defined

EXECUTION OWNER — MANDATORY:
Use the execution_owner role provided in inputs. This role appears in the 100-day plan and governance rhythm.

VALIDATION SEGMENT — MANDATORY:
The validation_segment provided is the beachhead. All first-phase commitments target this segment. Do not diffuse the 100-day plan across multiple segments.

HORIZON ALLOCATION:
Use the horizon_allocation percentages provided. Label workstreams clearly as Now / Next / Later. The allocation shapes what gets funded, paused, protected, or reallocated.

REVENUE TARGET — IF PROVIDED:
Connect OKRs explicitly to the revenue_target. State: "The strategy must deliver [target]. The OKRs are set to measure whether this trajectory is on track."

BET CAPACITY:
Respect the bet_capacity constraint. If 3–5 bets are resourceable, produce 3–5. Do not list more bets than the company can resource.

PLANNED HIRES — IF PROVIDED:
Include planned hires in the Team & Capability section and connect them to specific strategic bets.

REVIEW CADENCE — IF PROVIDED:
Use the stated cadence in the Governance Rhythm. Default if not stated: Weekly operational + Monthly strategic + Quarterly portfolio.

BOARD REPORTING FREQUENCY — IF PROVIDED:
Include in governance rhythm.

ANTI-PORTFOLIO — MANDATORY:
Explicitly name what is NOT being pursued and why. State: "We are not pursuing [X] because [evidence]. This would change if [condition]."

STALE CONTENT PROHIBITION — MANDATORY:
You are synthesising from the CURRENT CASCADE OUTPUTS provided in context. Do NOT carry forward strategic directions, geographic assumptions, or buyer logic from earlier prompt versions or prior runs. The documents in context are the sole source of truth for this synthesis.

GEOGRAPHY INHERITANCE RULE — MANDATORY:
Inherit the geographic sequencing chosen in Decide EXACTLY. Do NOT introduce geographic logic that contradicts what Decide chose.

BUYER MOTION ALIGNMENT — MANDATORY:
GTM actions and 100-day milestones must align to the PRIMARY ECONOMIC BUYER defined in Position.

BET STACK CONSISTENCY — MANDATORY:
Label each strategic bet at one of three levels:
- Strategic bet: a market or category-level commitment
- Capability bet: a build/buy/partner commitment that enables a strategic bet
- Sequencing rule: an explicit "X before Y" dependency
Do not mix levels without clear labels. Aim for 3–5 bets maximum.

MARKET REFRESH — LIMITED WEB SEARCH (MANDATORY):
Do a narrow, targeted search to check for material market changes since the prior stages were run. This is NOT a full research pass — it is a reality check before committing. Run these searches only:
1. Search "[company name] competitor news 2025" → scan snippets for any major funding rounds, acquisitions, or product launches among the known competitors. Fetch the top article only if a headline signals a significant move.
2. Search "[category] market news 2025" → scan snippets for any major category shifts, regulatory changes, or platform moves that would affect the strategy.
3. Search "[top 1–2 competitors from prior stages] announcement 2025" → check for anything that would invalidate the chosen direction.
4. HIRING REALITY CHECK — search "site:greenhouse.io [company name]" OR "[company name] jobs site:indeed.com" → scan current open roles against the planned_hires provided. Are the strategic bets reflected in what the company is actually hiring for today? Flag any disconnects between stated bet commitments and current hiring posture — this is an execution risk.
5. COMPETITOR HIRING FINAL CHECK — for the top 1–2 competitors: check their current open roles on Indeed or their ATS page. Has anything changed since Diagnose? Any new senior hires, new geographies, or capability signals that affect the committed direction?

If you find material new information: note it explicitly in the executive_summary under "### Market Refresh Note" and factor it into the bet portfolio.
If nothing material has changed: state "No material market changes detected since prior stages" in the executive_summary and proceed with the synthesis.
Do NOT do broad company research — that was Frame and Diagnose's job. This search is for late-breaking signals only.

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Strategic Commitment"
- In what_matters: use "### Strategic Bet Portfolio", "### Anti-Portfolio", "### Hiring Posture vs. Bet Alignment"
- In recommendation: use "### What Must Be True (Consolidated)", "### Governance Rhythm"
- In business_implications: use "### Resource & Investment Implications", "### Team & Capability Implications", "### Competitive Hiring Window"

STRUCTURED ARRAYS — MANDATORY (populate as separate fields in the tool call, NOT as ### sub-headings):

strategic_bets array — 3 to 5 bets. Synthesise from the user's selected bets in the Commit answers. Each object MUST use exactly these field names:
- "Bet name": string — name of the strategic bet (3–6 words, punchy, directional)
- "Type": string — exactly one of: "Strategic" | "Capability" | "Sequencing"
- "Hypothesis": string — EXACTLY ONE sentence: "We believe [action] will result in [outcome] because [the non-obvious insight]"
- "Minimum viable test": string — EXACTLY ONE sentence: the fastest, cheapest way to validate this bet before full commitment. No costs, no budgets.
Example: { "Bet name": "Own the Enterprise Mid-Market", "Type": "Strategic", "Hypothesis": "We believe targeting mid-market enterprise will result in 3× ACV expansion because buyers in that band self-select for compliance features we already own", "Minimum viable test": "Run a 60-day pilot with 5 mid-market prospects and measure time-to-close against current ICP" }

okrs array — exactly 3 OKRs. Each object:
- "objective": string — the objective (qualitative direction)
- "key_results": string[] — 2–3 measurable key results
Example: { "objective": "Establish enterprise pipeline", "key_results": ["Close 3 enterprise deals >$50k ACV", "Achieve 90-day sales cycle", "Hit 85% logo retention"] }

hundred_day_plan array — milestones at 30, 60, and 90 days. Each object:
- "milestone": string — what must be achieved
- "timeline": string — "30 days" | "60 days" | "90 days"
- "owner": string — named owner role (use execution_owner + relevant function leads)
- "deliverable": string — concrete output
- "gate": string — what must be true to proceed past this milestone

kill_criteria array — at least 3. Each object:
- "criterion": string — what would cause a direction change
- "trigger": string — specific threshold or signal
- "response": string — what to do if triggered

ASSUMPTION FORMAT REQUIREMENT — MANDATORY:
The assumptions array in your tool call MUST be an array of objects, NOT strings. Each assumption object must have:
- "text": string — the assumption statement (max 15 words, no pipes or metadata in this field)
- "fragility": "low" | "medium" | "high"
- "testable": boolean
- "status": "unvalidated"

${RED_GATE_INSTRUCTIONS.commit}`,
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
  // competitor_intel: lead with the TARGET competitor, portfolio company is secondary context
  if (company.competitorTarget) {
    const lines: string[] = [
      `## Competitor to Analyse: ${company.competitorTarget.name}`,
      `Website: ${company.competitorTarget.url}`,
      ``,
      `## Portfolio Company (Strategic Perspective): ${company.name}`,
    ];
    if (company.url) lines.push(`Website: ${company.url}`);
    if (company.sector) lines.push(`Sector: ${company.sector}`);
    if (company.location) lines.push(`Location: ${company.location}`);
    const icps = [company.icp1, company.icp2, company.icp3].filter(Boolean);
    if (icps.length > 0) {
      lines.push(`\n### Portfolio Company ICPs`);
      icps.forEach((icp, i) => lines.push(`${i + 1}. ${icp}`));
    }
    return lines.join("\n");
  }

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

  return `\n\n## Prior Stage Findings — Complete Cascade Context\n\nThe following contains the FULL output from each completed prior stage in the CURRENT RUN. These documents are the sole authoritative source for this synthesis.\n\nSTALE CONTENT WARNING — MANDATORY: Use ONLY the strategic directions, geographic assumptions, and buyer logic present in the documents below. Do NOT introduce logic from earlier prompt versions, cached prior runs, or strategies that conflict with what is written here. If you recall a prior strategic direction that is not reflected in these outputs, discard it — these documents override it.\n\nWhen producing your output, clearly distinguish NEW assumptions and risks from those inherited from prior stages. Prefix inherited items with the source stage name (e.g. "[Frame]", "[Diagnose]"). This allows downstream consumers to trace the provenance of each claim.\n\n${sections.join("\n\n---\n\n")}`;
}

// ─── Resolve agent ID ─────────────────────────────────────────

function resolveAgentId(stageId: string): string {
  const id = AGENT_IDS[stageId];
  if (!id) throw new Error(`No agent configured for stage: ${stageId}`);
  return id;
}

// ─── Pre-fetch company pages ──────────────────────────────────
// Fetches the company's own pages before the agent runs so that
// baseline company context is guaranteed in the prompt regardless
// of how much web research the agent does itself.

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StrategyResearchBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Strip scripts, styles, and tags — keep readable text
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n")
      .trim()
      .slice(0, 4000); // cap per page to avoid context bloat
  } catch {
    return "";
  }
}

async function buildPreResearchContext(company: CompanyContext): Promise<string> {
  if (!company.url) return "";

  const base = company.url.replace(/\/$/, "");
  const pages = [
    { path: "",          label: "Homepage" },
    { path: "/about",    label: "About" },
    { path: "/about-us", label: "About" },
    { path: "/product",  label: "Product" },
    { path: "/platform", label: "Platform" },
    { path: "/pricing",  label: "Pricing" },
    { path: "/customers",label: "Customers" },
    { path: "/blog",     label: "Blog" },
    { path: "/careers",  label: "Careers" },
  ];

  const results: string[] = [];

  // Fetch all pages in parallel, deduplicate by content
  const fetched = await Promise.allSettled(
    pages.map(async (p) => {
      const url = base + p.path;
      const content = await fetchPage(url);
      return { url, label: p.label, content };
    })
  );

  const seen = new Set<string>();
  for (const r of fetched) {
    if (r.status !== "fulfilled") continue;
    const { url, label, content } = r.value;
    if (!content || content.length < 100) continue;
    // Deduplicate — if two paths return identical content (e.g. /about and /about-us both redirect to same page), skip the second
    const fingerprint = content.slice(0, 200);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    results.push(`### Pre-fetched: ${label} (${url})\n${content}`);
  }

  if (results.length === 0) return "";

  return [
    "",
    "## Pre-Fetched Company Pages — Read Before Starting Research",
    "The following pages were fetched directly from the company website before you began. Use this as your starting point. You still MUST do your own web searches and additional URL fetches to meet the minimum research bar — this data alone is not sufficient.",
    "",
    ...results,
    "",
  ].join("\n");
}

// ─── Research gate instruction ─────────────────────────────────

const RESEARCH_GATE = `## RESEARCH GATE — MANDATORY BEFORE WRITING ANY OUTPUT

Before you write a single word of the report sections or call the output tool, you MUST complete the following research checklist. Work through it item by item. Do not skip steps.

PHASE 1 — COMPANY RESEARCH (do all of these):
[ ] Fetch company homepage — read verbatim copy
[ ] Fetch company /about — leadership, mission, founding
[ ] Fetch company /product or /platform — full feature list
[ ] Fetch company /pricing — tiers, model, packaging
[ ] Fetch company /customers or /case-studies — logo list, sectors
[ ] Fetch company /blog — last 3 post titles and topics
[ ] Fetch company /careers or /jobs — open role count and functions
[ ] Search "site:greenhouse.io [company]" OR "site:lever.co [company]" — ATS live roles

PHASE 2 — MARKET RESEARCH (do all of these):
[ ] Search "Gartner Magic Quadrant [category] 2024 2025" — fetch result page
[ ] Search "Forrester Wave [category] 2024 2025" — fetch result page
[ ] Search "[category] market size CAGR 2025 2026" — fetch analyst page
[ ] Search "[category] market trends 2025" — fetch trade press article
[ ] Search "[company] TrustRadius reviews" — fetch full profile
[ ] Search "[company] Capterra reviews" — fetch profile
[ ] Search "[company] funding Crunchbase" — read snippet + fetch press release

PHASE 3 — COMPETITOR RESEARCH (do all of these):
[ ] Search "[company] alternatives TrustRadius" — fetch alternatives page, list all competitors
[ ] For each of TOP 5 COMPETITORS: fetch their homepage — read hero copy verbatim
[ ] For TOP 3 COMPETITORS: fetch their /pricing page
[ ] For TOP 3 COMPETITORS: fetch their /customers page
[ ] Search "[category] consolidation OR acquisition 2024 2025" — fetch top article
[ ] Search "[category] AI 2024 2025" — fetch top article on AI disruption

PHASE 4 — NEWS & SIGNALS (do all of these):
[ ] Search "[company] news 2024 2025" — fetch top 2 articles
[ ] Search "[company] CEO OR CPO interview 2025" — fetch any executive interview
[ ] Search "[category] news 2025" — fetch top trade article

PHASE 5 — COMPETITOR HIRING (do all of these):
[ ] Search "[competitor 1] jobs site:indeed.com" — scan titles
[ ] Search "[competitor 2] jobs site:indeed.com" — scan titles
[ ] Search "[competitor 3] jobs site:indeed.com" — scan titles

SELF-CHECK BEFORE WRITING:
Count the distinct URLs you have fetched in this session. If fewer than 15, go back and fetch more. Only when you have 15+ fetched URLs may you proceed to write the output and call the tool.

YOUR EVIDENCE_BASE SOURCES ARRAY must include ALL URLs you fetched during research — every single one. This is what populates the Knowledge Base. An empty or short sources array means you did not do enough research.`;

// ─── Public: createStrategySession ───────────────────────────

export async function createStrategySession(input: StrategySessionInput): Promise<string> {
  const { stageId, stageName, questions, answers, persona, company, priorReports } = input;

  const agentId = resolveAgentId(stageId);

  const personaFraming = buildPersonaFraming(persona);
  const stageInstruction = STAGE_INSTRUCTIONS[stageId] ?? STAGE_INSTRUCTIONS.frame;
  const companyBlock = buildCompanyBlock(company);
  const formattedAnswers = formatAnswers(questions, answers);
  const priorContext = buildPriorStageContext(priorReports ?? []);

  // Pre-fetch company pages for Frame and Diagnose stages (most research-heavy)
  const preResearch = (stageId === "frame" || stageId === "diagnose")
    ? await buildPreResearchContext(company)
    : "";

  // Only inject the research gate for Frame and Diagnose
  const researchGate = (stageId === "frame" || stageId === "diagnose" || stageId === "position")
    ? RESEARCH_GATE
    : "";

  const userMessage = [
    personaFraming,
    "",
    EVIDENCE_DISCIPLINE,
    "",
    researchGate,
    "",
    FIELD_CONCISENESS_RULES,
    "",
    stageInstruction,
    "",
    companyBlock,
    preResearch,
    priorContext,
    "",
    `## ${stageName} — User Inputs`,
    "",
    formattedAnswers,
    "",
    `BEFORE CALLING THE TOOL: Verify your evidence_base.sources array contains ALL URLs you fetched during research. This array must have at least 10 entries for Diagnose/Frame stages. An empty sources array is a failure condition — go back and add every URL you retrieved.`,
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
      } else if (stopReason?.type === "end_turn" || (!stopReason && events.length > 0)) {
        // Agent finished its turn without calling the custom tool — it returned text instead.
        // This is a failure condition: the agent must always call produce_strategic_diagnosis.
        console.error("[checkStrategySession] Session idle with end_turn but no tool event — agent did not call tool");
        return { status: "failed" };
      }
    }

    return { status: "pending" };
  } catch (err) {
    const errMsg = String(err);
    // If session not found (archived/expired), treat as failed not pending
    if (errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("not_found")) {
      console.error("[checkStrategySession] Session not found (archived/expired):", sessionId);
      return { status: "failed" };
    }
    // Non-fatal — next poll will retry
    console.error("[checkStrategySession] Error:", err);
    return { status: "pending" };
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ TRANSFORMATION MULTI-AGENT ORCHESTRATION ═════════════════
// ═══════════════════════════════════════════════════════════════

const TRANSFORMATION_AGENTS: Record<string, string> = {
  Pressure:            "agent_011CaDZq9weZ3d4NPBnQP6RQ",
  BenchmarkResearch:   "agent_011CaDZqC49PNcha4nSrGAfq",
  ProductDeepDive:     "agent_011CaDZqE9evUa3QNWErEw2G",
  SaaSStackResearch:   "agent_011CaDZqGxaX5cizyGtdstye",
  WorkflowAnalysis:    "agent_011CaDZqKAXcBFUrTjiAn6Ua",
  Exposure:            "agent_011CaDZqM7cMLh5WeEJ9nA6S",
  Choice:              "agent_011CaDZqNpJX3SFGi79cjZcf",
  MoveEngine:          "agent_011CaDZqRv5ksyBJJA2kcNhp",
  LeadershipScan:      "agent_011CaDZqUuRGYPEyRnnVmcEv",
  Conviction:          "agent_011CaDZqXpYEH6vM2NwX9kfC",
  Proof:               "agent_011CaDZqZw2tefgNSMnzqMFc",
  ContradictionEngine: "agent_011CaDZqbzZNrKntpwUDnqWk",
  ReportBuilder:       "agent_011CaDZqextzFgBHUHYmGU5y",
  DashboardBuilder:    "agent_011CaDZqgomtCjTERkq78EHS",
};

interface StageAgentDef {
  name: string;
  dependsOn?: string[];
}

const STAGE_AGENTS: Record<string, { agents: StageAgentDef[] }> = {
  why_now: {
    agents: [
      { name: "Pressure" },
      { name: "BenchmarkResearch" },
    ],
  },
  current_state: {
    agents: [
      { name: "ProductDeepDive" },
      { name: "SaaSStackResearch" },
      { name: "WorkflowAnalysis" },
      { name: "Exposure", dependsOn: ["ProductDeepDive", "SaaSStackResearch", "WorkflowAnalysis"] },
    ],
  },
  future_moves: {
    agents: [
      { name: "Choice" },
      { name: "MoveEngine", dependsOn: ["Choice"] },
    ],
  },
  mobilise: {
    agents: [
      { name: "LeadershipScan" },
      { name: "Conviction", dependsOn: ["LeadershipScan"] },
    ],
  },
  embed: {
    agents: [
      { name: "Proof" },
    ],
  },
  synthesis: {
    agents: [
      { name: "ContradictionEngine" },
      { name: "ReportBuilder", dependsOn: ["ContradictionEngine"] },
      { name: "DashboardBuilder", dependsOn: ["ReportBuilder"] },
    ],
  },
};

export const TRANSFORMATION_STAGE_IDS = Object.keys(STAGE_AGENTS);

export interface TransformationAgentState {
  sessionId?: string;
  status: "waiting" | "running" | "complete" | "failed";
  result?: Record<string, unknown>;
}

export interface TransformationJobState {
  stageId: string;
  stageName: string;
  agents: Record<string, TransformationAgentState>;
}

/**
 * Create sessions for transformation agents that have no dependencies.
 * Returns the initial TransformationJobState to store in Job metadata.
 */
export async function createTransformationSession(
  input: StrategySessionInput,
): Promise<TransformationJobState> {
  const { stageId, stageName, questions, answers, persona, company, priorReports } = input;

  const stageDef = STAGE_AGENTS[stageId];
  if (!stageDef) throw new Error(`No transformation agents configured for stage: ${stageId}`);

  const companyBlock = buildCompanyBlock(company);
  const formattedAnswers = formatAnswers(questions, answers);
  const personaFraming = buildPersonaFraming(persona);
  const priorContext = buildPriorStageContext(priorReports ?? []);

  // Build the base message that all agents in this stage receive
  const baseMessage = [
    personaFraming,
    "",
    `## Transformation Assessment — ${stageName}`,
    "",
    companyBlock,
    priorContext,
    "",
    `## ${stageName} — User Inputs`,
    "",
    formattedAnswers,
    "",
    `Call the produce_transformation_analysis tool with your complete analysis when you are done.`,
  ].filter((line) => line !== null).join("\n");

  // Initialise agent states
  const agentStates: Record<string, TransformationAgentState> = {};
  for (const agentDef of stageDef.agents) {
    agentStates[agentDef.name] = {
      status: agentDef.dependsOn && agentDef.dependsOn.length > 0 ? "waiting" : "running",
    };
  }

  // Create sessions for agents with no dependencies (run in parallel)
  const launchPromises: Array<Promise<void>> = [];
  for (const agentDef of stageDef.agents) {
    if (agentDef.dependsOn && agentDef.dependsOn.length > 0) continue;

    const agentId = TRANSFORMATION_AGENTS[agentDef.name];
    if (!agentId) throw new Error(`Unknown transformation agent: ${agentDef.name}`);

    launchPromises.push(
      (async () => {
        const session = await client.beta.sessions.create({
          agent: agentId,
          environment_id: ENVIRONMENT_ID,
          title: `${stageName} — ${agentDef.name} — ${company.name}`,
          metadata: { stageId, agentName: agentDef.name, companyName: company.name },
        });

        await client.beta.sessions.events.send(session.id, {
          events: [{ type: "user.message", content: [{ type: "text", text: baseMessage }] }],
        });

        agentStates[agentDef.name].sessionId = session.id;
      })()
    );
  }

  await Promise.all(launchPromises);

  return { stageId, stageName, agents: agentStates };
}

/**
 * Advance a transformation session: check running agents, launch dependent agents when ready.
 * Called by the status polling endpoint.
 * Returns updated state + overall status + per-agent progress info.
 */
export async function advanceTransformationSession(
  state: TransformationJobState,
  company: CompanyContext,
  questions: Array<{ id: string; question: string; type: string }>,
  answers: Record<string, string | string[] | { selection: string; freetext: string }>,
): Promise<{
  state: TransformationJobState;
  status: "pending" | "complete" | "failed";
  agents: Record<string, { status: string; name: string }>;
  sections?: Record<string, unknown>;
}> {
  const stageDef = STAGE_AGENTS[state.stageId];
  if (!stageDef) return { state, status: "failed", agents: {} };

  const agentProgress: Record<string, { status: string; name: string }> = {};

  // Check all running agents
  for (const agentDef of stageDef.agents) {
    const agentState = state.agents[agentDef.name];
    if (!agentState) continue;

    if (agentState.status === "running" && agentState.sessionId) {
      const result = await checkStrategySession(agentState.sessionId);

      if (result.status === "complete" && result.sections) {
        agentState.status = "complete";
        agentState.result = result.sections;
      } else if (result.status === "failed") {
        agentState.status = "failed";
      }
      // "pending" — still running, no change
    }

    agentProgress[agentDef.name] = { status: agentState.status, name: agentDef.name };
  }

  // Launch dependent agents whose deps are all complete
  for (const agentDef of stageDef.agents) {
    const agentState = state.agents[agentDef.name];
    if (agentState.status !== "waiting") continue;
    if (!agentDef.dependsOn || agentDef.dependsOn.length === 0) continue;

    const allDepsComplete = agentDef.dependsOn.every(
      (dep) => state.agents[dep]?.status === "complete"
    );

    if (!allDepsComplete) continue;

    // All dependencies are done — launch this agent with dep results as context
    const agentId = TRANSFORMATION_AGENTS[agentDef.name];
    if (!agentId) {
      agentState.status = "failed";
      continue;
    }

    // Build context from dependency results
    const depContext = agentDef.dependsOn
      .map((dep) => {
        const depResult = state.agents[dep]?.result;
        if (!depResult) return "";
        return `### ${dep} Analysis Results\n${JSON.stringify(depResult, null, 2)}`;
      })
      .filter(Boolean)
      .join("\n\n");

    const companyBlock = buildCompanyBlock(company);
    const formattedAnswers = formatAnswers(questions, answers);

    const message = [
      `## Transformation Assessment — ${state.stageName}`,
      "",
      companyBlock,
      "",
      `## ${state.stageName} — User Inputs`,
      "",
      formattedAnswers,
      "",
      `## Upstream Analysis (from completed agents)`,
      "",
      depContext,
      "",
      `You are the ${agentDef.name} agent. The above upstream analysis has been completed by other agents. Use their findings as input to your synthesis.`,
      "",
      `Call the produce_transformation_analysis tool with your complete analysis when you are done.`,
    ].join("\n");

    try {
      const session = await client.beta.sessions.create({
        agent: agentId,
        environment_id: ENVIRONMENT_ID,
        title: `${state.stageName} — ${agentDef.name} — ${company.name}`,
        metadata: { stageId: state.stageId, agentName: agentDef.name, companyName: company.name },
      });

      await client.beta.sessions.events.send(session.id, {
        events: [{ type: "user.message", content: [{ type: "text", text: message }] }],
      });

      agentState.sessionId = session.id;
      agentState.status = "running";
    } catch (err) {
      console.error(`[transformation] Failed to launch ${agentDef.name}:`, err);
      agentState.status = "failed";
    }

    agentProgress[agentDef.name] = { status: agentState.status, name: agentDef.name };
  }

  // Determine overall status
  const allAgents = stageDef.agents.map((a) => state.agents[a.name]);
  const allComplete = allAgents.every((a) => a.status === "complete");
  const anyFailed = allAgents.some((a) => a.status === "failed");

  if (allComplete) {
    // Aggregate all agent results into a single sections object
    const aggregated: Record<string, unknown> = {};
    for (const agentDef of stageDef.agents) {
      const agentResult = state.agents[agentDef.name]?.result;
      if (agentResult) {
        aggregated[agentDef.name] = agentResult;
      }
    }

    // Build a combined executive summary from all agent headlines
    const headlines = stageDef.agents
      .map((a) => {
        const r = state.agents[a.name]?.result as Record<string, unknown> | undefined;
        return r?.headline ? `**${a.name}**: ${r.headline}` : null;
      })
      .filter(Boolean);

    const summaries = stageDef.agents
      .map((a) => {
        const r = state.agents[a.name]?.result as Record<string, unknown> | undefined;
        return r?.summary ? `${r.summary}` : null;
      })
      .filter(Boolean);

    aggregated.executive_summary = headlines.join("\n\n") + "\n\n" + summaries.join("\n\n");

    // Collect all recommendations
    const allRecs: unknown[] = [];
    for (const agentDef of stageDef.agents) {
      const r = state.agents[agentDef.name]?.result as Record<string, unknown> | undefined;
      if (Array.isArray(r?.recommendations)) {
        allRecs.push(...(r.recommendations as unknown[]));
      }
    }
    if (allRecs.length > 0) aggregated.recommendations = allRecs;

    // Collect all key_findings
    const allFindings: unknown[] = [];
    for (const agentDef of stageDef.agents) {
      const r = state.agents[agentDef.name]?.result as Record<string, unknown> | undefined;
      if (Array.isArray(r?.key_findings)) {
        allFindings.push(...(r.key_findings as unknown[]));
      }
    }
    if (allFindings.length > 0) aggregated.key_findings = allFindings;

    // Collect all sources
    const allSources: unknown[] = [];
    for (const agentDef of stageDef.agents) {
      const r = state.agents[agentDef.name]?.result as Record<string, unknown> | undefined;
      if (Array.isArray(r?.sources)) {
        allSources.push(...(r.sources as unknown[]));
      }
    }
    if (allSources.length > 0) aggregated.sources = allSources;

    // Average confidence
    const confidences = stageDef.agents
      .map((a) => {
        const r = state.agents[a.name]?.result as Record<string, unknown> | undefined;
        return typeof r?.confidence === "number" ? r.confidence : null;
      })
      .filter((c): c is number => c !== null);
    if (confidences.length > 0) {
      aggregated.confidence = { score: confidences.reduce((a, b) => a + b, 0) / confidences.length };
    }

    return { state, status: "complete", agents: agentProgress, sections: aggregated };
  }

  if (anyFailed && !allAgents.some((a) => a.status === "running" || a.status === "waiting")) {
    return { state, status: "failed", agents: agentProgress };
  }

  return { state, status: "pending", agents: agentProgress };
}

// ─── Synthesis helpers ────────────────────────────────────────────────────────

const SYNTHESIS_STAGES = ["why_now", "current_state", "future_moves", "mobilise", "embed"] as const;

/**
 * Extract structured summaries from the 5 completed stage outputs.
 * Budget: ~20K tokens. Emphasizes Exposure + Conviction sub-results for ContradictionEngine.
 */
function buildSynthesisContext(
  outputs: Array<{ workflowType: string; sections: Record<string, unknown> }>,
): PriorStageSummary[] {
  const stageNames: Record<string, string> = {
    why_now: "Why Now",
    current_state: "Current State",
    future_moves: "Future Moves",
    mobilise: "Mobilise",
    embed: "Embed",
  };

  return outputs.map((output) => {
    const s = output.sections;
    const parts: string[] = [];

    // Executive summary
    if (typeof s.executive_summary === "string") {
      parts.push(`### Executive Summary\n${s.executive_summary}`);
    }

    // Recommendations
    if (Array.isArray(s.recommendations) && s.recommendations.length > 0) {
      const recs = (s.recommendations as Array<Record<string, unknown>>)
        .slice(0, 10)
        .map((r) => `- **${r.title ?? r.recommendation ?? ""}**: ${r.rationale ?? r.description ?? ""}`)
        .join("\n");
      parts.push(`### Recommendations\n${recs}`);
    }

    // Key findings
    if (Array.isArray(s.key_findings) && s.key_findings.length > 0) {
      const findings = (s.key_findings as Array<Record<string, unknown>>)
        .slice(0, 10)
        .map((f) => `- ${f.finding ?? f.title ?? JSON.stringify(f)}`)
        .join("\n");
      parts.push(`### Key Findings\n${findings}`);
    }

    // Confidence
    if (s.confidence && typeof s.confidence === "object" && "score" in (s.confidence as Record<string, unknown>)) {
      parts.push(`### Confidence: ${(s.confidence as { score: number }).score}/100`);
    }

    // Exposure sub-result (current_state) — emphasised for ContradictionEngine
    if (output.workflowType === "current_state" && s.Exposure && typeof s.Exposure === "object") {
      const exp = s.Exposure as Record<string, unknown>;
      parts.push(`### ⚠ Exposure Analysis (highlighted for contradiction detection)\n${exp.headline ?? ""}\n${exp.summary ?? ""}`);
      if (Array.isArray(exp.recommendations)) {
        const expRecs = (exp.recommendations as Array<Record<string, unknown>>)
          .slice(0, 5)
          .map((r) => `- ${r.title ?? r.recommendation ?? JSON.stringify(r)}`)
          .join("\n");
        parts.push(expRecs);
      }
    }

    // Conviction sub-result (mobilise) — emphasised for ContradictionEngine
    if (output.workflowType === "mobilise" && s.Conviction && typeof s.Conviction === "object") {
      const conv = s.Conviction as Record<string, unknown>;
      parts.push(`### ⚠ Conviction Analysis (highlighted for contradiction detection)\n${conv.headline ?? ""}\n${conv.summary ?? ""}`);
      if (Array.isArray(conv.recommendations)) {
        const convRecs = (conv.recommendations as Array<Record<string, unknown>>)
          .slice(0, 5)
          .map((r) => `- ${r.title ?? r.recommendation ?? JSON.stringify(r)}`)
          .join("\n");
        parts.push(convRecs);
      }
    }

    return {
      stageId: output.workflowType,
      stageName: stageNames[output.workflowType] ?? output.workflowType,
      summary: parts.join("\n\n"),
    };
  });
}

/**
 * Create a synthesis transformation session from the 5 completed stage outputs.
 * Returns the initial TransformationJobState + the created Job ID.
 */
export async function createSynthesisSession(
  companyId: string,
  userId: string,
  company: CompanyContext,
): Promise<{ transformationState: TransformationJobState; jobId: string }> {
  // Fetch the 5 most recent completed outputs for each stage
  const outputs = await db.output.findMany({
    where: {
      companyId,
      workflowType: { in: [...SYNTHESIS_STAGES] },
    },
    orderBy: { createdAt: "desc" },
    select: { workflowType: true, sections: true },
  });

  // Deduplicate — keep only the most recent per stage
  const seenStages = new Set<string>();
  const uniqueOutputs = outputs.filter((o) => {
    if (seenStages.has(o.workflowType)) return false;
    seenStages.add(o.workflowType);
    return true;
  });

  const priorReports = buildSynthesisContext(
    uniqueOutputs.map((o) => ({
      workflowType: o.workflowType,
      sections: o.sections as Record<string, unknown>,
    })),
  );

  const transformationState = await createTransformationSession({
    stageId: "synthesis",
    stageName: "Final Synthesis",
    questions: [],
    answers: {},
    company,
    priorReports,
  });

  const job = await db.job.create({
    data: {
      companyId,
      userId,
      workflowType: "synthesis",
      status: "running",
      metadata: { transformationState, answers: {}, questions: [] } as object,
    },
  });

  return { transformationState, jobId: job.id };
}

/**
 * Auto-trigger synthesis if all 5 transformation stages are complete
 * and no synthesis Job is already running.
 * Returns the jobId if synthesis was triggered, null otherwise.
 */
export async function triggerSynthesisIfReady(
  companyId: string,
  userId: string,
  company: CompanyContext,
): Promise<string | null> {
  // Check all 5 stages have at least one completed Output
  const completedStages = await db.output.groupBy({
    by: ["workflowType"],
    where: {
      companyId,
      workflowType: { in: [...SYNTHESIS_STAGES] },
    },
  });

  if (completedStages.length < 5) return null;

  // Check no synthesis Job is already running
  const existingSynthesisJob = await db.job.findFirst({
    where: {
      companyId,
      workflowType: "synthesis",
      status: "running",
    },
  });

  if (existingSynthesisJob) return null;

  const { jobId } = await createSynthesisSession(companyId, userId, company);
  return jobId;
}
