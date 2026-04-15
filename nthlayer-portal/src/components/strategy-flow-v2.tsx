"use client";
// v3
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DeckDownloadButton } from "@/components/deck-download-button";
import { renderWithCitations } from "@/lib/render-citations";
import { ProductStrategyModal } from "@/components/product-strategy-modal";

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
  hidden?: boolean; // hidden stages run automatically and are not shown in the UI nav
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
  reportFailed?: boolean;
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
  { label: "Hypotheses",          anchor: "section-hypothesis-register" },
];

// Stage-aware label overrides for section pills
const STAGE_PILL_LABELS: Record<string, Record<string, string>> = {
  frame:    { "What Matters Most": "Market Context", Recommendation: "Core Strategic Question", "Business Implications": "Hypothesis Register" },
  diagnose: { Recommendation: "Emerging Direction", "Business Implications": "ICP Signal" },
  decide:   { Recommendation: "Recommended Direction", "Business Implications": "Cost of Inaction" },
  position: { Recommendation: "Positioning Statement", "Business Implications": "GTM Implications" },
  commit:   { Sources: "Evidence Inherited", "Business Implications": "Resource Allocation" },
};

// Sections hidden per stage (pills not shown)
const STAGE_HIDDEN_PILLS: Record<string, Set<string>> = {
  frame:         new Set(["Actions", "Metrics"]),
  diagnose:      new Set(["Actions", "Metrics"]),
  decide:        new Set(["Metrics"]),
  position:      new Set(["Actions", "Metrics"]),
  commit:        new Set(["Hypotheses"]),
  competitor_intel: new Set(["Hypotheses"]),
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
    description: "Define what has changed, why this decision matters now, and the boundaries of the strategic question. Frame does not answer the question — it defines it precisely.",
    goal: "Define the decision",
    deliverables: ["The Strategic Moment", "Winning Conditions", "Competitive Landscape Overview", "Decision Boundaries", "Hypothesis Register"],
  },
  diagnose: {
    tagline: "Diagnose",
    description: "Build a structured fact base across product-market fit, competitive position, growth trajectory, and operating constraints. Diagnose does not choose the strategy — it diagnoses reality.",
    goal: "Establish what is true",
    deliverables: ["Business Assessment", "ICP Signal", "Competitive Landscape", "Benchmark Gaps", "Emerging Direction"],
  },
  decide: {
    tagline: "Decide",
    description: "Surface the real strategic options, pressure-test each, and choose the direction. Decide makes the strategic choice — it does not create the execution plan.",
    goal: "Choose the direction",
    deliverables: ["Strategic Options", "Decision Matrix", "Recommended Direction", "What Must Be True", "Kill Criteria"],
  },
  position: {
    tagline: "Position",
    description: "Translate the chosen direction into a precise market stance: who you serve, what you solve better than any alternative, and what defensibility you are building toward.",
    goal: "Define how the chosen direction will win",
    deliverables: ["Target Customer", "Positioning Statement", "Narrative Gap Analysis", "Structural Defensibility", "GTM Motion Implications"],
  },
  commit: {
    tagline: "Commit",
    description: "Convert the chosen direction and position into a portfolio of strategic bets, with sequencing, ownership, milestones, OKRs, and governance. This is the first stage where strategic bets become explicit commitments.",
    goal: "Turn the direction into a committed plan",
    deliverables: ["Strategic Bet Portfolio", "Anti-Portfolio", "OKRs", "100-Day Plan", "Governance Rhythm", "Resource Allocation"],
  },
};

