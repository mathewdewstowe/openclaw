"use client";
// v3
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DeckDownloadButton } from "@/components/deck-download-button";
import { renderWithCitations } from "@/lib/render-citations";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const check = useCallback(() => setIsMobile(window.innerWidth < 768), []);
  useEffect(() => {
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [check]);
  return isMobile;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "single-select" | "multi-select" | "rank" | "free-text" | "structured-repeater" | "percentage-split";

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  question: string;
  hint?: string;
  type: QuestionType;
  options?: QuestionOption[];
  placeholder?: string;
  maxSelections?: number;
  required?: boolean;
  repeaterFields?: string[]; // short field keys for structured-repeater (used as data keys + display labels)
  repeaterFieldPlaceholders?: string[]; // optional longer placeholder text per field
  addLabel?: string; // label for the "add entry" button in structured-repeater
  splitLabels?: string[]; // labels for percentage-split (3 items)
}

interface Stage {
  id: string;
  name: string;
  purpose: string;
  output: string;
  questions: Question[];
  runButtonLabel: string;
}

interface RepeaterEntry {
  [field: string]: string;
}

interface SplitValue {
  h1: number;
  h2: number;
  h3: number;
}

type AnswerValue = string | string[] | { selection: string; freetext: string } | RepeaterEntry[] | SplitValue;

type StageStatus = "locked" | "active" | "complete";
type ReportStatus = "none" | "generating" | "complete";

interface StageState {
  status: StageStatus;
  answers: Record<string, AnswerValue>;
  currentQuestion: number;
  reportStatus: ReportStatus;
  report: string | null;
  reportSections?: Record<string, unknown>;
}

// ─── Stage Data ───────────────────────────────────────────────────────────────

// Standard section pills shown for every completed report
const STANDARD_REPORT_PILLS: Array<{ label: string; anchor: string }> = [
  { label: "Exec Summary",        anchor: "section-executive-summary" },
  { label: "What Matters Most",   anchor: "section-what-matters-most" },
  { label: "Recommendation",      anchor: "section-recommendation" },
  { label: "Business Implications", anchor: "section-business-implications" },
  { label: "Assumptions",         anchor: "section-key-assumptions" },
  { label: "Confidence",          anchor: "section-confidence" },
  { label: "Risks",               anchor: "section-risks" },
  { label: "Actions",             anchor: "section-actions" },
  { label: "Metrics",             anchor: "section-metrics" },
  { label: "Sources",             anchor: "section-sources" },
];

// Stage-aware label overrides for section pills
const STAGE_PILL_LABELS: Record<string, Record<string, string>> = {
  frame:    { Recommendation: "Strategic Hypothesis" },
  diagnose: { Recommendation: "Emerging Direction" },
  position: { Recommendation: "Positioning Recommendation" },
  commit:   { Sources: "Evidence Inherited" },
};

// Sections hidden per stage (pills not shown)
const STAGE_HIDDEN_PILLS: Record<string, Set<string>> = {
  frame:    new Set(["Actions", "Metrics"]),
  diagnose: new Set(["Actions", "Metrics"]),
  decide:   new Set(["Metrics"]),
  position: new Set(["Actions", "Metrics"]),
  commit:   new Set(),
};

function getReportPillsForStage(stageId: string): Array<{ label: string; anchor: string }> {
  const hidden = STAGE_HIDDEN_PILLS[stageId] ?? new Set();
  const labelOverrides = STAGE_PILL_LABELS[stageId] ?? {};

  return STANDARD_REPORT_PILLS
    .filter((pill) => !hidden.has(pill.label))
    .map((pill) => ({
      ...pill,
      label: labelOverrides[pill.label] ?? pill.label,
    }));
}

// Extract ### sub-headings from a markdown report string → navigable anchor pills
function extractSubheadings(markdown: string): Array<{ label: string; anchor: string }> {
  const results: Array<{ label: string; anchor: string }> = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^### (.+)$/);
    if (m) {
      const label = m[1].trim();
      const anchor = "subsection-" + label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      results.push({ label, anchor });
    }
  }
  return results;
}

const STAGE_HERO: Record<string, { tagline: string; description: string; goal: string; deliverables: string[] }> = {
  frame: {
    tagline: "Frame",
    description: "Build a clear frame around the decision: what has specifically changed, what the business needs to achieve in 24 to 36 months, and where the boundaries actually sit. Surface who has genuine authority to act on the output, and establish a shared understanding of the challenge that every subsequent stage depends on. Sharper framing here means fewer wasted cycles downstream.",
    goal: "Define exactly what is changing, what winning looks like in this context, and the boundaries of the decision you are here to make.",
    deliverables: ["The Strategic Problem", "Macro & Market Context", "Winning Conditions", "Decision Boundaries", "Strategic Hypothesis"],
  },
  diagnose: {
    tagline: "Diagnose",
    description: "Build a structured fact base across product-market fit, competitive position, unit economics, and operational capability — assessed against what the chosen direction will actually require. Separate the gaps that will constrain your options from the noise, and produce a shared, evidence-based view of position that makes the decision conversation significantly more productive.",
    goal: "Build an honest, structured fact base across product, market, and operations — before any strategic direction is chosen.",
    deliverables: ["Business Assessment", "Product-Market Fit", "Competitive Landscape", "Unit Economics", "Capability Assessment"],
  },
  decide: {
    tagline: "Decide",
    description: "Surface the genuine strategic options — including inaction, which carries its own cost — and pressure-test each one against what would need to be true for it to succeed. Drawing on Roger Martin's Playing to Win framework, work backwards from winning conditions, set explicit criteria for when you would change course, and structure a staged investment logic that avoids single-bet exposure. The output is a committed direction with the assumptions and trade-offs made visible.",
    goal: "Commit to a strategic direction — with explicit assumptions, kill criteria, and the conditions under which you would reverse it.",
    deliverables: ["Strategic Options", "Recommended Direction", "What Must Be True", "Kill Criteria"],
  },
  position: {
    tagline: "Position",
    description: "Translate strategic direction into a precise market stance — defining who the business serves, what job it does better than any available alternative, and which structural advantages it is building toward. Drawing on Hamilton Helmer's 7 Powers framework, identify the specific sources of defensibility available at this stage and what building toward them requires. The output gives product, GTM, and commercial teams a single coherent position to operate from.",
    goal: "Define precisely who you serve, what you do better than any alternative, and how you will build a defensible position over time.",
    deliverables: ["Target Customer", "Positioning Statement", "Competitive Advantage", "Structural Defensibility"],
  },
  commit: {
    tagline: "Commit",
    description: "Translate direction into execution: a portfolio of bets with clear ownership and metered funding gates, an OKR architecture that connects company-level strategy to team-level action, a 100-day plan that creates immediate accountability, and a governance rhythm that keeps the strategy live. The output functions as the operating system for the next phase of the business.",
    goal: "Translate strategic direction into a funded, governed, and time-bound execution plan that the whole leadership layer can be held to.",
    deliverables: ["Strategic Bets", "OKRs", "100-Day Plan", "Governance Rhythm", "Resource Allocation"],
  },
};

