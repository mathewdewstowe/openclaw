import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PrintButton } from "../system-report/print-button";

export const dynamic = "force-dynamic";

const stages = [
  {
    num: "01",
    name: "Frame",
    slug: "frame",
    color: "#374151",
    bg: "#f9fafb",
    border: "#d1d5db",
    purpose: "Define the inflection point and establish what winning looks like.",
    questions: [
      {
        id: "persona",
        label: "Who is completing this session?",
        type: "Single-select",
        required: true,
        options: [
          "PE Partner / Principal",
          "VC Investor",
          "Portfolio Company CEO",
          "Portfolio Leadership Team",
          "Independent Advisor / Fractional CPO",
          "Other",
        ],
      },
      {
        id: "trigger",
        label: "What triggered this strategic review?",
        type: "Multi-select (max 3)",
        required: true,
        options: [
          "Growth has stalled or decelerated",
          "A competitor has made a significant move",
          "Approaching exit window or new funding round",
          "Pricing or revenue model is under pressure",
          "Technology shift is disrupting the category",
          "New leadership has joined",
          "Acquisition or merger has completed",
          "A key customer segment is churning",
          "Current trajectory runs out of runway",
          "Other",
        ],
      },
      {
        id: "lifecycle_stage",
        label: "Where is the business in its lifecycle?",
        type: "Single-select",
        required: true,
        options: [
          "Early growth — PMF established, scaling GTM",
          "Scaling — proven unit economics, expanding",
          "Optimising — mature core, driving efficiency",
          "Pre-exit — 12–24 months from exit",
          "Other",
        ],
      },
      {
        id: "winning_definition",
        label: "What does winning look like in 24–36 months?",
        type: "Multi-select (max 3)",
        required: true,
        options: [
          "Achieving a specific ARR or revenue target",
          "Reaching profitability or a target EBITDA margin",
          "Becoming the clear category leader in our segment",
          "Expanding into new geographies or verticals",
          "Completing a successful exit or secondary",
          "Building platform or ecosystem defensibility",
          "Demonstrating strong NRR and retention benchmarks",
          "Other",
        ],
      },
      {
        id: "risk_appetite",
        label: "What is the risk appetite for this move?",
        type: "Single-select",
        required: false,
        options: [
          "Conservative — protect core, incremental change only",
          "Moderate — improve trajectory with selective adjacencies",
          "Aggressive — willing to cannibalise existing revenue",
          "Transformational — full pivot or platform shift on the table",
          "Other",
        ],
      },
      {
        id: "investment_horizon",
        label: "What is the investment horizon for this strategy?",
        type: "Single-select",
        required: false,
        options: [
          "Immediate (0–6 months, fast payback required)",
          "Short-term (6–18 months)",
          "Medium-term (18–36 months)",
          "Long-term (36+ months)",
          "Other",
        ],
      },
      {
        id: "decision_maker",
        label: "Who is the primary decision-maker for this strategy?",
        type: "Single-select",
        required: false,
        options: [
          "CEO / Founder",
          "PE or VC Sponsor / Board",
          "CEO + Board jointly",
          "Incoming or new leadership team",
          "Other",
        ],
      },
      {
        id: "strategic_question",
        label: "In one sentence — what is the core strategic question you are trying to answer?",
        type: "Free text",
        required: true,
        placeholder: "e.g. Should we expand into enterprise or double down on our SMB base?",
        options: [],
      },
    ],
  },
  {
    num: "02",
    name: "Diagnose",
    slug: "diagnose",
    color: "#1e40af",
    bg: "#eff6ff",
    border: "#bfdbfe",
    purpose: "Assess current reality across market, customer, competitive, and capability dimensions.",
    questions: [
      {
        id: "pmf_status",
        label: "How would you characterise current product-market fit?",
        type: "Single-select",
        required: true,
        options: [
          "Strong — high NPS, excellent retention, customers expand",
          "Partial — works well for a subset, not broadly",
          "Fragile — wins are inconsistent, churn is a real concern",
          "Unclear — not yet rigorously tested",
          "Deteriorating — something has shifted in the market",
          "Other",
        ],
      },
      {
        id: "competitive_forces",
        label: "Which competitive forces are intensifying most right now?",
        type: "Multi-select (max 3)",
        required: true,
        options: [
          "New well-funded entrants targeting our space",
          "Existing competitors improving significantly",
          "Customers gaining more leverage or raising expectations",
          "Substitute or alternative solutions eroding demand",
          "Platform or supplier costs and control increasing",
          "Pricing pressure compressing margins",
          "Other",
        ],
      },
      {
        id: "unit_economics",
        label: "What does the unit economics picture look like?",
        type: "Single-select",
        required: true,
        options: [
          "Strong — LTV:CAC >3:1, payback <18 months, healthy margins",
          "Acceptable — close to benchmarks, areas to improve",
          "Mixed — strong on some metrics, weak on others",
          "Challenged — high CAC, long payback, or margin pressure",
          "Unknown — no clear visibility on these metrics yet",
          "Other",
        ],
      },
      {
        id: "arr_growth",
        label: "What is the current ARR growth rate?",
        type: "Single-select",
        required: true,
        options: [
          ">80% YoY",
          "50–80% YoY",
          "25–50% YoY",
          "10–25% YoY",
          "<10% YoY or declining",
          "Other",
        ],
      },
      {
        id: "customer_signals",
        label: "What is the customer base telling you?",
        type: "Multi-select (max 3)",
        required: false,
        options: [
          "Best customers are highly engaged and expanding",
          "Clear ICP but winning too often outside it",
          "Meaningful outcome variation across customer segments",
          "Churn concentrated in a specific segment or cohort",
          "Customers using the product for jobs we didn't design for",
          "Win rates declining against specific competitors",
          "Customers say they'd be very disappointed if we disappeared",
          "Other",
        ],
      },
      {
        id: "capability_gaps",
        label: "Where are the most significant internal capability gaps?",
        type: "Multi-select (max 3)",
        required: false,
        options: [
          "Product and engineering velocity or quality",
          "Sales capacity and process maturity",
          "Marketing and demand generation",
          "Customer success and retention",
          "Data and analytics capability",
          "Leadership and management depth",
          "Financial controls and reporting",
          "GTM alignment across sales, marketing, and product",
          "Other",
        ],
      },
      {
        id: "moat_status",
        label: "Which best describes the competitive moat today?",
        type: "Single-select",
        required: false,
        options: [
          "Strong and defensible — switching costs, network effects, or scale",
          "Narrow moat in a specific niche or segment",
          "Mainly product quality and customer relationships",
          "Limited differentiation — competing on price or service",
          "Moat is eroding as competitors catch up",
          "Other",
        ],
      },
      {
        id: "biggest_constraint",
        label: "What is the single biggest constraint on the business right now?",
        type: "Free text",
        required: true,
        placeholder: "e.g. We're winning deals but losing them at renewal — retention is the real constraint.",
        options: [],
      },
    ],
  },
  {
    num: "03",
    name: "Decide",
    slug: "decide",
    color: "#6d28d9",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    purpose: "Evaluate genuine strategic options and choose with clear criteria and kill conditions.",
    questions: [
      {
        id: "strategic_options",
        label: "Which strategic directions are genuinely on the table?",
        type: "Multi-select (max 4)",
        required: true,
        options: [
          "Double down on core — optimise what's working",
          "Move upmarket (enterprise or larger customers)",
          "Move downmarket (SMB, self-serve, or PLG)",
          "Expand into an adjacent product category",
          "Enter new geographies or verticals",
          "Shift the business model (usage-based, platform, or marketplace)",
          "Build or acquire to create a platform play",
          "Reposition to own a new or redefined category",
          "Pursue M&A as the primary growth lever",
          "Other",
        ],
      },
      {
        id: "cost_of_inaction",
        label: "What is the cost of inaction if strategy stays unchanged?",
        type: "Single-select",
        required: true,
        options: [
          "Very low — current trajectory is acceptable",
          "Moderate — leaving growth on the table but not in danger",
          "Significant — competitors pulling ahead, gap widening",
          "Critical — without strategic change the business is at risk",
          "Unknown — haven't modelled the cost of inaction",
          "Other",
        ],
      },
      {
        id: "decision_criteria",
        label: "Which criteria matter most when evaluating options?",
        type: "Rank (top 3)",
        required: true,
        helper: "Rank your top 3 in order of priority",
        options: [
          "Revenue impact within 24 months",
          "EBITDA improvement",
          "Capital efficiency (return per £/$ invested)",
          "Competitive moat strengthening",
          "Speed to market",
          "Customer retention improvement",
          "Team capability alignment",
          "Alignment with investment thesis or exit positioning",
          "Other",
        ],
      },
      {
        id: "commitment_level",
        label: "How much strategic commitment can be made right now?",
        type: "Single-select",
        required: true,
        options: [
          "Full — ready to commit resources and stop pursuing alternatives",
          "Staged — commit to initial investment with gates before full commitment",
          "Exploratory — test and validate before any significant resource commitment",
          "Uncertain — need more evidence before committing to any direction",
          "Other",
        ],
      },
      {
        id: "bold_move_concern",
        label: "What is the biggest concern about making a bold strategic move?",
        type: "Single-select",
        required: false,
        options: [
          "Cannibalising existing revenue streams",
          "Distraction from the core business",
          "Team capacity and execution risk",
          "Insufficient capital to execute",
          "Moving too slowly and being beaten by competitors",
          "Backing the wrong option — strategic mis-bet",
          "Other",
        ],
      },
      {
        id: "wwhtbt",
        label: "For the preferred option — what would have to be true for it to succeed?",
        type: "Free text",
        required: true,
        placeholder: "e.g. The enterprise segment would have to value our compliance features enough to pay 3x current ACV, and we'd need 5 reference customers in Q1.",
        options: [],
      },
      {
        id: "kill_criteria",
        label: "What evidence would confirm this strategy is working — or should be abandoned?",
        type: "Free text",
        required: true,
        placeholder: "e.g. If we haven't signed 3 enterprise pilots within 90 days, or pipeline coverage drops below 3:1, we trigger a review.",
        options: [],
      },
    ],
  },
  {
    num: "04",
    name: "Position",
    slug: "position",
    color: "#065f46",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    purpose: "Define the specific competitive stance, target customer, and differentiated value proposition.",
    questions: [
      {
        id: "target_customer",
        label: "Who is the primary target customer — the one everything is built around?",
        type: "Single-select",
        required: true,
        options: [
          "A specific firmographic profile (size, sector, geography)",
          "A persona defined by a trigger or transition they're experiencing",
          "A segment defined by a specific job-to-be-done or pain",
          "An account tier (enterprise, mid-market, SMB)",
          "Multiple primary targets of genuinely equal priority",
          "Other",
        ],
      },
      {
        id: "competitive_alternative",
        label: "What is the clearest alternative your target customer has to you?",
        type: "Multi-select (max 2)",
        required: true,
        options: [
          "A direct competitor with a similar product",
          "Doing it manually — spreadsheets or people",
          "Building it themselves (build vs. buy)",
          "A legacy system or incumbent they're locked into",
          "Doing nothing — the status quo",
          "A patchwork of point solutions and workarounds",
          "Other",
        ],
      },
      {
        id: "value_prop_type",
        label: "What does the value proposition primarily deliver?",
        type: "Single-select",
        required: true,
        options: [
          "Saves significant time or reduces operational friction",
          "Generates measurable revenue or growth for the customer",
          "Reduces a specific risk, cost, or compliance burden",
          "Gives customers strategic capability they couldn't otherwise have",
          "Replaces a complex, expensive process with a simpler, affordable one",
          "Other",
        ],
      },
      {
        id: "market_stance",
        label: "Where do you want to compete on the market map?",
        type: "Single-select",
        required: true,
        options: [
          "Head-to-head — win the mainstream market against established players",
          "Big fish, small pond — dominate a specific underserved niche",
          "Category creation — define and own an entirely new category",
          "Adjacent disruption — enter from the low end and move upmarket",
          "Other",
        ],
      },
      {
        id: "power_type",
        label: "Which best describes the primary competitive advantage — or the one being built toward?",
        type: "Single-select",
        required: false,
        helper: "Helmer's 7 Powers framework",
        options: [
          "Scale economies — lower unit costs than competitors at scale",
          "Network effects — product value grows as more users join",
          "Counter-positioning — model incumbents can't copy without self-harm",
          "Switching costs — customers locked in by data, integrations, or workflow",
          "Branding — premium perception that commands a price premium",
          "Cornered resource — exclusive access to a key input or capability",
          "Process power — operational capability competitors can't replicate",
          "Not yet established — this is what needs to be built",
          "Other",
        ],
      },
      {
        id: "differentiation",
        label: "What are the 2–3 dimensions on which you are genuinely differentiated from alternatives?",
        type: "Free text",
        required: true,
        placeholder: "e.g. Native meeting platform integrations (not bot injection); compliance-grade data architecture; vertical-specific workflows for staffing agencies.",
        options: [],
      },
      {
        id: "positioning_statement",
        label: "Draft your positioning statement",
        type: "Free text",
        required: false,
        placeholder: "For [target customer] who [need or trigger], [product] is a [market category] that [primary benefit]. Unlike [primary alternative], we [key differentiator].",
        helper: "For [target customer] who [need or trigger], [product] is a [market category] that [primary benefit]. Unlike [primary alternative], we [key differentiator].",
        options: [],
      },
      {
        id: "moat_building",
        label: "Which moat-building activities are actively being pursued?",
        type: "Multi-select (max 2)",
        required: false,
        options: [
          "Deepening integrations that increase switching costs",
          "Building network effects (user data, community, or marketplace)",
          "Accumulating proprietary data competitors can't access",
          "Achieving scale advantages that reduce unit cost",
          "Building brand premium perception in the category",
          "Locking in reference customers that validate category leadership",
          "Creating a platform ecosystem that third parties build on",
          "Other",
        ],
      },
    ],
  },
  {
    num: "05",
    name: "Commit",
    slug: "commit",
    color: "#92400e",
    bg: "#fffbeb",
    border: "#fde68a",
    purpose: "Translate strategy into resourced bets, measurable objectives, and accountable governance.",
    questions: [
      {
        id: "strategic_bets",
        label: "What are the strategic bets being made in the next 12 months?",
        type: "Structured repeater (max 3 bets)",
        required: true,
        helper: "For each bet: Bet name · Action · Expected outcome · Hypothesis",
        fields: [
          { name: "Bet name", placeholder: "Short label e.g. 'Move upmarket'" },
          { name: "Action", placeholder: "What we will specifically do e.g. 'Hire 2 enterprise AEs, build compliance module'" },
          { name: "Outcome", placeholder: "Measurable result e.g. '5 enterprise pilots signed by Q1, ACV 3×'" },
          { name: "Hypothesis", placeholder: "We believe [action] will result in [outcome] because [rationale]" },
        ],
        options: [],
      },
      {
        id: "okrs",
        label: "What are the top 3 company-level objectives for the next 12 months?",
        type: "Structured repeater (max 3 OKRs)",
        required: true,
        helper: "For each OKR: Objective (qualitative direction) + Key Result (quantitative success measure)",
        fields: [
          { name: "Objective", placeholder: "Qualitative direction" },
          { name: "Key Result", placeholder: "Quantitative — what counts as success?" },
        ],
        options: [],
      },
      {
        id: "horizon_allocation",
        label: "How will investment be allocated across horizons?",
        type: "Percentage split (must total 100%)",
        required: true,
        helper: "McKinsey benchmark: 70 / 20 / 10",
        fields: [
          { name: "Core / H1", placeholder: "Defending and optimising what exists" },
          { name: "Adjacent / H2", placeholder: "Scaling into adjacent opportunities" },
          { name: "Transformational / H3", placeholder: "Exploring new models or markets" },
        ],
        options: [],
      },
      {
        id: "thirty_day_actions",
        label: "What are the first 3 actions that must happen in the next 30 days?",
        type: "Structured repeater (max 3)",
        required: true,
        fields: [
          { name: "Action", placeholder: "What needs to happen" },
          { name: "Owner", placeholder: "Who is accountable" },
          { name: "Success measure", placeholder: "How success is measured" },
        ],
        options: [],
      },
      {
        id: "bet_kill_criteria",
        label: "What are the predefined kill criteria for the strategic bets?",
        type: "Free text",
        required: true,
        placeholder: "e.g. If enterprise pipeline coverage drops below 3:1 by day 60, or CAC exceeds £8k with no improving trajectory, trigger a board review.",
        options: [],
      },
      {
        id: "bet_classification",
        label: "How would you characterise each strategic bet?",
        type: "Single-select",
        required: false,
        helper: "Sure bet: high confidence, low risk. Solid bet: good evidence, moderate risk. Side bet: speculative. Slim bet: long shot.",
        options: [
          "Sure bet — high confidence, low risk, core to delivery",
          "Solid bet — good evidence, moderate risk, significant upside",
          "Side bet — speculative, high upside if conditions are right",
          "Slim bet — long shot, transformational if successful",
          "Other",
        ],
      },
      {
        id: "governance_rhythm",
        label: "What governance rhythm will hold this strategy accountable?",
        type: "Multi-select",
        required: false,
        options: [
          "Weekly operating metrics review (leadership team)",
          "Monthly strategic progress review (CEO + direct reports)",
          "Quarterly board or sponsor strategy review",
          "30/60/90-day milestone gates with go/no-go decisions",
          "Hypothesis and assumption review in product discovery cadence",
          "Annual strategy refresh",
          "Other",
        ],
      },
      {
        id: "capability_needs",
        label: "Which capabilities must be built, bought, or partnered for in the next 6 months?",
        type: "Multi-select",
        required: false,
        options: [
          "Senior sales leadership for enterprise motion",
          "Product engineering capacity",
          "Data and analytics infrastructure",
          "Customer success and onboarding",
          "Marketing and demand generation",
          "Strategic partnerships or channel",
          "M&A or integration capability",
          "Finance and operational controls",
          "Other",
        ],
      },
    ],
  },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "Single-select":    { bg: "#eff6ff", text: "#1e40af" },
  "Multi-select":     { bg: "#f5f3ff", text: "#6d28d9" },
  "Free text":        { bg: "#f0fdf4", text: "#065f46" },
  "Rank":             { bg: "#fff7ed", text: "#c2410c" },
  "Structured":       { bg: "#fdf4ff", text: "#7e22ce" },
  "Percentage":       { bg: "#fffbeb", text: "#92400e" },
};