const STAGES: Stage[] = [
  {
    id: "frame",
    name: "Frame",
    purpose: "Define what has changed, why this decision matters now, and the boundaries of the strategic question",
    output: "Strategic moment, winning conditions, competitive landscape overview, decision boundaries, and hypothesis register",
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
        question: "What has changed that forces a strategic decision now?",
        hint: "This becomes the opening of the Frame report. Select up to 3.",
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
        id: "winning_definition",
        required: true,
        question: "What does winning look like in 24\u201336 months?",
        hint: "Select up to 3 winning conditions.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Revenue target \u2014 achieving a specific ARR milestone", label: "Revenue target \u2014 achieving a specific ARR milestone" },
          { value: "Market position \u2014 clear category leader in our segment", label: "Market position \u2014 clear category leader in our segment" },
          { value: "Acquisition readiness \u2014 positioned for a strong exit", label: "Acquisition readiness \u2014 positioned for a strong exit" },
          { value: "Category leadership \u2014 recognised by analysts and buyers", label: "Category leadership \u2014 recognised by analysts and buyers" },
          { value: "Geographic expansion \u2014 material revenue from new markets", label: "Geographic expansion \u2014 material revenue from new markets" },
          { value: "Product platform shift \u2014 from point tool to platform", label: "Product platform shift \u2014 from point tool to platform" },
          { value: "Strong NRR and retention benchmarks", label: "Strong NRR and retention benchmarks" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "investment_horizon",
        required: true,
        question: "What is the investment horizon for this strategy?",
        type: "single-select",
        options: [
          { value: "6\u201312 months", label: "6\u201312 months" },
          { value: "12\u201318 months", label: "12\u201318 months" },
          { value: "18\u201336 months", label: "18\u201336 months" },
          { value: "36+ months", label: "36+ months" },
        ],
      },
      {
        id: "decision_maker",
        required: true,
        question: "Who is the primary decision-maker for this strategy?",
        type: "single-select",
        options: [
          { value: "CEO", label: "CEO" },
          { value: "CPO", label: "CPO" },
          { value: "COO", label: "COO" },
          { value: "PE Operating Partner", label: "PE Operating Partner" },
          { value: "Board", label: "Board" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "investor_owner",
        required: false,
        question: "Who is the investor or owner?",
        type: "free-text",
        placeholder: "e.g. Inflexion Private Equity, bootstrapped, Series B VC-backed",
        hint: "PE firm name, VC, bootstrapped, or public. Shapes governance expectations and return model.",
      },
      {
        id: "arr_band",
        required: false,
        question: "What is the current ARR band?",
        hint: "Used to benchmark growth rate and resource constraints against peers.",
        type: "single-select",
        options: [
          { value: "<$1M", label: "<$1M" },
          { value: "$1\u20135M", label: "$1\u20135M" },
          { value: "$5\u201310M", label: "$5\u201310M" },
          { value: "$10\u201320M", label: "$10\u201320M" },
          { value: "$20\u201350M", label: "$20\u201350M" },
          { value: "$50M+", label: "$50M+" },
        ],
      },
      {
        id: "employee_count",
        required: false,
        question: "What is the current headcount?",
        type: "single-select",
        options: [
          { value: "<25", label: "<25" },
          { value: "25\u201350", label: "25\u201350" },
          { value: "50\u2013100", label: "50\u2013100" },
          { value: "100\u2013250", label: "100\u2013250" },
          { value: "250\u2013500", label: "250\u2013500" },
          { value: "500+", label: "500+" },
        ],
      },
      {
        id: "growth_rate_yoy",
        required: false,
        question: "What is the current ARR growth rate year-on-year?",
        type: "single-select",
        options: [
          { value: "<10%", label: "<10%" },
          { value: "10\u201325%", label: "10\u201325%" },
          { value: "25\u201350%", label: "25\u201350%" },
          { value: "50\u2013100%", label: "50\u2013100%" },
          { value: "100%+", label: "100%+" },
        ],
      },
      {
        id: "top_concerns",
        required: false,
        question: "What are you most worried about?",
        hint: "Select up to 3. These seed the hypothesis register.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Team capacity", label: "Team capacity" },
          { value: "Competitive pressure", label: "Competitive pressure" },
          { value: "Product velocity", label: "Product velocity" },
          { value: "Market timing", label: "Market timing" },
          { value: "Investor expectations", label: "Investor expectations" },
          { value: "Go-to-market execution", label: "Go-to-market execution" },
          { value: "Analyst recognition", label: "Analyst recognition" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "assumptions_to_test",
        required: false,
        question: "Any assumptions you want this cascade to test?",
        hint: "These become explicit hypotheses for the Diagnose stage. Up to 5.",
        type: "structured-repeater",
        maxSelections: 5,
        addLabel: "Add Assumption",
        repeaterFields: ["Assumption"],
        repeaterFieldPlaceholders: [
          "e.g. Enterprise buyers will pay 3x current ACV for a compliance module",
        ],
      },
    ],
  },
  {
    id: "diagnose",
    name: "Diagnose",
    purpose: "Build a structured fact base on product-market fit, competitive position, growth trajectory, and operating constraints",
    output: "Business assessment, competitive landscape, ICP signal, benchmark gaps, and emerging direction",
    runButtonLabel: "Run Diagnose Report",
    questions: [
      {
        id: "pmf_status",
        required: true,
        question: "How would you describe your product-market fit today?",
        type: "single-select",
        options: [
          { value: "Strong and expanding", label: "Strong and expanding" },
          { value: "Strong in a niche", label: "Strong in a niche" },
          { value: "Emerging", label: "Emerging" },
          { value: "Uncertain", label: "Uncertain" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "binding_constraint",
        required: true,
        question: "Rank your biggest constraints, most binding first.",
        hint: "Drag to reorder \u2014 top is most binding.",
        type: "rank",
        maxSelections: 7,
        options: [
          { value: "Resourcing", label: "Resourcing" },
          { value: "Product velocity", label: "Product velocity" },
          { value: "Marketing & demand gen", label: "Marketing & demand gen" },
          { value: "Sales capacity", label: "Sales capacity" },
          { value: "Analyst recognition", label: "Analyst recognition" },
          { value: "Capital", label: "Capital" },
          { value: "Leadership bandwidth", label: "Leadership bandwidth" },
        ],
      },
      {
        id: "where_winning",
        required: true,
        question: "Where are you winning today? Describe the customer profile.",
        type: "free-text",
        placeholder: "e.g. Mid-market UK HR teams at 200\u2013500 headcount, buying to fix employee comms fragmentation after a merger.",
        hint: "This is the stated ICP \u2014 Diagnose will test it against evidence.",
      },
      {
        id: "winning_outside_target",
        required: false,
        question: "Where are you winning outside your intended target?",
        type: "free-text",
        placeholder: "e.g. We keep winning in manufacturing, which we've never explicitly targeted \u2014 they find us through G2.",
        hint: "The out-of-ICP signal. Flag this prominently if present \u2014 it may reveal a stronger ICP than the one you're targeting.",
      },
      {
        id: "retention_signal",
        required: true,
        question: "What is your current NPS or retention signal?",
        type: "single-select",
        options: [
          { value: "Very strong", label: "Very strong" },
          { value: "Strong", label: "Strong" },
          { value: "Average", label: "Average" },
          { value: "Below average", label: "Below average" },
          { value: "Don't know", label: "Don't know" },
        ],
      },
      {
        id: "win_rate",
        required: false,
        question: "What is the current win rate in competitive deals?",
        type: "single-select",
        options: [
          { value: "<20%", label: "<20%" },
          { value: "20\u201340%", label: "20\u201340%" },
          { value: "40\u201360%", label: "40\u201360%" },
          { value: "60%+", label: "60%+" },
          { value: "Don't know", label: "Don't know" },
        ],
      },
      {
        id: "nrr_ndr",
        required: false,
        question: "What is the current net revenue retention (NRR)?",
        type: "single-select",
        options: [
          { value: "<90%", label: "<90%" },
          { value: "90\u2013100%", label: "90\u2013100%" },
          { value: "100\u2013110%", label: "100\u2013110%" },
          { value: "110\u2013120%", label: "110\u2013120%" },
          { value: "120%+", label: "120%+" },
          { value: "Don't know", label: "Don't know" },
        ],
      },
      {
        id: "buying_trigger",
        required: false,
        question: "What makes customers buy?",
        hint: "Select up to 3. If unknown, flag as the #1 evidence gap.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Intranet or internal comms need", label: "Intranet or internal comms need" },
          { value: "Employee advocacy or engagement initiative", label: "Employee advocacy or engagement initiative" },
          { value: "AI capability requirement", label: "AI capability requirement" },
          { value: "Integration with existing stack", label: "Integration with existing stack" },
          { value: "Price or cost displacement of incumbent", label: "Price or cost displacement of incumbent" },
          { value: "Analyst recommendation", label: "Analyst recommendation" },
          { value: "Culture or engagement programme", label: "Culture or engagement programme" },
          { value: "Don't know \u2014 this is the evidence gap", label: "Don't know \u2014 this is the evidence gap" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "roadmap_focus",
        required: false,
        question: "Where is the product roadmap focused for the next 12 months?",
        hint: "Select up to 3.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "AI capability", label: "AI capability" },
          { value: "Platform breadth", label: "Platform breadth" },
          { value: "Vertical depth", label: "Vertical depth" },
          { value: "Integrations", label: "Integrations" },
          { value: "Performance and reliability", label: "Performance and reliability" },
          { value: "New market entry", label: "New market entry" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "moat_status",
        required: false,
        question: "Which best describes the competitive moat today?",
        hint: "Be honest \u2014 only claim a moat if there is genuine structural evidence for it.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Network effects", label: "Network effects" },
          { value: "Switching costs", label: "Switching costs" },
          { value: "Counter-positioning", label: "Counter-positioning" },
          { value: "Brand", label: "Brand" },
          { value: "Scale economies", label: "Scale economies" },
          { value: "Process power", label: "Process power" },
          { value: "Cornered resource", label: "Cornered resource" },
          { value: "None yet established", label: "None yet established" },
        ],
      },
      {
        id: "change_capacity",
        required: false,
        question: "What is the team's capacity for strategic change right now?",
        type: "single-select",
        options: [
          { value: "Can absorb major change", label: "Can absorb major change" },
          { value: "Can absorb moderate change", label: "Can absorb moderate change" },
          { value: "Already stretched", label: "Already stretched" },
          { value: "In crisis mode", label: "In crisis mode" },
        ],
      },
    ],
  },
  {
    id: "decide",
    name: "Decide",
    purpose: "Surface the real strategic options, pressure-test each, and choose the direction",
    output: "Recommended direction, decision matrix, what must be true, kill criteria, and cost of inaction",
    runButtonLabel: "Run Decide Report",
    questions: [
      {
        id: "leadership_instinct",
        required: true,
        question: "Having seen the diagnosis \u2014 what is your instinct?",
        hint: "Select up to 3 directions that feel most viable.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Double down on current direction", label: "Double down on current direction" },
          { value: "Narrow focus \u2014 go deeper in a specific segment", label: "Narrow focus \u2014 go deeper in a specific segment" },
          { value: "Broaden the platform", label: "Broaden the platform" },
          { value: "Enter new markets or geographies", label: "Enter new markets or geographies" },
          { value: "Pursue an adjacent segment", label: "Pursue an adjacent segment" },
          { value: "Accelerate through acquisition", label: "Accelerate through acquisition" },
          { value: "Accept current trajectory \u2014 no material change", label: "Accept current trajectory \u2014 no material change" },
          { value: "Not sure \u2014 need the evidence to decide", label: "Not sure \u2014 need the evidence to decide" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "priority_outcome",
        required: true,
        question: "What is the single most important outcome in the next 18 months?",
        type: "single-select",
        options: [
          { value: "Revenue acceleration", label: "Revenue acceleration" },
          { value: "Market share gain", label: "Market share gain" },
          { value: "Competitive differentiation", label: "Competitive differentiation" },
          { value: "Analyst recognition", label: "Analyst recognition" },
          { value: "Exit readiness", label: "Exit readiness" },
          { value: "Platform credibility", label: "Platform credibility" },
          { value: "Team stability", label: "Team stability" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "willing_to_give_up",
        required: true,
        question: "What are you willing to give up to pursue the chosen direction?",
        hint: "Selecting 'Nothing' is itself a signal \u2014 it will be flagged in the report.",
        type: "multi-select",
        maxSelections: 4,
        options: [
          { value: "Short-term revenue", label: "Short-term revenue" },
          { value: "Breadth of positioning", label: "Breadth of positioning" },
          { value: "Geographic reach", label: "Geographic reach" },
          { value: "Feature breadth", label: "Feature breadth" },
          { value: "Specific customer segments", label: "Specific customer segments" },
          { value: "Analyst category placement", label: "Analyst category placement" },
          { value: "Speed of execution", label: "Speed of execution" },
          { value: "Nothing \u2014 unwilling to give anything up", label: "Nothing \u2014 unwilling to give anything up" },
        ],
      },
      {
        id: "investor_success_criteria",
        required: true,
        question: "How does your investor or board evaluate success?",
        hint: "Select up to 4.",
        type: "multi-select",
        maxSelections: 4,
        options: [
          { value: "ARR growth rate", label: "ARR growth rate" },
          { value: "Gross margin", label: "Gross margin" },
          { value: "NRR", label: "NRR" },
          { value: "Market share", label: "Market share" },
          { value: "Category leadership", label: "Category leadership" },
          { value: "Exit multiple", label: "Exit multiple" },
          { value: "Revenue quality", label: "Revenue quality" },
          { value: "Pipeline velocity", label: "Pipeline velocity" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "mandated_direction",
        required: false,
        question: "Is there a strategic direction you have already been told to pursue?",
        type: "free-text",
        placeholder: "e.g. The board has committed to a US expansion by Q3.",
        hint: "If present, this becomes a constraint. If evidence contradicts it, the report will say so directly.",
      },
      {
        id: "options_to_evaluate",
        required: false,
        question: "Any specific options you want evaluated alongside the cascade's own?",
        hint: "Up to 3. These will be included in the decision matrix.",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add Option",
        repeaterFields: ["Option name", "Description"],
        repeaterFieldPlaceholders: [
          "e.g. Acquire a competitor",
          "Brief description of what this would involve",
        ],
      },
      {
        id: "wwhtbt",
        required: true,
        question: "For the preferred option \u2014 what would have to be true for it to succeed?",
        type: "free-text",
        placeholder: "e.g. The enterprise segment would have to value our compliance features enough to pay 3x current ACV, and we'd need 5 reference customers in Q1.",
      },
      {
        id: "kill_criteria",
        required: true,
        question: "What evidence would confirm this strategy is working \u2014 or should be abandoned?",
        type: "free-text",
        placeholder: "e.g. If we haven't signed 3 enterprise pilots within 90 days, or pipeline coverage drops below 3:1, we trigger a review.",
      },
    ],
  },
  {
    id: "position",
    name: "Position",
    purpose: "Translate the chosen direction into a precise market stance: who you serve, what you solve better, and what defensibility you are building",
    output: "Positioning statement, target customer, competitive frame, structural defensibility, and narrative gap analysis",
    runButtonLabel: "Run Position Report",
    questions: [
      {
        id: "primary_buyer_role",
        required: true,
        question: "Who is your primary economic buyer today?",
        type: "free-text",
        placeholder: "e.g. Chief People Officer, Head of Internal Communications, VP Marketing",
        hint: "The person who signs off on purchase and owns the budget. One primary buyer \u2014 strategy depends on this focus.",
      },
      {
        id: "win_language",
        required: false,
        question: "What do prospects say when they describe why they chose you?",
        type: "free-text",
        placeholder: "e.g. 'The advocacy features were unlike anything else we'd seen \u2014 and the onboarding was genuinely fast.'",
        hint: "Verbatim language from win calls or sales notes. The more specific the better.",
      },
      {
        id: "loss_language",
        required: false,
        question: "What do prospects say when they describe why they didn't choose you?",
        type: "free-text",
        placeholder: "e.g. 'You weren't on the Gartner MQ, and our procurement team flagged that as a risk.'",
        hint: "Verbatim language from loss calls or sales notes.",
      },
      {
        id: "active_positioning_engagement",
        required: true,
        question: "Is there an active positioning or messaging engagement underway?",
        type: "single-select",
        options: [
          { value: "Yes, in progress", label: "Yes, in progress" },
          { value: "Yes, recently completed", label: "Yes, recently completed" },
          { value: "No", label: "No" },
          { value: "Planning one", label: "Planning one" },
        ],
      },
      {
        id: "market_stance",
        required: true,
        question: "Where do you want to compete on the market map?",
        type: "single-select",
        options: [
          { value: "Head-to-head \u2014 win the mainstream market against established players", label: "Head-to-head \u2014 win the mainstream market against established players" },
          { value: "Big fish, small pond \u2014 dominate a specific underserved niche", label: "Big fish, small pond \u2014 dominate a specific underserved niche" },
          { value: "Category creation \u2014 define and own an entirely new category", label: "Category creation \u2014 define and own an entirely new category" },
          { value: "Adjacent disruption \u2014 enter from the low end and move upmarket", label: "Adjacent disruption \u2014 enter from the low end and move upmarket" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "key_objections",
        required: false,
        question: "What are the most common objections in the sales process?",
        hint: "Select up to 3.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Too expensive", label: "Too expensive" },
          { value: "Too niche", label: "Too niche" },
          { value: "Not enough AI capability", label: "Not enough AI capability" },
          { value: "Not enterprise-ready", label: "Not enterprise-ready" },
          { value: "Not recognised by analysts", label: "Not recognised by analysts" },
          { value: "Feature gaps vs. alternatives", label: "Feature gaps vs. alternatives" },
          { value: "Integration concerns", label: "Integration concerns" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "buyer_discovery",
        required: false,
        question: "How do buyers currently find you?",
        hint: "Select up to 3.",
        type: "multi-select",
        maxSelections: 3,
        options: [
          { value: "Analyst reports", label: "Analyst reports" },
          { value: "G2 or review sites", label: "G2 or review sites" },
          { value: "Google search", label: "Google search" },
          { value: "Referral from existing customers", label: "Referral from existing customers" },
          { value: "Events or conferences", label: "Events or conferences" },
          { value: "Outbound sales", label: "Outbound sales" },
          { value: "Content or thought leadership", label: "Content or thought leadership" },
          { value: "Partner or channel", label: "Partner or channel" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "sales_motion",
        required: false,
        question: "What is the primary sales motion?",
        type: "single-select",
        options: [
          { value: "Inbound-led", label: "Inbound-led" },
          { value: "Outbound-led", label: "Outbound-led" },
          { value: "Partner-led", label: "Partner-led" },
          { value: "Product-led growth (PLG)", label: "Product-led growth (PLG)" },
          { value: "Mixed", label: "Mixed" },
        ],
      },
      {
        id: "power_type",
        required: false,
        question: "Which best describes the primary competitive advantage \u2014 or the one being built toward?",
        hint: "Helmer's 7 Powers framework",
        type: "single-select",
        options: [
          { value: "Scale economies \u2014 lower unit costs than competitors at scale", label: "Scale economies \u2014 lower unit costs than competitors at scale" },
          { value: "Network effects \u2014 product value grows as more users join", label: "Network effects \u2014 product value grows as more users join" },
          { value: "Counter-positioning \u2014 model incumbents can't copy without self-harm", label: "Counter-positioning \u2014 model incumbents can't copy without self-harm" },
          { value: "Switching costs \u2014 customers locked in by data, integrations, or workflow", label: "Switching costs \u2014 customers locked in by data, integrations, or workflow" },
          { value: "Branding \u2014 premium perception that commands a price premium", label: "Branding \u2014 premium perception that commands a price premium" },
          { value: "Cornered resource \u2014 exclusive access to a key input or capability", label: "Cornered resource \u2014 exclusive access to a key input or capability" },
          { value: "Process power \u2014 operational capability competitors can't replicate", label: "Process power \u2014 operational capability competitors can't replicate" },
          { value: "Not yet established \u2014 this is what needs to be built", label: "Not yet established \u2014 this is what needs to be built" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "differentiation",
        required: true,
        question: "What are the 2\u20133 dimensions on which you are genuinely differentiated from alternatives?",
        type: "free-text",
        placeholder: "e.g. Native meeting platform integrations (not bot injection); compliance-grade data architecture; vertical-specific workflows for staffing agencies.",
      },
    ],
  },
  {
    id: "commit",
    name: "Commit",
    purpose: "Convert the chosen direction and position into a committed plan with strategic bets, sequencing, ownership, milestones, and governance",
    output: "Strategic bet portfolio, anti-portfolio, OKRs, 100-day plan, resource allocation, and governance rhythm",
    runButtonLabel: "Run Commit Report",
    questions: [
      {
        id: "execution_owner",
        required: true,
        question: "Who owns strategic execution?",
        type: "free-text",
        placeholder: "e.g. CEO, CPO, COO \u2014 the role, not the individual's name",
        hint: "Appears in the 100-day plan and governance cadence.",
      },
      {
        id: "validation_segment",
        required: true,
        question: "What is the primary vertical or segment for validation?",
        type: "free-text",
        placeholder: "e.g. UK financial services firms at 500\u20132,000 employees",
        hint: "The beachhead segment where the strategy gets tested first.",
      },
      {
        id: "horizon_allocation",
        required: true,
        question: "How do you want to allocate capacity across time horizons?",
        hint: "Now = defend and optimise core. Next = adjacent opportunities. Later = transformational bets. Must total 100%.",
        type: "percentage-split",
        splitLabels: [
          "Now \u2014 defending and optimising what exists",
          "Next \u2014 scaling into adjacent opportunities",
          "Later \u2014 transformational bets and new models",
        ],
      },
      {
        id: "strategic_bets",
        required: true,
        question: "Define your strategic bets",
        hint: "For each: name the bet, its type (Strategic / Capability / Sequencing), the hypothesis, and what validating it looks like. Up to 5 bets.",
        type: "structured-repeater",
        maxSelections: 5,
        addLabel: "Add Bet",
        repeaterFields: ["Bet name", "Type", "Hypothesis", "Minimum viable test"],
        repeaterFieldPlaceholders: [
          "Short label e.g. 'Enterprise mid-market'",
          "Strategic / Capability / Sequencing",
          "We believe [action] will result in [outcome] because [rationale]",
          "How we test this before full commitment e.g. '3 pilots in 60 days'",
        ],
      },
      {
        id: "okrs",
        required: true,
        question: "What are the top 3 company-level objectives for the next 12 months?",
        hint: "OKRs should measure whether the strategy is working, not just operational output.",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add OKR",
        repeaterFields: ["Objective", "Key Result 1", "Key Result 2", "Key Result 3"],
        repeaterFieldPlaceholders: [
          "Objective (qualitative direction)",
          "Key result 1 (quantitative \u2014 what counts as success?)",
          "Key result 2 (optional)",
          "Key result 3 (optional)",
        ],
      },
      {
        id: "revenue_target",
        required: false,
        question: "What is the revenue or pipeline target this strategy must deliver?",
        type: "free-text",
        placeholder: "e.g. \u00a35M ARR by end of FY26, or 3:1 pipeline coverage by Q2",
        hint: "OKRs connect to this. Leave blank if not yet defined.",
      },
      {
        id: "bet_capacity",
        required: false,
        question: "How many strategic bets can you resource simultaneously?",
        type: "single-select",
        options: [
          { value: "2\u20133", label: "2\u20133" },
          { value: "3\u20135", label: "3\u20135" },
          { value: "5\u20137", label: "5\u20137" },
        ],
      },
      {
        id: "review_cadence",
        required: false,
        question: "What is the preferred strategic review cadence?",
        type: "single-select",
        options: [
          { value: "Weekly operational + monthly strategic + quarterly portfolio", label: "Weekly operational + monthly strategic + quarterly portfolio (recommended)" },
          { value: "Weekly", label: "Weekly" },
          { value: "Fortnightly", label: "Fortnightly" },
          { value: "Monthly", label: "Monthly" },
          { value: "Quarterly", label: "Quarterly" },
        ],
      },
      {
        id: "planned_hires",
        required: false,
        question: "Which leadership or critical hires are planned in the next 6 months?",
        hint: "Select all that apply.",
        type: "multi-select",
        options: [
          { value: "Sales leadership", label: "Sales leadership" },
          { value: "Product leadership", label: "Product leadership" },
          { value: "Marketing leadership", label: "Marketing leadership" },
          { value: "Engineering leadership", label: "Engineering leadership" },
          { value: "None planned", label: "None planned" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "board_reporting_frequency",
        required: false,
        question: "How frequently does the board or sponsor review strategic progress?",
        type: "single-select",
        options: [
          { value: "Monthly", label: "Monthly" },
          { value: "Quarterly", label: "Quarterly" },
          { value: "Bi-annually", label: "Bi-annually" },
        ],
      },
      {
        id: "bet_kill_criteria",
        required: true,
        question: "What are the predefined kill criteria for the strategic bets?",
        type: "free-text",
        placeholder: "e.g. If enterprise pipeline coverage drops below 3:1 by day 60, or CAC exceeds \u00a38k with no improving trajectory, trigger a board review.",
      },
    ],
  },
];

const VISIBLE_STAGES = STAGES.filter((s) => !s.hidden);

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
        </div>
      ))}
    </div>
  );
}

function renderAssumptionsCards(assumptions: (string | Record<string, unknown>)[]): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {assumptions.map((item, i) => {
        // Assumptions may come back as plain strings, JSON strings, or objects {text, status, testable, fragility}
        let parsed: Record<string, unknown> | null = null;
        if (typeof item === "string" && item.trim().startsWith("{")) {
          try { parsed = JSON.parse(item); } catch { /* keep as string */ }
        }
        const obj = parsed ?? (typeof item === "object" ? item as Record<string, unknown> : null);
        const text = obj ? (obj.text as string ?? "") : (item as string);
        const fragility = obj ? (obj.fragility as string | undefined) : undefined;
        const testable = obj ? (obj.testable as string | undefined) : undefined;
        return (
          <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: fragility || testable ? 10 : 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0, lineHeight: 1.5 }}>{text}</p>
            </div>
            {(fragility || testable) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {fragility && <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 4, padding: "2px 8px" }}>Fragility: {fragility}</span>}
                {testable && <span style={{ fontSize: 11, fontWeight: 600, color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "2px 8px" }}>Testable: {testable}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type HypothesisEntry = {
  hypothesis: string;
  source: string;
  tested_in: string;
  status: string;
  evidence?: string;
};

function renderHypothesisRegisterCards(items: HypothesisEntry[]): React.ReactNode {
  const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    untested:    { label: "Untested",    color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", dot: "#9ca3af" },
    validated:   { label: "Validated",   color: "#065f46", bg: "#f0fdf4", border: "#86efac", dot: "#22c55e" },
    at_risk:     { label: "At Risk",     color: "#92400e", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
    invalidated: { label: "Invalidated", color: "#991b1b", bg: "#fff1f2", border: "#fecaca", dot: "#ef4444" },
  };

  const SOURCE_LABEL: Record<string, string> = {
    user_input:    "User input",
    web_research:  "Research",
    inferred:      "Inferred",
  };

  const TESTED_IN_LABEL: Record<string, string> = {
    diagnose: "Diagnose",
    decide:   "Decide",
    position: "Position",
    commit:   "Commit",
  };

  // Group by status for a summary header
  const counts = items.reduce<Record<string, number>>((acc, h) => {
    const s = h.status ?? "untested";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {(["validated", "at_risk", "invalidated", "untested"] as const).map((s) =>
          counts[s] ? (
            <span key={s} style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              color: STATUS_STYLES[s].color, background: STATUS_STYLES[s].bg,
              border: `1px solid ${STATUS_STYLES[s].border}`,
            }}>
              {counts[s]} {STATUS_STYLES[s].label}
            </span>
          ) : null
        )}
      </div>
      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((h, i) => {
          const st = STATUS_STYLES[h.status ?? "untested"] ?? STATUS_STYLES.untested;
          return (
            <div key={i} style={{
              background: st.bg, border: `1px solid ${st.border}`,
              borderLeft: `4px solid ${st.dot}`, borderRadius: 10, padding: "14px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: h.evidence ? 8 : 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", margin: 0, lineHeight: 1.6, flex: 1 }}>{h.hypothesis}</p>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: st.color, background: "#fff", border: `1px solid ${st.border}`,
                  borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginTop: 2,
                }}>{st.label}</span>
              </div>
              {h.evidence && (
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px", lineHeight: 1.5, fontStyle: "italic" }}>{h.evidence}</p>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {h.source && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#4b5563", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 4, padding: "1px 6px" }}>
                    {SOURCE_LABEL[h.source] ?? h.source}
                  </span>
                )}
                {h.tested_in && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 4, padding: "1px 6px" }}>
                    Test in: {TESTED_IN_LABEL[h.tested_in] ?? h.tested_in}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
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

function confidenceTier(score: number): {
  tier: string; tagBg: string; tagColor: string; tagBorder: string;
  dotColor: string; meaning: string; upgradeTo: string;
} {
  if (score >= 0.75) return {
    tier: "Validated",
    tagBg: "#f0fdf4", tagColor: "#166534", tagBorder: "#bbf7d0",
    dotColor: "#16a34a",
    meaning: "Strong evidence base — reliable for decision-making.",
    upgradeTo: "Evidence that would further strengthen this",
  };
  if (score >= 0.55) return {
    tier: "Provisional",
    tagBg: "#fef9c3", tagColor: "#854d0e", tagBorder: "#fde68a",
    dotColor: "#d97706",
    meaning: "Directional signal — validate key assumptions before committing.",
    upgradeTo: "To reach Validated",
  };
  return {
    tier: "Indicative",
    tagBg: "#fff7ed", tagColor: "#9a3412", tagBorder: "#fed7aa",
    dotColor: "#ea580c",
    meaning: "Hypothesis only — test before building on these conclusions.",
    upgradeTo: "To reach Provisional",
  };
}

function renderConfidenceCard(conf: { score?: number; rationale?: string }): React.ReactNode {
  const score = conf.score;
  const pct = score !== undefined ? Math.round(score * 100) : null;
  const tier = score !== undefined ? confidenceTier(score) : null;
  const filledDots = score !== undefined ? Math.max(1, Math.min(5, Math.round(score * 5))) : 0;

  // Parse rationale: split at "Confidence would increase materially with:" or similar boundary
  const rawRationale = (conf.rationale ?? "").trim();
  const splitMatch = rawRationale.match(/^([\s\S]*?)(?:Confidence would increase materially with[:\s]*)([\s\S]*)$/i);
  const explanation = splitMatch ? splitMatch[1].trim() : rawRationale;
  const improvementsRaw = splitMatch ? splitMatch[2].trim() : "";

  const improvements = improvementsRaw
    ? improvementsRaw.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 3)
    : [];

  const explanationBullets = explanation
    ? explanation.split(/\.\s+(?=[A-Z])/).map((s) => s.trim().replace(/\.$/, "")).filter((s) => s.length > 10)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tier card */}
      {tier !== null && pct !== null && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              background: tier.tagBg, color: tier.tagColor, border: `1px solid ${tier.tagBorder}`,
              borderRadius: 4, padding: "3px 10px",
            }}>
              {tier.tier}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>{pct}%</span>
          </div>
          {/* Segmented dots */}
          <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{
                flex: 1, height: 7, borderRadius: 3,
                background: i <= filledDots ? tier.dotColor : "#e5e7eb",
                transition: "background 400ms ease",
              }} />
            ))}
          </div>
          {/* Meaning */}
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>{tier.meaning}</p>
        </div>
      )}
      {/* Explanation bullets */}
      {explanationBullets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {explanationBullets.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "#d1d5db", flexShrink: 0, marginTop: 4, fontSize: 10 }}>●</span>
              <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.7 }}>{s}.</p>
            </div>
          ))}
        </div>
      )}
      {/* Upgrade path */}
      {improvements.length > 0 && tier !== null && (
        <div style={{ background: tier.tagBg, border: `1px solid ${tier.tagBorder}`, borderRadius: 10, padding: "14px 18px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: tier.tagColor, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
            {tier.upgradeTo}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {improvements.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tier.dotColor} strokeWidth="2" style={{ flexShrink: 0, marginTop: 3 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <p style={{ fontSize: 13, color: tier.tagColor, margin: 0, lineHeight: 1.6 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}
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
      } else if (h === "confidence" && sections.confidence && typeof sections.confidence === "object") {
        structuredContent = renderConfidenceCard(sections.confidence as { score?: number; rationale?: string });
      } else if ((h === "key assumptions" || h === "assumptions") && Array.isArray(sections.assumptions) && sections.assumptions.length > 0) {
        structuredContent = renderAssumptionsCards(sections.assumptions as (string | Record<string, unknown>)[]);
      } else if (h === "kill criteria" && Array.isArray(sections.kill_criteria) && sections.kill_criteria.length > 0) {
        structuredContent = renderKillCriteriaCards(sections.kill_criteria as { criterion: string; trigger: string; response: string }[]);
      } else if (h === "okrs" && Array.isArray(sections.okrs) && sections.okrs.length > 0) {
        structuredContent = renderOKRsCards(sections.okrs as { objective: string; key_results: string[] }[]);
      } else if (h === "strategic bets" && Array.isArray(sections.strategic_bets) && sections.strategic_bets.length > 0) {
        structuredContent = renderStrategicBetsCards(sections.strategic_bets as { bet: string; hypothesis: string; investment: string }[]);
      } else if (h === "100-day plan" && Array.isArray(sections.hundred_day_plan) && sections.hundred_day_plan.length > 0) {
        structuredContent = renderHundredDayPlanCards(sections.hundred_day_plan as { milestone: string; timeline: string; owner: string; deliverable: string }[]);
      } else if (h === "hypothesis register" && Array.isArray(sections.hypothesis_register) && sections.hypothesis_register.length > 0) {
        structuredContent = renderHypothesisRegisterCards(sections.hypothesis_register as HypothesisEntry[]);
      }
    }

    const innerNodes = structuredContent ?? renderReportBlocks(bodyText, si * 1000);

    if (heading) {
      allNodes.push(
        <div key={si} id={sectionId} style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "24px 28px",
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 18, marginTop: 0 }}>
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
                      <span style={{ fontSize: 18, color: "#374151", lineHeight: 1.8, flex: 1 }}>{renderInlineContent(match[2])}</span>
                    </div>
                  );
                })}
              </div>
            );
          } else if (blines.every((l) => l.trimStart().startsWith("- "))) {
            subnodes.push(
              <ul key={k} style={{ margin: "0 0 16px", paddingLeft: 20 }}>
                {blines.map((l, m) => (
                  <li key={m} style={{ fontSize: 18, color: "#374151", lineHeight: 1.8, marginBottom: 6 }}>
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
                        <span style={{ fontSize: 18, color: "#374151", lineHeight: 1.8 }}>{renderInlineContent(t2.slice(2))}</span>
                      </div>
                    );
                  }
                  return <p key={m} style={{ fontSize: 18, color: "#374151", lineHeight: 1.8, margin: "0 0 6px" }}>{renderInlineContent(t2)}</p>;
                })}
              </div>
            );
          } else if (blines.length > 1) {
            subnodes.push(
              <div key={k} style={{ marginBottom: 20 }}>
                {blines.map((l, m) => (
                  <p key={m} style={{ fontSize: 18, lineHeight: 1.8, color: "#374151", margin: m === 0 ? "0 0 2px" : "0" }}>
                    {renderInlineContent(l)}
                  </p>
                ))}
              </div>
            );
          } else {
            subnodes.push(
              <p key={k} style={{ fontSize: 18, lineHeight: 1.8, color: "#374151", marginBottom: 16, marginTop: 0 }}>
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
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 0 }}>
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
                fontSize: 14, fontWeight: 800, color: "#111827",
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
              <div key={j} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: isUrl ? "#dbeafe" : "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isUrl ? "#1d4ed8" : "#6366f1", marginTop: 2 }}>
                  {match[1]}
                </span>
                <span style={{ fontSize: 18, color: "#374151", lineHeight: 1.7, flex: 1 }}>
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
          <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6366f1", marginTop: 2 }}>
            {singleNumbered[1]}
          </span>
          <span style={{ fontSize: 18, color: "#374151", lineHeight: 1.7, flex: 1 }}>{renderInlineContent(singleNumbered[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet list block (lines starting with "- ")
    if (lines.every((l) => l.trimStart().startsWith("- "))) {
      nodes.push(
        <ul key={i} style={{ margin: "0 0 16px", paddingLeft: 20 }}>
          {lines.map((l, j) => (
            <li key={j} style={{ fontSize: 18, color: "#374151", lineHeight: 1.8, marginBottom: 6 }}>
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
                  <span style={{ fontSize: 18, color: "#374151", lineHeight: 1.8 }}>{renderInlineContent(t.slice(2))}</span>
                </div>
              );
            }
            return <p key={j} style={{ fontSize: 18, color: "#374151", lineHeight: 1.8, margin: "0 0 6px" }}>{renderInlineContent(t)}</p>;
          })}
        </div>
      );
      continue;
    }

    // Plain paragraph — may contain line breaks (e.g. bold title then detail line)
    if (lines.length > 1) {
      // First paragraph with multiple lines → blockquote callout
      if (nodes.length === 0) {
        nodes.push(
          <div key={i} style={{ borderLeft: "3px solid #6366f1", background: "#f5f3ff", borderRadius: "0 8px 8px 0", padding: "16px 20px", marginBottom: 20 }}>
            {lines.map((l, j) => (
              <p key={j} style={{ fontSize: 18, lineHeight: 1.7, color: "#1e1b4b", margin: j === 0 ? "0 0 2px" : "0" }}>
                {renderInlineContent(l)}
              </p>
            ))}
          </div>
        );
      } else {
        nodes.push(
          <div key={i} style={{ marginBottom: 20 }}>
            {lines.map((l, j) => (
              <p key={j} style={{ fontSize: 18, lineHeight: 1.7, color: "#374151", margin: j === 0 ? "0 0 2px" : "0" }}>
                {renderInlineContent(l)}
              </p>
            ))}
          </div>
        );
      }
    } else {
      // If paragraph starts with **bold.** followed by body text, render bold on its own line
      const boldLeadMatch = trimmed.match(/^(\*\*[^*]+\*\*\.?)\s+([\s\S]+)$/);
      if (boldLeadMatch) {
        nodes.push(
          <div key={i} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: "#374151", margin: "0 0 3px", fontWeight: 600 }}>
              {renderInlineContent(boldLeadMatch[1])}
            </p>
            <p style={{ fontSize: 18, lineHeight: 1.8, color: "#374151", margin: 0 }}>
              {renderInlineContent(boldLeadMatch[2])}
            </p>
          </div>
        );
      } else {
        // Single paragraph — if it's the first block and long enough, render as blockquote callout
        const isFirstBlock = nodes.length === 0;
        const isLongParagraph = trimmed.length > 80;
        if (isFirstBlock && isLongParagraph) {
          nodes.push(
            <div key={i} style={{ borderLeft: "3px solid #6366f1", background: "#f5f3ff", borderRadius: "0 8px 8px 0", padding: "16px 20px", marginBottom: 20 }}>
              <p style={{ fontSize: 18, lineHeight: 1.7, color: "#1e1b4b", margin: 0 }}>
                {renderInlineContent(trimmed)}
              </p>
            </div>
          );
        } else {
        nodes.push(
          <p key={i} style={{ fontSize: 18, lineHeight: 1.8, color: "#374151", marginBottom: 16, marginTop: 0 }}>
            {renderInlineContent(trimmed)}
          </p>
        );
        }
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
                  fontSize: 18,
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
        fontSize: 15,
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
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 8,
                  marginTop: 0,
                  lineHeight: 1.4,
                }}
              >
                {q.question}
              </p>
              <div>
                {isFreeText ? (
                  <p style={{ fontSize: 18, color: "#374151", fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>
                    &ldquo;{chips[0]}&rdquo;
                  </p>
                ) : isRepeater ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(answer as RepeaterEntry[]).map((entry, i) => {
                      const name = entry["Bet name"] || entry["Action"] || entry["Milestone"] || Object.values(entry)[0] || `Entry ${i + 1}`;
                      const betType = (entry["Type"] || entry["type"]) as string | undefined;
                      const rest = Object.entries(entry).filter(([k]) => k !== "Bet name" && k !== "Milestone" && k !== "Type" && k !== "type");
                      const betBadge = betType ? {
                        color: betType === "Strategic" ? "#1e40af" : betType === "Capability" ? "#065f46" : betType === "Sequencing" ? "#92400e" : "#1e40af",
                        bg: betType === "Strategic" ? "#dbeafe" : betType === "Capability" ? "#d1fae5" : betType === "Sequencing" ? "#fef3c7" : "#dbeafe",
                      } : null;
                      return (
                        <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <p style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1.4 }}>{name}</p>
                            {betType && betBadge && (
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: betBadge.color, background: betBadge.bg, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>
                                {betType}
                              </span>
                            )}
                          </div>
                          {rest.map(([k, v]) => v.trim() ? (
                            <div key={k} style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.05em", flexShrink: 0, marginTop: 3, width: 96 }}>{k}</span>
                              <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, flex: 1 }}>{v}</span>
                            </div>
                          ) : null)}
                        </div>
                      );
                    })}
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

