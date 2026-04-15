// ─── Workflow types ──────────────────────────────────────────

export type WorkflowType = "diagnose" | "decide" | "position" | "act" | "competitor_intel";

export type OutputType =
  // Diagnose
  | "executive_strategic_brief"
  | "strategic_diagnosis"
  // Decide
  | "strategic_choices"
  | "build_buy_partner"
  | "investment_priorities"
  // Position
  | "positioning_recommendation"
  | "pricing_monetisation"
  | "gtm_fit"
  | "narrative"
  | "retention_moat"
  // Act
  | "decision_memo"
  | "ninety_day_plan"
  | "metrics_monitoring"
  // Competitor Intelligence
  | "executive_teardown"
  | "competitor_product_shape"
  | "competitor_gtm_signals";

// ─── 10-section output structure ─────────────────────────────

export interface OutputSections {
  executive_summary: string;
  what_matters: string;
  recommendation: string;
  business_implications: string;
  evidence_base: { sources: string[]; quotes: string[] };
  assumptions: (string | { text: string; fragility: "low" | "medium" | "high"; testable: boolean; status: "unvalidated" | "validated" | "at_risk" | "invalidated" })[];
  confidence: { score: number; rationale: string };
  risks: { risk: string; severity: "high" | "medium" | "low"; mitigation: string }[];
  actions: { action: string; owner: string; deadline: string; priority: "critical" | "high" | "medium" | "low" }[];
  monitoring: { metric: string; target: string; frequency: string }[];
  // Optional structured fields — populated by stages that produce them
  kill_criteria?: { criterion: string; trigger: string; response: string }[];
  okrs?: { objective: string; key_results: string[] }[];
  strategic_bets?: { bet: string; hypothesis: string; investment: string }[];
  hundred_day_plan?: { milestone: string; timeline: string; owner: string; deliverable: string }[];
  // Hypothesis register — created in Frame, updated by each downstream stage
  hypothesis_register?: {
    hypothesis: string;
    source: "user_input" | "web_research" | "inferred";
    tested_in: "diagnose" | "decide" | "position" | "commit";
    status: "untested" | "validated" | "at_risk" | "invalidated";
    evidence: string;
  }[];
}

// ─── Section metadata for rendering ──────────────────────────

export const SECTION_ORDER = [
  "executive_summary",
  "what_matters",
  "recommendation",
  "business_implications",
  "evidence_base",
  "assumptions",
  "confidence",
  "risks",
  "actions",
  "monitoring",
  "kill_criteria",
  "okrs",
  "strategic_bets",
  "hundred_day_plan",
  "hypothesis_register",
] as const;

export const SECTION_LABELS: Record<string, string> = {
  executive_summary: "Executive Summary",
  what_matters: "What Matters",
  recommendation: "Recommendation",
  business_implications: "Business & Strategic Implications",
  evidence_base: "Evidence Base",
  assumptions: "Assumptions",
  confidence: "Confidence",
  risks: "Risks",
  actions: "Actions",
  monitoring: "Metrics",
  kill_criteria: "Kill Criteria",
  okrs: "OKRs",
  strategic_bets: "Strategic Bets",
  hundred_day_plan: "100-Day Plan",
  hypothesis_register: "Hypothesis Register",
};

// ─── Stage-aware section labels ─────────────────────────────────
// Override default labels per stage where the section means something different.

export const STAGE_SECTION_LABELS: Record<string, Partial<Record<string, string>>> = {
  frame:    { recommendation: "Core Strategic Question" },
  diagnose: { recommendation: "Emerging Direction" },
  decide:   {}, // uses defaults — Recommendation is genuinely earned here
  position: { recommendation: "Positioning Recommendation" },
  commit:   { evidence_base: "Evidence Inherited" },
};

// ─── Stage-hidden sections ──────────────────────────────────────
// Sections that should not be rendered for a given stage because
// the stage does not produce them (agents are told not to return them).

export const STAGE_HIDDEN_SECTIONS: Record<string, string[]> = {
  frame:    ["actions", "monitoring"],
  diagnose: ["actions", "monitoring"],
  decide:   ["monitoring"],
  position: ["actions", "monitoring"],
  commit:   [],
};

// ─── Workflow metadata ───────────────────────────────────────