function typeColor(type: string) {
  if (type.startsWith("Single")) return TYPE_COLORS["Single-select"];
  if (type.startsWith("Multi")) return TYPE_COLORS["Multi-select"];
  if (type.startsWith("Free")) return TYPE_COLORS["Free text"];
  if (type.startsWith("Rank")) return TYPE_COLORS["Rank"];
  if (type.startsWith("Structured")) return TYPE_COLORS["Structured"];
  if (type.startsWith("Percentage")) return TYPE_COLORS["Percentage"];
  return { bg: "#f3f4f6", text: "#374151" };
}

export default async function QuestionReferencePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/admin");

  const totalQuestions = stages.reduce((acc, s) => acc + s.questions.length, 0);

  return (
    <div>
      {/* Screen-only header */}
      <div className="no-print" style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Question Reference</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>All {totalQuestions} questions across 5 stages — types, options, and constraints. Admin only.</p>
        </div>
        <PrintButton />
      </div>

      <div id="question-reference" style={{ fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 900, margin: "0 auto", color: "#111827", lineHeight: 1.7 }}>

        {/* Cover */}
        <div style={{ borderBottom: "3px solid #111827", paddingBottom: 32, marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280", marginBottom: 12 }}>Nth Layer · Inflexion Platform · Internal Documentation</p>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", color: "#111827", marginBottom: 8, lineHeight: 1.2 }}>Question Reference</h1>
          <p style={{ fontSize: 16, color: "#374151", marginBottom: 24 }}>
            Complete catalogue of all questions across the five Inflexion strategy stages — including question IDs, input types, all answer options, constraints, placeholders, and whether each question is required.
          </p>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              { label: "Total questions", value: String(totalQuestions) },
              { label: "Stages", value: "5" },
              { label: "Single-select", value: "14" },
              { label: "Multi-select", value: "12" },
              { label: "Free text", value: "8" },
              { label: "Structured", value: "4" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: 0 }}>{value}</p>
                <p style={{ fontSize: 12, color: "#6b7280", fontFamily: "system-ui, sans-serif", margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginBottom: 40, padding: "16px 20px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: 12, fontFamily: "system-ui, sans-serif" }}>Input type legend</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(TYPE_COLORS).map(([label, { bg, text }]) => (
              <span key={label} style={{ background: bg, color: text, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, fontFamily: "system-ui, sans-serif" }}>
                {label}
              </span>
            ))}
            <span style={{ background: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, fontFamily: "system-ui, sans-serif" }}>
              ★ Required
            </span>
            <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, fontFamily: "system-ui, sans-serif" }}>
              ○ Optional
            </span>
          </div>
        </div>

        {/* Stages */}
        {stages.map((stage) => (
          <div key={stage.slug} style={{ marginBottom: 56 }}>

            {/* Stage header */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>STAGE {stage.num}</span>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: stage.color, margin: 0 }}>{stage.name}</h2>
            </div>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, fontFamily: "system-ui, sans-serif" }}>{stage.purpose}</p>

            {/* Questions */}
            {stage.questions.map((q, qi) => {
              const tc = typeColor(q.type);
              return (
                <div key={q.id} style={{ marginBottom: 24, padding: "20px 24px", background: stage.bg, border: `1px solid ${stage.border}`, borderRadius: 8, pageBreakInside: "avoid" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>Q{qi + 1}</span>
                        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 4, padding: "1px 6px" }}>{q.id}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.text, borderRadius: 20, padding: "2px 10px", fontFamily: "system-ui, sans-serif" }}>
                          {q.type}
                        </span>
                        {q.required ? (
                          <span style={{ fontSize: 11, fontWeight: 600, background: "#fef2f2", color: "#dc2626", borderRadius: 20, padding: "2px 10px", fontFamily: "system-ui, sans-serif" }}>★ Required</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, background: "#f3f4f6", color: "#6b7280", borderRadius: 20, padding: "2px 10px", fontFamily: "system-ui, sans-serif" }}>○ Optional</span>
                        )}
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>{q.label}</p>
                    </div>
                  </div>

                  {/* Helper */}
                  {"helper" in q && q.helper && (
                    <p style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", margin: "0 0 10px", fontFamily: "system-ui, sans-serif" }}>{q.helper}</p>
                  )}

                  {/* Options */}
                  {q.options && q.options.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 6, fontFamily: "system-ui, sans-serif" }}>Options</p>
                      <ol style={{ margin: 0, paddingLeft: 20 }}>
                        {q.options.map((opt) => (
                          <li key={opt} style={{ fontSize: 13, color: "#374151", marginBottom: 2, fontFamily: "system-ui, sans-serif" }}>{opt}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Structured fields */}
                  {"fields" in q && q.fields && q.fields.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 6, fontFamily: "system-ui, sans-serif" }}>Sub-fields</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {q.fields.map((f) => (
                          <div key={f.name} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "system-ui, sans-serif", minWidth: 120 }}>{f.name}</span>
                            <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic", fontFamily: "system-ui, sans-serif" }}>{f.placeholder}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Placeholder */}
                  {"placeholder" in q && q.placeholder && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(255,255,255,0.6)", borderRadius: 4, border: "1px dashed #d1d5db" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 2, fontFamily: "system-ui, sans-serif" }}>Placeholder</p>
                      <p style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", margin: 0, fontFamily: "system-ui, sans-serif" }}>{q.placeholder}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Summary table */}
        <div style={{ marginTop: 56, borderTop: "2px solid #111827", paddingTop: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Summary: Questions by Stage</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #111827" }}>
                {["Stage", "Questions", "Required", "Optional", "Select", "Multi", "Free text", "Structured"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 12px 8px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => {
                const qs = s.questions;
                const req = qs.filter((q) => q.required).length;
                const sel = qs.filter((q) => q.type.startsWith("Single")).length;
                const multi = qs.filter((q) => q.type.startsWith("Multi")).length;
                const free = qs.filter((q) => q.type.startsWith("Free")).length;
                const struct = qs.filter((q) => q.type.startsWith("Structured") || q.type.startsWith("Percentage") || q.type.startsWith("Rank")).length;
                return (
                  <tr key={s.slug} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: s.color }}>{s.num} — {s.name}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>{qs.length}</td>
                    <td style={{ padding: "8px 12px", color: "#dc2626" }}>{req}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{qs.length - req}</td>
                    <td style={{ padding: "8px 12px" }}>{sel}</td>
                    <td style={{ padding: "8px 12px" }}>{multi}</td>
                    <td style={{ padding: "8px 12px" }}>{free}</td>
                    <td style={{ padding: "8px 12px" }}>{struct}</td>
                  </tr>
                );
              })}
              {/* Totals */}
              <tr style={{ borderTop: "2px solid #111827", fontWeight: 700, background: "#f9fafb" }}>
                <td style={{ padding: "8px 12px" }}>Total</td>
                <td style={{ padding: "8px 12px" }}>{totalQuestions}</td>
                <td style={{ padding: "8px 12px", color: "#dc2626" }}>{stages.reduce((a, s) => a + s.questions.filter((q) => q.required).length, 0)}</td>
                <td style={{ padding: "8px 12px", color: "#6b7280" }}>{stages.reduce((a, s) => a + s.questions.filter((q) => !q.required).length, 0)}</td>
                <td style={{ padding: "8px 12px" }}>14</td>
                <td style={{ padding: "8px 12px" }}>12</td>
                <td style={{ padding: "8px 12px" }}>8</td>
                <td style={{ padding: "8px 12px" }}>4</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 11, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>Nth Layer · Inflexion Platform · Question Reference · Admin Only</p>
          <p style={{ fontSize: 11, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>Generated {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>

      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, aside, header, footer { display: none !important; }
          body { background: white !important; }
          #question-reference { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