function ReportFeedback({ stageId, stageName, inline }: { stageId: string; stageName: string; inline?: boolean }) {
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

  const inlineBase: React.CSSProperties = inline
    ? { display: "flex", alignItems: "center", gap: 12 }
    : { display: "flex", alignItems: "center", gap: 12, padding: "10px 48px", borderBottom: "1px solid #e5e7eb", background: submitted ? "#f0fdf4" : "#fafafa", flexShrink: 0 };

  if (submitted) {
    return (
      <div style={inlineBase}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
      <div style={{ ...inlineBase, justifyContent: inline ? "flex-start" : "flex-end" }}>
        <span style={{ fontSize: 13, color: "#6b7280", marginRight: 8 }}>How useful was this report?</span>
        <QuickStars value={quickRating} onSelect={handleQuickStar} />
      </div>
    );
  }

  // ── Expanded panel ──
  const expandedPadding = inline ? "12px 0 0" : "12px 48px 0";
  const catPadding = inline ? "16px 0" : "16px 48px";
  const submitPadding = inline ? "0 0 16px" : "0 48px 16px";
  return (
    <div style={inline ? { background: "#fafafa", borderRadius: 10, padding: "4px 0" } : { borderBottom: "1px solid #e5e7eb", background: "#fafafa", flexShrink: 0 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: expandedPadding }}>
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
      <div style={{ display: "flex", gap: 0, padding: catPadding }}>
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
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: submitPadding }}>
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
  frame:    ["Strategic Problem", "Market Context", "Winning Conditions", "Decision Boundaries", "Core Strategic Question"],
  diagnose: ["Business Assessment", "Product-Market Fit", "Competitive Landscape", "Emerging Direction", "Benchmark Gaps"],
  decide:   ["Strategic Options", "Recommended Direction", "What Must Be True", "Kill Criteria"],
  position: ["Target Customer", "Positioning Statement", "Competitive Advantage", "Structural Defensibility"],
  commit:   ["Strategic Bets", "OKRs", "100-Day Plan", "Governance Rhythm", "Resource Allocation"],
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