export const WORKFLOW_META: Record<WorkflowType, {
  label: string;
  description: string;
  summary: string;
  detail: string;
  outputTag: string;
  bullets: string[];
  outputTypes: OutputType[];
}> = {
  diagnose: {
    label: "Diagnose",
    description: "Understand what is happening",
    summary: "Read the actual forces shaping your market before committing capital or direction.",
    detail: "What is happening in your market and what it forces. Your competitive landscape, ICP shifts, GTM friction, and the AI signals you are underweighting — mapped and prioritised.",
    outputTag: "What matters and why",
    bullets: [
      "Identifies what has actually changed in your market versus what you think has changed",
      "Surfaces the structural forces driving or threatening your position",
      "Frames the decisions you actually face — not the ones you assume you face",
      "Output: Executive Strategic Brief + Strategic Diagnosis",
    ],
    outputTypes: ["executive_strategic_brief", "strategic_diagnosis"],
  },
  decide: {
    label: "Decide",
    description: "Determine what choices to make",
    summary: "Map your real options with their tradeoffs. Find out which bets compound and which burn capital.",
    detail: "What to do and what to stop doing. Strategic choices, sequenced bets, explicit trade-offs, and build vs buy vs partner — with the evidence behind each call.",
    outputTag: "What to do and what not to do",
    bullets: [
      "Maps the strategic options available to you with their real tradeoffs",
      "Pressure-tests build vs. buy vs. partner decisions against your constraints",
      "Identifies which investments will move the needle and which are noise",
      "Output: Strategic Choices, Build/Buy/Partner Analysis, Investment Priorities",
    ],
    outputTypes: ["strategic_choices", "build_buy_partner", "investment_priorities"],
  },
  position: {
    label: "Position",
    description: "Define how to win",
    summary: "Find out whether your ICP, pricing, and GTM motion are set up to win — or just set up to compete.",
    detail: "How to win in market. Category positioning, differentiation against named competitors, pricing logic, GTM fit, and the narrative that makes your moat defensible.",
    outputTag: "How to win",
    bullets: [
      "Validates or challenges your ICP assumptions with market evidence",
      "Evaluates pricing model fit against willingness to pay and competitive alternatives",
      "Identifies gaps in your GTM motion and narrative clarity",
      "Output: Positioning Recommendation, Pricing & Monetisation, GTM Fit, Narrative, Retention Moat",
    ],
    outputTypes: ["positioning_recommendation", "pricing_monetisation", "gtm_fit", "narrative", "retention_moat"],
  },
  act: {
    label: "Act",
    description: "Execute what to do next",
    summary: "Turn strategic direction into a 90-day plan with owners, deadlines, and the metrics that tell you it's working.",
    detail: "What happens next and how you measure it. A board-ready decision memo, a 90-day plan with named owners, and the metrics that tell you it is working before the quarter ends.",
    outputTag: "What to do next",
    bullets: [
      "Produces a board-ready decision memo with rationale and tradeoffs documented",
      "Breaks strategy into a prioritised 90-day action plan with owners and deadlines",
      "Defines the leading indicators that tell you if the strategy is working",
      "Output: Decision Memo, 90-Day Plan, Metrics & Monitoring",
    ],
    outputTypes: ["decision_memo", "ninety_day_plan", "metrics_monitoring"],
  },
  competitor_intel: {
    label: "Competitor Intelligence",
    description: "Cross-cutting competitive analysis",
    summary: "Read competitor strategy through product shape, pricing moves, and GTM signals — not feature lists.",
    detail: "Inflexion reads competitor strategy the way operators and investors actually need to — through product shape, pricing movements, hiring signals, and GTM patterns. The output tells you what they're building toward, where they're vulnerable, and where you have a window to move.",
    outputTag: "Competitive intelligence",
    bullets: [
      "Deep teardowns of competitor product shape, pricing, and strategic intent",
      "GTM signal analysis: who they're targeting, how they're selling, where they're investing",
      "Identifies competitive drift, emerging threats, and gaps you can exploit",
      "Output: Executive Teardown, Product Shape Analysis, GTM Signals",
    ],
    outputTypes: ["executive_teardown", "competitor_product_shape", "competitor_gtm_signals"],
  },
};

// ─── Job statuses ────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "completed" | "failed";
