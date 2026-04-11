"use client";
// v3
import React, { useState, useEffect, useRef } from "react";

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
  repeaterFields?: string[]; // field labels for structured-repeater
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

const STAGE_HERO: Record<string, { tagline: string; description: string; goal: string; deliverables: string[] }> = {
  frame: {
    tagline: "Frame",
    description: "Build a clear frame around the decision: what has specifically changed, what the business needs to achieve in 24 to 36 months, and where the boundaries actually sit. Surface who has genuine authority to act on the output, and establish a shared understanding of the challenge that every subsequent stage depends on. Sharper framing here means fewer wasted cycles downstream.",
    goal: "Define exactly what is changing, what winning looks like in this context, and the boundaries of the decision you are here to make.",
    deliverables: ["Executive Summary", "What Matters Most", "Recommendation", "Risks", "Actions", "Monitoring"],
  },
  diagnose: {
    tagline: "Diagnose",
    description: "Build a structured fact base across product-market fit, competitive position, unit economics, and operational capability — assessed against what the chosen direction will actually require. Separate the gaps that will constrain your options from the noise, and produce a shared, evidence-based view of position that makes the decision conversation significantly more productive.",
    goal: "Build an honest, structured fact base across product, market, and operations — before any strategic direction is chosen.",
    deliverables: ["Executive Summary", "What Matters Most", "Recommendation", "Risks", "Actions", "Monitoring"],
  },
  decide: {
    tagline: "Decide",
    description: "Surface the genuine strategic options — including inaction, which carries its own cost — and pressure-test each one against what would need to be true for it to succeed. Drawing on Roger Martin's Playing to Win framework, work backwards from winning conditions, set explicit criteria for when you would change course, and structure a staged investment logic that avoids single-bet exposure. The output is a committed direction with the assumptions and trade-offs made visible.",
    goal: "Commit to a strategic direction — with explicit assumptions, kill criteria, and the conditions under which you would reverse it.",
    deliverables: ["Executive Summary", "What Matters Most", "Recommendation", "Risks", "Actions", "Monitoring"],
  },
  position: {
    tagline: "Position",
    description: "Translate strategic direction into a precise market stance — defining who the business serves, what job it does better than any available alternative, and which structural advantages it is building toward. Drawing on Hamilton Helmer's 7 Powers framework, identify the specific sources of defensibility available at this stage and what building toward them requires. The output gives product, GTM, and commercial teams a single coherent position to operate from.",
    goal: "Define precisely who you serve, what you do better than any alternative, and how you will build a defensible position over time.",
    deliverables: ["Executive Summary", "What Matters Most", "Recommendation", "Risks", "Actions", "Monitoring"],
  },
  commit: {
    tagline: "Commit",
    description: "Translate direction into execution: a portfolio of bets with clear ownership and metered funding gates, an OKR architecture that connects company-level strategy to team-level action, a 100-day plan that creates immediate accountability, and a governance rhythm that keeps the strategy live. The output functions as the operating system for the next phase of the business.",
    goal: "Translate strategic direction into a funded, governed, and time-bound execution plan that the whole leadership layer can be held to.",
    deliverables: ["Executive Summary", "What Matters Most", "Recommendation", "Risks", "Actions", "Monitoring"],
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
        hint: "Up to 3 bets. For each: name the bet and state the hypothesis.",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add Bet",
        repeaterFields: ["Bet name", "Hypothesis: We believe that [action] will result in [outcome] because [rationale]"],
      },
      {
        id: "okrs",
        required: true,
        question: "What are the top 3 company-level objectives for the next 12 months?",
        hint: "For each: an objective (qualitative direction) and a key result (quantitative success measure).",
        type: "structured-repeater",
        maxSelections: 3,
        addLabel: "Add OKR",
        repeaterFields: ["Objective (qualitative)", "Key result (quantitative — what counts as success?)"],
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

function renderInlineContent(text: string): React.ReactNode[] {
  // Handle **bold**, _italic_, and URLs
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ fontWeight: 700, color: "#111827" }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return <em key={i} style={{ fontStyle: "italic", color: "#6b7280" }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{ color: "#2563eb", wordBreak: "break-all", textDecoration: "none" }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
        >{part}</a>
      );
    }
    return part;
  });
}