async function downloadReportPDF(stageName: string, companyName: string, sections: Record<string, unknown>, markdownReport?: string | null) {
  const conf = sections.confidence as { score?: number; rationale?: string } | undefined;
  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  // Convert markdown to simple HTML — strip citation tags like [Frame · Section]
  function mdToHtml(md: string): string {
    const lines = md.split("\n");
    const htmlParts: string[] = [];
    let inSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
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

  // Build a hidden container with print-ready styling
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "760px";
  container.innerHTML = `
<style>
  .pdf-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11pt;color:#111827;background:#fff;padding:24px}
  .pdf-root .header{border-bottom:2px solid #111827;padding-bottom:16px;margin-bottom:32px}
  .pdf-root .header h1{font-size:22pt;font-weight:800;color:#111827;margin-bottom:4px}
  .pdf-root .header .company{font-size:13pt;color:#6b7280;margin-bottom:2px}
  .pdf-root .header .meta{font-size:9pt;color:#9ca3af}
  .pdf-root .conf{display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:4px 12px;font-size:10pt;font-weight:700;color:#374151;margin-top:10px}
  .pdf-root section{margin-bottom:28px;page-break-inside:avoid}
  .pdf-root h2{font-size:13pt;font-weight:700;color:#111827;margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
  .pdf-root h3{font-size:9pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em;margin:20px 0 8px}
  .pdf-root p{font-size:10.5pt;line-height:1.7;color:#374151;margin-bottom:8px}
  .pdf-root ul,.pdf-root ol{padding-left:18px;margin:0 0 12px}
  .pdf-root li{font-size:10.5pt;line-height:1.65;color:#374151;margin-bottom:6px}
  .pdf-root li strong{color:#111827}
  .pdf-root strong{color:#111827}
  .pdf-root em{color:#6b7280;font-style:normal}
  .pdf-root .footer{margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:8.5pt;color:#9ca3af;display:flex;justify-content:space-between}
</style>
<div class="pdf-root">
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
</div>`;

  document.body.appendChild(container);

  // Load html2pdf.js if not already loaded
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(window as any).html2pdf) {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
    document.head.appendChild(script);
    await new Promise<void>((resolve) => { script.onload = () => resolve(); });
  }

  const filename = `${stageName}-Report-${companyName}-Inflexion.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).html2pdf().set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    }).from(container.querySelector(".pdf-root")).save();
  } finally {
    document.body.removeChild(container);
  }
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
  companyId = "",
  initialCompletedOutputIds = {},
  allOutputsByStage = {},
}: {
  initialRunningJobs?: { stageId: string; sessionId: string }[];
  initialCompletedOutputs?: Record<string, Record<string, unknown>>;
  initialSavedAnswers?: Record<string, Record<string, unknown>>;
  companyName?: string;
  companyId?: string;
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
      lines.push(`## Key Assumptions\n\n${(sections.assumptions as (string | Record<string, unknown>)[]).map((a) => `- ${typeof a === "string" ? a : (a.text as string) ?? JSON.stringify(a)}`).join("\n")}`);
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
    if (Array.isArray(sections.hypothesis_register) && sections.hypothesis_register.length > 0) {
      const hypoLines = (sections.hypothesis_register as HypothesisEntry[]).map((h) => {
        const statusLabel = { untested: "Untested", validated: "Validated", at_risk: "At Risk", invalidated: "Invalidated" }[h.status] ?? h.status;
        const sourceLabel = { user_input: "User input", web_research: "Research", inferred: "Inferred" }[h.source] ?? h.source;
        const testedLabel = { diagnose: "Diagnose", decide: "Decide", position: "Position", commit: "Commit" }[h.tested_in] ?? h.tested_in;
        const evidenceLine = h.evidence ? `\n  _Evidence:_ ${h.evidence}` : "";
        return `- **[${statusLabel}]** ${h.hypothesis} _(${sourceLabel} → test in ${testedLabel})_${evidenceLine}`;
      });
      lines.push(`## Hypothesis Register\n\n${hypoLines.join("\n")}`);
    }
    const eb = sections.evidence_base as { sources?: string[]; quotes?: string[] } | undefined;
    if (eb?.sources && eb.sources.length > 0) {
      lines.push(`## Sources\n\n${eb.sources.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
    }
    return lines.join("\n\n---\n\n");
  }

  const initialState: Record<string, StageState> = {};
  STAGES.forEach((stage, idx) => {
    const runningJob = initialRunningJobs.find((j) => j.stageId === stage.id);
    const completedSections = initialCompletedOutputs[stage.id];
    const savedAnswers = initialSavedAnswers[stage.id] ?? {};
    const hasSavedAnswers = Object.keys(savedAnswers).length > 0;
    // Sequential locking: stage is locked unless prior stage is complete (or it's Frame)
    // Commit's prerequisite is Position (not Bet) since Bet runs automatically
    const priorStageId = stage.id === "commit" ? "position" : STAGES[idx - 1]?.id;
    const priorComplete = idx === 0 || !!initialCompletedOutputs[priorStageId];
    initialState[stage.id] = {
      status: priorComplete ? "active" : "locked",
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
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activePillLabel, setActivePillLabel] = useState<string>("");
  const [showAllPills, setShowAllPills] = useState(false);
  const [redTeamState, setRedTeamState] = useState<"idle" | "running" | "shown" | "acknowledged">("idle");
  const [redTeamChallenges, setRedTeamChallenges] = useState<{ title: string; detail: string; severity: string }[]>([]);

  // Reset red team gate whenever the active stage changes
  useEffect(() => {
    setRedTeamState("idle");
    setRedTeamChallenges([]);
  }, [activeStageId]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportTopRef = useRef<HTMLDivElement | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Record<string, Array<{ role: "user"|"assistant"; content: string }>>>({});
  const [chatInput, setChatInput] = useState<Record<string, string>>({});
  const [chatLoading, setChatLoading] = useState<Record<string, boolean>>({});
  const [chatStreaming, setChatStreaming] = useState<Record<string, string>>({});
  const [chatModalOpen, setChatModalOpen] = useState(false);

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

  // Strategic bet suggestions for Commit stage — fetched from suggest-bets API when user reaches the question
  type BetSuggestion = { "Bet name": string; "Type": string; "Hypothesis": string; "Minimum viable test": string };
  const [betSuggestions, setBetSuggestions] = useState<BetSuggestion[]>([]);
  const [betsFetched, setBetsFetched] = useState(false);
  const [betsLoading, setBetsLoading] = useState(false);


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
            setReportModalOpen(true);
            showToast(`${STAGES.find((s) => s.id === resumeStageId)?.name ?? ""} report ready`);
          }, 500);
        } else if (statusData.status === "failed") {
          stopPolling();
          setStageStates((prev) => ({
            ...prev,
            [resumeStageId]: { ...prev[resumeStageId], reportStatus: "none", reportFailed: true },
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
      if (stage.id === activeStageId) break;
      const state = stageStates[stage.id];
      if (state?.reportSections) {
        priorSections[stage.id] = state.reportSections as Record<string, unknown>;
      }
    }

    const frameAnswers = stageStates["frame"]?.answers ?? {};
    const persona = typeof frameAnswers["persona"] === "string" ? frameAnswers["persona"] : undefined;

    try {
      const res = await fetch("/api/strategy/red-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priorSections,
          currentStageId: activeStageId,
          currentStageName: STAGES.find((s) => s.id === activeStageId)?.name,
          currentAnswers: stageStates[activeStageId]?.answers ?? {},
          persona,
        }),
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
          parts.push(`**Key Assumptions**\n${(s.assumptions as (string | Record<string, unknown>)[]).map((a) => `- ${typeof a === "string" ? a : (a.text as string) ?? ""}`).join("\n")}`);
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

      // Persist bet selections when running the Commit stage
      if (activeStageId === "commit" && activeState.answers) {
        const commitBets = activeState.answers["strategic_bets"];
        if (Array.isArray(commitBets) && commitBets.length > 0) {
          const betNames = (commitBets as Array<{ "Bet name"?: string }>).map((b) => b["Bet name"]).filter(Boolean);
          if (betNames.length > 0) {
            fetch("/api/strategy/bet-selections", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ betNames }),
            }).catch(() => {}); // fire-and-forget
          }
        }
      }

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
              setReportModalOpen(true);
              showToast(`${STAGES.find((s) => s.id === activeStageId)?.name ?? ""} report ready`);
            }, 500);
          } else if (statusData.status === "failed") {
            stopPolling();
            updateStage(activeStageId, { reportStatus: "none", reportFailed: true });
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
    // Navigate to the next visible, incomplete stage (skip hidden stages like Bet)
    const currentVisibleIdx = VISIBLE_STAGES.findIndex((s) => s.id === activeStageId);
    let targetStage = VISIBLE_STAGES[currentVisibleIdx + 1];
    for (let i = currentVisibleIdx + 1; i < VISIBLE_STAGES.length; i++) {
      if (stageStates[VISIBLE_STAGES[i].id]?.reportStatus !== "complete") {
        targetStage = VISIBLE_STAGES[i];
        break;
      }
    }
    if (targetStage) {
      setActiveStageId(targetStage.id);
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
      parts.push(`Key Assumptions:\n${(s.assumptions as (string | Record<string, unknown>)[]).map((a) => `- ${typeof a === "string" ? a : (a as Record<string, unknown>).text as string ?? ""}`).join("\n")}`);
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
  const currentStageIdx = VISIBLE_STAGES.findIndex((s) => s.id === activeStageId);
  const nextStage = VISIBLE_STAGES[currentStageIdx + 1];
  // Find the true "next destination" for the Continue button — first incomplete visible stage after current
  const nextIncompleteStage = (() => {
    for (let i = currentStageIdx + 1; i < VISIBLE_STAGES.length; i++) {
      if (stageStates[VISIBLE_STAGES[i].id]?.reportStatus !== "complete") return VISIBLE_STAGES[i];
    }
    return null; // all visible stages complete
  })();
  // All stages complete when every visible stage is done (bet runs automatically)
  const allStagesComplete = VISIBLE_STAGES.every((s) => stageStates[s.id]?.reportStatus === "complete");

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
      <style>{`
        @keyframes unlock-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(163,230,53,0.7); }
          60%  { box-shadow: 0 0 0 10px rgba(163,230,53,0); }
          100% { box-shadow: 0 0 0 0 rgba(163,230,53,0); }
        }
        .unlock-ready {
          animation: unlock-pulse 1.8s ease-out infinite;
          background: #a3e635 !important;
          color: #111827 !important;
        }
        .unlock-ready svg { stroke: #111827 !important; }
        .unlock-ready:hover { background: #bef264 !important; }
      `}</style>
      {/* Stage Navigation Rail */}
      <div
        style={{
          height: isMobile ? 64 : 84,
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          paddingLeft: isMobile ? 16 : 12,
          paddingRight: isMobile ? 16 : 24,
          gap: 0,
          background: "#fff",
          flexShrink: 0,
          overflowX: isMobile ? "auto" : "visible",
        }}
      >
        {VISIBLE_STAGES.map((stage, idx) => {
          const state = stageStates[stage.id];
          const isActive = stage.id === activeStageId;
          const isComplete = state.status === "complete" || state.reportStatus === "complete";
          const isLocked = state.status === "locked";

          return (
            <div key={stage.id} style={{ display: "flex", alignItems: "center", height: isMobile ? 64 : 84 }}>
              <button
                onClick={() => { if (!isLocked) setActiveStageId(stage.id); }}
                disabled={isLocked}
                title={isLocked ? `Complete ${STAGES[idx - 1]?.name ?? "previous stage"} first` : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #a3e635" : "2px solid transparent",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  padding: "6px 10px 6px 0",
                  height: "100%",
                  borderRadius: 0,
                  transition: "border-color 150ms",
                  fontFamily: "inherit",
                  opacity: isLocked ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    width: isMobile ? 38 : 52,
                    height: isMobile ? 38 : 52,
                    borderRadius: "50%",
                    background: isLocked ? "#e5e7eb" : isComplete ? "#111827" : isActive ? "#111827" : "#f3f4f6",
                    color: isLocked ? "#9ca3af" : isComplete ? "#a3e635" : isActive ? "#a3e635" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isMobile ? 13 : 15,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {isLocked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : isComplete ? (
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
              {idx < VISIBLE_STAGES.length - 1 && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ margin: "0 2px", flexShrink: 0 }}>
                  <path d="M6 4l4 4-4 4" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}

        {/* Unlock button — far right */}
        {(() => {
          const allComplete = Object.values(stageStates).filter((s) => s.reportStatus === "complete").length === 5;
          return (
        <button
          onClick={() => setDeckModalOpen(true)}
          className={allComplete ? "unlock-ready" : undefined}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "#111827",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            transition: "background 300ms",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Unlock
        </button>
          );
        })()}
      </div>

      {/* Toast */}
      <Toast message={toastMessage} visible={toastVisible} />

      {/* Product Strategy Document Modal */}
      {deckModalOpen && (
        <ProductStrategyModal
          open={deckModalOpen}
          onClose={() => setDeckModalOpen(false)}
          completedStages={Object.values(stageStates).filter((s) => s.reportStatus === "complete").length}
          companyName={companyName}
          companyId={companyId}
          outputs={Object.fromEntries(
            Object.entries(stageStates)
              .filter(([, s]) => s.reportSections != null)
              .map(([id, s]) => [id, { sections: s.reportSections }])
          )}
        />
      )}

      {/* REPORT MODAL */}
      {reportModalOpen && isReportComplete && (
        <div
          onClick={() => setReportModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0", overflowY: "auto" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 0, width: "100%", maxWidth: 1300, position: "relative", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", minHeight: "100vh" }}
          >
            {/* Modal header */}
            <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>{activeStage.name} Report</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { if (activeState.reportSections) downloadReportPDF(activeStage.name, companyName, activeState.reportSections, activeState.report); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    Export PDF
                  </button>
                  <ShareButton stageId={activeStageId} stageName={activeStage.name} reportSections={activeState.reportSections} />
                  <button
                    onClick={() => { setReportModalOpen(false); setChatModalOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #111827", borderRadius: 8, background: "#111827", fontSize: 13, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    Ask Me
                  </button>
                </div>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Modal body */}
            <div style={{ padding: "16px 16px 48px" }} className="sm:!p-[32px_40px_48px]" id="report-print-area">
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
              {/* Stale report warning */}
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
              {/* Version history banner */}
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
                                  {ver.confidence != null && (() => {
                                    const t = confidenceTier(ver.confidence);
                                    return (
                                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", background: t.tagBg, color: t.tagColor, border: `1px solid ${t.tagBorder}`, borderRadius: 4, padding: "2px 8px" }}>
                                        {t.tier}
                                      </span>
                                    );
                                  })()}
                                  {(outputTags[ver.id] ?? []).map((tag) => (
                                    <span key={tag} style={{ fontSize: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "1px 7px", color: "#6b7280" }}>{tag}</span>
                                  ))}
                                  {confPct && <span style={{ display: "none" }}>{confPct}</span>}
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
              {/* Rating */}
              <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid #e5e7eb" }}>
                <ReportFeedback stageId={activeStageId} stageName={activeStage.name} inline />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RED TEAM MODAL — running + challenges */}
      {(redTeamState === "running" || redTeamState === "shown") && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 1100, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 100px rgba(0,0,0,0.35)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: "#111827", padding: "28px 36px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                {redTeamState === "running" ? (
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#a3e635", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                )}
                <p style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
                  {redTeamState === "running" ? "Running Red Team analysis…" : `Red Team Pre-Flight: ${redTeamChallenges.length} challenge${redTeamChallenges.length !== 1 ? "s" : ""} identified`}
                </p>
              </div>
              <p style={{ fontSize: 15, color: "#9ca3af", margin: 0 }}>
                {redTeamState === "running"
                  ? "Checking your answers for contradictions, blind spots, and unvalidated assumptions before generating the report."
                  : `Review these before generating the ${activeStage.name} report. You can proceed anyway or go back and address them.`}
              </p>
            </div>
            {/* Challenges list */}
            {redTeamState === "shown" && redTeamChallenges.length > 0 && (
              <div style={{ padding: "24px 36px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: 1 }}>
                {redTeamChallenges.map((c, i) => {
                  const sevColor = c.severity === "critical" ? "#fee2e2" : c.severity === "high" ? "#fef3c7" : "#f3f4f6";
                  const sevText = c.severity === "critical" ? "#991b1b" : c.severity === "high" ? "#92400e" : "#374151";
                  return (
                    <div key={i} style={{ padding: "18px 22px", borderRadius: 10, background: sevColor, border: `1px solid ${sevText}22` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: sevText }}>{c.severity}</span>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>{c.title}</p>
                      </div>
                      <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.65 }}>{c.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Running spinner body */}
            {redTeamState === "running" && (
              <div style={{ padding: "48px 36px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <div style={{ width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#111827", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                <p style={{ fontSize: 16, color: "#6b7280", margin: 0 }}>Analysing your answers…</p>
              </div>
            )}
            {/* Footer buttons */}
            {redTeamState === "shown" && (
              <div style={{ padding: "18px 36px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
                <button
                  onClick={() => { setRedTeamState("acknowledged"); handleRunReport(); }}
                  style={{ padding: "12px 28px", background: "#111827", color: "#fff", border: "none", borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Acknowledged — Generate Report Anyway
                </button>
                <button
                  onClick={() => setRedTeamState("idle")}
                  style={{ padding: "12px 20px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 15, color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ASK ME MODAL */}
      {chatModalOpen && isReportComplete && (
        <div
          onClick={() => setChatModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", overflow: "hidden" }}
          >
            {/* Chat modal header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>Ask the {activeStage.name} Report</p>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Ask follow-up questions about this analysis</p>
                </div>
              </div>
              <button
                onClick={() => setChatModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {(chatMessages[activeStageId] ?? []).length === 0 && !chatLoading[activeStageId] && !chatStreaming[activeStageId] && (
                <>
                  <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", margin: "8px 0 16px" }}>Try one of these questions or type your own below</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 8 }}>
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
                </>
              )}
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
            {/* Chat input */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
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
                  placeholder={`Ask a question about the ${activeStage.name} report\u2026`}
                  disabled={chatLoading[activeStageId]}
                  rows={2}
                  style={{ flex: 1, padding: "10px 14px", fontSize: 13, border: "1.5px solid #e5e7eb", borderRadius: 10, resize: "none", fontFamily: "inherit", color: "#111827", outline: "none", background: chatLoading[activeStageId] ? "#f9fafb" : "#fff" }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button
                  onClick={() => handleChatSend(activeStageId)}
                  disabled={chatLoading[activeStageId] || !(chatInput[activeStageId] ?? "").trim()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "10px 18px", fontSize: 13, fontWeight: 700,
                    background: "#111827", color: "#fff",
                    border: "none", borderRadius: 10,
                    cursor: (chatLoading[activeStageId] || !(chatInput[activeStageId] ?? "").trim()) ? "not-allowed" : "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    opacity: (chatLoading[activeStageId] || !(chatInput[activeStageId] ?? "").trim()) ? 0.35 : 1,
                    transition: "opacity 150ms",
                  }}
                >
                  {chatLoading[activeStageId] ? "\u2026" : "Send"}
                  {!chatLoading[activeStageId] && (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M8 4l3 3-3 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>Press Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate confirmation dialog */}
      {regenConfirmOpen && (
        <div
          onClick={() => setRegenConfirmOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, maxWidth: 440, width: "100%", padding: "32px 32px 28px", boxShadow: "0 16px 48px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
              </span>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>Regenerate report?</p>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>This will delete your current report. Your answers will be kept.</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "0 0 24px", background: "#f9fafb", borderRadius: 8, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
              The existing {activeStage.name} report will be permanently deleted and a new one generated from your current answers. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setRegenConfirmOpen(false)}
                style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#374151", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRegenConfirmOpen(false);
                  setReportModalOpen(false);
                  updateStage(activeStageId, { reportStatus: "none", report: null });
                  setRedTeamState("idle");
                }}
                style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700, color: "#fff", background: "#dc2626", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}
              >
                Yes, regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Three-column body */}
      {(() => {
        const hero = STAGE_HERO[activeStage.id];
        const KB_SLOTS_BY_STAGE: Record<string, { name: string; desc: string }[]> = {
          frame: [
            { name: "Board deck", desc: "Latest board presentation" },
            { name: "CEO priorities", desc: "Current strategic priorities" },
            { name: "Product strategy", desc: "Product roadmap & strategy doc" },
            { name: "GTM plan", desc: "Go-to-market plan & execution" },
            { name: "Org / ownership", desc: "Org chart & ownership map" },
          ],
          diagnose: [
            { name: "Revenue / retention", desc: "ARR, NRR, churn metrics" },
            { name: "Product usage", desc: "Feature adoption & engagement data" },
            { name: "Win / loss", desc: "Recent deal outcomes & reasons" },
            { name: "Customer research", desc: "Interviews, surveys, NPS verbatims" },
            { name: "Support themes", desc: "Top tickets & friction patterns" },
          ],
          decide: [
            { name: "Strategic options", desc: "Options under active consideration" },
            { name: "Market sizing", desc: "TAM / SAM / SOM analysis" },
            { name: "Segment economics", desc: "Unit economics by segment" },
            { name: "Capability gaps", desc: "Build vs buy vs partner analysis" },
            { name: "Risks / assumptions", desc: "Key unknowns & dependencies" },
          ],
          position: [
            { name: "Positioning / messaging", desc: "Current messaging & value props" },
            { name: "ICP / personas", desc: "Ideal customer profile definitions" },
            { name: "Call insights", desc: "Sales call recordings or summaries" },
            { name: "Competitor comparisons", desc: "Battle cards & feature matrices" },
            { name: "Case studies", desc: "Customer stories & proof points" },
          ],
          commit: [
            { name: "Roadmap", desc: "Current product & GTM roadmap" },
            { name: "Resource plan", desc: "Headcount & budget allocation" },
            { name: "OKRs / KPIs", desc: "Existing objectives & metrics" },
            { name: "Governance cadence", desc: "Review rhythms & decision rights" },
            { name: "Dependencies / priorities", desc: "Cross-functional constraints" },
          ],
        };
        const KB_SLOTS = KB_SLOTS_BY_STAGE[activeStage.id] ?? KB_SLOTS_BY_STAGE.frame;
        const answeredCountStatus = activeStage.questions.filter((q) => {
          const a = activeState.answers[q.id];
          if (!a) return false;
          if (Array.isArray(a)) return a.length > 0;
          if (typeof a === "string") return a.trim().length > 0;
          return false;
        }).length;
        const totalCountStatus = activeStage.questions.length;
        return (
          <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: "hidden" }}>

            {/* LEFT INFO PANEL — stage definition + report sections nav */}
            {!isMobile && (
              <div style={{ width: 220, borderRight: "1px solid #e5e7eb", overflowY: "auto", padding: "24px 16px 40px 12px", flexShrink: 0, background: "#fff" }}>
                {/* Stage badge + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#111827", color: "#a3e635", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {currentStageIdx + 1}
                  </span>
                  <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1.2 }}>{activeStage.name}</h1>
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px", paddingLeft: 38, lineHeight: 1.4 }}>{hero?.goal}</p>

                {/* DEFINITION */}
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 8px" }}>DEFINITION</p>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: "0 0 24px" }}>{hero?.description}</p>

                {/* REPORT SECTIONS — always visible; clickable once report is complete */}
                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 8px" }}>REPORT SECTIONS</p>
                  {getReportPillsForStage(activeStage.id).map((pill) => (
                    <button
                      key={pill.label}
                      onClick={() => {
                        if (!isReportComplete) return;
                        setActivePillLabel(pill.label);
                        setReportModalOpen(true);
                        setTimeout(() => {
                          const el = document.getElementById(pill.anchor);
                          if (el) {
                            const y = el.getBoundingClientRect().top + window.scrollY - 120;
                            window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
                          }
                        }, 100);
                      }}
                      style={{ display: "block", width: "100%", textAlign: "left" as const, padding: "6px 8px", marginBottom: 2, fontSize: 14, background: isReportComplete && activePillLabel === pill.label ? "#f3f4f6" : "none", border: "none", borderRadius: 6, color: isReportComplete ? "#374151" : "#9ca3af", cursor: isReportComplete ? "pointer" : "default", fontFamily: "inherit" }}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 80px" : "24px 32px 80px" }}>
              {/* Mobile-only stage header */}
              {isMobile && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#111827", color: "#a3e635", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {currentStageIdx + 1}
                  </span>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>{activeStage.name}</h1>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{hero?.goal}</p>
                  </div>
                </div>
              )}


                  {/* Definition — mobile only (desktop shows it in left info panel) */}
                  {isMobile && (
                    <div style={{ marginBottom: 24 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 8px" }}>DEFINITION</p>
                      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>{hero?.description ?? activeStage.purpose}</p>
                    </div>
                  )}

                  {/* Progress banner (not generating) */}
                  {!isGenerating && (() => {
                    const answeredCount = activeStage.questions.filter((q) => {
                      const a = activeState.answers[q.id];
                      if (!a) return false;
                      if (Array.isArray(a)) return a.length > 0;
                      if (typeof a === "string") return a.trim().length > 0;
                      return false;
                    }).length;
                    const totalCount = activeStage.questions.length;
                    const skippedCount = activeStage.questions.filter((q, qi) => {
                      if (q.required !== false) return false;
                      const a = activeState.answers[q.id];
                      const hasAnswer = a && (Array.isArray(a) ? a.length > 0 : typeof a === "string" ? a.trim().length > 0 : true);
                      return !hasAnswer && qi < activeState.currentQuestion;
                    }).length;
                    const remaining = totalCount - answeredCount - skippedCount;
                    const pct = totalCount > 0 ? Math.round(((answeredCount + skippedCount) / totalCount) * 100) : 100;
                    return (
                      <div style={{ marginBottom: 28, background: "#111827", borderRadius: 10, padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Answer questions to generate your report</p>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "3px 10px" }}>
                            {answeredCount}/{totalCount} completed{skippedCount > 0 ? `, ${skippedCount} skipped` : ""}
                          </span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                          <div style={{ height: "100%", background: "#a3e635", borderRadius: 2, width: `${pct}%`, transition: "width 300ms ease-out" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>{remaining > 0 ? `${remaining} question${remaining !== 1 ? "s" : ""} remaining` : "All questions answered"}</p>
                          {allAnswered && redTeamState === "idle" && !isReportComplete && (
                            <button
                              onClick={handleRedTeamCheck}
                              style={{ fontSize: 13, fontWeight: 700, color: "#111827", background: "#a3e635", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}
                            >
                              Generate Report
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Generating banner */}
                  {isGenerating && (
                    <div style={{ marginBottom: 28, background: "#000", borderRadius: 10, padding: "16px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>
                          Generating {activeStage.name} report...
                        </p>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "0 0 2px", whiteSpace: "nowrap" }}>{progressMessage}</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0, whiteSpace: "nowrap" }}>~3–5 min</p>
                        </div>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
                        <div style={{ height: "100%", background: "#fff", borderRadius: 2, width: `${progressValue}%`, transition: "width 150ms ease-out" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(163,230,53,0.8)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                          We&apos;ll email you when your report is ready — you can safely leave this page
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Commit stage warnings */}
                  {activeStageId === "commit" && !allAnswered && !isGenerating && (() => {
                    const issues: string[] = [];
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

                  {/* QUESTIONS & ANSWERS heading */}
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 12px" }}>QUESTIONS &amp; ANSWERS</p>

                  {/* Questions list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: isGenerating ? 0.4 : 1, pointerEvents: isGenerating ? "none" : "auto", transition: "opacity 200ms" }}>
                    {activeStage.questions.map((q, qIdx) => {
                      const answerVal = activeState.answers[q.id];
                      const hasAns = (() => {
                        if (!answerVal) return false;
                        if (Array.isArray(answerVal)) return answerVal.length > 0;
                        if (typeof answerVal === "string") return answerVal.trim().length > 0;
                        return true;
                      })();
                      const isCurrent = qIdx === activeState.currentQuestion && !allAnswered && !isGenerating;
                      const isFuture = !hasAns && !isCurrent;

                      return (
                        <div key={q.id} style={{
                          border: isCurrent ? "1.5px solid #111827" : hasAns ? "1px solid #e5e7eb" : "1px solid #f3f4f6",
                          borderRadius: 10,
                          background: "#fff",
                          overflow: "hidden",
                          transition: "border-color 200ms, background 200ms",
                        }}>
                          {/* Question header row */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: isCurrent ? "14px 16px 0" : "12px 16px" }}>
                            {/* Status icon */}
                            {hasAns ? (
                              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </span>
                            ) : (
                              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${isCurrent ? "#111827" : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, color: isCurrent ? "#111827" : "#9ca3af", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                                {isCurrent ? <svg width="6" height="6" viewBox="0 0 6 6" fill="none"><circle cx="3" cy="3" r="3" fill="#111827"/></svg> : <span>{"\u2212"}</span>}
                              </span>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: isCurrent ? 700 : 600, color: isFuture ? "#9ca3af" : "#111827", margin: 0, lineHeight: 1.4 }}>
                                {q.question}
                                {q.required === false && <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>(optional)</span>}
                              </p>
                              {/* Answer summary — shown when answered and not currently editing */}
                              {hasAns && !isCurrent && (() => {
                                // Repeater answers: show structured mini-cards
                                if (Array.isArray(answerVal) && answerVal.length > 0 && typeof answerVal[0] === "object" && !Array.isArray(answerVal[0])) {
                                  const entries = answerVal as RepeaterEntry[];
                                  return (
                                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                                      {entries.map((entry, i) => {
                                        const name = entry["Bet name"] || entry["Action"] || entry["Milestone"] || Object.values(entry).find(v => v) || `Entry ${i + 1}`;
                                        const betType = (entry["Type"] || entry["type"]) as string | undefined;
                                        const badgeColor = betType === "Strategic" ? "#1e40af" : betType === "Capability" ? "#065f46" : betType === "Sequencing" ? "#92400e" : "#1e40af";
                                        const badgeBg = betType === "Strategic" ? "#dbeafe" : betType === "Capability" ? "#d1fae5" : betType === "Sequencing" ? "#fef3c7" : "#dbeafe";
                                        return (
                                          <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7, padding: "7px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                                            {betType && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: badgeColor, background: badgeBg, borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{betType}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                // All other answer types: compact chip summary
                                const chips = getAnswerDisplay(answerVal as AnswerValue);
                                const shown = chips.slice(0, 3);
                                const extra = chips.length - shown.length;
                                return (
                                  <p style={{ fontSize: 12, color: "#6b7280", margin: "3px 0 0", lineHeight: 1.5 }}>
                                    {shown.join(", ")}{extra > 0 ? ` +${extra} more` : ""}
                                  </p>
                                );
                              })()}
                            </div>
                            {/* Edit button */}
                            {hasAns && !isCurrent && qIdx < activeState.currentQuestion && (
                              <button
                                onClick={() => updateStage(activeStageId, { currentQuestion: qIdx })}
                                style={{ fontSize: 11, color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                              >
                                Edit
                              </button>
                            )}
                          </div>

                          {/* Current question input */}
                          {isCurrent && (
                            <div style={{ padding: "12px 16px 16px", paddingLeft: 50 }}>
                              {/* AI bet suggestions for Commit / strategic_bets */}
                              {activeStageId === "commit" && q.id === "strategic_bets" && (() => {
                                const currentEntries = Array.isArray(currentAnswer) ? currentAnswer as Array<Record<string,string>> : [];
                                const max = q.maxSelections ?? 3;
                                if (!betsFetched && !betsLoading) {
                                  setBetsFetched(true);
                                  setBetsLoading(true);
                                  const priorSections: Record<string, Record<string, unknown>> = {};
                                  for (const sid of ["frame", "diagnose", "decide", "position"]) {
                                    const s = (stageStates[sid]?.reportSections ?? initialCompletedOutputs[sid]) as Record<string, unknown> | undefined;
                                    if (s) priorSections[sid] = s;
                                  }
                                  const frameAnswers = stageStates["frame"]?.answers ?? {};
                                  const persona = typeof frameAnswers["persona"] === "string" ? frameAnswers["persona"] : undefined;
                                  fetch("/api/strategy/suggest-bets", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ companyName, persona, priorSections }),
                                  })
                                    .then((r) => r.json())
                                    .then((data) => {
                                      const raw = (data as { bets?: BetSuggestion[] }).bets ?? [];
                                      setBetSuggestions(raw.sort((a, b) => (a["Type"] === "Strategic" ? -1 : a["Type"] === "Capability" ? 0 : 1) - (b["Type"] === "Strategic" ? -1 : b["Type"] === "Capability" ? 0 : 1)));
                                    })
                                    .catch(() => { /* silent fail */ })
                                    .finally(() => setBetsLoading(false));
                                }
                                const addedNames = new Set(currentEntries.map((e) => e["Bet name"]));
                                const available = betSuggestions.filter((b) => !addedNames.has(b["Bet name"]));
                                return (
                                  <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                      <p style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                                        AI-suggested strategic bets from your analysis — select up to 5 to commit to
                                      </p>
                                      {betSuggestions.length > 0 && (
                                        <span style={{ fontSize: 14, color: "#6b7280" }}>{available.length} available</span>
                                      )}
                                    </div>
                                    {available.length > 0 && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
                                        {available.map((bet, i) => (
                                          <div key={i} style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "16px 18px", position: "relative" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                <p style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1.3 }}>{bet["Bet name"]}</p>
                                                {bet["Type"] && (
                                                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: bet["Type"] === "Strategic" ? "#1e40af" : bet["Type"] === "Capability" ? "#065f46" : "#92400e", background: bet["Type"] === "Strategic" ? "#dbeafe" : bet["Type"] === "Capability" ? "#d1fae5" : "#fef3c7", borderRadius: 4, padding: "2px 8px", alignSelf: "flex-start" }}>
                                                    {bet["Type"]}
                                                  </span>
                                                )}
                                              </div>
                                              <button
                                                disabled={currentEntries.length >= max}
                                                onClick={() => { if (currentEntries.length >= max) return; handleAnswer([...currentEntries, { ...bet }]); }}
                                                style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 20, border: "none", background: currentEntries.length >= max ? "#e5e7eb" : "#111827", color: currentEntries.length >= max ? "#9ca3af" : "#fff", cursor: currentEntries.length >= max ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" as const }}
                                              >
                                                {currentEntries.length >= max ? "Full" : "+ Add bet"}
                                              </button>
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                              {[["Hypothesis", "#6b7280", "#f3f4f6"], ["Minimum viable test", "#1e40af", "#dbeafe"]].map(([label, color, bg]) => {
                                                const text = bet[label as keyof typeof bet] ?? "";
                                                return (
                                                  <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "2px 8px", flexShrink: 0, marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em", minWidth: 76, textAlign: "center" as const }}>{label}</span>
                                                    <span style={{ fontSize: 20, color: "#374151", lineHeight: 1.6 }}>{text}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {betsLoading && (
                                      <div style={{ background: "#111827", borderRadius: 12, padding: "22px 24px", marginBottom: 10 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#a3e635", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
                                          <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Generating strategic bets from your analysis</p>
                                        </div>
                                        <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Synthesising Frame → Position findings. Takes 10–20 seconds.</p>
                                      </div>
                                    )}
                                    {!betsLoading && available.length === 0 && betsFetched && (
                                      <div style={{ background: "#f9fafb", border: "1.5px dashed #e5e7eb", borderRadius: 10, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                                        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                                          {betSuggestions.length > 0
                                            ? "All suggested bets added — add more below or run the report."
                                            : "No suggestions generated — complete prior stages first or add your own bets below."}
                                        </p>
                                        {betSuggestions.length === 0 && (
                                          <button
                                            onClick={() => { setBetsFetched(false); }}
                                            style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#111827", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}
                                          >
                                            Retry
                                          </button>
                                        )}
                                      </div>
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
                                question={q}
                                answer={activeState.answers[q.id]}
                                onChange={handleAnswer}
                              />
                              <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
                                <button
                                  onClick={handleNext}
                                  disabled={q.required !== false && !isAnswerValid(q, activeState.answers[q.id])}
                                  style={{
                                    padding: "10px 24px",
                                    background: (q.required === false || isAnswerValid(q, activeState.answers[q.id])) ? "#111827" : "#e5e7eb",
                                    color: (q.required === false || isAnswerValid(q, activeState.answers[q.id])) ? "#fff" : "#9ca3af",
                                    border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13,
                                    cursor: (q.required === false || isAnswerValid(q, activeState.answers[q.id])) ? "pointer" : "not-allowed",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  {qIdx === activeStage.questions.length - 1 ? "Review answers" : "Next"}
                                </button>
                                {q.required === false && (
                                  <button
                                    onClick={handleNext}
                                    style={{ padding: "10px 20px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, fontWeight: 500, fontSize: 13, color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}
                                  >
                                    Skip
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Run report gate (when all answered) */}
                  {allAnswered && !isGenerating && (
                    <div style={{ marginTop: 24 }}>
                      {activeState.reportFailed && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 12 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                            The previous attempt didn&apos;t complete. Click Retry to try again — this usually succeeds on a second attempt.
                          </p>
                        </div>
                      )}
                      {/* Red team states handled via modal — no inline block needed */}
                      {/* Generate button: shown when acknowledged or shown with 0 challenges */}
                      {(redTeamState === "acknowledged" || (redTeamState === "shown" && redTeamChallenges.length === 0)) && (
                        <button
                          onClick={() => { updateStage(activeStageId, { reportFailed: false }); handleRunReport(); }}
                          style={{ padding: "14px 32px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polygon points="3,1.5 13,7 3,12.5" fill="white" /></svg>
                          {activeState.reportFailed ? "Retry Report" : activeStage.runButtonLabel}
                        </button>
                      )}
                      {/* idle state: show run button */}
                      {redTeamState === "idle" && !activeState.reportFailed && (
                        <button
                          onClick={handleRedTeamCheck}
                          style={{ padding: "14px 32px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polygon points="3,1.5 13,7 3,12.5" fill="white" /></svg>
                          {activeStage.runButtonLabel}
                        </button>
                      )}
                      {redTeamState === "idle" && activeState.reportFailed && (
                        <button
                          onClick={() => { updateStage(activeStageId, { reportFailed: false }); handleRedTeamCheck(); }}
                          style={{ padding: "14px 32px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polygon points="3,1.5 13,7 3,12.5" fill="white" /></svg>
                          Retry Report
                        </button>
                      )}
                    </div>
                  )}

            </div>

            {/* RIGHT SIDEBAR — hidden on mobile */}
            {!isMobile && (
              <div style={{ width: 550, borderLeft: "1px solid #e5e7eb", flexShrink: 0, display: "flex", flexDirection: "row" }}>

                {/* LEFT SUB-COLUMN: KNOWLEDGE BASE */}
                <div style={{ width: 260, borderRight: "1px solid #e5e7eb", overflowY: "auto", padding: "20px 20px", flexShrink: 0, background: "#fafafa" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 8px" }}>KNOWLEDGE BASE</p>
                  <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 6px" }}>Uploading company-specific artifacts provides more context for deep reasoning.</p>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.05em" }}>Coming Soon</span>
                  {/* Document slots */}
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                    {KB_SLOTS.map((slot) => (
                      <div key={slot.name} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, opacity: 0.6 }}>
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 1 }}><rect x="1" y="5" width="10" height="8" rx="1.5" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" strokeLinecap="round" /></svg>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 1px", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{slot.name}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{slot.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: "10px 0 0" }}>0 of 5 slots filled</p>
                </div>

                {/* RIGHT SUB-COLUMN: REPORT, GENERATION, NEXT STAGE, STATUS */}
                <div style={{ flex: 1, overflowY: "auto", background: "#fafafa" }}>

                  {/* REPORT — dark card */}
                  <div style={{ margin: "16px 16px 0", background: "#111827", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#9ca3af", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="#9ca3af" strokeWidth="1.5"><rect x="2" y="1" width="10" height="12" rx="1.5" /><path d="M4 4h6M4 7h6M4 10h4" strokeLinecap="round" /></svg>
                        REPORT
                      </p>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M3 7h8M8 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <button
                      onClick={() => { if (isReportComplete) setReportModalOpen(true); }}
                      style={{ background: "none", border: "none", cursor: isReportComplete ? "pointer" : "default", padding: 0, textAlign: "left", width: "100%", fontFamily: "inherit" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 18, fontWeight: 700, color: isReportComplete ? "#4ade80" : "#d1d5db", margin: 0 }}>View Report</p>
                        {isReportComplete && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#4ade80", background: "rgba(74,222,128,0.12)", borderRadius: 20, padding: "2px 7px" }}>READY</span>
                        )}
                        {!isReportComplete && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#9ca3af", background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "2px 7px" }}>NOT RUN</span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: isReportComplete ? "#6ee7a0" : "#9ca3af", margin: 0 }}>{activeStage.name} · Exec Summary</p>
                    </button>
                  </div>

                  {/* Export PDF + Share — below dark card */}
                  {isReportComplete && (
                    <div style={{ margin: "8px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        onClick={() => { if (activeState.reportSections) downloadReportPDF(activeStage.name, companyName, activeState.reportSections, activeState.report); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "inherit", width: "100%" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Export PDF
                      </button>
                      <ShareButton stageId={activeStageId} stageName={activeStage.name} reportSections={activeState.reportSections} fullWidth />
                    </div>
                  )}

                  {/* GENERATION */}
                  {isReportComplete && (
                    <div style={{ padding: "16px 16px", borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 10px" }}>GENERATION</p>
                      <button
                        onClick={() => setRegenConfirmOpen(true)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit", width: "100%", transition: "background 150ms" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                        Generate Report
                      </button>
                    </div>
                  )}

                  {/* NEXT STAGE — locked until report complete */}
                  {nextStage && (
                    <div style={{ padding: "16px 16px", borderTop: "1px solid #e5e7eb", opacity: isReportComplete ? 1 : 0.4, transition: "opacity 300ms" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 10px" }}>NEXT STAGE</p>
                      <button
                        onClick={() => { if (isReportComplete) handleContinue(); }}
                        style={{ display: "block", width: "100%", textAlign: "left" as const, padding: "14px 16px", background: isReportComplete ? "#f0fdf4" : "#f9fafb", border: `1px solid ${isReportComplete ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 10, cursor: isReportComplete ? "pointer" : "not-allowed", fontFamily: "inherit" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: isReportComplete ? "#059669" : "#9ca3af", margin: 0 }}>STAGE {currentStageIdx + 2}</p>
                          {isReportComplete
                            ? <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="#059669" strokeWidth="1.5"><path d="M3 7h8M8 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" /></svg>
                          }
                        </div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: isReportComplete ? "#111827" : "#6b7280", margin: "0 0 4px" }}>{nextStage.name}</p>
                        <p style={{ fontSize: 12, color: isReportComplete ? "#059669" : "#9ca3af", margin: 0, lineHeight: 1.4 }}>
                          {isReportComplete ? STAGE_HERO[nextStage.id]?.goal ?? "" : "Complete this report to unlock"}
                        </p>
                      </button>
                    </div>
                  )}

                  {/* STATUS */}
                  <div style={{ padding: "16px 16px", borderTop: "1px solid #e5e7eb" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 12px" }}>STATUS</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>Questions</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: answeredCountStatus === totalCountStatus ? "#059669" : "#374151", background: answeredCountStatus === totalCountStatus ? "#d1fae5" : "#f3f4f6", borderRadius: 20, padding: "2px 10px" }}>{answeredCountStatus}/{totalCountStatus} answered</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>KB docs</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", background: "#dbeafe", borderRadius: 20, padding: "2px 10px" }}>0/5 indexed</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>Report</span>
                        {isGenerating ? (
                          <span style={{ fontSize: 12, fontWeight: 600, background: "#dbeafe", color: "#1d4ed8", borderRadius: 20, padding: "2px 10px" }}>Generating...</span>
                        ) : isReportComplete ? (
                          <span style={{ fontSize: 12, fontWeight: 600, background: "#d1fae5", color: "#059669", borderRadius: 20, padding: "2px 10px" }}>Ready</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>Not started</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