const STAGES: Stage[] = [
  {
    id: "frame",
    name: "Frame",
    purpose: "Define the inflection point and establish what winning looks like",
    output: "Scoped problem statement, quantified success criteria, scope boundaries, and an initial hypothesis",
    runButtonLabel: "Run Frame Report",
    questions: [
      {
        id: "persona",
        required: true,
        question: "Who is completing this session?",
        type: "single-select",
        options: [
          { value: "PE Partner / Principal", label: "PE Partner / Principal" },
          { value: "VC Investor", label: "VC Investor" },
          { value: "Portfolio Company CEO", label: "Portfolio Company CEO" },
          { value: "Portfolio Leadership Team", label: "Portfolio Leadership Team" },
          { value: "Independent Advisor / Fractional CPO", label: "Independent Advisor / Fractional CPO" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "trigger",
        required: true,
        question: "What triggered this strategic review?",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Growth has stalled or decelerated", label: "Growth has stalled or decelerated" },
          { value: "A competitor has made a significant move", label: "A competitor has made a significant move" },
          { value: "Approaching exit window or new funding round", label: "Approaching exit window or new funding round" },
          { value: "Pricing or revenue model is under pressure", label: "Pricing or revenue model is under pressure" },
          { value: "Technology shift is disrupting the category", label: "Technology shift is disrupting the category" },
          { value: "New leadership has joined", label: "New leadership has joined" },
          { value: "Acquisition or merger has completed", label: "Acquisition or merger has completed" },
          { value: "A key customer segment is churning", label: "A key customer segment is churning" },
          { value: "Current trajectory runs out of runway", label: "Current trajectory runs out of runway" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "lifecycle_stage",
        required: true,
        question: "Where is the business in its lifecycle?",
        type: "single-select",
        options: [
          { value: "Early growth — PMF established, scaling GTM", label: "Early growth — PMF established, scaling GTM" },
          { value: "Scaling — proven unit economics, expanding", label: "Scaling — proven unit economics, expanding" },
          { value: "Optimising — mature core, driving efficiency", label: "Optimising — mature core, driving efficiency" },
          { value: "Pre-exit — 12–24 months from exit", label: "Pre-exit — 12–24 months from exit" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "winning_definition",
        required: true,
        question: "What does winning look like in 24–36 months?",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Achieving a specific ARR or revenue target", label: "Achieving a specific ARR or revenue target" },
          { value: "Reaching profitability or a target EBITDA margin", label: "Reaching profitability or a target EBITDA margin" },
          { value: "Becoming the clear category leader in our segment", label: "Becoming the clear category leader in our segment" },
          { value: "Expanding into new geographies or verticals", label: "Expanding into new geographies or verticals" },
          { value: "Completing a successful exit or secondary", label: "Completing a successful exit or secondary" },
          { value: "Building platform or ecosystem defensibility", label: "Building platform or ecosystem defensibility" },
          { value: "Demonstrating strong NRR and retention benchmarks", label: "Demonstrating strong NRR and retention benchmarks" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "risk_appetite",
        required: false,
        question: "What is the risk appetite for this move?",
        type: "single-select",
        options: [
          { value: "Conservative — protect core, incremental change only", label: "Conservative — protect core, incremental change only" },
          { value: "Moderate — improve trajectory with selective adjacencies", label: "Moderate — improve trajectory with selective adjacencies" },
          { value: "Aggressive — willing to cannibalise existing revenue", label: "Aggressive — willing to cannibalise existing revenue" },
          { value: "Transformational — full pivot or platform shift on the table", label: "Transformational — full pivot or platform shift on the table" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "investment_horizon",
        required: false,
        question: "What is the investment horizon for this strategy?",
        type: "single-select",
        options: [
          { value: "Immediate (0–6 months, fast payback required)", label: "Immediate (0–6 months, fast payback required)" },
          { value: "Short-term (6–18 months)", label: "Short-term (6–18 months)" },
          { value: "Medium-term (18–36 months)", label: "Medium-term (18–36 months)" },
          { value: "Long-term (36+ months)", label: "Long-term (36+ months)" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "decision_maker",
        required: false,
        question: "Who is the primary decision-maker for this strategy?",
        type: "single-select",
        options: [
          { value: "CEO / Founder", label: "CEO / Founder" },
          { value: "PE or VC Sponsor / Board", label: "PE or VC Sponsor / Board" },
          { value: "CEO + Board jointly", label: "CEO + Board jointly" },
          { value: "Incoming or new leadership team", label: "Incoming or new leadership team" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "vision",
        required: false,
        question: "What is the company's current vision?",
        type: "free-text",
        placeholder: "e.g. To be the leading employee experience platform in Europe.",
        hint: "The long-term aspirational destination — where the company is ultimately headed. Leave blank if there isn't a formal statement.",
      },
      {
        id: "mission",
        required: false,
        question: "What is the company's current mission?",
        type: "free-text",
        placeholder: "e.g. To help companies build connected, engaged workforces.",
        hint: "The purpose the company exists to fulfil — what it does and for whom. Leave blank if there isn't a formal statement.",
      },
      {
        id: "strategic_question",
        required: true,
        question: "In one sentence — what is the core strategic question you are trying to answer?",
        type: "free-text",
        placeholder: "e.g. Should we expand into enterprise or double down on our SMB base?",
      },
    ],
  },
  {
    id: "diagnose",
    name: "Diagnose",
    purpose: "Assess current reality across market, customer, competitive, and capability dimensions",
    output: "PMF assessment, competitive position diagnosis, inflection type, unit economics, and capability gap matrix",
    runButtonLabel: "Run Diagnose Report",
    questions: [
      {
        id: "pmf_status",
        required: true,
        question: "How would you characterise current product-market fit?",
        type: "single-select",
        options: [
          { value: "Strong — high NPS, excellent retention, customers expand", label: "Strong — high NPS, excellent retention, customers expand" },
          { value: "Partial — works well for a subset, not broadly", label: "Partial — works well for a subset, not broadly" },
          { value: "Fragile — wins are inconsistent, churn is a real concern", label: "Fragile — wins are inconsistent, churn is a real concern" },
          { value: "Unclear — not yet rigorously tested", label: "Unclear — not yet rigorously tested" },
          { value: "Deteriorating — something has shifted in the market", label: "Deteriorating — something has shifted in the market" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "competitive_forces",
        required: true,
        question: "Which competitive forces are intensifying most right now?",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "New well-funded entrants targeting our space", label: "New well-funded entrants targeting our space" },
          { value: "Existing competitors improving significantly", label: "Existing competitors improving significantly" },
          { value: "Customers gaining more leverage or raising expectations", label: "Customers gaining more leverage or raising expectations" },
          { value: "Substitute or alternative solutions eroding demand", label: "Substitute or alternative solutions eroding demand" },
          { value: "Platform or supplier costs and control increasing", label: "Platform or supplier costs and control increasing" },
          { value: "Pricing pressure compressing margins", label: "Pricing pressure compressing margins" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "unit_economics",
        required: true,
        question: "What does the unit economics picture look like?",
        type: "single-select",
        options: [
          { value: "Strong — LTV:CAC >3:1, payback <18 months, healthy margins", label: "Strong — LTV:CAC >3:1, payback <18 months, healthy margins" },
          { value: "Acceptable — close to benchmarks, areas to improve", label: "Acceptable — close to benchmarks, areas to improve" },
          { value: "Mixed — strong on some metrics, weak on others", label: "Mixed — strong on some metrics, weak on others" },
          { value: "Challenged — high CAC, long payback, or margin pressure", label: "Challenged — high CAC, long payback, or margin pressure" },
          { value: "Unknown — no clear visibility on these metrics yet", label: "Unknown — no clear visibility on these metrics yet" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "arr_growth",
        required: true,
        question: "What is the current ARR growth rate?",
        type: "single-select",
        options: [
          { value: ">80% YoY", label: ">80% YoY" },
          { value: "50–80% YoY", label: "50–80% YoY" },
          { value: "25–50% YoY", label: "25–50% YoY" },
          { value: "10–25% YoY", label: "10–25% YoY" },
          { value: "<10% YoY or declining", label: "<10% YoY or declining" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "customer_signals",
        required: false,
        question: "What is the customer base telling you?",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Best customers are highly engaged and expanding", label: "Best customers are highly engaged and expanding" },
          { value: "Clear ICP but winning too often outside it", label: "Clear ICP but winning too often outside it" },
          { value: "Meaningful outcome variation across customer segments", label: "Meaningful outcome variation across customer segments" },
          { value: "Churn concentrated in a specific segment or cohort", label: "Churn concentrated in a specific segment or cohort" },
          { value: "Customers using the product for jobs we didn't design for", label: "Customers using the product for jobs we didn't design for" },
          { value: "Win rates declining against specific competitors", label: "Win rates declining against specific competitors" },
          { value: "Customers say they'd be very disappointed if we disappeared", label: "Customers say they'd be very disappointed if we disappeared" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "capability_gaps",
        required: false,
        question: "Where are the most significant internal capability gaps?",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Product and engineering velocity or quality", label: "Product and engineering velocity or quality" },
          { value: "Sales capacity and process maturity", label: "Sales capacity and process maturity" },
          { value: "Marketing and demand generation", label: "Marketing and demand generation" },
          { value: "Customer success and retention", label: "Customer success and retention" },
          { value: "Data and analytics capability", label: "Data and analytics capability" },
          { value: "Leadership and management depth", label: "Leadership and management depth" },
          { value: "Financial controls and reporting", label: "Financial controls and reporting" },
          { value: "GTM alignment across sales, marketing, and product", label: "GTM alignment across sales, marketing, and product" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "moat_status",
        required: false,
        question: "Which best describes the competitive moat today?",
        type: "single-select",
        options: [
          { value: "Strong and defensible — switching costs, network effects, or scale", label: "Strong and defensible — switching costs, network effects, or scale" },
          { value: "Narrow moat in a specific niche or segment", label: "Narrow moat in a specific niche or segment" },
          { value: "Mainly product quality and customer relationships", label: "Mainly product quality and customer relationships" },
          { value: "Limited differentiation — competing on price or service", label: "Limited differentiation — competing on price or service" },
          { value: "Moat is eroding as competitors catch up", label: "Moat is eroding as competitors catch up" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "current_challenges",
        required: false,
        question: "What are the top 3 challenges the business is facing right now?",
        hint: "Name each challenge and briefly describe why it matters. Up to 3.",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add Challenge",
        repeaterFields: ["Challenge", "Why it matters"],
        repeaterFieldPlaceholders: [
          "e.g. Sales cycle too long, NRR declining, product-market misalignment",
          "e.g. It's compressing ARR growth and making forecasting unreliable",
        ],
      },
      {
        id: "biggest_constraint",
        required: true,
        question: "What is the single biggest constraint on the business right now?",
        type: "free-text",
        placeholder: "e.g. We're winning deals but losing them at renewal — retention is the real constraint.",
      },
    ],
  },
  {
    id: "decide",
    name: "Decide",
    purpose: "Evaluate genuine strategic options and choose with clear criteria and kill conditions",
    output: "Chosen strategic direction with \"What Would Have to Be True\" conditions, kill criteria, and staged investment plan",
    runButtonLabel: "Run Decide Report",
    questions: [
      {
        id: "strategic_options",
        required: true,
        question: "Which strategic directions are genuinely on the table?",
        type: "multi-select",
        maxSelections: 4,
        options: [
          { value: "Double down on core — optimise what's working", label: "Double down on core — optimise what's working" },
          { value: "Move upmarket (enterprise or larger customers)", label: "Move upmarket (enterprise or larger customers)" },
          { value: "Move downmarket (SMB, self-serve, or PLG)", label: "Move downmarket (SMB, self-serve, or PLG)" },
          { value: "Expand into an adjacent product category", label: "Expand into an adjacent product category" },
          { value: "Enter new geographies or verticals", label: "Enter new geographies or verticals" },
          { value: "Shift the business model (usage-based, platform, or marketplace)", label: "Shift the business model (usage-based, platform, or marketplace)" },
          { value: "Build or acquire to create a platform play", label: "Build or acquire to create a platform play" },
          { value: "Reposition to own a new or redefined category", label: "Reposition to own a new or redefined category" },
          { value: "Pursue M&A as the primary growth lever", label: "Pursue M&A as the primary growth lever" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "cost_of_inaction",
        required: true,
        question: "What is the cost of inaction if strategy stays unchanged?",
        type: "single-select",
        options: [
          { value: "Very low — current trajectory is acceptable", label: "Very low — current trajectory is acceptable" },
          { value: "Moderate — leaving growth on the table but not in danger", label: "Moderate — leaving growth on the table but not in danger" },
          { value: "Significant — competitors pulling ahead, gap widening", label: "Significant — competitors pulling ahead, gap widening" },
          { value: "Critical — without strategic change the business is at risk", label: "Critical — without strategic change the business is at risk" },
          { value: "Unknown — haven't modelled the cost of inaction", label: "Unknown — haven't modelled the cost of inaction" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "decision_criteria",
        required: true,
        question: "Which criteria matter most when evaluating options?",
        hint: "Rank your top 3 in order of priority",
        type: "rank",
        maxSelections: 3,
        options: [
          { value: "Revenue impact within 24 months", label: "Revenue impact within 24 months" },
          { value: "EBITDA improvement", label: "EBITDA improvement" },
          { value: "Capital efficiency (return per £/$ invested)", label: "Capital efficiency (return per £/$ invested)" },
          { value: "Competitive moat strengthening", label: "Competitive moat strengthening" },
          { value: "Speed to market", label: "Speed to market" },
          { value: "Customer retention improvement", label: "Customer retention improvement" },
          { value: "Team capability alignment", label: "Team capability alignment" },
          { value: "Alignment with investment thesis or exit positioning", label: "Alignment with investment thesis or exit positioning" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "commitment_level",
        required: true,
        question: "How much strategic commitment can be made right now?",
        type: "single-select",
        options: [
          { value: "Full — ready to commit resources and stop pursuing alternatives", label: "Full — ready to commit resources and stop pursuing alternatives" },
          { value: "Staged — commit to initial investment with gates before full commitment", label: "Staged — commit to initial investment with gates before full commitment" },
          { value: "Exploratory — test and validate before any significant resource commitment", label: "Exploratory — test and validate before any significant resource commitment" },
          { value: "Uncertain — need more evidence before committing to any direction", label: "Uncertain — need more evidence before committing to any direction" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "bold_move_concern",
        required: false,
        question: "What is the biggest concern about making a bold strategic move?",
        type: "single-select",
        options: [
          { value: "Cannibalising existing revenue streams", label: "Cannibalising existing revenue streams" },
          { value: "Distraction from the core business", label: "Distraction from the core business" },
          { value: "Team capacity and execution risk", label: "Team capacity and execution risk" },
          { value: "Insufficient capital to execute", label: "Insufficient capital to execute" },
          { value: "Moving too slowly and being beaten by competitors", label: "Moving too slowly and being beaten by competitors" },
          { value: "Backing the wrong option — strategic mis-bet", label: "Backing the wrong option — strategic mis-bet" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "wwhtbt",
        required: true,
        question: "For the preferred option — what would have to be true for it to succeed?",
        type: "free-text",
        placeholder: "e.g. The enterprise segment would have to value our compliance features enough to pay 3x current ACV, and we'd need 5 reference customers in Q1.",
      },
      {
        id: "kill_criteria",
        required: true,
        question: "What evidence would confirm this strategy is working — or should be abandoned?",
        type: "free-text",
        placeholder: "e.g. If we haven't signed 3 enterprise pilots within 90 days, or pipeline coverage drops below 3:1, we trigger a review.",
      },
    ],
  },
  {
    id: "position",
    name: "Position",
    purpose: "Define the specific competitive stance, target customer, and differentiated value proposition",
    output: "Strategic positioning brief, validated positioning statement, ICP playbook, and 7 Powers assessment",
    runButtonLabel: "Run Position Report",
    questions: [
      {
        id: "target_customer",
        required: true,
        question: "Who is the primary target customer — the one everything is built around?",
        type: "single-select",
        options: [
          { value: "A specific firmographic profile (size, sector, geography)", label: "A specific firmographic profile (size, sector, geography)" },
          { value: "A persona defined by a trigger or transition they're experiencing", label: "A persona defined by a trigger or transition they're experiencing" },
          { value: "A segment defined by a specific job-to-be-done or pain", label: "A segment defined by a specific job-to-be-done or pain" },
          { value: "An account tier (enterprise, mid-market, SMB)", label: "An account tier (enterprise, mid-market, SMB)" },
          { value: "Multiple primary targets of genuinely equal priority", label: "Multiple primary targets of genuinely equal priority" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "competitive_alternative",
        required: true,
        question: "What is the clearest alternative your target customer has to you?",
        type: "multi-select",
        maxSelections: 2,
        options: [
          { value: "A direct competitor with a similar product", label: "A direct competitor with a similar product" },
          { value: "Doing it manually — spreadsheets or people", label: "Doing it manually — spreadsheets or people" },
          { value: "Building it themselves (build vs. buy)", label: "Building it themselves (build vs. buy)" },
          { value: "A legacy system or incumbent they're locked into", label: "A legacy system or incumbent they're locked into" },
          { value: "Doing nothing — the status quo", label: "Doing nothing — the status quo" },
          { value: "A patchwork of point solutions and workarounds", label: "A patchwork of point solutions and workarounds" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "value_prop_type",
        required: true,
        question: "What does the value proposition primarily deliver?",
        type: "single-select",
        options: [
          { value: "Saves significant time or reduces operational friction", label: "Saves significant time or reduces operational friction" },
          { value: "Generates measurable revenue or growth for the customer", label: "Generates measurable revenue or growth for the customer" },
          { value: "Reduces a specific risk, cost, or compliance burden", label: "Reduces a specific risk, cost, or compliance burden" },
          { value: "Gives customers strategic capability they couldn't otherwise have", label: "Gives customers strategic capability they couldn't otherwise have" },
          { value: "Replaces a complex, expensive process with a simpler, affordable one", label: "Replaces a complex, expensive process with a simpler, affordable one" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "market_stance",
        required: true,
        question: "Where do you want to compete on the market map?",
        type: "single-select",
        options: [
          { value: "Head-to-head — win the mainstream market against established players", label: "Head-to-head — win the mainstream market against established players" },
          { value: "Big fish, small pond — dominate a specific underserved niche", label: "Big fish, small pond — dominate a specific underserved niche" },
          { value: "Category creation — define and own an entirely new category", label: "Category creation — define and own an entirely new category" },
          { value: "Adjacent disruption — enter from the low end and move upmarket", label: "Adjacent disruption — enter from the low end and move upmarket" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "power_type",
        required: false,
        question: "Which best describes the primary competitive advantage — or the one being built toward?",
        hint: "Helmer's 7 Powers framework",
        type: "single-select",
        options: [
          { value: "Scale economies — lower unit costs than competitors at scale", label: "Scale economies — lower unit costs than competitors at scale" },
          { value: "Network effects — product value grows as more users join", label: "Network effects — product value grows as more users join" },
          { value: "Counter-positioning — model incumbents can't copy without self-harm", label: "Counter-positioning — model incumbents can't copy without self-harm" },
          { value: "Switching costs — customers locked in by data, integrations, or workflow", label: "Switching costs — customers locked in by data, integrations, or workflow" },
          { value: "Branding — premium perception that commands a price premium", label: "Branding — premium perception that commands a price premium" },
          { value: "Cornered resource — exclusive access to a key input or capability", label: "Cornered resource — exclusive access to a key input or capability" },
          { value: "Process power — operational capability competitors can't replicate", label: "Process power — operational capability competitors can't replicate" },
          { value: "Not yet established — this is what needs to be built", label: "Not yet established — this is what needs to be built" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "differentiation",
        required: true,
        question: "What are the 2–3 dimensions on which you are genuinely differentiated from alternatives?",
        type: "free-text",
        placeholder: "e.g. Native meeting platform integrations (not bot injection); compliance-grade data architecture; vertical-specific workflows for staffing agencies.",
      },
      {
        id: "positioning_statement",
        required: false,
        question: "Draft your positioning statement",
        hint: "For [target customer] who [need or trigger], [product] is a [market category] that [primary benefit]. Unlike [primary alternative], we [key differentiator].",
        type: "free-text",
        placeholder: "For [target customer] who [need or trigger], [product] is a [market category] that [primary benefit]. Unlike [primary alternative], we [key differentiator].",
      },
      {
        id: "moat_building",
        required: false,
        question: "Which moat-building activities are actively being pursued?",
        type: "multi-select",
        maxSelections: 2,
        options: [
          { value: "Deepening integrations that increase switching costs", label: "Deepening integrations that increase switching costs" },
          { value: "Building network effects (user data, community, or marketplace)", label: "Building network effects (user data, community, or marketplace)" },
          { value: "Accumulating proprietary data competitors can't access", label: "Accumulating proprietary data competitors can't access" },
          { value: "Achieving scale advantages that reduce unit cost", label: "Achieving scale advantages that reduce unit cost" },
          { value: "Building brand premium perception in the category", label: "Building brand premium perception in the category" },
          { value: "Locking in reference customers that validate category leadership", label: "Locking in reference customers that validate category leadership" },
          { value: "Creating a platform ecosystem that third parties build on", label: "Creating a platform ecosystem that third parties build on" },
          { value: "Other", label: "Other" },
        ],
      },
    ],
  },
  {
    id: "commit",
    name: "Commit",
    purpose: "Translate strategy into resourced bets, measurable objectives, and accountable governance",
    output: "Strategic bet portfolio, OKR architecture, 100-day execution plan, and Strategy on a Page",
    runButtonLabel: "Run Commit Report",
    questions: [
      {
        id: "strategic_bets",
        required: true,
        question: "What are the strategic bets being made in the next 12 months?",
        hint: "Up to 3 bets. For each: name the bet, the specific action you will take, the outcome you expect, and your hypothesis.",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add Bet",
        repeaterFields: ["Bet name", "Action", "Outcome", "Hypothesis"],
        repeaterFieldPlaceholders: [
          "Short label e.g. 'Move upmarket'",
          "What we will specifically do e.g. 'Hire 2 enterprise AEs, build compliance module'",
          "Measurable result we expect e.g. '5 enterprise pilots signed by Q1, ACV 3×'",
          "We believe [action] will result in [outcome] because [rationale]",
        ],
      },
      {
        id: "okrs",
        required: true,
        question: "What are the top 3 company-level objectives for the next 12 months?",
        hint: "For each: an objective (qualitative direction) and a key result (quantitative success measure).",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add OKR",
        repeaterFields: ["Objective", "Key Result"],
        repeaterFieldPlaceholders: ["Objective (qualitative direction)", "Key result (quantitative — what counts as success?)"],
      },
      {
        id: "horizon_allocation",
        required: true,
        question: "How will investment be allocated across horizons?",
        hint: "McKinsey benchmark is 70/20/10. Must total 100%.",
        type: "percentage-split",
        splitLabels: [
          "Core / H1 — defending and optimising what exists",
          "Adjacent / H2 — scaling into adjacent opportunities",
          "Transformational / H3 — exploring new models or markets",
        ],
      },
      {
        id: "thirty_day_actions",
        required: true,
        question: "What are the first 3 actions that must happen in the next 30 days?",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add Action",
        repeaterFields: ["Action", "Owner", "Success measure"],
        repeaterFieldPlaceholders: ["What needs to happen", "Who is accountable", "How success is measured"],
      },
      {
        id: "bet_kill_criteria",
        required: true,
        question: "What are the predefined kill criteria for the strategic bets?",
        type: "free-text",
        placeholder: "e.g. If enterprise pipeline coverage drops below 3:1 by day 60, or CAC exceeds £8k with no improving trajectory, trigger a board review.",
      },
      {
        id: "bet_classification",
        required: false,
        question: "How would you characterise each strategic bet?",
        hint: "Sure bet: high confidence, low risk. Solid bet: good evidence, moderate risk. Side bet: speculative. Slim bet: long shot.",
        type: "single-select",
        options: [
          { value: "Sure bet — high confidence, low risk, core to delivery", label: "Sure bet — high confidence, low risk, core to delivery" },
          { value: "Solid bet — good evidence, moderate risk, significant upside", label: "Solid bet — good evidence, moderate risk, significant upside" },
          { value: "Side bet — speculative, high upside if conditions are right", label: "Side bet — speculative, high upside if conditions are right" },
          { value: "Slim bet — long shot, transformational if successful", label: "Slim bet — long shot, transformational if successful" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "governance_rhythm",
        required: false,
        question: "What governance rhythm will hold this strategy accountable?",
        type: "multi-select",
        options: [
          { value: "Weekly operating metrics review (leadership team)", label: "Weekly operating metrics review (leadership team)" },
          { value: "Monthly strategic progress review (CEO + direct reports)", label: "Monthly strategic progress review (CEO + direct reports)" },
          { value: "Quarterly board or sponsor strategy review", label: "Quarterly board or sponsor strategy review" },
          { value: "30/60/90-day milestone gates with go/no-go decisions", label: "30/60/90-day milestone gates with go/no-go decisions" },
          { value: "Hypothesis and assumption review in product discovery cadence", label: "Hypothesis and assumption review in product discovery cadence" },
          { value: "Annual strategy refresh", label: "Annual strategy refresh" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "capability_needs",
        required: false,
        question: "Which capabilities must be built, bought, or partnered for in the next 6 months?",
        type: "multi-select",
        options: [
          { value: "Senior sales leadership for enterprise motion", label: "Senior sales leadership for enterprise motion" },
          { value: "Product engineering capacity", label: "Product engineering capacity" },
          { value: "Data and analytics infrastructure", label: "Data and analytics infrastructure" },
          { value: "Customer success and onboarding", label: "Customer success and onboarding" },
          { value: "Marketing and demand generation", label: "Marketing and demand generation" },
          { value: "Strategic partnerships or channel", label: "Strategic partnerships or channel" },
          { value: "M&A or integration capability", label: "M&A or integration capability" },
          { value: "Finance and operational controls", label: "Finance and operational controls" },
          { value: "Other", label: "Other" },
        ],
      },
    ],
  },
];

const PROGRESS_MESSAGES = [
  "Generating report...",
  "Analysing inputs...",
  "Researching market signals...",
  "Structuring findings...",
  "Building evidence base...",
  "Drafting recommendations...",
  "Finalising output...",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAnswerDisplay(answer: AnswerValue): string[] {
  if (typeof answer === "string") return [answer];
  if (Array.isArray(answer)) {
    // Check if it's a RepeaterEntry[]
    if (answer.length > 0 && typeof answer[0] === "object" && !Array.isArray(answer[0])) {
      return (answer as RepeaterEntry[]).map((entry, i) => {
        const fields = Object.entries(entry)
          .filter(([, v]) => v.trim().length > 0)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ");
        return `Entry ${i + 1}: ${fields}`;
      });
    }
    return answer as string[];
  }
  if (typeof answer === "object" && answer !== null) {
    if ("selection" in answer) {
      const a = answer as { selection: string; freetext: string };
      const parts = [a.selection];
      if (a.freetext) parts.push(a.freetext);
      return parts;
    }
    if ("h1" in answer) {
      const a = answer as SplitValue;
      return [`H1: ${a.h1}%`, `H2: ${a.h2}%`, `H3: ${a.h3}%`];
    }
  }
  return [];
}

function isAnswerValid(question: Question, answer: AnswerValue | undefined): boolean {
  // Optional questions: always valid (allow skipping)
  if (question.required === false) return true;

  if (answer === undefined || answer === null) return false;

  if (question.type === "free-text") {
    return typeof answer === "string" && answer.trim().length > 0;
  }
  if (question.type === "single-select") {
    return Array.isArray(answer) && answer.length > 0;
  }
  if (question.type === "multi-select") {
    return Array.isArray(answer) && answer.length > 0;
  }
  if (question.type === "rank") {
    return Array.isArray(answer) && answer.length === question.maxSelections;
  }
  if (question.type === "structured-repeater") {
    return (
      Array.isArray(answer) &&
      answer.length > 0 &&
      (answer as RepeaterEntry[]).every((e) => Object.values(e).some((v) => v.trim().length > 0))
    );
  }
  if (question.type === "percentage-split") {
    if (typeof answer === "object" && !Array.isArray(answer) && answer !== null && "h1" in answer) {
      const a = answer as SplitValue;
      return a.h1 + a.h2 + a.h3 === 100;
    }
    return false;
  }
  return false;
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ fontWeight: 700, color: "#111827" }}>
        {part}
      </strong>
    ) : (
      part
    )
  );
}

// Citation state — reset at start of each renderReport call
let _citeMap: Map<string, number> | null = null;
let _citeIdx = 0;
function _getCite(val: string): number {
  if (!_citeMap) { _citeMap = new Map(); _citeIdx = 0; }
  if (!_citeMap.has(val)) _citeMap.set(val, ++_citeIdx);
  return _citeMap.get(val)!;
}

function renderInlineContent(text: string): React.ReactNode[] {
  // Handle **bold**, _italic_, URLs, and numeric citations
  const numPat = /(\$[\d,]+(?:\.\d+)?(?:\s*(?:billion|million|bn|k|M|B))?(?:\s*(?:ARR|MRR|ACV))?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d+(?:\.\d+)?(?:\s*(?:billion|million|bn))\b|\b\d+(?:\.\d+)?%)/g;
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|https?:\/\/[^\s)]+)/g);
  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      result.push(<strong key={i} style={{ fontWeight: 700, color: "#111827" }}>{part.slice(2, -2)}</strong>);
      return;
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      result.push(<em key={i} style={{ fontStyle: "italic", color: "#6b7280" }}>{part.slice(1, -1)}</em>);
      return;
    }
    if (part.startsWith("http://") || part.startsWith("https://")) {
      result.push(
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{ color: "#2563eb", wordBreak: "break-all", textDecoration: "none" }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
        >{part}</a>
      );
      return;
    }
    // Detect numbers and add superscript citation markers
    numPat.lastIndex = 0;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = numPat.exec(part)) !== null) {
      if (m.index > lastIdx) result.push(part.slice(lastIdx, m.index));
      const cNum = _getCite(m[0]);
      result.push(
        <span key={`c-${i}-${m.index}`}>
          {m[0]}<sup style={{ fontSize: "0.62em", color: "#9ca3af", fontWeight: 600, marginLeft: "1px", lineHeight: 0 }}>{cNum}</sup>
        </span>
      );
      lastIdx = numPat.lastIndex;
    }
    result.push(part.slice(lastIdx));
  });
  return result;
}

const SEVERITY_REPORT_META: Record<string, { color: string; bg: string; dot: string }> = {
  Critical: { color: "#7f1d1d", bg: "#fef2f2", dot: "#dc2626" },
  High:     { color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
  Medium:   { color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
  Low:      { color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
};
const PRIORITY_REPORT_META: Record<string, { color: string; bg: string }> = {
  High:   { color: "#991b1b", bg: "#fee2e2" },
  Medium: { color: "#92400e", bg: "#fef3c7" },
  Low:    { color: "#065f46", bg: "#d1fae5" },
};

function renderRisksCards(risks: { risk: string; severity?: string; mitigation?: string }[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {risks.map((r, i) => {
        const sev = SEVERITY_REPORT_META[r.severity ?? ""];
        return (
          <div key={i} style={{ background: "#fff", border: "1px solid", borderColor: sev ? sev.bg : "#e5e7eb", borderLeft: `4px solid ${sev?.dot ?? "#e5e7eb"}`, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: r.mitigation ? 10 : 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.5, flex: 1 }}>{r.risk}</p>
              {sev && r.severity && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: sev.bg, color: sev.color, flexShrink: 0 }}>{r.severity}</span>
              )}
            </div>
            {r.mitigation && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                <p style={{ fontSize: 14, color: "#4b5563", margin: 0, lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 6 }}>Mitigation:</span>
                  {r.mitigation}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const REPORT_ACTION_STATUSES = [
  { value: "not_started", label: "Not Started", color: "#6b7280", bg: "#f3f4f6" },
  { value: "in_progress", label: "In Progress", color: "#1e40af", bg: "#dbeafe" },
  { value: "completed",   label: "Completed",   color: "#065f46", bg: "#d1fae5" },
  { value: "blocked",     label: "Blocked",     color: "#991b1b", bg: "#fee2e2" },
  { value: "deferred",    label: "Deferred",    color: "#92400e", bg: "#fef3c7" },
];
const REPORT_MONITORING_STATUSES = [
  { value: "tracking",  label: "Tracking",  color: "#1e40af", bg: "#dbeafe" },
  { value: "on_track",  label: "On Track",  color: "#065f46", bg: "#d1fae5" },
  { value: "off_track", label: "Off Track", color: "#991b1b", bg: "#fee2e2" },
  { value: "at_risk",   label: "At Risk",   color: "#92400e", bg: "#fef3c7" },
  { value: "paused",    label: "Paused",    color: "#6b7280", bg: "#f3f4f6" },
];
const REPORT_ASSUMPTION_STATUSES = [
  { value: "unvalidated", label: "Unvalidated", color: "#6b7280", bg: "#f3f4f6" },
  { value: "validated",   label: "Validated",   color: "#065f46", bg: "#d1fae5" },
  { value: "at_risk",     label: "At Risk",     color: "#92400e", bg: "#fef3c7" },
  { value: "invalidated", label: "Invalidated", color: "#991b1b", bg: "#fee2e2" },
];

function ReportStatusPills({ statuses, defaultValue }: { statuses: { value: string; label: string; color: string; bg: string }[]; defaultValue: string }) {
  const [current, setCurrent] = React.useState(defaultValue);
  const active = statuses.find((s) => s.value === current) ?? statuses[0];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {statuses.map((s) => (
        <button
          key={s.value}
          onClick={() => setCurrent(s.value)}
          style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1.5px solid", borderColor: current === s.value ? s.color : "#e5e7eb", background: current === s.value ? s.bg : "#fff", color: current === s.value ? s.color : "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}
        >
          {current === s.value && <span style={{ marginRight: 4 }}>●</span>}
          {s.label}
        </button>
      ))}
    </div>
  );
}

function renderActionsCards(actions: { action: string; owner?: string; deadline?: string; priority?: string }[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {actions.map((a, i) => {
        const pri = PRIORITY_REPORT_META[a.priority ?? ""];
        return (
          <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.5, flex: 1 }}>{a.action}</p>
              {pri && a.priority && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: pri.bg, color: pri.color, flexShrink: 0 }}>{a.priority}</span>}
            </div>
            {/* Owner + Deadline */}
            {(a.owner || a.deadline) && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                {a.owner && (
                  <span style={{ fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                    <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, marginRight: 4 }}>Owner</span>
                    <span style={{ color: "#374151", fontWeight: 500 }}>{a.owner}</span>
                  </span>
                )}
                {a.deadline && (
                  <span style={{ fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                    <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, marginRight: 4 }}>Deadline</span>
                    <span style={{ color: "#374151", fontWeight: 500 }}>{a.deadline}</span>
                  </span>
                )}
              </div>
            )}
            {/* Status pills */}
            <ReportStatusPills statuses={REPORT_ACTION_STATUSES} defaultValue="not_started" />
          </div>
        );
      })}
    </div>
  );
}

function renderMonitoringCards(monitoring: { metric: string; target?: string; frequency?: string }[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {monitoring.map((m, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 10px", lineHeight: 1.5 }}>{m.metric}</p>
          {/* Target + Frequency */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {m.target && (
              <span style={{ fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "flex-start", gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginTop: 1, flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, marginRight: 4 }}>Target</span>
                <span style={{ color: "#374151", fontWeight: 500 }}>{m.target}</span>
              </span>
            )}
            {m.frequency && (
              <span style={{ fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, marginRight: 4 }}>Frequency</span>
                <span style={{ color: "#374151", fontWeight: 500 }}>{m.frequency}</span>
              </span>
            )}
          </div>
          {/* Status pills */}
          <ReportStatusPills statuses={REPORT_MONITORING_STATUSES} defaultValue="tracking" />
        </div>
      ))}
    </div>
  );
}

function renderAssumptionsCards(assumptions: string[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {assumptions.map((text, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0, lineHeight: 1.5 }}>{text}</p>
          </div>
          <ReportStatusPills statuses={REPORT_ASSUMPTION_STATUSES} defaultValue="unvalidated" />
        </div>
      ))}
    </div>
  );
}

function renderKillCriteriaCards(items: { criterion: string; trigger: string; response: string }[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((k, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #fecaca", borderLeft: "4px solid #ef4444", borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 10px", lineHeight: 1.5 }}>{k.criterion}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#991b1b", background: "#fee2e2", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Trigger</span>
              <span style={{ lineHeight: 1.5 }}>{k.trigger}</span>
            </span>
            <span style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#065f46", background: "#dcfce7", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Response</span>
              <span style={{ lineHeight: 1.5 }}>{k.response}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderOKRsCards(items: { objective: string; key_results: string[] }[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((okr, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #bfdbfe", borderLeft: "4px solid #3b82f6", borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px", lineHeight: 1.5 }}>{okr.objective}</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {(okr.key_results ?? []).map((kr, j) => (
              <li key={j} style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 2 }}>{kr}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function renderStrategicBetsCards(items: { bet: string; hypothesis: string; investment: string }[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((b, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 10px", lineHeight: 1.5 }}>{b.bet}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#92400e", background: "#fef3c7", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Hypothesis</span>
              <span style={{ lineHeight: 1.5 }}>{b.hypothesis}</span>
            </span>
            <span style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1e40af", background: "#dbeafe", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Investment</span>
              <span style={{ lineHeight: 1.5 }}>{b.investment}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderHundredDayPlanCards(items: { milestone: string; timeline: string; owner: string; deliverable: string }[]): React.ReactNode {
  const timelineColor: Record<string, string> = { "30 days": "#059669", "60 days": "#d97706", "90 days": "#7c3aed" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((m, i) => {
        const color = timelineColor[m.timeline] ?? "#6b7280";
        return (
          <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderLeft: `4px solid ${color}`, borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color, padding: "2px 8px", borderRadius: 4 }}>{m.timeline}</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.5 }}>{m.milestone}</p>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {m.owner && <span style={{ fontSize: 12, color: "#6b7280" }}><span style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginRight: 4 }}>Owner</span>{m.owner}</span>}
              {m.deliverable && <span style={{ fontSize: 12, color: "#6b7280" }}><span style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginRight: 4 }}>Deliverable</span>{m.deliverable}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderReport(text: string, sections?: Record<string, unknown>): React.ReactNode {
  // Reset citation counter for each new report render
  _citeMap = null;
  _citeIdx = 0;

  // Split into major sections at ## boundaries
  const rawSections = text.split(/\n(?=## )/);
  const allNodes: React.ReactNode[] = [];

  for (let si = 0; si < rawSections.length; si++) {
    const sectionText = rawSections[si].trim();
    if (!sectionText) continue;

    let heading = "";
    let bodyText = sectionText;

    if (sectionText.startsWith("## ")) {
      const nl = sectionText.indexOf("\n");
      heading = nl > 0 ? sectionText.slice(3, nl).trim() : sectionText.slice(3).trim();
      bodyText = nl > 0 ? sectionText.slice(nl + 1).trim() : "";
    }

    const sectionId = heading ? "section-" + heading.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : `pre-${si}`;

    // Use structured card rendering for Risks / Actions / Monitoring sections
    let structuredContent: React.ReactNode | null = null;
    if (sections) {
      const h = heading.toLowerCase();
      if (h === "risks" && Array.isArray(sections.risks) && sections.risks.length > 0) {
        structuredContent = renderRisksCards(sections.risks as { risk: string; severity?: string; mitigation?: string }[]);
      } else if (h === "actions" && Array.isArray(sections.actions) && sections.actions.length > 0) {
        structuredContent = renderActionsCards(sections.actions as { action: string; owner?: string; deadline?: string; priority?: string }[]);
      } else if ((h === "monitoring" || h === "metrics") && Array.isArray(sections.monitoring) && sections.monitoring.length > 0) {
        structuredContent = renderMonitoringCards(sections.monitoring as { metric: string; target?: string; frequency?: string }[]);
      } else if ((h === "key assumptions" || h === "assumptions") && Array.isArray(sections.assumptions) && sections.assumptions.length > 0) {
        structuredContent = renderAssumptionsCards(sections.assumptions as string[]);
      } else if (h === "kill criteria" && Array.isArray(sections.kill_criteria) && sections.kill_criteria.length > 0) {
        structuredContent = renderKillCriteriaCards(sections.kill_criteria as { criterion: string; trigger: string; response: string }[]);
      } else if (h === "okrs" && Array.isArray(sections.okrs) && sections.okrs.length > 0) {
        structuredContent = renderOKRsCards(sections.okrs as { objective: string; key_results: string[] }[]);
      } else if (h === "strategic bets" && Array.isArray(sections.strategic_bets) && sections.strategic_bets.length > 0) {
        structuredContent = renderStrategicBetsCards(sections.strategic_bets as { bet: string; hypothesis: string; investment: string }[]);
      } else if (h === "100-day plan" && Array.isArray(sections.hundred_day_plan) && sections.hundred_day_plan.length > 0) {
        structuredContent = renderHundredDayPlanCards(sections.hundred_day_plan as { milestone: string; timeline: string; owner: string; deliverable: string }[]);
      }
    }

    const innerNodes = structuredContent ?? renderReportBlocks(bodyText, si * 1000);

    if (heading) {
      allNodes.push(
        <div key={si} id={sectionId} style={{
          background: "#f9fafb",
          border: "1px solid #f0f0f0",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, marginTop: 0 }}>
            {heading}
          </p>
          {innerNodes}
        </div>
      );
    } else {
      allNodes.push(<div key={si}>{innerNodes}</div>);
    }
  }

  return <>{allNodes}</>;
}

function renderReportBlocks(text: string, keyOffset: number): React.ReactNode[] {
  const blocks = text.split(/\n\n+/);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const trimmed = blocks[i].trim();
    if (!trimmed) continue;
    const key = keyOffset + i;

    // ## Heading (shouldn't appear inside a section body, but handle gracefully)
    if (trimmed.startsWith("## ")) {
      const heading = trimmed.slice(3);
      nodes.push(
        <p key={key} style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 10, marginTop: nodes.length === 0 ? 0 : 28 }}>
          {heading}
        </p>
      );
      continue;
    }

    // ### Sub-heading — stage-specific navigable sections
    // Look ahead to collect consecutive ### groups for two/three-column layout
    if (trimmed.startsWith("### ")) {
      // Collect this and all following consecutive ### blocks (heading + body blocks)
      type SubSection = { heading: string; bodyBlocks: string[] };
      const group: SubSection[] = [];
      let j = i;
      while (j < blocks.length) {
        const t = blocks[j].trim();
        if (!t) { j++; continue; }
        if (t.startsWith("### ")) {
          const heading = t.slice(4);
          const bodyBlocks: string[] = [];
          j++;
          // Collect following non-### non-## blocks as body
          while (j < blocks.length) {
            const next = blocks[j].trim();
            if (!next) { j++; continue; }
            if (next.startsWith("## ") || next.startsWith("### ")) break;
            bodyBlocks.push(next);
            j++;
          }
          group.push({ heading, bodyBlocks });
        } else {
          break;
        }
      }
      // Advance outer loop past all consumed blocks
      i = j - 1;

      // Render each sub-section's body blocks into nodes
      function renderSubBody(bodyBlocks: string[]): React.ReactNode[] {
        const subnodes: React.ReactNode[] = [];
        for (let k = 0; k < bodyBlocks.length; k++) {
          const bt = bodyBlocks[k];
          const blines = bt.split("\n");
          if (blines.every((l) => /^\d+\.\s/.test(l.trimStart()))) {
            subnodes.push(
              <div key={k} style={{ marginBottom: 8 }}>
                {blines.map((l, m) => {
                  const match = l.trimStart().match(/^(\d+)\.\s+(.+)$/);
                  if (!match) return null;
                  return (
                    <div key={m} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 1 }}>
                        {match[1]}
                      </span>
                      <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, flex: 1 }}>{renderInlineContent(match[2])}</span>
                    </div>
                  );
                })}
              </div>
            );
          } else if (blines.every((l) => l.trimStart().startsWith("- "))) {
            subnodes.push(
              <ul key={k} style={{ margin: "0 0 16px", paddingLeft: 20 }}>
                {blines.map((l, m) => (
                  <li key={m} style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, marginBottom: 6 }}>
                    {renderInlineContent(l.trimStart().slice(2))}
                  </li>
                ))}
              </ul>
            );
          } else if (blines.some((l) => l.trimStart().startsWith("- "))) {
            subnodes.push(
              <div key={k} style={{ marginBottom: 16 }}>
                {blines.map((l, m) => {
                  const t2 = l.trimStart();
                  if (t2.startsWith("- ")) {
                    return (
                      <div key={m} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <span style={{ color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>•</span>
                        <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.8 }}>{renderInlineContent(t2.slice(2))}</span>
                      </div>
                    );
                  }
                  return <p key={m} style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, margin: "0 0 6px" }}>{renderInlineContent(t2)}</p>;
                })}
              </div>
            );
          } else if (blines.length > 1) {
            subnodes.push(
              <div key={k} style={{ marginBottom: 20 }}>
                {blines.map((l, m) => (
                  <p key={m} style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", margin: m === 0 ? "0 0 2px" : "0" }}>
                    {renderInlineContent(l)}
                  </p>
                ))}
              </div>
            );
          } else {
            subnodes.push(
              <p key={k} style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", marginBottom: 16, marginTop: 0 }}>
                {renderInlineContent(bt)}
              </p>
            );
          }
        }
        return subnodes;
      }

      if (group.length === 2 || group.length === 3) {
        const cols = group.length === 2 ? "1fr 1fr" : "1fr 1fr 1fr";
        nodes.push(
          <div key={i} style={{ display: "grid", gridTemplateColumns: cols, gap: 24, marginTop: 22, marginBottom: 8 }}>
            {group.map((sec, idx) => {
              const subId = "subsection-" + sec.heading.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
              return (
                <div key={idx} id={subId} style={{ background: "#fff", borderRadius: 8, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 0 }}>
                    {sec.heading}
                  </p>
                  {renderSubBody(sec.bodyBlocks)}
                </div>
              );
            })}
          </div>
        );
      } else {
        // 1 or 4+: render as cards (stacked)
        for (const sec of group) {
          const subId = "subsection-" + sec.heading.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          nodes.push(
            <div key={subId} id={subId} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 18px", marginBottom: 10 }}>
              <p style={{
                fontSize: 11, fontWeight: 800, color: "#374151",
                marginBottom: 8, marginTop: 0,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                {sec.heading}
              </p>
              {renderSubBody(sec.bodyBlocks)}
            </div>
          );
        }
      }
      continue;
    }

    // --- divider
    if (trimmed === "---") {
      nodes.push(<hr key={i} style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0" }} />);
      continue;
    }

    const lines = trimmed.split("\n");

    // Numbered list block — all lines start with "N. "
    if (lines.every((l) => /^\d+\.\s/.test(l.trimStart()))) {
      nodes.push(
        <div key={i} style={{ marginBottom: 8 }}>
          {lines.map((l, j) => {
            const match = l.trimStart().match(/^(\d+)\.\s+(.+)$/);
            if (!match) return null;
            const isUrl = match[2].startsWith("http");
            return (
              <div key={j} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: isUrl ? "#dbeafe" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isUrl ? "#1d4ed8" : "#6b7280", marginTop: 1 }}>
                  {match[1]}
                </span>
                <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, flex: 1 }}>
                  {isUrl
                    ? <a href={match[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none", wordBreak: "break-all", fontSize: 12 }}>{match[2]}</a>
                    : renderInlineContent(match[2])
                  }
                </span>
              </div>
            );
          })}
        </div>
      );
      continue;
    }

    // Single numbered item block e.g. "1. Long paragraph..."
    const singleNumbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (singleNumbered) {
      nodes.push(
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 1 }}>
            {singleNumbered[1]}
          </span>
          <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, flex: 1 }}>{renderInlineContent(singleNumbered[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet list block (lines starting with "- ")
    if (lines.every((l) => l.trimStart().startsWith("- "))) {
      nodes.push(
        <ul key={i} style={{ margin: "0 0 16px", paddingLeft: 20 }}>
          {lines.map((l, j) => (
            <li key={j} style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, marginBottom: 6 }}>
              {renderInlineContent(l.trimStart().slice(2))}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Mixed block with some bullet lines
    if (lines.some((l) => l.trimStart().startsWith("- "))) {
      nodes.push(
        <div key={i} style={{ marginBottom: 16 }}>
          {lines.map((l, j) => {
            const t = l.trimStart();
            if (t.startsWith("- ")) {
              return (
                <div key={j} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>•</span>
                  <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.8 }}>{renderInlineContent(t.slice(2))}</span>
                </div>
              );
            }
            return <p key={j} style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, margin: "0 0 6px" }}>{renderInlineContent(t)}</p>;
          })}
        </div>
      );
      continue;
    }

    // Plain paragraph — may contain line breaks (e.g. bold title then detail line)
    if (lines.length > 1) {
      nodes.push(
        <div key={i} style={{ marginBottom: 20 }}>
          {lines.map((l, j) => (
            <p key={j} style={{ fontSize: 14, lineHeight: 1.7, color: "#374151", margin: j === 0 ? "0 0 2px" : "0" }}>
              {renderInlineContent(l)}
            </p>
          ))}
        </div>
      );
    } else {
      // If paragraph starts with **bold.** followed by body text, render bold on its own line
      const boldLeadMatch = trimmed.match(/^(\*\*[^*]+\*\*\.?)\s+([\s\S]+)$/);
      if (boldLeadMatch) {
        nodes.push(
          <div key={i} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#374151", margin: "0 0 3px", fontWeight: 600 }}>
              {renderInlineContent(boldLeadMatch[1])}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", margin: 0 }}>
              {renderInlineContent(boldLeadMatch[2])}
            </p>
          </div>
        );
      } else {
        nodes.push(
          <p key={i} style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", marginBottom: 16, marginTop: 0 }}>
            {renderInlineContent(trimmed)}
          </p>
        );
      }
    }
  }

  return nodes;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionCard({
  option,
  selected,
  disabled,
  onClick,
  showCheckbox,
  rankNumber,
}: {
  option: QuestionOption;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  showCheckbox?: boolean;
  rankNumber?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 18px",
        border: selected ? "2px solid #111827" : "1.5px solid #e5e7eb",
        borderRadius: 8,
        background: selected ? "#111827" : "#fff",
        color: selected ? "#fff" : disabled ? "#9ca3af" : "#374151",
        fontWeight: 500,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "all 150ms",
        opacity: disabled && !selected ? 0.5 : 1,
        width: "100%",
      }}
    >
      {rankNumber !== undefined && (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#fff",
            color: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {rankNumber}
        </span>
      )}
      {showCheckbox && rankNumber === undefined && (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: selected ? "2px solid #fff" : "2px solid #9ca3af",
            background: selected ? "#fff" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {selected && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      )}
      {option.label}
    </button>
  );
}

function OtherInput({ initialValue, onCommit }: { initialValue: string; onCommit: (text: string) => void }) {
  const [text, setText] = React.useState(initialValue);
  return (
    <input
      autoFocus
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onCommit(e.target.value);
      }}
      placeholder="Please specify..."
      style={{
        padding: "12px 16px",
        border: "1.5px solid #111827",
        borderRadius: 8,
        fontSize: 13,
        width: "100%",
        outline: "none",
        fontFamily: "inherit",
        boxSizing: "border-box" as const,
      }}
    />
  );
}

// ─── Collapsible Repeater Entry Card ─────────────────────────────────────────

function RepeaterEntryCard({
  idx,
  fields,
  placeholders,
  entry,
  hasContent,
  firstVal,
  addLabel,
  onUpdate,
  onRemove,
}: {
  idx: number;
  fields: string[];
  placeholders: string[];
  entry: RepeaterEntry;
  hasContent: boolean;
  firstVal: string;
  addLabel?: string;
  onUpdate: (field: string, val: string) => void;
  onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const itemLabel = addLabel?.replace(/^Add /, "") ?? "Entry";

  return (
    <div
      style={{
        border: "1.5px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Header — always visible */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          cursor: hasContent ? "pointer" : "default",
          background: collapsed ? "#f9fafb" : "#fff",
          borderBottom: collapsed ? "none" : "1px solid #f3f4f6",
        }}
        onClick={() => { if (hasContent) setCollapsed((c) => !c); }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {itemLabel} {idx + 1}
          </span>
          {collapsed && firstVal && (
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>— {firstVal}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasContent && (
            <button
              onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "0 4px", lineHeight: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 150ms" }}>
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1, padding: "0 2px", fontFamily: "inherit" }}
          >
            ×
          </button>
        </div>
      </div>
      {/* Fields — hidden when collapsed */}
      {!collapsed && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {fields.map((field, fi) => (
            <div key={field}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
                {field}
              </label>
              <textarea
                value={entry[field] ?? ""}
                onChange={(e) => onUpdate(field, e.target.value)}
                placeholder={placeholders[fi] ?? field}
                rows={2}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#111827",
                  background: "#fff",
                  resize: "none",
                  outline: "none",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "border-color 150ms",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#2563eb"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: AnswerValue | undefined;
  onChange: (val: AnswerValue) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [answer]);

  if (question.type === "free-text") {
    return (
      <textarea
        ref={textareaRef}
        value={typeof answer === "string" ? answer : ""}
        onChange={(e) => {
          onChange(e.target.value);
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
          }
        }}
        placeholder={question.placeholder}
        rows={3}
        style={{
          width: "100%",
          padding: "14px 16px",
          border: "1.5px solid #e5e7eb",
          borderRadius: 8,
          fontSize: 13,
          color: "#111827",
          background: "#fff",
          resize: "none",
          outline: "none",
          lineHeight: 1.6,
          boxSizing: "border-box",
          transition: "border-color 150ms",
          fontFamily: "inherit",
          minHeight: 100,
          overflow: "hidden",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#2563eb";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#e5e7eb";
        }}
      />
    );
  }

  if (question.type === "single-select") {
    const selected = Array.isArray(answer) ? (answer as string[]) : [];
    const hasOtherOption = question.options!.some((o) => o.value === "Other");
    const otherSelected = selected.some((v) => v === "Other" || v.startsWith("Other: "));
    const otherText = selected.find((v) => v.startsWith("Other: "))?.slice(7) ?? "";

    function handleOtherText(text: string) {
      const withoutOther = selected.filter((v) => v !== "Other" && !v.startsWith("Other: "));
      onChange(text.trim() ? [...withoutOther, `Other: ${text}`] : [...withoutOther, "Other"]);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.options!.map((opt) => {
          const isSelected = opt.value === "Other"
            ? otherSelected
            : selected.includes(opt.value);
          return (
            <OptionCard
              key={opt.value}
              option={opt}
              selected={isSelected}
              disabled={false}
              onClick={() => {
                if (opt.value === "Other") {
                  onChange(otherSelected ? [] : ["Other"]);
                } else {
                  onChange(isSelected ? [] : [opt.value]);
                }
              }}
            />
          );
        })}
        {hasOtherOption && otherSelected && (
          <OtherInput key="single-other" initialValue={otherText} onCommit={handleOtherText} />
        )}
      </div>
    );
  }

  if (question.type === "multi-select") {
    const selected = Array.isArray(answer) ? (answer as string[]) : [];
    const max = question.maxSelections;
    const hasOtherOption = question.options!.some((o) => o.value === "Other");
    const otherSelected = selected.some((v) => v === "Other" || v.startsWith("Other: "));
    const otherText = selected.find((v) => v.startsWith("Other: "))?.slice(7) ?? "";
    // Count "Other" variants as one selection
    const atMax = max !== undefined && selected.length >= max && !otherSelected;

    function handleOtherText(text: string) {
      const withoutOther = selected.filter((v) => v !== "Other" && !v.startsWith("Other: "));
      onChange(text.trim() ? [...withoutOther, `Other: ${text}`] : [...withoutOther, "Other"]);
    }

    return (
      <div>
        {max && max > 1 && (
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10, marginTop: 0 }}>
            Select up to {max} · {selected.length} selected
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {question.options!.map((opt) => {
            const isSelected = opt.value === "Other"
              ? otherSelected
              : selected.includes(opt.value);
            const isDisabled = atMax && !isSelected;
            return (
              <OptionCard
                key={opt.value}
                option={opt}
                selected={isSelected}
                disabled={isDisabled}
                showCheckbox={true}
                onClick={() => {
                  if (isDisabled) return;
                  if (opt.value === "Other") {
                    if (otherSelected) {
                      onChange(selected.filter((v) => v !== "Other" && !v.startsWith("Other: ")));
                    } else {
                      onChange([...selected, "Other"]);
                    }
                  } else {
                    if (isSelected) {
                      onChange(selected.filter((v) => v !== opt.value));
                    } else {
                      onChange([...selected, opt.value]);
                    }
                  }
                }}
              />
            );
          })}
          {hasOtherOption && otherSelected && (
            <OtherInput key="multi-other" initialValue={otherText} onCommit={handleOtherText} />
          )}
        </div>
      </div>
    );
  }

  if (question.type === "rank") {
    const ranked = Array.isArray(answer) ? (answer as string[]) : [];
    const max = question.maxSelections ?? 3;

    return (
      <div>
        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10, marginTop: 0 }}>
          Rank your top {max} in order of priority · {ranked.length} of {max} ranked
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {question.options!.map((opt) => {
            const rankIndex = ranked.indexOf(opt.value);
            const isSelected = rankIndex !== -1;
            const atMax = ranked.length >= max && !isSelected;
            return (
              <OptionCard
                key={opt.value}
                option={opt}
                selected={isSelected}
                disabled={atMax}
                rankNumber={isSelected ? rankIndex + 1 : undefined}
                onClick={() => {
                  if (atMax) return;
                  if (isSelected) {
                    onChange(ranked.filter((v) => v !== opt.value));
                  } else {
                    onChange([...ranked, opt.value]);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === "structured-repeater") {
    const entries = Array.isArray(answer) ? (answer as RepeaterEntry[]) : [];
    const fields = question.repeaterFields ?? [];
    const placeholders = question.repeaterFieldPlaceholders ?? fields;
    const max = question.maxSelections ?? 3;

    function updateEntry(idx: number, field: string, val: string) {
      const updated = entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e));
      onChange(updated);
    }

    function addEntry() {
      const blank: RepeaterEntry = {};
      fields.forEach((f) => (blank[f] = ""));
      onChange([...entries, blank]);
    }

    function removeEntry(idx: number) {
      onChange(entries.filter((_, i) => i !== idx));
    }

    // Check if an entry has any content (for collapse logic)
    function entryHasContent(entry: RepeaterEntry): boolean {
      return Object.values(entry).some((v) => v.trim().length > 0);
    }

    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((entry, idx) => {
            const hasContent = entryHasContent(entry);
            // First field value for collapsed summary
            const firstKey = fields[0];
            const firstVal = entry[firstKey] ?? "";
            return (
              <RepeaterEntryCard
                key={idx}
                idx={idx}
                fields={fields}
                placeholders={placeholders}
                entry={entry}
                hasContent={hasContent}
                firstVal={firstVal}
                addLabel={question.addLabel}
                onUpdate={(field, val) => updateEntry(idx, field, val)}
                onRemove={() => removeEntry(idx)}
              />
            );
          })}
        </div>
        {entries.length < max && (
          <button
            onClick={addEntry}
            style={{
              marginTop: entries.length > 0 ? 12 : 0,
              padding: "11px 20px",
              background: "#fff",
              color: "#374151",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 150ms",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {question.addLabel ?? "Add entry"} {entries.length > 0 ? `(${entries.length}/${max})` : ""}
          </button>
        )}
      </div>
    );
  }

  if (question.type === "percentage-split") {
    const labels = question.splitLabels ?? ["H1", "H2", "H3"];
    const val = (typeof answer === "object" && answer !== null && !Array.isArray(answer) && "h1" in answer)
      ? (answer as SplitValue)
      : { h1: 0, h2: 0, h3: 0 };
    const total = val.h1 + val.h2 + val.h3;
    const remaining = 100 - total;

    function update(key: "h1" | "h2" | "h3", raw: string) {
      const n = parseInt(raw, 10);
      const num = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
      onChange({ ...val, [key]: num });
    }

    const keys: Array<"h1" | "h2" | "h3"> = ["h1", "h2", "h3"];

    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {keys.map((key, i) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#374151", margin: 0 }}>{labels[i]}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={val[key] === 0 ? "" : val[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder="0"
                  style={{
                    width: 72,
                    padding: "10px 12px",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#111827",
                    textAlign: "right",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    transition: "border-color 150ms",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#2563eb"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
                />
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>%</span>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: total === 100 ? "#d1fae5" : total > 100 ? "#fee2e2" : "#f9fafb",
            border: `1px solid ${total === 100 ? "#a7f3d0" : total > 100 ? "#fca5a5" : "#e5e7eb"}`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: total === 100 ? "#059669" : total > 100 ? "#dc2626" : "#6b7280" }}>
            Total: {total}%
          </span>
          <span style={{ fontSize: 12, color: total === 100 ? "#059669" : "#6b7280" }}>
            {total === 100 ? "Good to go" : remaining > 0 ? `${remaining}% remaining` : `${Math.abs(remaining)}% over`}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function AnswerChip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#f3f4f6",
        color: "#374151",
        borderRadius: 4,
        padding: "4px 10px",
        fontSize: 13,
        fontWeight: 500,
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {text}
    </span>
  );
}

function AnswerSummaryPanel({
  stage,
  answers,
  currentQuestion,
}: {
  stage: Stage;
  answers: Record<string, AnswerValue>;
  currentQuestion: number;
}) {
  // Show all questions that have a value — so editing doesn't wipe the right panel
  const answered = stage.questions.filter((q) => {
    const a = answers[q.id];
    if (a === undefined || a === null) return false;
    if (Array.isArray(a)) return a.length > 0;
    if (typeof a === "string") return a.trim().length > 0;
    if (typeof a === "object" && "selection" in a) return (a as { selection: string }).selection.length > 0;
    if (typeof a === "object" && "h1" in a) {
      const sv = a as SplitValue;
      return sv.h1 + sv.h2 + sv.h3 > 0;
    }
    return false;
  });
  if (answered.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", margin: 0, paddingTop: 8, lineHeight: 1.6 }}>
        Your answers will appear here as you progress.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {answered.map((q) => {
          const answer = answers[q.id];
          if (answer === undefined) return null;
          const chips = getAnswerDisplay(answer);
          const isFreeText = q.type === "free-text";
          const isRepeater = q.type === "structured-repeater";
          const isSplit = q.type === "percentage-split";
          return (
            <div key={q.id}>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 8,
                  marginTop: 0,
                  lineHeight: 1.4,
                }}
              >
                {q.question}
              </p>
              <div>
                {isFreeText ? (
                  <p style={{ fontSize: 13, color: "#374151", fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>
                    "{chips[0]}"
                  </p>
                ) : isRepeater ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {chips.map((chip, i) => (
                      <p key={i} style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.4 }}>{chip}</p>
                    ))}
                  </div>
                ) : isSplit ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {chips.map((chip, i) => <AnswerChip key={i} text={chip} />)}
                  </div>
                ) : (
                  chips.map((chip, i) => <AnswerChip key={i} text={chip} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Report Feedback ──────────────────────────────────────────────────────────

const FEEDBACK_CATEGORIES = [
  { id: "accuracy", label: "Accuracy", description: "Does this reflect the business reality correctly?" },
  { id: "depth", label: "Depth", description: "Is the analysis sufficiently detailed and substantive?" },
  { id: "actionability", label: "Actionability", description: "Are the recommendations clear and executable?" },
  { id: "relevance", label: "Relevance", description: "Is this focused on what actually matters right now?" },
];

const STAR_PATH = "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z";

function QuickStars({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  const [hovered, setHovered] = React.useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map((s) => {
        const filled = s <= (hovered || value);
        return (
          <button
            key={s}
            onClick={() => onSelect(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            title={`${s} star${s !== 1 ? "s" : ""}`}
            style={{ background: "none", border: "none", padding: 2, cursor: "pointer", lineHeight: 0, color: filled ? "#059669" : "#d1d5db", transition: "color 100ms" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d={STAR_PATH} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = React.useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: filled ? "#059669" : "#d1d5db", transition: "color 100ms",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d={STAR_PATH} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function ReportFeedback({ stageId, stageName }: { stageId: string; stageName: string }) {
  const [open, setOpen] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [quickRating, setQuickRating] = React.useState(0);
  const [ratings, setRatings] = React.useState<Record<string, number>>({});
  const [comment, setComment] = React.useState("");

  const allRated = FEEDBACK_CATEGORIES.every((c) => ratings[c.id] > 0);
  const avgRating = quickRating > 0 ? quickRating : (allRated
    ? Math.round(Object.values(ratings).reduce((a, b) => a + b, 0) / FEEDBACK_CATEGORIES.length * 10) / 10
    : null);

  async function saveFeedback(payload: Record<string, unknown>) {
    try {
      await fetch("/api/strategy/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowType: stageId, ...payload }),
      });
    } catch { /* non-fatal */ }
  }

  async function handleQuickStar(s: number) {
    setQuickRating(s);
    setRatings({ accuracy: s, depth: s, actionability: s, relevance: s });
    setOpen(true);
    await saveFeedback({ overallRating: s, accuracy: s, depth: s, actionability: s, relevance: s });
  }

  async function handleSubmit() {
    if (!allRated) return;
    await saveFeedback({
      overallRating: quickRating || Math.round(Object.values(ratings).reduce((a, b) => a + b, 0) / FEEDBACK_CATEGORIES.length),
      accuracy: ratings.accuracy,
      depth: ratings.depth,
      actionability: ratings.actionability,
      relevance: ratings.relevance,
      comment,
    });
    setSubmitted(true);
    setOpen(false);
  }

  // ── Collapsed / submitted bar ──
  const barBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 48px", borderBottom: "1px solid #e5e7eb",
    background: submitted ? "#f0fdf4" : "#fafafa",
    flexShrink: 0,
  };

  if (submitted) {
    return (
      <div style={barBase}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", background: "#d1fae5",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M2 8l4 4 8-8" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>Thanks for your feedback</span>
        <span style={{ fontSize: 13, color: "#6b7280" }}>— you rated this report {avgRating}/5</span>
      </div>
    );
  }

  if (!open) {
    return (
      <div style={{ ...barBase, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 13, color: "#6b7280", marginRight: 8 }}>How useful was this report?</span>
        <QuickStars value={quickRating} onSelect={handleQuickStar} />
      </div>
    );
  }

  // ── Expanded panel ──
  return (
    <div style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa", flexShrink: 0 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 48px 0" }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Rate this {stageName} report</span>
          <span style={{ fontSize: 13, color: "#6b7280", marginLeft: 10 }}>Your feedback improves future analyses.</span>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4, lineHeight: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 4 categories in a row */}
      <div style={{ display: "flex", gap: 0, padding: "16px 48px" }}>
        {FEEDBACK_CATEGORIES.map((cat, i) => (
          <div
            key={cat.id}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              paddingRight: i < FEEDBACK_CATEGORIES.length - 1 ? 24 : 0,
              borderRight: i < FEEDBACK_CATEGORIES.length - 1 ? "1px solid #e5e7eb" : "none",
              marginRight: i < FEEDBACK_CATEGORIES.length - 1 ? 24 : 0,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat.label}</span>
            <span style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.4 }}>{cat.description}</span>
            <StarRating
              value={ratings[cat.id] ?? 0}
              onChange={(v) => setRatings((prev) => ({ ...prev, [cat.id]: v }))}
            />
          </div>
        ))}
      </div>

      {/* Comment + submit */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "0 48px 16px" }}>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What would make this more useful? (optional)"
          rows={2}
          style={{
            flex: 1, padding: "8px 12px", fontSize: 13,
            border: "1.5px solid #e5e7eb", borderRadius: 8, outline: "none",
            fontFamily: "inherit", resize: "none", color: "#374151",
            lineHeight: 1.6, background: "#fff",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#2563eb"; }}
          onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
        />
        <button
          onClick={handleSubmit}
          disabled={!allRated}
          style={{
            background: allRated ? "#111827" : "#f3f4f6",
            color: allRated ? "#fff" : "#9ca3af",
            border: "none", borderRadius: 8, padding: "9px 20px",
            fontSize: 13, fontWeight: 600, cursor: allRated ? "pointer" : "not-allowed",
            fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {allRated ? "Submit feedback" : `Rate all ${FEEDBACK_CATEGORIES.length} to submit`}
        </button>
      </div>
    </div>
  );
}

// ─── Share Button ─────────────────────────────────────────────────────────────

function ShareButton({ stageId, stageName, reportSections, fullWidth }: { stageId: string; stageName: string; reportSections?: Record<string, unknown>; fullWidth?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleShare() {
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email address"); return; }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/strategy/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, stageName, recipientEmail: email.trim(), sections: reportSections }),
      });
      if (!res.ok) throw new Error("Failed");
      setSent(true);
      setEmail("");
      setTimeout(() => { setSent(false); setOpen(false); }, 2500);
    } catch {
      setError("Failed to send — please try again");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: "relative", display: fullWidth ? "block" : "inline-block", marginRight: fullWidth ? 0 : 8 }}>
      <button
        onClick={() => { setOpen((o) => !o); setSent(false); setError(""); }}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
          padding: fullWidth ? "12px" : "7px 14px", fontSize: 13, fontWeight: 500, color: "#6b7280",
          cursor: "pointer", fontFamily: "inherit", width: fullWidth ? "100%" : undefined,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Share
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.10)", padding: 20, width: 300,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Share report</p>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Send a summary of the {stageName} report by email.</p>
          {sent ? (
            <p style={{ fontSize: 13, color: "#059669", fontWeight: 500 }}>✓ Sent successfully</p>
          ) : (
            <>
              <input
                type="email"
                placeholder="recipient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13,
                  border: "1.5px solid #e5e7eb", borderRadius: 8, outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8,
                }}
                onFocus={(e) => { e.target.style.borderColor = "#2563eb"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
              />
              {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleShare}
                  disabled={sending}
                  style={{
                    flex: 1, background: "#111827", color: "#fff", border: "none",
                    borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600,
                    cursor: sending ? "not-allowed" : "pointer", fontFamily: "inherit",
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
                    padding: "9px 14px", fontSize: 13, fontWeight: 500, color: "#6b7280",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Toast Notification ───────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        right: 32,
        zIndex: 9999,
        background: "#111827",
        color: "#fff",
        borderRadius: 10,
        padding: "14px 20px",
        fontSize: 13,
        fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 300ms, transform 300ms",
        pointerEvents: "none",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#4ade80" strokeWidth="1.5" />
        <path d="M5 8l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  );
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

const STAGE_DEFAULT_TAGS: Record<string, string[]> = {
  frame:    ["Strategic Problem", "Market Context", "Winning Conditions", "Decision Boundaries", "Strategic Hypothesis"],
  diagnose: ["Business Assessment", "Product-Market Fit", "Competitive Landscape", "Unit Economics", "Capability Assessment"],
  decide:   ["Strategic Options", "Recommended Direction", "What Must Be True", "Kill Criteria"],
  position: ["Target Customer", "Competitive Advantage", "Positioning Statement", "Structural Defensibility"],
  commit:   ["Strategic Bets", "OKRs", "100-Day Plan", "Kill Criteria", "Resource Allocation"],
};

function stripMd(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^-{3,}$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function renderSectionHtml(title: string, content: unknown): string {
  if (!content) return "";
  let body = "";
  if (typeof content === "string") {
    const paras = stripMd(content).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    body = paras.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  } else if (Array.isArray(content)) {
    const items = (content as unknown[]).map((item) => {
      if (typeof item === "string") return `<li>${stripMd(item)}</li>`;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (o.text) return `<li><strong>${stripMd(String(o.text))}</strong>${o.fragility ? ` <span class="badge">${o.fragility}</span>` : ""}</li>`;
        if (o.risk) return `<li><strong>${stripMd(String(o.risk))}</strong> <span class="badge ${o.severity}">${o.severity}</span>${o.mitigation ? `<br><span class="sub">Mitigation: ${stripMd(String(o.mitigation))}</span>` : ""}</li>`;
        if (o.action) return `<li><strong>${stripMd(String(o.action))}</strong><br><span class="sub">${[o.priority, o.owner, o.deadline].filter(Boolean).join(" · ")}</span></li>`;
        if (o.metric) return `<li><strong>${stripMd(String(o.metric))}</strong>: ${o.target ?? ""} <span class="sub">(${o.frequency ?? ""})</span></li>`;
      }
      return "";
    }).filter(Boolean);
    body = `<ul>${items.join("")}</ul>`;
  }
  return `<section><h2>${title}</h2>${body}</section>`;
}

function downloadReportPDF(stageName: string, companyName: string, sections: Record<string, unknown>, markdownReport?: string | null) {
  const conf = sections.confidence as { score?: number; rationale?: string } | undefined;
  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  // Convert markdown to simple HTML — strip citation tags like [Frame · Section]
  function mdToHtml(md: string): string {
    const lines = md.split("\n");
    const htmlParts: string[] = [];
    let inSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Strip citation tags [Stage · Section] and [N] superscripts
      const clean = line.replace(/\[[^\]]+·[^\]]+\]/g, "").replace(/\[\d+\]/g, "").trim();
      if (line.startsWith("## ")) {
        if (inSection) htmlParts.push("</section>");
        htmlParts.push(`<section><h2>${clean.replace(/^## /, "")}</h2>`);
        inSection = true;
      } else if (line.startsWith("### ")) {
        htmlParts.push(`<h3>${clean.replace(/^### /, "")}</h3>`);
      } else if (line.startsWith("---")) {
        // section divider — skip
      } else if (line.startsWith("**") && line.endsWith("**")) {
        htmlParts.push(`<p><strong>${clean.slice(2, -2)}</strong></p>`);
      } else if (line.startsWith("- ")) {
        htmlParts.push(`<li>${clean.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/_(.*?)_/g, "<em>$1</em>")}</li>`);
      } else if (/^\d+\.\s/.test(line)) {
        htmlParts.push(`<li>${clean.replace(/^\d+\.\s/, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</li>`);
      } else if (clean) {
        htmlParts.push(`<p>${clean.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/_(.*?)_/g, "<em>$1</em>")}</p>`);
      }
    }
    if (inSection) htmlParts.push("</section>");
    return htmlParts.join("\n");
  }

  const bodyContent = markdownReport
    ? mdToHtml(markdownReport)
    : "<p>No content available.</p>";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${stageName} Report — ${companyName} — Inflexion</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11pt;color:#111827;background:#fff;padding:0}
  @media screen{body{max-width:760px;margin:0 auto;padding:32px 24px}}
  @page{margin:18mm 20mm;size:A4}
  .header{border-bottom:2px solid #111827;padding-bottom:16px;margin-bottom:32px}
  .header h1{font-size:22pt;font-weight:800;color:#111827;margin-bottom:4px}
  .header .company{font-size:13pt;color:#6b7280;margin-bottom:2px}
  .header .meta{font-size:9pt;color:#9ca3af}
  .conf{display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:4px 12px;font-size:10pt;font-weight:700;color:#374151;margin-top:10px}
  section{margin-bottom:28px;page-break-inside:avoid}
  h2{font-size:13pt;font-weight:700;color:#111827;margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
  h3{font-size:9pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em;margin:20px 0 8px}
  p{font-size:10.5pt;line-height:1.7;color:#374151;margin-bottom:8px}
  ul,ol{padding-left:18px;margin:0 0 12px}
  li{font-size:10.5pt;line-height:1.65;color:#374151;margin-bottom:6px}
  li strong{color:#111827}
  strong{color:#111827}
  em{color:#6b7280;font-style:normal}
  .footer{margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:8.5pt;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{.no-print{display:none}.footer{position:fixed;bottom:10mm;left:20mm;right:20mm}}
</style>
</head>
<body>
<div class="header">
  <h1>${stageName} Report</h1>
  <div class="company">${companyName}</div>
  <div class="meta">${date} · Inflexion by Nth Layer</div>
  ${conf?.score !== undefined ? `<div class="conf">Confidence: ${Math.round(conf.score * 100)}%</div>` : ""}
</div>
${bodyContent}
<div class="footer">
  <span>${stageName} Report — Inflexion · ${companyName}</span>
  <span>${date}</span>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stageName}-Report-${companyName}-Inflexion.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─── Main Component ───────────────────────────────────────────────────────────

type OutputVersion = {
  id: string;
  sections: Record<string, unknown>;
  createdAt: string;
  version: number;
  confidence: number | null;
  tags: string[];
};

export function StrategyFlow({
  initialRunningJobs = [],
  initialCompletedOutputs = {},
  initialSavedAnswers = {},
  companyName = "",
  initialCompletedOutputIds = {},
  allOutputsByStage = {},
}: {
  initialRunningJobs?: { stageId: string; sessionId: string }[];
  initialCompletedOutputs?: Record<string, Record<string, unknown>>;
  initialSavedAnswers?: Record<string, Record<string, unknown>>;
  companyName?: string;
  initialCompletedOutputIds?: Record<string, string>;
  allOutputsByStage?: Record<string, OutputVersion[]>;
}) {
  // sectionsToMarkdown needs to be defined before useState so we can use it in initial state
  function sectionsToMarkdownInit(sections: Record<string, unknown>): string {
    const lines: string[] = [];
    if (sections.executive_summary) lines.push(`## Executive Summary\n\n${sections.executive_summary}`);
    if (sections.what_matters) lines.push(`## What Matters Most\n\n${sections.what_matters}`);
    if (sections.recommendation) lines.push(`## Recommendation\n\n${sections.recommendation}`);
    if (sections.business_implications) lines.push(`## Business Implications\n\n${sections.business_implications}`);
    if (Array.isArray(sections.assumptions) && sections.assumptions.length > 0) {
      lines.push(`## Key Assumptions\n\n${(sections.assumptions as string[]).map((a) => `- ${a}`).join("\n")}`);
    }
    const conf = sections.confidence as { score?: number; rationale?: string } | undefined;
    if (conf) {
      const pct = conf.score !== undefined ? `${Math.round(conf.score * 100)}%` : "";
      const rationale = conf.rationale ?? "";
      // Convert rationale to bullet points — split on (N) numbered items or sentence boundaries
      let rationaleBullets: string;
      if (/\(\d+\)/.test(rationale)) {
        const parts = rationale.split(/(?=\(\d+\))/).map((s) => s.trim()).filter(Boolean);
        // Check for preamble before first numbered item
        const firstNumIdx = rationale.search(/\(\d+\)/);
        const preamble = firstNumIdx > 0 ? rationale.slice(0, firstNumIdx).trim() : "";
        const bullets = preamble ? [`- ${preamble}`, ...parts.map((p) => `- ${p.replace(/^\(\d+\)\s*/, "")}`)] : parts.map((p) => `- ${p.replace(/^\(\d+\)\s*/, "")}`);
        rationaleBullets = bullets.join("\n");
      } else {
        // Split on ". " boundaries (sentence-level)
        const sentences = rationale.split(/\.\s+(?=[A-Z])/).filter((s) => s.trim().length > 15);
        rationaleBullets = sentences.length > 1
          ? sentences.map((s) => `- ${s.trim().replace(/\.$/, "")}.`).join("\n")
          : `- ${rationale}`;
      }
      const confLabel = conf.score !== undefined
        ? conf.score >= 0.75 ? "High confidence" : conf.score >= 0.55 ? "Moderate confidence" : "Low confidence"
        : "";
      const confNote = conf.score !== undefined
        ? conf.score >= 0.75
          ? "The evidence base is strong. This report is reliable for decision-making."
          : conf.score >= 0.55
          ? "The evidence base is adequate. Some gaps exist — treat directional conclusions with appropriate caution."
          : "The evidence base is limited. Treat conclusions as hypotheses to validate, not decisions to commit to."
        : "";
      lines.push(`## Confidence\n\n- **Score:** ${pct} — ${confLabel}\n- ${confNote}\n${rationaleBullets}`);
    }
    if (Array.isArray(sections.risks) && sections.risks.length > 0) {
      const riskLines = (sections.risks as { risk: string; severity: string; mitigation: string }[]).map(
        (r) => `**${r.risk}**\n_(${r.severity})_ — ${r.mitigation}`
      );
      lines.push(`## Risks\n\n${riskLines.join("\n\n")}`);
    }
    if (Array.isArray(sections.actions) && sections.actions.length > 0) {
      const actionLines = (sections.actions as { action: string; owner: string; deadline: string; priority: string }[]).map(
        (a) => `**${a.action}**\n_${a.priority}_ — ${a.owner} · ${a.deadline}`
      );
      lines.push(`## Actions\n\n${actionLines.join("\n\n")}`);
    }
    if (Array.isArray(sections.monitoring) && sections.monitoring.length > 0) {
      const monLines = (sections.monitoring as { metric: string; target: string; frequency: string }[]).map(
        (m) => `**${m.metric}**\n${m.target} _(${m.frequency})_`
      );
      lines.push(`## Metrics\n\n${monLines.join("\n\n")}`);
    }
    if (Array.isArray(sections.kill_criteria) && sections.kill_criteria.length > 0) {
      const kcLines = (sections.kill_criteria as { criterion: string; trigger: string; response: string }[]).map(
        (k) => `**${k.criterion}**\n_Trigger:_ ${k.trigger}\n_Response:_ ${k.response}`
      );
      lines.push(`## Kill Criteria\n\n${kcLines.join("\n\n")}`);
    }
    if (Array.isArray(sections.okrs) && sections.okrs.length > 0) {
      const okrLines = (sections.okrs as { objective: string; key_results: string[] }[]).map(
        (o) => `**${o.objective}**\n${(o.key_results ?? []).map((kr) => `- ${kr}`).join("\n")}`
      );
      lines.push(`## OKRs\n\n${okrLines.join("\n\n")}`);
    }
    if (Array.isArray(sections.strategic_bets) && sections.strategic_bets.length > 0) {
      const betLines = (sections.strategic_bets as { bet: string; hypothesis: string; investment: string }[]).map(
        (b) => `**${b.bet}**\n_Hypothesis:_ ${b.hypothesis}\n_Investment:_ ${b.investment}`
      );
      lines.push(`## Strategic Bets\n\n${betLines.join("\n\n")}`);
    }
    if (Array.isArray(sections.hundred_day_plan) && sections.hundred_day_plan.length > 0) {
      const planLines = (sections.hundred_day_plan as { milestone: string; timeline: string; owner: string; deliverable: string }[]).map(
        (p) => `**${p.milestone}** _(${p.timeline})_\nOwner: ${p.owner}\nDeliverable: ${p.deliverable}`
      );
      lines.push(`## 100-Day Plan\n\n${planLines.join("\n\n")}`);
    }
    const eb = sections.evidence_base as { sources?: string[]; quotes?: string[] } | undefined;
    if (eb?.sources && eb.sources.length > 0) {
      lines.push(`## Sources\n\n${eb.sources.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
    }
    return lines.join("\n\n---\n\n");
  }

  const initialState: Record<string, StageState> = {};
  STAGES.forEach((stage) => {
    const runningJob = initialRunningJobs.find((j) => j.stageId === stage.id);
    const completedSections = initialCompletedOutputs[stage.id];
    const savedAnswers = initialSavedAnswers[stage.id] ?? {};
    const hasSavedAnswers = Object.keys(savedAnswers).length > 0;
    initialState[stage.id] = {
      status: "active",
      answers: savedAnswers as Record<string, AnswerValue>,
      // Set currentQuestion past the end so allAnswered=true when answers are loaded
      currentQuestion: (completedSections && hasSavedAnswers) ? stage.questions.length : 0,
      reportStatus: runningJob ? "generating" : completedSections ? "complete" : "none",
      report: completedSections ? sectionsToMarkdownInit(completedSections) : null,
      reportSections: completedSections,
    };
  });

  const [stageStates, setStageStates] = useState<Record<string, StageState>>(initialState);
  const isMobile = useIsMobile();
  // Priority: running job stage → first completed stage → frame
  const firstRunningStage = initialRunningJobs[0]?.stageId
    ?? Object.keys(initialCompletedOutputs)[0]
    ?? "frame";
  const [activeStageId, setActiveStageId] = useState<string>(firstRunningStage);
  const [progressValue, setProgressValue] = useState(initialRunningJobs.length > 0 ? 40 : 0);
  const [progressMessage, setProgressMessage] = useState(PROGRESS_MESSAGES[0]);
  // If we have a completed output for the first stage, default to report tab
  const hasCompletedFirst = !!initialCompletedOutputs[firstRunningStage] && initialRunningJobs.length === 0;
  const [activeTab, setActiveTab] = useState<"qa" | "report">(hasCompletedFirst ? "report" : "qa");
  const [redTeamState, setRedTeamState] = useState<"idle" | "running" | "shown" | "acknowledged">("idle");
  const [redTeamChallenges, setRedTeamChallenges] = useState<{ title: string; detail: string; severity: string }[]>([]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportTopRef = useRef<HTMLDivElement | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Record<string, Array<{ role: "user"|"assistant"; content: string }>>>({});
  const [chatInput, setChatInput] = useState<Record<string, string>>({});
  const [chatLoading, setChatLoading] = useState<Record<string, boolean>>({});
  const [chatStreaming, setChatStreaming] = useState<Record<string, string>>({});

  // Version history state: stageId → whether the panel is open
  const [versionHistoryOpen, setVersionHistoryOpen] = useState<Record<string, boolean>>({});
  // Active version per stage: stageId → outputId (null = use default/latest)
  const [activeVersionOutputId, setActiveVersionOutputId] = useState<Record<string, string | null>>({});
  // Output IDs per stage (most recent)
  const [outputIds] = useState<Record<string, string>>(initialCompletedOutputIds);
  // Tags state: outputId → string[]
  const [outputTags, setOutputTags] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const versions of Object.values(allOutputsByStage)) {
      for (const v of versions) {
        map[v.id] = v.tags ?? [];
      }
    }
    return map;
  });
  // Tag dropdown open state: stageId → boolean
  const [tagDropdownOpen, setTagDropdownOpen] = useState<Record<string, boolean>>({});
  // Custom tag input per stage
  const [customTagInput, setCustomTagInput] = useState<Record<string, string>>({});

  // Strategic bet suggestions for Commit stage
  type BetSuggestion = { "Bet name": string; "Action": string; "Outcome": string; "Hypothesis": string };
  const [betSuggestions, setBetSuggestions] = useState<BetSuggestion[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [betsFetched, setBetsFetched] = useState(false);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Auto-resume polling for any in-progress jobs (e.g. after logout + login)
  useEffect(() => {
    if (initialRunningJobs.length === 0) return;

    // Resume the most recent running job
    const job = initialRunningJobs[0];
    const resumeStageId = job.stageId;
    const sessionId = job.sessionId;

    let progress = 40;
    let msgIdx = 2;

    progressIntervalRef.current = setInterval(() => {
      const increment = progress < 70 ? 0.4 : 0.15;
      progress = Math.min(progress + increment, 85);
      setProgressValue(Math.round(progress));
    }, 1000);

    messageIntervalRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROGRESS_MESSAGES.length;
      setProgressMessage(PROGRESS_MESSAGES[msgIdx]);
    }, 4000);

    const stopPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
    };

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/strategy/report/status?sessionId=${encodeURIComponent(sessionId)}`);
        const statusData = await statusRes.json() as { status: "pending" | "complete" | "failed"; sections?: Record<string, unknown> };

        if (statusData.status === "complete" && statusData.sections) {
          stopPolling();
          setProgressValue(100);
          setProgressMessage("Complete");

          const reportMarkdown = sectionsToMarkdown(statusData.sections);
          const currentIdx = STAGES.findIndex((s) => s.id === resumeStageId);
          const nextStage = STAGES[currentIdx + 1];

          setTimeout(() => {
            setStageStates((prev) => {
              const updated = { ...prev };
              updated[resumeStageId] = {
                ...updated[resumeStageId],
                reportStatus: "complete",
                report: reportMarkdown,
                reportSections: statusData.sections,
              };
              if (nextStage) {
                updated[nextStage.id] = { ...updated[nextStage.id], status: "active" };
              }
              return updated;
            });
            setActiveTab("report");
            setTimeout(() => {
              reportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
            showToast(`${STAGES.find((s) => s.id === resumeStageId)?.name ?? ""} report ready`);
          }, 500);
        } else if (statusData.status === "failed") {
          stopPolling();
          setStageStates((prev) => ({
            ...prev,
            [resumeStageId]: { ...prev[resumeStageId], reportStatus: "none" },
          }));
        }
      } catch {
        // Non-fatal — next poll will retry
      }
    }, 3000);

    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeStage = STAGES.find((s) => s.id === activeStageId)!;
  const activeState = stageStates[activeStageId];
  const currentQ = activeStage.questions[activeState.currentQuestion];
  const currentAnswer = activeState.answers[currentQ?.id];
  const allAnswered = activeState.currentQuestion >= activeStage.questions.length;

  function updateStage(stageId: string, update: Partial<StageState>) {
    setStageStates((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], ...update },
    }));
  }

  // ── Tag helpers ─────────────────────────────────────────────────────────────

  const PRESET_TAGS = ["Draft", "Reviewed", "Board-ready", "Archived", "V1", "V2"];

  async function saveTagsForOutput(outputId: string, tags: string[]) {
    setOutputTags((prev) => ({ ...prev, [outputId]: tags }));
    try {
      await fetch(`/api/outputs/${outputId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
    } catch {
      // Non-fatal
    }
  }

  async function toggleTag(outputId: string, tag: string) {
    const current = outputTags[outputId] ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    await saveTagsForOutput(outputId, next);
  }

  async function addCustomTag(outputId: string, tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const current = outputTags[outputId] ?? [];
    if (current.includes(trimmed)) return;
    await saveTagsForOutput(outputId, [...current, trimmed]);
  }

  // ── Version history helpers ─────────────────────────────────────────────────

  function getActiveReport(stageId: string): { report: string | null; sections: Record<string, unknown> | null } {
    const activeId = activeVersionOutputId[stageId];
    if (activeId) {
      const versions = allOutputsByStage[stageId] ?? [];
      const v = versions.find((ver) => ver.id === activeId);
      if (v) {
        return { report: sectionsToMarkdownInit(v.sections), sections: v.sections };
      }
    }
    const state = stageStates[stageId];
    return { report: state?.report ?? null, sections: (state?.reportSections as Record<string, unknown> | null) ?? null };
  }

  function handleAnswer(val: AnswerValue) {
    updateStage(activeStageId, {
      answers: { ...activeState.answers, [currentQ.id]: val },
    });
  }

  function handleNext() {
    if (!currentQ) return;
    const nextQ = activeState.currentQuestion + 1;
    updateStage(activeStageId, { currentQuestion: nextQ });
  }

  const sectionsToMarkdown = sectionsToMarkdownInit;

  function showToast(msg: string) {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  }

  async function handleRedTeamCheck() {
    setRedTeamState("running");

    // Build sections from all prior completed stages
    const priorSections: Record<string, Record<string, unknown>> = {};
    for (const stage of STAGES) {
      if (stage.id === "commit") break;
      const state = stageStates[stage.id];
      if (state?.reportSections) {
        priorSections[stage.id] = state.reportSections as Record<string, unknown>;
      }
    }

    try {
      const res = await fetch("/api/strategy/red-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorSections }),
      });
      const data = await res.json() as { challenges?: { title: string; detail: string; severity: string }[] };
      setRedTeamChallenges(data.challenges ?? []);
      setRedTeamState("shown");
    } catch {
      // If red team fails, skip it and proceed directly
      setRedTeamState("acknowledged");
      handleRunReport();
    }
  }

  async function handleRunReport() {
    // Clear any existing poll
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    updateStage(activeStageId, { reportStatus: "generating" });
    setProgressValue(0);
    setProgressMessage(PROGRESS_MESSAGES[0]);

    // Animate progress bar (slow — agents take 30–120s)
    let progress = 0;
    let msgIdx = 0;
    progressIntervalRef.current = setInterval(() => {
      // Slow ramp: inch toward 85% over ~2 minutes
      const increment = progress < 40 ? 1 : progress < 70 ? 0.4 : 0.15;
      progress = Math.min(progress + increment, 85);
      setProgressValue(Math.round(progress));
    }, 1000);

    messageIntervalRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROGRESS_MESSAGES.length;
      setProgressMessage(PROGRESS_MESSAGES[msgIdx]);
    }, 4000);

    // Extract persona from frame stage answers
    const frameAnswers = stageStates["frame"]?.answers ?? {};
    const persona = typeof frameAnswers["persona"] === "string" ? frameAnswers["persona"] : undefined;

    // Build prior stage summaries for cascade context — pass full sections so Commit has complete picture
    const priorReports: { stageId: string; stageName: string; summary: string }[] = [];
    for (const stage of STAGES) {
      if (stage.id === activeStageId) break;
      const stageState = stageStates[stage.id];
      if (stageState?.reportSections) {
        const s = stageState.reportSections;
        const parts: string[] = [];

        if (typeof s.executive_summary === "string" && s.executive_summary) parts.push(`**Executive Summary**\n${s.executive_summary}`);
        if (typeof s.what_matters === "string" && s.what_matters) parts.push(`**What Matters Most**\n${s.what_matters}`);
        if (typeof s.recommendation === "string" && s.recommendation) parts.push(`**Recommendation**\n${s.recommendation}`);
        if (typeof s.business_implications === "string" && s.business_implications) parts.push(`**Business Implications**\n${s.business_implications}`);

        if (Array.isArray(s.assumptions) && (s.assumptions as string[]).length > 0) {
          parts.push(`**Key Assumptions**\n${(s.assumptions as string[]).map((a: string) => `- ${a}`).join("\n")}`);
        }

        const conf = s.confidence as { score?: number; rationale?: string } | undefined;
        if (conf?.score !== undefined) {
          const pct = Math.round((conf.score as number) * 100);
          parts.push(`**Confidence**\nScore: ${pct}%${conf.rationale ? `\n${conf.rationale}` : ""}`);
        }

        if (Array.isArray(s.risks) && (s.risks as unknown[]).length > 0) {
          const riskLines = (s.risks as { risk: string; severity: string; mitigation: string }[]).map(
            (r) => `- [${r.severity}] ${r.risk} — Mitigation: ${r.mitigation}`
          );
          parts.push(`**Risks**\n${riskLines.join("\n")}`);
        }

        if (Array.isArray(s.actions) && (s.actions as unknown[]).length > 0) {
          const actionLines = (s.actions as { action: string; owner: string; deadline: string; priority: string }[]).map(
            (a) => `- [${a.priority}] ${a.action} (Owner: ${a.owner}, Deadline: ${a.deadline})`
          );
          parts.push(`**Priority Actions**\n${actionLines.join("\n")}`);
        }

        if (Array.isArray(s.monitoring) && (s.monitoring as unknown[]).length > 0) {
          const monLines = (s.monitoring as { metric: string; target: string; frequency: string }[]).map(
            (m) => `- ${m.metric}: target ${m.target} (${m.frequency})`
          );
          parts.push(`**Monitoring**\n${monLines.join("\n")}`);
        }

        if (Array.isArray(s.kill_criteria) && (s.kill_criteria as unknown[]).length > 0) {
          const kcLines = (s.kill_criteria as { criterion: string; trigger: string; response: string }[]).map(
            (k) => `- ${k.criterion} (Trigger: ${k.trigger} → Response: ${k.response})`
          );
          parts.push(`**Kill Criteria**\n${kcLines.join("\n")}`);
        }

        if (Array.isArray(s.okrs) && (s.okrs as unknown[]).length > 0) {
          const okrLines = (s.okrs as { objective: string; key_results: string[] }[]).map(
            (o) => `- ${o.objective}: ${(o.key_results ?? []).join("; ")}`
          );
          parts.push(`**OKRs**\n${okrLines.join("\n")}`);
        }

        if (Array.isArray(s.strategic_bets) && (s.strategic_bets as unknown[]).length > 0) {
          const betLines = (s.strategic_bets as { bet: string; hypothesis: string; investment: string }[]).map(
            (b) => `- ${b.bet} (Hypothesis: ${b.hypothesis}, Investment: ${b.investment})`
          );
          parts.push(`**Strategic Bets**\n${betLines.join("\n")}`);
        }

        if (Array.isArray(s.hundred_day_plan) && (s.hundred_day_plan as unknown[]).length > 0) {
          const planLines = (s.hundred_day_plan as { milestone: string; timeline: string; owner: string; deliverable: string }[]).map(
            (p) => `- [${p.timeline}] ${p.milestone} (Owner: ${p.owner}, Deliverable: ${p.deliverable})`
          );
          parts.push(`**100-Day Plan**\n${planLines.join("\n")}`);
        }

        const eb = s.evidence_base as { sources?: string[] } | undefined;
        if (eb?.sources && eb.sources.length > 0) {
          parts.push(`**Sources**\n${eb.sources.map((src: string) => `- ${src}`).join("\n")}`);
        }

        priorReports.push({
          stageId: stage.id,
          stageName: stage.name,
          summary: parts.join("\n\n"),
        });
      }
    }

    const stopPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
    };

    try {
      const res = await fetch("/api/strategy/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: activeStageId,
          stageName: activeStage.name,
          questions: activeStage.questions.map((q) => ({ id: q.id, question: q.question, type: q.type })),
          answers: activeState.answers,
          persona,
          priorReports,
        }),
      });

      if (!res.ok) {
        stopPolling();
        updateStage(activeStageId, { reportStatus: "none" });
        return;
      }

      const { sessionId } = await res.json() as { sessionId: string };

      // Poll every 3s
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/strategy/report/status?sessionId=${encodeURIComponent(sessionId)}`);
          const statusData = await statusRes.json() as { status: "pending" | "complete" | "failed"; sections?: Record<string, unknown> };

          if (statusData.status === "complete" && statusData.sections) {
            stopPolling();
            setProgressValue(100);
            setProgressMessage("Complete");

            const reportMarkdown = sectionsToMarkdown(statusData.sections);
            const currentIdx = STAGES.findIndex((s) => s.id === activeStageId);
            const nextStage = STAGES[currentIdx + 1];

            setTimeout(() => {
              setStageStates((prev) => {
                const updated = { ...prev };
                updated[activeStageId] = {
                  ...updated[activeStageId],
                  reportStatus: "complete",
                  report: reportMarkdown,
                  reportSections: statusData.sections,
                };
                if (nextStage) {
                  updated[nextStage.id] = { ...updated[nextStage.id], status: "active" };
                }
                return updated;
              });
              setActiveTab("report");
              // Scroll to top of report and show toast
              setTimeout(() => {
                reportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 100);
              showToast(`${STAGES.find((s) => s.id === activeStageId)?.name ?? ""} report ready`);
            }, 500);
          } else if (statusData.status === "failed") {
            stopPolling();
            updateStage(activeStageId, { reportStatus: "none" });
          }
        } catch {
          // Non-fatal — next poll will retry
        }
      }, 3000);
    } catch (err) {
      stopPolling();
      console.error(err);
      updateStage(activeStageId, { reportStatus: "none" });
    }
  }

  function handleContinue() {
    // Navigate to first incomplete (no completed report) stage after current
    const currentIdx = STAGES.findIndex((s) => s.id === activeStageId);
    // Look for the next stage that doesn't have a completed report
    let targetStage = STAGES[currentIdx + 1];
    for (let i = currentIdx + 1; i < STAGES.length; i++) {
      if (stageStates[STAGES[i].id]?.reportStatus !== "complete") {
        targetStage = STAGES[i];
        break;
      }
    }
    if (targetStage) {
      setActiveStageId(targetStage.id);
      const targetComplete = stageStates[targetStage.id]?.reportStatus === "complete";
      setActiveTab(targetComplete ? "report" : "qa");
    }
  }

  async function handleChatSendWithText(stageId: string, text: string) {
    if (!text || chatLoading[stageId]) return;

    const stage = stageStates[stageId];
    const sections = stage?.reportSections as Record<string, unknown> | null;
    if (!sections) return;

    const s = sections;
    const parts: string[] = [`=== ${stageId.charAt(0).toUpperCase() + stageId.slice(1)} Stage Report ===`];
    if (s.executive_summary) parts.push(`Executive Summary:\n${s.executive_summary}`);
    if (s.what_matters) parts.push(`What Matters Most:\n${s.what_matters}`);
    if (s.recommendation) parts.push(`Recommendation:\n${s.recommendation}`);
    if (s.business_implications) parts.push(`Business Implications:\n${s.business_implications}`);
    if (Array.isArray(s.assumptions) && (s.assumptions as string[]).length > 0) {
      parts.push(`Key Assumptions:\n${(s.assumptions as string[]).map((a: unknown) => `- ${a}`).join("\n")}`);
    }
    const context = parts.join("\n\n");

    const prevMessages = chatMessages[stageId] ?? [];
    const newMessages = [...prevMessages, { role: "user" as const, content: text }];

    setChatMessages(prev => ({ ...prev, [stageId]: newMessages }));
    setChatInput(prev => ({ ...prev, [stageId]: "" }));
    setChatLoading(prev => ({ ...prev, [stageId]: true }));
    setChatStreaming(prev => ({ ...prev, [stageId]: "" }));

    try {
      const response = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, context, stageId }),
      });
      if (!response.ok) throw new Error("Chat failed");
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setChatStreaming(prev => ({ ...prev, [stageId]: accumulated }));
      }
      setChatMessages(prev => ({
        ...prev,
        [stageId]: [...(prev[stageId] ?? []), { role: "assistant", content: accumulated }]
      }));
      setChatStreaming(prev => ({ ...prev, [stageId]: "" }));
    } catch {
      setChatMessages(prev => ({
        ...prev,
        [stageId]: [...(prev[stageId] ?? []), { role: "assistant", content: "Sorry, something went wrong. Please try again." }]
      }));
    } finally {
      setChatLoading(prev => ({ ...prev, [stageId]: false }));
    }
  }

  async function handleChatSend(stageId: string) {
    const text = (chatInput[stageId] ?? "").trim();
    await handleChatSendWithText(stageId, text);
  }

  function getStageSuggestedQuestions(stageId: string): string[] {
    const questions: Record<string, string[]> = {
      frame: [
        "What is the core strategic problem in one sentence?",
        "What are the key winning conditions?",
        "What are the most important decision boundaries?",
      ],
      diagnose: [
        "Where is product-market fit strongest and weakest?",
        "What are the top 3 competitive threats?",
        "Which capability gaps are most critical to address?",
      ],
      decide: [
        "What were the main options considered?",
        "What is the recommended direction and why?",
        "What are the kill criteria for this direction?",
      ],
      position: [
        "Who is our most important target customer segment?",
        "What is our key competitive advantage?",
        "How defensible is our position?",
      ],
      commit: [
        "What are the top strategic bets?",
        "What are the company OKRs?",
        "What are the key 30-day milestones?",
      ],
    };
    return questions[stageId] ?? [];
  }

  const isGenerating = activeState.reportStatus === "generating";
  const isReportComplete = activeState.reportStatus === "complete";
  const currentStageIdx = STAGES.findIndex((s) => s.id === activeStageId);
  const nextStage = STAGES[currentStageIdx + 1];
  // Find the true "next destination" for the Continue button — first incomplete stage after current
  const nextIncompleteStage = (() => {
    for (let i = currentStageIdx + 1; i < STAGES.length; i++) {
      if (stageStates[STAGES[i].id]?.reportStatus !== "complete") return STAGES[i];
    }
    return null; // all subsequent stages complete
  })();
  const allStagesComplete = STAGES.every((s) => stageStates[s.id]?.reportStatus === "complete");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Print CSS — hides everything except the report content */}
      <style>{`
        @media print {
          /* Hide navigation, sidebars, action bars, chat, Q&A, version history, feedback, tag pickers */
          nav, aside, header,
          [data-no-print],
          [id="report-print-area"] ~ * {
            display: none !important;
          }
          /* Show only the report print area */
          body > * { display: none !important; }
          #report-print-area,
          #report-print-area * {
            display: block !important;
            visibility: visible !important;
          }
          #report-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 740px !important;
            margin: 0 auto !important;
            padding: 32px 48px !important;
            font-family: Georgia, 'Times New Roman', serif !important;
            font-size: 11pt !important;
            line-height: 1.7 !important;
            color: #111827 !important;
          }
          /* Print header injected before report area */
          #report-print-area::before {
            content: "${companyName ? companyName + " — " : ""}${activeStage.name} Report";
            display: block !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            font-size: 20pt !important;
            font-weight: 700 !important;
            color: #111827 !important;
            margin-bottom: 4pt !important;
            padding-bottom: 12pt !important;
            border-bottom: 2px solid #111827 !important;
          }
          h2 { font-size: 13pt !important; margin-top: 18pt !important; page-break-after: avoid !important; }
          h3 { font-size: 11pt !important; margin-top: 12pt !important; page-break-after: avoid !important; }
          p, li { orphans: 3; widows: 3; }
          hr { border: none !important; border-top: 1px solid #e5e7eb !important; }
          a { color: inherit !important; text-decoration: none !important; }
          @page { size: A4; margin: 20mm 18mm; }
        }
      `}</style>
      {/* Stage Navigation Rail */}
      <div
        style={{
          height: isMobile ? 64 : 84,
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          paddingLeft: isMobile ? 16 : 48,
          paddingRight: isMobile ? 16 : 48,
          gap: 0,
          background: "#fff",
          flexShrink: 0,
          overflowX: isMobile ? "auto" : "visible",
        }}
      >
        {STAGES.map((stage, idx) => {
          const state = stageStates[stage.id];
          const isActive = stage.id === activeStageId;
          const isComplete = state.status === "complete" || state.reportStatus === "complete";
          const isLocked = state.status === "locked";

          return (
            <div key={stage.id} style={{ display: "flex", alignItems: "center", height: isMobile ? 64 : 84 }}>
              <button
                onClick={() => setActiveStageId(stage.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #a3e635" : "2px solid transparent",
                  cursor: "pointer",
                  padding: "6px 10px",
                  height: "100%",
                  borderRadius: 0,
                  transition: "border-color 150ms",
                }}
              >
                <span
                  style={{
                    width: isMobile ? 38 : 52,
                    height: isMobile ? 38 : 52,
                    borderRadius: "50%",
                    background: isComplete ? "#111827" : isActive ? "#111827" : "#f3f4f6",
                    color: isComplete ? "#a3e635" : isActive ? "#a3e635" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isMobile ? 13 : 15,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {isComplete ? (
                    <svg width="16" height="13" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5l3.5 3.5L11 1" stroke="#a3e635" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                {!isMobile && (
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: isActive ? 800 : 600,
                      color: isLocked ? "#9ca3af" : isActive ? "#111827" : "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stage.name}
                  </span>
                )}
              </button>
              {idx < STAGES.length - 1 && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ margin: "0 2px", flexShrink: 0 }}>
                  <path d="M6 4l4 4-4 4" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage Header */}
      {(() => {
        const hero = STAGE_HERO[activeStage.id];
        return (
          <div style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
            {/* Hero band */}
            <div style={{ padding: isMobile ? "16px 16px 20px" : "20px 48px 24px" }}>
              <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 800, color: "#111827", marginBottom: 6, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {activeStage.name}
              </h1>
              {hero?.goal && (
                <p style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: "#111827", marginBottom: 16, lineHeight: 1.5 }}>
                  Goal: {hero.goal}
                </p>
              )}
              <p style={{ fontSize: 17, color: "#374151", lineHeight: 1.7, marginBottom: 0 }}>
                {hero?.description ?? activeStage.purpose}
              </p>
            </div>
            {/* Output navigation strip */}
            <div style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
              {/* Row 1: Standard section pills — always present, active when report complete */}
              <div style={{ padding: isMobile ? "10px 16px 8px" : "12px 48px 8px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {getReportPillsForStage(activeStage.id).map((pill) => {
                  const isComplete = activeState.reportStatus === "complete";
                  return isComplete ? (
                    <button
                      key={pill.label}
                      onClick={() => {
                        setActiveTab("report");
                        setTimeout(() => {
                          const el = document.getElementById(pill.anchor);
                          if (el) {
                            const y = el.getBoundingClientRect().top + window.scrollY - 220;
                            window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
                          }
                        }, 50);
                      }}
                      style={{ fontSize: 12, fontWeight: 600, color: "#a3e635", background: "#111827", border: "none", borderRadius: 20, padding: "3px 11px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                    >
                      {pill.label}
                    </button>
                  ) : (
                    <span key={pill.label} style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 11px", whiteSpace: "nowrap" }}>
                      {pill.label}
                    </span>
                  );
                })}
              </div>
              {/* Row 2: Stage-specific section pills — from deliverables (pre-run) or ### headings (post-run) */}
              {(() => {
                const isComplete = activeState.reportStatus === "complete";
                const stagePills = isComplete && activeState.report
                  ? extractSubheadings(activeState.report)
                  : (hero?.deliverables ?? []).map((d) => ({
                      label: d,
                      anchor: "subsection-" + d.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                    }));
                if (stagePills.length === 0) return null;
                return (
                  <div style={{ padding: isMobile ? "0 16px 10px" : "0 48px 10px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginRight: 4, whiteSpace: "nowrap" }}>
                      {activeStage.name}
                    </span>
                    {stagePills.map((pill) => (
                      isComplete ? (
                        <button
                          key={pill.label}
                          onClick={() => {
                            setActiveTab("report");
                            setTimeout(() => {
                              const el = document.getElementById(pill.anchor);
                              if (el) {
                                const y = el.getBoundingClientRect().top + window.scrollY - 220;
                                window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
                              }
                            }, 50);
                          }}
                          style={{ fontSize: 12, fontWeight: 600, color: "#a3e635", background: "#111827", border: "none", borderRadius: 20, padding: "3px 11px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                        >
                          {pill.label}
                        </button>
                      ) : (
                        <span key={pill.label} style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 11px", whiteSpace: "nowrap" }}>
                          {pill.label}
                        </span>
                      )
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Tab bar — shown when report is complete */}
      {isReportComplete && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #e5e7eb",
            paddingLeft: isMobile ? 16 : 48,
            paddingRight: isMobile ? 16 : 48,
            background: "#fff",
            flexShrink: 0,
            gap: 0,
          }}
        >
          {(["qa", "report"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "14px 20px",
                fontSize: 16,
                fontWeight: activeTab === tab ? 600 : 500,
                color: activeTab === tab ? "#111827" : "#6b7280",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #a3e635" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
                transition: "color 150ms",
              }}
            >
              {tab === "qa" ? "Questions & Answers" : `${activeStage.name} Report`}
            </button>
          ))}
        </div>
      )}

      {/* Action bar — below tab strip, above report content */}
      {isReportComplete && activeTab === "report" && !isMobile && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 48px", borderBottom: "1px solid #e5e7eb",
          background: "#fff", flexShrink: 0,
        }}>
          {/* PDF download */}
          <button
            onClick={() => { if (activeState.reportSections) downloadReportPDF(activeStage.name, companyName, activeState.reportSections, activeState.report); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#111827", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </button>
          <ShareButton stageId={activeStageId} stageName={activeStage.name} reportSections={activeState.reportSections} />
          <div style={{ flex: 1 }} />
          {nextIncompleteStage ? (
            <button onClick={handleContinue} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Continue to {nextIncompleteStage.name}
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : allStagesComplete ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => { setActiveStageId("commit"); setActiveTab("report"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1.5 7.5l4 4 7-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                View Full Strategy
              </button>
              <button onClick={() => setDeckModalOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "#111827", border: "1.5px solid #111827", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>
                Unlock Strategy Deck
              </button>
            </div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f3f4f6", color: "#6b7280", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600 }}>Last stage</div>
          )}
        </div>
      )}

      {/* Feedback bar */}
      {isReportComplete && activeTab === "report" && (
        <ReportFeedback stageId={activeStageId} stageName={activeStage.name} />
      )}

      {/* Toast */}
      <Toast message={toastMessage} visible={toastVisible} />

      {/* Strategy Deck Modal */}
      {deckModalOpen && (
        <div
          onClick={() => setDeckModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
          >
            {/* Header */}
            <div style={{ background: "#111827", padding: "28px 32px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                    </svg>
                    <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>Strategy Deck</p>
                  </div>
                  <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>A board-ready presentation generated from your 5 completed strategy reports.</p>
                </div>
                <button onClick={() => setDeckModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            {/* Slide list */}
            <div style={{ padding: "24px 32px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>What&apos;s included — 12 slides</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { n: "01", label: "The Strategic Moment", source: "Frame" },
                  { n: "02", label: "Current Reality", source: "Diagnose" },
                  { n: "03", label: "Competitive Position", source: "Diagnose" },
                  { n: "04", label: "Strategic Options Considered", source: "Decide" },
                  { n: "05", label: "Recommended Direction", source: "Decide" },
                  { n: "06", label: "What Must Be True", source: "Decide" },
                  { n: "07", label: "Market Position", source: "Position" },
                  { n: "08", label: "Competitive Advantage", source: "Position" },
                  { n: "09", label: "Strategic Bets", source: "Commit" },
                  { n: "10", label: "OKRs", source: "Commit" },
                  { n: "11", label: "100-Day Plan", source: "Commit" },
                  { n: "12", label: "Governance & Kill Criteria", source: "Commit" },
                ].map((slide) => (
                  <div key={slide.n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 24, flexShrink: 0 }}>{slide.n}</span>
                    <span style={{ fontSize: 13, color: "#111827", flex: 1 }}>{slide.label}</span>
                    <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", borderRadius: 6, padding: "2px 8px" }}>{slide.source}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f3f4f6" }}>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 16px" }}>
                  Your board-ready PowerPoint deck, generated from all 5 strategy reports.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setDeckModalOpen(false)}
                    style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Close
                  </button>
                  <DeckDownloadButton
                    companyName={companyName}
                    outputs={Object.fromEntries(
                      Object.entries(stageStates)
                        .filter(([, s]) => s.reportSections != null)
                        .map(([id, s]) => [id, s.reportSections])
                    ) as Record<string, unknown>}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      {isReportComplete && activeTab === "report" ? (
        /* Report tab — full width */
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 80px" : "24px 48px 80px" }}>
          <div ref={reportTopRef} />
          <div id="report-print-area" style={{ maxWidth: "100%" }}>
            {/* Persona tag */}
            {(() => {
              const persona = typeof stageStates["frame"]?.answers?.["persona"] === "string"
                ? (stageStates["frame"].answers["persona"] as string)
                : Array.isArray(stageStates["frame"]?.answers?.["persona"])
                  ? (stageStates["frame"].answers["persona"] as string[])[0]
                  : null;
              return persona ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", marginBottom: 20, fontSize: 12, color: "#6b7280" }}>
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 12c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Framed for: {persona}
                </div>
              ) : null;
            })()}
            {/* Stage-specific tags */}
            {(() => {
              const currentOutputId = outputIds[activeStageId];
              const rawTags = currentOutputId ? (outputTags[currentOutputId] ?? []) : [];
              const tags = rawTags.length > 0 ? rawTags : (STAGE_DEFAULT_TAGS[activeStageId] ?? []);
              if (!tags.length) return null;
              const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
                frame:    { bg: "#f9fafb",  text: "#374151", border: "#d1d5db" },
                diagnose: { bg: "#eff6ff",  text: "#1e40af", border: "#bfdbfe" },
                decide:   { bg: "#f5f3ff",  text: "#6d28d9", border: "#ddd6fe" },
                position: { bg: "#f0fdf4",  text: "#065f46", border: "#bbf7d0" },
                commit:   { bg: "#fffbeb",  text: "#92400e", border: "#fde68a" },
              };
              const col = STAGE_COLORS[activeStageId] ?? STAGE_COLORS.frame;
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 11, fontWeight: 600, color: col.text, background: col.bg, border: `1px solid ${col.border}`, padding: "2px 10px", borderRadius: 999 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              );
            })()}
            {/* Stale report warning — time-based or content contradiction */}
            {(() => {
              const { sections } = getActiveReport(activeStageId);
              const createdAt = sections?.createdAt ? new Date(sections.createdAt as string) : null;
              const daysOld = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
              const reportSections = activeState.reportSections as Record<string, unknown> | null;
              const isContentStale = reportSections?._stale === true;
              const staledBy = reportSections?._staledBy as string | undefined;
              const staleReasons = reportSections?._staleReasons as string[] | undefined;

              if (isContentStale) {
                return (
                  <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", margin: 0 }}>
                        Contradictions detected — flagged stale by {staledBy ? `the ${staledBy.charAt(0).toUpperCase() + staledBy.slice(1)} stage` : "a later stage"}
                      </p>
                    </div>
                    {staleReasons && staleReasons.length > 0 && (
                      <ul style={{ margin: "0 0 4px 18px", padding: 0 }}>
                        {staleReasons.map((r, i) => (
                          <li key={i} style={{ fontSize: 12, color: "#9a3412", lineHeight: 1.6 }}>{r}</li>
                        ))}
                      </ul>
                    )}
                    <p style={{ fontSize: 11, color: "#c2410c", margin: 0 }}>Consider re-running this stage to resolve the contradictions.</p>
                  </div>
                );
              }

              if (daysOld < 90) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                    This report is <strong>{daysOld} days old</strong> — market conditions may have changed. Consider re-running this stage.
                  </p>
                </div>
              );
            })()}
            {/* Low confidence quality gate */}
            {(() => {
              const conf = activeState.reportSections?.confidence as { score?: number } | undefined;
              const score = conf?.score;
              if (!score || score >= 0.50) return null;
              const pct = Math.round(score * 100);
              return (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 1 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: "0 0 2px" }}>Low confidence: {pct}%</p>
                    <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.5 }}>
                      The evidence base for this report may be insufficient to commit to this direction. Consider re-running the stage with stronger inputs or additional context.
                    </p>
                  </div>
                </div>
              );
            })()}
            {/* Version history banner — shown when viewing an older version */}
            {activeVersionOutputId[activeStageId] && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>
                <p style={{ fontSize: 12, color: "#1e40af", margin: 0, flex: 1 }}>
                  You are viewing an older version of this report.
                </p>
                <button
                  onClick={() => setActiveVersionOutputId((prev) => ({ ...prev, [activeStageId]: null }))}
                  style={{ fontSize: 11, color: "#1d4ed8", background: "none", border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  Back to latest
                </button>
              </div>
            )}
            {(() => { const ar = getActiveReport(activeStageId); return ar.report && renderReport(ar.report, ar.sections ?? undefined); })()}
            {/* Version history panel */}
            {(() => {
              const versions = allOutputsByStage[activeStageId] ?? [];
              if (versions.length < 2) return null;
              const isOpen = versionHistoryOpen[activeStageId] ?? false;
              return (
                <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
                  <button
                    onClick={() => setVersionHistoryOpen((prev) => ({ ...prev, [activeStageId]: !prev[activeStageId] }))}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, fontSize: 12, color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>
                    Version history ({versions.length})
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
                      <path d="M3 5l4 4 4-4"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {versions.map((ver) => {
                        const isActive = (activeVersionOutputId[activeStageId] ?? outputIds[activeStageId]) === ver.id;
                        const confPct = ver.confidence != null ? `${Math.round(ver.confidence * 100)}%` : null;
                        return (
                          <div
                            key={ver.id}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isActive ? "#f0fdf4" : "#f9fafb", border: `1px solid ${isActive ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 8 }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>v{ver.version}</span>
                                <span style={{ fontSize: 11, color: "#6b7280" }}>{new Date(ver.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                                {confPct && (
                                  <span style={{ fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "1px 8px", color: "#374151" }}>
                                    {confPct} confidence
                                  </span>
                                )}
                                {(outputTags[ver.id] ?? []).map((tag) => (
                                  <span key={tag} style={{ fontSize: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "1px 7px", color: "#6b7280" }}>{tag}</span>
                                ))}
                              </div>
                            </div>
                            {!isActive && (
                              <button
                                onClick={() => setActiveVersionOutputId((prev) => ({ ...prev, [activeStageId]: ver.id }))}
                                style={{ fontSize: 11, padding: "4px 12px", background: "none", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", color: "#374151", fontFamily: "inherit", whiteSpace: "nowrap" }}
                              >
                                View
                              </button>
                            )}
                            {isActive && (
                              <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 500 }}>Current</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          {/* Per-stage chat */}
          {isReportComplete && activeTab === "report" && (
            <div style={{ maxWidth: 800, marginTop: 48, paddingTop: 32, borderTop: "1.5px solid #e5e7eb" }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Ask this report</h3>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Ask follow-up questions about the {activeStage.name} analysis.</p>
              </div>

              {/* Messages */}
              {((chatMessages[activeStageId] ?? []).length > 0 || chatStreaming[activeStageId]) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  {(chatMessages[activeStageId] ?? []).map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      background: msg.role === "user" ? "#111827" : "#f9fafb",
                      border: msg.role === "assistant" ? "1px solid #e5e7eb" : "none",
                      borderRadius: msg.role === "user" ? "12px 12px 0 12px" : "12px 12px 12px 0",
                      padding: "10px 14px",
                      fontSize: 13,
                      color: msg.role === "user" ? "#fff" : "#374151",
                      maxWidth: "80%",
                      lineHeight: 1.6,
                    }}>
                      {msg.role === "assistant" ? renderWithCitations(msg.content) : msg.content}
                    </div>
                  ))}
                  {chatStreaming[activeStageId] && (
                    <div style={{
                      alignSelf: "flex-start",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px 12px 12px 0",
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#374151",
                      maxWidth: "80%",
                      lineHeight: 1.6,
                    }}>
                      {renderWithCitations(chatStreaming[activeStageId])}▋
                    </div>
                  )}
                </div>
              )}

              {/* Suggested questions — only when no messages yet */}
              {(chatMessages[activeStageId] ?? []).length === 0 && !chatLoading[activeStageId] && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {getStageSuggestedQuestions(activeStageId).map((q) => (
                    <button
                      key={q}
                      onClick={async () => {
                        setChatInput(prev => ({ ...prev, [activeStageId]: q }));
                        await handleChatSendWithText(activeStageId, q);
                      }}
                      style={{ fontSize: 12, color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={chatInput[activeStageId] ?? ""}
                  onChange={(e) => setChatInput(prev => ({ ...prev, [activeStageId]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend(activeStageId);
                    }
                  }}
                  placeholder={`Ask a question about the ${activeStage.name} report…`}
                  disabled={chatLoading[activeStageId]}
                  rows={2}
                  style={{ flex: 1, padding: "10px 14px", fontSize: 13, border: "1.5px solid #e5e7eb", borderRadius: 10, resize: "none", fontFamily: "inherit", color: "#111827", outline: "none", background: chatLoading[activeStageId] ? "#f9fafb" : "#fff" }}
                />
                <button
                  onClick={() => handleChatSend(activeStageId)}
                  disabled={chatLoading[activeStageId] || !(chatInput[activeStageId] ?? "").trim()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "10px 18px", fontSize: 13, fontWeight: 700,
                    background: "#111827",
                    color: (chatLoading[activeStageId] || !(chatInput[activeStageId] ?? "").trim()) ? "rgba(255,255,255,0.3)" : "#fff",
                    border: "none", borderRadius: 10,
                    cursor: (chatLoading[activeStageId] || !(chatInput[activeStageId] ?? "").trim()) ? "not-allowed" : "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    opacity: (chatLoading[activeStageId] || !(chatInput[activeStageId] ?? "").trim()) ? 0.5 : 1,
                    transition: "opacity 150ms",
                  }}
                >
                  {chatLoading[activeStageId] ? "…" : "Send"}
                  {!chatLoading[activeStageId] && (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M8 4l3 3-3 3" stroke="#a3e635" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>Press Enter to send · Shift+Enter for new line</p>
            </div>
          )}
          {/* Mobile: action buttons at bottom of report */}
          {isMobile && (
            <div style={{ marginTop: 40, paddingBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Download + Share row */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { if (activeState.reportSections) downloadReportPDF(activeStage.name, companyName, activeState.reportSections, activeState.report); }}
                  style={{
                    flex: 1,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "#111827", border: "none", borderRadius: 8,
                    padding: "12px", fontSize: 13, fontWeight: 600, color: "#fff",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF
                </button>
                <div style={{ flex: 1 }}>
                  <ShareButton stageId={activeStageId} stageName={activeStage.name} reportSections={activeState.reportSections} fullWidth />
                </div>
              </div>
              {/* Continue button */}
              {nextStage && (
                <button
                  onClick={handleContinue}
                  style={{
                    width: "100%",
                    padding: "16px 24px",
                    background: "#111827",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  Continue to {nextStage.name}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Q&A view — always shown (normal, generating, or Q&A tab when complete) */
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            minHeight: 0,
            gap: isMobile ? 24 : 32,
            padding: isMobile ? "16px 16px 48px" : "32px 48px 48px",
            pointerEvents: isGenerating ? "none" : "auto",
            opacity: isGenerating ? 0.6 : 1,
            transition: "opacity 200ms",
            position: "relative",
            overflowY: isMobile ? "auto" : "visible",
          }}
        >
          {/* Generating overlay banner */}
          {isGenerating && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 5,
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  margin: "0 48px 24px",
                  background: "#111827",
                  borderRadius: 10,
                  padding: "16px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#a3e635", margin: "0 0 8px" }}>
                    Generating {activeStage.name} report...
                  </p>
                  <div style={{ height: 3, background: "rgba(163,230,53,0.2)", borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        background: "#a3e635",
                        borderRadius: 2,
                        width: `${progressValue}%`,
                        transition: "width 150ms ease-out",
                      }}
                    />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 12, color: "rgba(163,230,53,0.7)", margin: "0 0 2px", whiteSpace: "nowrap" }}>
                    {progressMessage}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(163,230,53,0.4)", margin: 0, whiteSpace: "nowrap" }}>
                    ~3–5 min
                  </p>
                </div>
              </div>
              {/* Email notification note — inside dark card */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", margin: "12px 48px 0" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(163,230,53,0.7)" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>
                  We&apos;ll email you when your report is ready
                </p>
              </div>
            </div>
          )}

          {/* Left: Question area */}
          <div
            style={{
              width: isMobile ? "100%" : "55%",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              paddingTop: isGenerating ? 72 : 0,
            }}
          >
            {!allAnswered && !isGenerating ? (
              <>
                {activeStageId === "commit" && activeTab === "qa" && (() => {
                  // Check for at-risk or invalidated assumptions across all prior stages
                  const issues: string[] = [];

                  // Check if diagnose has no completed output (can't commit without diagnosis)
                  if (!initialCompletedOutputs["diagnose"]) issues.push("Diagnose stage not yet completed — strategic bets may lack an evidence base");
                  if (!initialCompletedOutputs["position"]) issues.push("Position stage not yet completed — commitment without a defined market position is high risk");

                  if (issues.length === 0) return null;

                  return (
                    <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 1 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#c2410c", margin: "0 0 6px" }}>Review before committing</p>
                          {issues.map((issue, i) => (
                            <p key={i} style={{ fontSize: 12, color: "#9a3412", margin: "0 0 4px" }}>· {issue}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {/* Question counter */}
                <p style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, marginTop: 0 }}>
                  Question {activeState.currentQuestion + 1} of {activeStage.questions.length}
                </p>
                {/* Question text */}
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#111827",
                    lineHeight: 1.4,
                    marginBottom: 4,
                    marginTop: 0,
                  }}
                >
                  {currentQ.question}
                  {" "}
                  {currentQ.required === false ? (
                    <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", fontStyle: "normal" }}>(optional)</span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>★ required</span>
                  )}
                </p>
                {currentQ.hint && (
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8, marginTop: 0, lineHeight: 1.5 }}>
                    {currentQ.hint}
                  </p>
                )}

                {/* AI-generated strategic bet suggestions for Commit stage */}
                {activeStageId === "commit" && currentQ.id === "strategic_bets" && (() => {
                  const currentEntries = Array.isArray(currentAnswer) ? currentAnswer as Array<Record<string,string>> : [];
                  const max = currentQ.maxSelections ?? 3;

                  // Auto-fetch on first render of this question
                  if (!betsFetched && !betsLoading) {
                    setBetsLoading(true);
                    setBetsFetched(true);
                    const persona = stageStates["frame"]?.answers?.["persona"] as string | undefined;
                    const priorSections: Record<string, Record<string, unknown>> = {};
                    for (const s of ["frame", "diagnose", "decide", "position"]) {
                      if (initialCompletedOutputs[s]) priorSections[s] = initialCompletedOutputs[s] as Record<string, unknown>;
                    }
                    fetch("/api/strategy/suggest-bets", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ companyName: stageStates["frame"]?.answers?.["company_name"] ?? "your company", persona, priorSections }),
                    })
                      .then((r) => r.json())
                      .then((data) => { if (data.bets) setBetSuggestions(data.bets); })
                      .catch(() => {})
                      .finally(() => setBetsLoading(false));
                  }

                  const addedNames = new Set(currentEntries.map((e) => e["Bet name"]));
                  const available = betSuggestions.filter((b) => !addedNames.has(b["Bet name"]));

                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                          AI-generated bet suggestions — based on your full strategy analysis
                        </p>
                        {betsLoading && (
                          <span style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>Generating…</span>
                        )}
                        {!betsLoading && betSuggestions.length > 0 && (
                          <button
                            onClick={() => { setBetsFetched(false); setBetSuggestions([]); }}
                            style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                          >
                            ↻ Regenerate
                          </button>
                        )}
                      </div>

                      {betsLoading && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {[1,2,3].map((i) => (
                            <div key={i} style={{ height: 80, background: "#f9fafb", borderRadius: 8, border: "1px solid #f3f4f6", animation: "pulse 1.5s ease-in-out infinite" }} />
                          ))}
                        </div>
                      )}

                      {!betsLoading && available.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                          {available.map((bet, i) => (
                            <div
                              key={i}
                              style={{
                                background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10,
                                padding: "14px 16px", position: "relative",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{bet["Bet name"]}</p>
                                <button
                                  disabled={currentEntries.length >= max}
                                  onClick={() => {
                                    if (currentEntries.length >= max) return;
                                    handleAnswer([...currentEntries, { ...bet }]);
                                  }}
                                  style={{
                                    fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20, border: "none",
                                    background: currentEntries.length >= max ? "#e5e7eb" : "#111827",
                                    color: currentEntries.length >= max ? "#9ca3af" : "#fff",
                                    cursor: currentEntries.length >= max ? "not-allowed" : "pointer",
                                    fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" as const,
                                  }}
                                >
                                  {currentEntries.length >= max ? "Full" : "+ Add bet"}
                                </button>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {[["Action", "#1e40af", "#dbeafe"], ["Outcome", "#065f46", "#d1fae5"], ["Hypothesis", "#6b7280", "#f3f4f6"]].map(([label, color, bg]) => (
                                  <div key={label} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "1px 6px", flexShrink: 0, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</span>
                                    <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{bet[label as keyof typeof bet]}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!betsLoading && betSuggestions.length === 0 && betsFetched && (
                        <p style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>
                          Could not generate suggestions — complete at least one prior stage and try again.
                        </p>
                      )}

                      {currentEntries.length > 0 && (
                        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 10, marginBottom: 0 }}>
                          {currentEntries.length}/{max} bets added below — edit any field or add your own.
                        </p>
                      )}
                    </div>
                  );
                })()}

                <QuestionInput
                  question={currentQ}
                  answer={currentAnswer}
                  onChange={handleAnswer}
                />

                <div style={{ display: "flex", gap: 10, marginTop: 32, alignItems: "center" }}>
                  {activeState.currentQuestion > 0 && (
                    <button
                      onClick={() => updateStage(activeStageId, { currentQuestion: activeState.currentQuestion - 1 })}
                      style={{
                        padding: "12px 24px",
                        background: "none",
                        color: "#6b7280",
                        border: "1.5px solid #e5e7eb",
                        borderRadius: 8,
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 150ms",
                        fontFamily: "inherit",
                      }}
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!isAnswerValid(currentQ, currentAnswer)}
                    style={{
                      padding: "12px 28px",
                      background: isAnswerValid(currentQ, currentAnswer) ? "#111827" : "#e5e7eb",
                      color: isAnswerValid(currentQ, currentAnswer) ? "#fff" : "#9ca3af",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: isAnswerValid(currentQ, currentAnswer) ? "pointer" : "not-allowed",
                      transition: "all 150ms",
                      fontFamily: "inherit",
                    }}
                  >
                    {activeState.currentQuestion === activeStage.questions.length - 1 ? "Review answers" : "Next"}
                  </button>
                </div>
              </>
            ) : (
              /* All answered (or locked while generating) */
              <div style={{ opacity: isGenerating ? 1 : 1 }}>
                <div
                  style={{
                    background: isGenerating ? "#f9fafb" : "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "24px 28px",
                    marginBottom: 28,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: isReportComplete ? "#d1fae5" : "#dbeafe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isReportComplete ? (
                        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                          <path d="M1 6l4 4 8-8" stroke="#059669" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>
                      {isReportComplete ? "Stage complete" : "All questions answered"}
                    </p>
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                    {isReportComplete
                      ? "Your report is ready. Switch to the Report tab to view the full output."
                      : `Run the report to generate your strategic analysis for the ${activeStage.name} stage.`}
                  </p>
                </div>

                {!isGenerating && !isReportComplete && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() => {
                        if (activeStageId === "commit" && redTeamState === "idle") {
                          handleRedTeamCheck();
                        } else {
                          handleRunReport();
                        }
                      }}
                      style={{
                        padding: "14px 32px",
                        background: "#111827",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <polygon points="3,1.5 13,7 3,12.5" fill="white" />
                      </svg>
                      {activeStage.runButtonLabel}
                    </button>
                    <button
                      onClick={() => updateStage(activeStageId, { currentQuestion: 0 })}
                      style={{
                        padding: "14px 24px",
                        background: "none",
                        color: "#6b7280",
                        border: "1.5px solid #e5e7eb",
                        borderRadius: 8,
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Edit answers
                    </button>
                  </div>
                )}

                {/* Red team gate — shown before Commit report runs */}
                {activeStageId === "commit" && redTeamState === "running" && (
                  <div style={{ marginTop: 20, padding: "20px 24px", background: "#111827", borderRadius: 12, color: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a3e635", animation: "pulse 1.5s infinite" }} />
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Running red team analysis...</p>
                    </div>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Checking your strategy for contradictions, blind spots, and unvalidated assumptions before generating the final report.</p>
                  </div>
                )}

                {activeStageId === "commit" && redTeamState === "shown" && redTeamChallenges.length > 0 && (
                  <div style={{ marginTop: 20, border: "1px solid #fde68a", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "#111827", padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Red Team Pre-Flight: {redTeamChallenges.length} challenge{redTeamChallenges.length !== 1 ? "s" : ""} identified</p>
                      </div>
                      <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Review these before generating your final Commit report. You can proceed anyway or go back and address them.</p>
                    </div>
                    <div style={{ padding: "16px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
                      {redTeamChallenges.map((c, i) => {
                        const sevColor = c.severity === "critical" ? "#fee2e2" : c.severity === "high" ? "#fef3c7" : "#f3f4f6";
                        const sevText = c.severity === "critical" ? "#991b1b" : c.severity === "high" ? "#92400e" : "#374151";
                        return (
                          <div key={i} style={{ padding: "12px 14px", borderRadius: 8, background: sevColor, border: `1px solid ${sevText}22` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: sevText }}>{c.severity}</span>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{c.title}</p>
                            </div>
                            <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.6 }}>{c.detail}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        onClick={() => { setRedTeamState("acknowledged"); handleRunReport(); }}
                        style={{ padding: "10px 20px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Acknowledged — Generate Report Anyway
                      </button>
                      <button
                        onClick={() => setRedTeamState("idle")}
                        style={{ padding: "10px 16px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                )}

                {isReportComplete && (
                  <button
                    onClick={() => setActiveTab("report")}
                    style={{
                      padding: "14px 28px",
                      background: "#111827",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    View Report
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Answer summary (always visible) */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: isGenerating ? 72 : 0 }}>
            <div style={{ background: "#f3f4f6", borderRadius: 12, padding: "24px 28px" }}>
              <AnswerSummaryPanel
                stage={activeStage}
                answers={activeState.answers}
                currentQuestion={activeState.currentQuestion}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