function renderReport(text: string): React.ReactNode {
  const blocks = text.split(/\n\n+/);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const trimmed = blocks[i].trim();
    if (!trimmed) continue;

    // ## Heading
    if (trimmed.startsWith("## ")) {
      const heading = trimmed.slice(3);
      const sectionId = "section-" + heading.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      nodes.push(
        <p key={i} id={sectionId} style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10, marginTop: nodes.length === 0 ? 0 : 28 }}>
          {heading}
        </p>
      );
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
            return (
              <div key={j} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 1 }}>
                  {match[1]}
                </span>
                <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, flex: 1 }}>{renderInlineContent(match[2])}</span>
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
          <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, flex: 1 }}>{renderInlineContent(singleNumbered[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet list block (lines starting with "- ")
    if (lines.every((l) => l.trimStart().startsWith("- "))) {
      nodes.push(
        <ul key={i} style={{ margin: "0 0 16px", paddingLeft: 20 }}>
          {lines.map((l, j) => (
            <li key={j} style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 6 }}>
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
                  <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{renderInlineContent(t.slice(2))}</span>
                </div>
              );
            }
            return <p key={j} style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: "0 0 6px" }}>{renderInlineContent(t)}</p>;
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
            <p key={j} style={{ fontSize: 13, lineHeight: 1.7, color: "#374151", margin: j === 0 ? "0 0 2px" : "0" }}>
              {renderInlineContent(l)}
            </p>
          ))}
        </div>
      );
    } else {
      nodes.push(
        <p key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#374151", marginBottom: 16, marginTop: 0 }}>
          {renderInlineContent(trimmed)}
        </p>
      );
    }
  }

  return <>{nodes}</>;
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
        fontSize: 13,
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

    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {entries.map((entry, idx) => (
            <div
              key={idx}
              style={{
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                padding: "16px 18px",
                background: "#fff",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Entry {idx + 1}
                </span>
                <button
                  onClick={() => removeEntry(idx)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    fontSize: 13,
                    lineHeight: 1,
                    padding: "0 4px",
                    fontFamily: "inherit",
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {fields.map((field) => (
                  <div key={field}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
                      {field}
                    </label>
                    <textarea
                      value={entry[field] ?? ""}
                      onChange={(e) => updateEntry(idx, field, e.target.value)}
                      placeholder={field}
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
            </div>
          ))}
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
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#9ca3af",
                  marginBottom: 8,
                  marginTop: 0,
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

// ─── Share Button ─────────────────────────────────────────────────────────────

function ShareButton({ stageId, stageName, reportSections }: { stageId: string; stageName: string; reportSections?: Record<string, unknown> }) {
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
      const data = await res.json() as { mailtoHref?: string };
      if (data.mailtoHref) window.location.href = data.mailtoHref;
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
    <div style={{ position: "relative", display: "inline-block", marginRight: 8 }}>
      <button
        onClick={() => { setOpen((o) => !o); setSent(false); setError(""); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
          padding: "7px 14px", fontSize: 13, fontWeight: 500, color: "#6b7280",
          cursor: "pointer", fontFamily: "inherit",
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function StrategyFlow({
  initialRunningJobs = [],
  initialCompletedOutputs = {},
}: {
  initialRunningJobs?: { stageId: string; sessionId: string }[];
  initialCompletedOutputs?: Record<string, Record<string, unknown>>;
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
      lines.push(`## Confidence\n\n**Score:** ${pct}\n\n${conf.rationale ?? ""}`);
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
      lines.push(`## Monitoring\n\n${monLines.join("\n\n")}`);
    }
    const eb = sections.evidence_base as { sources?: string[]; quotes?: string[] } | undefined;
    if (eb?.sources && eb.sources.length > 0) {
      lines.push(`## Sources\n\n${eb.sources.map((s) => `- ${s}`).join("\n")}`);
    }
    return lines.join("\n\n---\n\n");
  }

  const initialState: Record<string, StageState> = {};
  STAGES.forEach((stage) => {
    const runningJob = initialRunningJobs.find((j) => j.stageId === stage.id);
    const completedSections = initialCompletedOutputs[stage.id];
    initialState[stage.id] = {
      status: "active",
      answers: {},
      currentQuestion: 0,
      reportStatus: runningJob ? "generating" : completedSections ? "complete" : "none",
      report: completedSections ? sectionsToMarkdownInit(completedSections) : null,
      reportSections: completedSections,
    };
  });

  const [stageStates, setStageStates] = useState<Record<string, StageState>>(initialState);
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
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Build prior stage summaries for cascade context
    const priorReports: { stageId: string; stageName: string; summary: string }[] = [];
    for (const stage of STAGES) {
      if (stage.id === activeStageId) break;
      const stageState = stageStates[stage.id];
      if (stageState?.reportSections) {
        const sections = stageState.reportSections;
        const execSummary = typeof sections.executive_summary === "string" ? sections.executive_summary : "";
        const whatMatters = typeof sections.what_matters === "string" ? sections.what_matters : "";
        const recommendation = typeof sections.recommendation === "string" ? sections.recommendation : "";
        priorReports.push({
          stageId: stage.id,
          stageName: stage.name,
          summary: [execSummary, whatMatters, recommendation].filter(Boolean).join("\n\n"),
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
    const currentIdx = STAGES.findIndex((s) => s.id === activeStageId);
    const nextStage = STAGES[currentIdx + 1];
    if (nextStage) {
      setActiveStageId(nextStage.id);
      setActiveTab("qa");
    }
  }

  const isGenerating = activeState.reportStatus === "generating";
  const isReportComplete = activeState.reportStatus === "complete";
  const currentStageIdx = STAGES.findIndex((s) => s.id === activeStageId);
  const nextStage = STAGES[currentStageIdx + 1];

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
      {/* Stage Navigation Rail */}
      <div
        style={{
          height: 112,
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          paddingLeft: 48,
          paddingRight: 48,
          gap: 0,
          background: "#fff",
          flexShrink: 0,
        }}
      >
        {STAGES.map((stage, idx) => {
          const state = stageStates[stage.id];
          const isActive = stage.id === activeStageId;
          const isComplete = state.status === "complete" || state.reportStatus === "complete";
          const isLocked = state.status === "locked";

          return (
            <div key={stage.id} style={{ display: "flex", alignItems: "center" }}>
              <button
                onClick={() => setActiveStageId(stage.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 10px",
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: isComplete ? "#059669" : isActive ? "#111827" : "#e5e7eb",
                    color: isComplete || isActive ? "#fff" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {isComplete ? (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isLocked ? "#9ca3af" : "#111827",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stage.name}
                </span>
              </button>
              {idx < STAGES.length - 1 && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ margin: "0 2px" }}>
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
            <div style={{ padding: "40px 48px 36px" }}>
              <h1 style={{ fontSize: 36, fontWeight: 800, color: "#111827", marginBottom: 6, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {activeStage.name}
              </h1>
              {hero?.goal && (
                <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 20, lineHeight: 1.5 }}>
                  Goal: {hero.goal}
                </p>
              )}
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 0 }}>
                {hero?.description ?? activeStage.purpose}
              </p>
            </div>
            {/* Deliverables strip */}
            {hero?.deliverables && (
              <div style={{ padding: "14px 48px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginRight: 4 }}>Outputs</span>
                {hero.deliverables.map((d) => {
                  const sectionId = "section-" + d.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  const canLink = activeState.reportStatus === "complete";
                  return canLink ? (
                    <button
                      key={d}
                      onClick={() => {
                        setActiveTab("report");
                        setTimeout(() => {
                          const el = document.getElementById(sectionId);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 50);
                      }}
                      style={{ fontSize: 13, fontWeight: 500, color: "#2563eb", background: "#fff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "4px 14px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {d}
                    </button>
                  ) : (
                    <span key={d} style={{ fontSize: 13, fontWeight: 500, color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "4px 14px" }}>
                      {d}
                    </span>
                  );
                })}
              </div>
            )}
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
            paddingLeft: 48,
            paddingRight: 48,
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
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 500,
                color: activeTab === tab ? "#111827" : "#6b7280",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #111827" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
                transition: "color 150ms",
              }}
            >
              {tab === "qa" ? "Questions & Answers" : `${activeStage.name} Report`}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {/* PDF download button */}
          <button
            onClick={async () => {
              const report = activeState.report;
              if (!report) return;
              const { jsPDF } = await import("jspdf");
              const doc = new jsPDF({ unit: "mm", format: "a4" });
              const pageW = doc.internal.pageSize.getWidth();
              const margin = 20;
              const maxW = pageW - margin * 2;

              // ── Logo (top-left, concentric squares + wordmark) ──
              const lx = margin;
              const ly = 14;
              const sz = 14; // outer square size in mm
              doc.setDrawColor(17, 24, 39);
              doc.setLineWidth(0.8);
              doc.rect(lx, ly, sz, sz); // outer
              doc.setLineWidth(0.6);
              const inset1 = 2.5;
              doc.rect(lx + inset1, ly + inset1, sz - inset1 * 2, sz - inset1 * 2); // mid
              const inset2 = 4.8;
              doc.rect(lx + inset2, ly + inset2, sz - inset2 * 2, sz - inset2 * 2); // inner
              // Wordmark
              const tx = lx + sz + 4;
              doc.setFont("helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(17, 24, 39);
              doc.text("THE", tx, ly + 4);
              doc.text("NTH", tx, ly + 8.5);
              doc.text("LAYER", tx, ly + 13);

              let y = ly + sz + 8;

              // Title
              doc.setFont("helvetica", "bold");
              doc.setFontSize(18);
              doc.setTextColor(17, 24, 39);
              doc.text(`${activeStage.name} Report`, margin, y);
              y += 8;
              doc.setFont("helvetica", "normal");
              doc.setFontSize(10);
              doc.setTextColor(156, 163, 175);
              doc.text(new Date().toLocaleDateString("en-GB"), margin, y);
              y += 10;

              const lines = report.split("\n");
              for (const line of lines) {
                if (y > 270) { doc.addPage(); y = 20; }
                if (line.startsWith("## ")) {
                  y += 4;
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(12);
                  doc.setTextColor(17, 24, 39);
                  doc.text(line.slice(3), margin, y);
                  y += 7;
                } else if (line === "---") {
                  doc.setDrawColor(229, 231, 235);
                  doc.setLineWidth(0.3);
                  doc.line(margin, y, pageW - margin, y);
                  y += 6;
                } else if (line.trim() === "") {
                  y += 3;
                } else {
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(10);
                  doc.setTextColor(55, 65, 81);
                  const plain = line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/_(.*?)_/g, "$1").replace(/^- /, "• ");
                  const wrapped = doc.splitTextToSize(plain, maxW);
                  for (const wline of wrapped) {
                    if (y > 275) { doc.addPage(); y = 20; }
                    doc.text(wline, margin, y);
                    y += 5;
                  }
                }
              }
              doc.save(`${activeStage.name}-Report.pdf`);
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
              padding: "7px 14px", fontSize: 13, fontWeight: 500, color: "#6b7280",
              cursor: "pointer", fontFamily: "inherit", marginRight: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </button>
          {/* Share button */}
          <ShareButton stageId={activeStageId} stageName={activeStage.name} reportSections={activeState.reportSections} />
          {nextStage ? (
            <button
              onClick={handleContinue}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Continue to {nextStage.name}
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#059669",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 7.5l4 4 7-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Strategy Complete
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {isReportComplete && activeTab === "report" ? (
        /* Report tab — full width */
        <div style={{ flex: 1, overflowY: "auto", padding: "48px 48px 80px" }}>
          <div id="report-print-area" style={{ maxWidth: 800 }}>
            {activeState.report && renderReport(activeState.report)}
          </div>
        </div>
      ) : (
        /* Q&A view — always shown (normal, generating, or Q&A tab when complete) */
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
            gap: 32,
            padding: "64px 48px 48px",
            pointerEvents: isGenerating ? "none" : "auto",
            opacity: isGenerating ? 0.6 : 1,
            transition: "opacity 200ms",
            position: "relative",
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
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>
                    Generating {activeStage.name} report...
                  </p>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        background: "#fff",
                        borderRadius: 2,
                        width: `${progressValue}%`,
                        transition: "width 150ms ease-out",
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
                  {progressMessage}
                </span>
              </div>
            </div>
          )}

          {/* Left: Question area */}
          <div
            style={{
              width: "55%",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              paddingTop: isGenerating ? 72 : 0,
            }}
          >
            {!allAnswered && !isGenerating ? (
              <>
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
                      onClick={handleRunReport}
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
