"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "multi-select" | "freeform" | "single-select-freetext";

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  question: string;
  type: QuestionType;
  options?: QuestionOption[];
  placeholder?: string;
  maxSelections?: number;
}

interface Stage {
  id: string;
  name: string;
  purpose: string;
  output: string;
  questions: Question[];
  runButtonLabel: string;
}

type AnswerValue = string | string[] | { selection: string; freetext: string };

type StageStatus = "locked" | "active" | "complete";
type ReportStatus = "none" | "generating" | "complete";

interface StageState {
  status: StageStatus;
  answers: Record<string, AnswerValue>;
  currentQuestion: number;
  reportStatus: ReportStatus;
  report: string | null;
}

// ─── Stage Data ───────────────────────────────────────────────────────────────

const STAGE_HERO: Record<string, { tagline: string; description: string; deliverables: string[] }> = {
  frame: {
    tagline: "Frame",
    description: "Frame establishes what is actually happening — the inflection point driving this strategy, the constraints shaping your options, and the outcome you are trying to reach. It creates clarity on the situation before any decisions are made.",
    deliverables: ["Inflection point diagnosis", "What changed summary", "Desired outcome statement", "Current ICP baseline", "Constraint map", "Strategic context summary"],
  },
  diagnose: {
    tagline: "Diagnose",
    description: "Diagnose identifies where performance is breaking, where you are winning, and where pressure is building across product, GTM, and market. It turns raw context into clear signals.",
    deliverables: ["Performance breakdown areas", "Strength signals (where winning)", "Weakness signals (where losing)", "Competitor set (validated)", "Internal constraint map", "Key diagnostic summary"],
  },
  decide: {
    tagline: "Decide",
    description: "Decide defines the critical strategic choices that shape the direction of the product. It forces clarity on where to focus, how to compete, and how to grow.",
    deliverables: ["Target ICP (future state)", "Product strategy choice", "Differentiation strategy", "Pricing & monetisation model", "GTM motion", "Decision confidence levels", "Strategic decision summary"],
  },
  position: {
    tagline: "Position",
    description: "Position translates strategic choices into a clear, external-facing narrative. It defines how the product is understood, who it is for, and why it wins.",
    deliverables: ["Category framing", "Refined ICP definition", "Primary value proposition", "Core differentiation themes", "Pricing narrative", "Positioning summary"],
  },
  commit: {
    tagline: "Commit",
    description: "Commit finalises the strategy by defining focus, trade-offs, and how success will be measured. It turns direction into a clear, accountable strategy.",
    deliverables: ["Strategic focus areas", "Explicit trade-offs", "Strategic bets", "Success metrics", "Early warning signals", "Overall confidence", "Final strategy summary"],
  },
};

const STAGES: Stage[] = [
  {
    id: "frame",
    name: "Frame",
    purpose: "Define the inflection point, current context, and desired outcome.",
    output: "A clear statement of the strategic context — what is forcing a decision, what the constraints are, and what success looks like.",
    runButtonLabel: "Run Frame Report",
    questions: [
      {
        id: "q1",
        question: "What kind of inflection point are you dealing with?",
        type: "multi-select",
        options: [
          { value: "Growth stalled", label: "Growth stalled" },
          { value: "Moving upmarket", label: "Moving upmarket" },
          { value: "Entering new market", label: "Entering new market" },
          { value: "New competitor pressure", label: "New competitor pressure" },
          { value: "AI / technology shift", label: "AI / technology shift" },
          { value: "Pricing pressure", label: "Pricing pressure" },
          { value: "Post-funding scale", label: "Post-funding scale" },
          { value: "Leadership / team change", label: "Leadership / team change" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q2",
        question: "What has changed in the last 3–6 months that makes this urgent now?",
        type: "freeform",
        placeholder: "Describe the change or trigger...",
      },
      {
        id: "q3",
        question: "What is your current ARR or revenue range?",
        type: "multi-select",
        maxSelections: 1,
        options: [
          { value: "Pre-revenue", label: "Pre-revenue" },
          { value: "Under £500k", label: "Under £500k" },
          { value: "£500k–£2m", label: "£500k–£2m" },
          { value: "£2m–£5m", label: "£2m–£5m" },
          { value: "£5m–£20m", label: "£5m–£20m" },
          { value: "£20m+", label: "£20m+" },
        ],
      },
      {
        id: "q4",
        question: "What is your current growth rate year-on-year?",
        type: "multi-select",
        maxSelections: 1,
        options: [
          { value: "Declining", label: "Declining" },
          { value: "Flat (0–10%)", label: "Flat (0–10%)" },
          { value: "Moderate (10–30%)", label: "Moderate (10–30%)" },
          { value: "Strong (30–80%)", label: "Strong (30–80%)" },
          { value: "Hyper-growth (80%+)", label: "Hyper-growth (80%+)" },
        ],
      },
      {
        id: "q5",
        question: "What is your total team size?",
        type: "multi-select",
        maxSelections: 1,
        options: [
          { value: "1–10", label: "1–10" },
          { value: "11–30", label: "11–30" },
          { value: "31–75", label: "31–75" },
          { value: "76–200", label: "76–200" },
          { value: "200+", label: "200+" },
        ],
      },
      {
        id: "q6",
        question: "What outcome are you trying to achieve in the next 6–12 months?",
        type: "multi-select",
        options: [
          { value: "Accelerate growth", label: "Accelerate growth" },
          { value: "Improve retention / NRR", label: "Improve retention / NRR" },
          { value: "Increase deal size / move upmarket", label: "Increase deal size / move upmarket" },
          { value: "Improve efficiency / reduce CAC", label: "Improve efficiency / reduce CAC" },
          { value: "Reposition product", label: "Reposition product" },
          { value: "Expand into new segment", label: "Expand into new segment" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q7",
        question: "What constraints matter most right now?",
        type: "multi-select",
        options: [
          { value: "Budget", label: "Budget" },
          { value: "Headcount", label: "Headcount" },
          { value: "Time to execute", label: "Time to execute" },
          { value: "Technology / infrastructure", label: "Technology / infrastructure" },
          { value: "Market conditions", label: "Market conditions" },
          { value: "Leadership bandwidth", label: "Leadership bandwidth" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q8",
        question: "What are the biggest risks or unknowns going into this strategy?",
        type: "freeform",
        placeholder: "Describe the risks or unknowns you are most concerned about...",
      },
    ],
  },
  {
    id: "diagnose",
    name: "Diagnose",
    purpose: "Turn context into clear signals — where you are winning, losing, and why.",
    output: "A structured read of where you are winning, where you are losing, and what is holding you back — mapped against your competitive landscape.",
    runButtonLabel: "Run Diagnose Report",
    questions: [
      {
        id: "q1",
        question: "Where is performance breaking down today?",
        type: "multi-select",
        options: [
          { value: "Lead volume", label: "Lead volume" },
          { value: "Conversion rate", label: "Conversion rate" },
          { value: "Sales cycle length", label: "Sales cycle length" },
          { value: "Deal size", label: "Deal size" },
          { value: "Retention / churn", label: "Retention / churn" },
          { value: "Expansion / upsell", label: "Expansion / upsell" },
          { value: "Product engagement", label: "Product engagement" },
          { value: "Team / execution", label: "Team / execution" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q2",
        question: "Where are you winning and what is driving it?",
        type: "multi-select",
        options: [
          { value: "Specific customer segment", label: "Specific customer segment" },
          { value: "Specific product feature", label: "Specific product feature" },
          { value: "Price advantage", label: "Price advantage" },
          { value: "Brand / reputation", label: "Brand / reputation" },
          { value: "Speed / ease of use", label: "Speed / ease of use" },
          { value: "Customer success / support", label: "Customer success / support" },
          { value: "Integrations / ecosystem", label: "Integrations / ecosystem" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q3",
        question: "Where are you losing and what is the primary cause?",
        type: "multi-select",
        options: [
          { value: "Feature gaps vs competitors", label: "Feature gaps vs competitors" },
          { value: "Pricing too high", label: "Pricing too high" },
          { value: "Pricing too low / perceived cheap", label: "Pricing too low / perceived cheap" },
          { value: "Competitor brand strength", label: "Competitor brand strength" },
          { value: "Weak differentiation", label: "Weak differentiation" },
          { value: "GTM / sales execution", label: "GTM / sales execution" },
          { value: "Product quality or reliability", label: "Product quality or reliability" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q4",
        question: "Which competitors matter most right now and why?",
        type: "freeform",
        placeholder: "Name the competitors and why they are most relevant...",
      },
      {
        id: "q5",
        question: "What do your best customers have in common?",
        type: "freeform",
        placeholder: "Describe the patterns across your strongest accounts...",
      },
      {
        id: "q6",
        question: "What assumptions are you currently relying on that may not be true?",
        type: "freeform",
        placeholder: "Describe the assumptions your current strategy depends on...",
      },
      {
        id: "q7",
        question: "What internal constraints are holding you back?",
        type: "multi-select",
        options: [
          { value: "Engineering / product capacity", label: "Engineering / product capacity" },
          { value: "Sales capability or skills", label: "Sales capability or skills" },
          { value: "Marketing reach or budget", label: "Marketing reach or budget" },
          { value: "Data quality or infrastructure", label: "Data quality or infrastructure" },
          { value: "Leadership alignment", label: "Leadership alignment" },
          { value: "Customer success capacity", label: "Customer success capacity" },
          { value: "Financial runway", label: "Financial runway" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q8",
        question: "What is the single biggest risk to your current trajectory?",
        type: "freeform",
        placeholder: "Describe the risk most likely to derail you if left unaddressed...",
      },
    ],
  },
  {
    id: "decide",
    name: "Decide",
    purpose: "Force the hard choices — segment, product, differentiation, GTM.",
    output: "The key strategic decisions made — segment focus, product direction, competitive differentiation, pricing model, and GTM motion.",
    runButtonLabel: "Run Decide Report",
    questions: [
      {
        id: "q1",
        question: "Which customer segment should this strategy optimise for?",
        type: "multi-select",
        options: [
          { value: "Maintain broad market", label: "Maintain broad market" },
          { value: "Focus SMB", label: "Focus SMB" },
          { value: "Focus mid-market", label: "Focus mid-market" },
          { value: "Focus enterprise", label: "Focus enterprise" },
          { value: "Specific vertical", label: "Specific vertical" },
          { value: "Hybrid (two segments)", label: "Hybrid (two segments)" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q2",
        question: "What product direction should you prioritise?",
        type: "multi-select",
        options: [
          { value: "Core product depth", label: "Core product depth" },
          { value: "Feature breadth expansion", label: "Feature breadth expansion" },
          { value: "Introduce new capability", label: "Introduce new capability" },
          { value: "AI / automation layer", label: "AI / automation layer" },
          { value: "Platform / ecosystem strategy", label: "Platform / ecosystem strategy" },
          { value: "Niche use case focus", label: "Niche use case focus" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q3",
        question: "What should you compete on most clearly?",
        type: "multi-select",
        options: [
          { value: "Depth / quality", label: "Depth / quality" },
          { value: "Speed / ease of use", label: "Speed / ease of use" },
          { value: "Price / value", label: "Price / value" },
          { value: "Innovation / AI-led", label: "Innovation / AI-led" },
          { value: "Vertical specialisation", label: "Vertical specialisation" },
          { value: "Customer experience", label: "Customer experience" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q4",
        question: "How should you price or monetise the product?",
        type: "multi-select",
        options: [
          { value: "Premium pricing", label: "Premium pricing" },
          { value: "Competitive / market-rate", label: "Competitive / market-rate" },
          { value: "Low-cost / penetration", label: "Low-cost / penetration" },
          { value: "Usage-based", label: "Usage-based" },
          { value: "Seat-based", label: "Seat-based" },
          { value: "Freemium + convert", label: "Freemium + convert" },
          { value: "Hybrid model", label: "Hybrid model" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q5",
        question: "What GTM motion should you lean into?",
        type: "multi-select",
        options: [
          { value: "Product-led growth", label: "Product-led growth" },
          { value: "Sales-led", label: "Sales-led" },
          { value: "Hybrid PLG + sales", label: "Hybrid PLG + sales" },
          { value: "Channel / partnerships", label: "Channel / partnerships" },
          { value: "Outbound-led", label: "Outbound-led" },
          { value: "Community-led", label: "Community-led" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q6",
        question: "What are you explicitly choosing NOT to do or deprioritise?",
        type: "freeform",
        placeholder: "Describe the trade-offs you are willing to make...",
      },
      {
        id: "q7",
        question: "What assumptions does this strategy depend on being true?",
        type: "freeform",
        placeholder: "List the assumptions these decisions rest on...",
      },
      {
        id: "q8",
        question: "How confident are you that these are the right calls?",
        type: "multi-select",
        maxSelections: 1,
        options: [
          { value: "Low — significant uncertainty remains", label: "Low — significant uncertainty remains" },
          { value: "Medium — directionally right, details to prove", label: "Medium — directionally right, details to prove" },
          { value: "High — clear conviction, ready to execute", label: "High — clear conviction, ready to execute" },
          { value: "Very high — full alignment across leadership", label: "Very high — full alignment across leadership" },
        ],
      },
    ],
  },
  {
    id: "position",
    name: "Position",
    purpose: "Define how the product is understood, who it is for, and why it wins.",
    output: "A sharp market position — how the product is framed, who it is for, what it leads with, and how pricing is justified.",
    runButtonLabel: "Run Position Report",
    questions: [
      {
        id: "q1",
        question: "How should this product be framed in the market?",
        type: "multi-select",
        options: [
          { value: "Leader in an existing category", label: "Leader in an existing category" },
          { value: "New category creation", label: "New category creation" },
          { value: "Hybrid / redefining the category", label: "Hybrid / redefining the category" },
          { value: "Vertical specialist", label: "Vertical specialist" },
          { value: "AI-native alternative", label: "AI-native alternative" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q2",
        question: "Who is this product really for — describe your refined ICP?",
        type: "freeform",
        placeholder: "Describe the company type, size, role, and situation you are targeting...",
      },
      {
        id: "q3",
        question: "What value should it lead with?",
        type: "multi-select",
        options: [
          { value: "Increase revenue", label: "Increase revenue" },
          { value: "Reduce cost", label: "Reduce cost" },
          { value: "Save time", label: "Save time" },
          { value: "Improve quality / outcomes", label: "Improve quality / outcomes" },
          { value: "Reduce risk", label: "Reduce risk" },
          { value: "Enable scale", label: "Enable scale" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q4",
        question: "What do you want to be most known for?",
        type: "multi-select",
        options: [
          { value: "Depth / sophistication", label: "Depth / sophistication" },
          { value: "Speed / simplicity", label: "Speed / simplicity" },
          { value: "Price / accessibility", label: "Price / accessibility" },
          { value: "Innovation / AI", label: "Innovation / AI" },
          { value: "Vertical specialisation", label: "Vertical specialisation" },
          { value: "Reliability / trust", label: "Reliability / trust" },
          { value: "Customer experience", label: "Customer experience" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q5",
        question: "What do you NOT want to be associated with?",
        type: "freeform",
        placeholder: "Describe the perceptions or comparisons you want to avoid...",
      },
      {
        id: "q6",
        question: "How should pricing be explained or justified?",
        type: "multi-select",
        options: [
          { value: "Premium justified by outcomes", label: "Premium justified by outcomes" },
          { value: "Competitive / market aligned", label: "Competitive / market aligned" },
          { value: "Disruptive / low-cost entry", label: "Disruptive / low-cost entry" },
          { value: "Value-based / ROI-driven", label: "Value-based / ROI-driven" },
          { value: "Transparent / usage-based", label: "Transparent / usage-based" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q7",
        question: "What is your single strongest proof point or win today?",
        type: "freeform",
        placeholder: "Describe the best example of your product working — a customer, result, or case...",
      },
    ],
  },
  {
    id: "commit",
    name: "Commit",
    purpose: "Lock focus, name trade-offs, and define what success looks like.",
    output: "The strategy on a page — focus areas, explicit non-goals, the bets you are backing, success metrics, and the signals that tell you it is working.",
    runButtonLabel: "Run Commit Report",
    questions: [
      {
        id: "q1",
        question: "What are the 3–5 most important strategic focus areas?",
        type: "multi-select",
        options: [
          { value: "New segment acquisition", label: "New segment acquisition" },
          { value: "Retention and expansion", label: "Retention and expansion" },
          { value: "Product differentiation", label: "Product differentiation" },
          { value: "GTM efficiency", label: "GTM efficiency" },
          { value: "Brand and positioning", label: "Brand and positioning" },
          { value: "Partnership / channel build", label: "Partnership / channel build" },
          { value: "Operational scale", label: "Operational scale" },
          { value: "International expansion", label: "International expansion" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q2",
        question: "What are you explicitly stopping or deprioritising?",
        type: "freeform",
        placeholder: "Name the things you are committing to not doing or deferring...",
      },
      {
        id: "q3",
        question: "What are the 2–3 bets you are backing in the next 6–12 months?",
        type: "freeform",
        placeholder: "Describe each bet — what you are doing, why, and what it depends on...",
      },
      {
        id: "q4",
        question: "How will you measure success — what are your key metrics?",
        type: "multi-select",
        options: [
          { value: "ARR / revenue growth", label: "ARR / revenue growth" },
          { value: "Net new logo count", label: "Net new logo count" },
          { value: "Average deal size", label: "Average deal size" },
          { value: "Sales cycle length", label: "Sales cycle length" },
          { value: "Gross / net revenue retention", label: "Gross / net revenue retention" },
          { value: "Expansion revenue", label: "Expansion revenue" },
          { value: "CAC payback period", label: "CAC payback period" },
          { value: "Pipeline coverage", label: "Pipeline coverage" },
          { value: "Product engagement / activation", label: "Product engagement / activation" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q5",
        question: "What are the early warning signals that this strategy is going off track?",
        type: "multi-select",
        options: [
          { value: "Conversion rate drops", label: "Conversion rate drops" },
          { value: "CAC increases materially", label: "CAC increases materially" },
          { value: "Average deal size declines", label: "Average deal size declines" },
          { value: "Churn or contraction increases", label: "Churn or contraction increases" },
          { value: "Sales cycle lengthens", label: "Sales cycle lengthens" },
          { value: "Win rate vs key competitors falls", label: "Win rate vs key competitors falls" },
          { value: "Pipeline coverage drops below 3x", label: "Pipeline coverage drops below 3x" },
          { value: "Other", label: "Other" },
        ],
      },
      {
        id: "q6",
        question: "What assumptions does the whole strategy rest on?",
        type: "freeform",
        placeholder: "Describe the assumptions that, if wrong, would require a rethink...",
      },
      {
        id: "q7",
        question: "What is your overall confidence level in this strategy?",
        type: "multi-select",
        maxSelections: 1,
        options: [
          { value: "Low — significant uncertainties remain", label: "Low — significant uncertainties remain" },
          { value: "Medium — directionally right, details to prove", label: "Medium — directionally right, details to prove" },
          { value: "High — clear conviction, ready to execute", label: "High — clear conviction, ready to execute" },
          { value: "Very high — full alignment, ready to commit", label: "Very high — full alignment, ready to commit" },
        ],
      },
    ],
  },
];

const PROGRESS_MESSAGES = [
  "Analysing inputs...",
  "Structuring strategy signals...",
  "Generating report...",
  "Finalising output...",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAnswerDisplay(answer: AnswerValue): string[] {
  if (typeof answer === "string") return [answer];
  if (Array.isArray(answer)) return answer;
  if (typeof answer === "object" && "selection" in answer) {
    const parts = [answer.selection];
    if (answer.freetext) parts.push(answer.freetext);
    return parts;
  }
  return [];
}

function isAnswerValid(question: Question, answer: AnswerValue | undefined): boolean {
  if (answer === undefined || answer === null) return false;
  if (question.type === "freeform") {
    return typeof answer === "string" && answer.trim().length > 0;
  }
  if (question.type === "multi-select") {
    return Array.isArray(answer) && answer.length > 0;
  }
  if (question.type === "single-select-freetext") {
    return typeof answer === "object" && !Array.isArray(answer) && "selection" in answer && answer.selection.length > 0;
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

function renderReport(text: string): React.ReactNode {
  const blocks = text.split(/\n\n+/);
  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const isHeader = trimmed.startsWith("**") && trimmed.endsWith("**") && !trimmed.slice(2, -2).includes("**");
        if (isHeader) {
          return (
            <p
              key={i}
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#111827",
                marginBottom: 10,
                marginTop: i === 0 ? 0 : 28,
              }}
            >
              {trimmed.slice(2, -2)}
            </p>
          );
        }
        return (
          <p
            key={i}
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "#374151",
              marginBottom: 16,
              marginTop: 0,
            }}
          >
            {renderInlineBold(trimmed)}
          </p>
        );
      })}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionCard({
  option,
  selected,
  disabled,
  onClick,
  showCheckbox,
}: {
  option: QuestionOption;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  showCheckbox?: boolean;
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
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "all 150ms",
        opacity: disabled && !selected ? 0.5 : 1,
        width: "100%",
      }}
    >
      {showCheckbox && (
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

  if (question.type === "freeform") {
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
          fontSize: 15,
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

  if (question.type === "multi-select") {
    const selected = Array.isArray(answer) ? answer : [];
    const max = question.maxSelections;
    const atMax = max !== undefined && selected.length >= max;
    const hasOtherOption = question.options!.some((o) => o.value === "Other");
    const otherSelected = selected.some((v) => v === "Other" || v.startsWith("Other: "));
    // Store "Other: [text]" entries — find any existing one
    const otherCustom = selected.find((v) => v.startsWith("Other: "))?.slice(7) ?? "";

    function handleOtherText(text: string) {
      const withoutOther = selected.filter((v) => v !== "Other" && !v.startsWith("Other: "));
      if (text.trim()) {
        onChange([...withoutOther, `Other: ${text}`]);
      } else {
        onChange([...withoutOther, "Other"]);
      }
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
              ? selected.some((v) => v === "Other" || v.startsWith("Other: "))
              : selected.includes(opt.value);
            const isDisabled = (atMax && !isSelected) && max !== 1;
            return (
              <OptionCard
                key={opt.value}
                option={opt}
                selected={isSelected}
                disabled={isDisabled}
                showCheckbox={max !== 1}
                onClick={() => {
                  if (isDisabled) return;
                  // Radio mode: single-select replaces the whole array
                  if (max === 1) {
                    onChange(isSelected ? [] : [opt.value]);
                    return;
                  }
                  if (opt.value === "Other") {
                    if (isSelected) {
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
        </div>
        {hasOtherOption && otherSelected && (
          <input
            type="text"
            autoFocus
            value={otherCustom}
            onChange={(e) => handleOtherText(e.target.value)}
            placeholder="Please specify..."
            style={{
              marginTop: 8,
              padding: "12px 16px",
              border: "1.5px solid #2563eb",
              borderRadius: 8,
              fontSize: 14,
              color: "#111827",
              outline: "none",
              fontFamily: "inherit",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>
    );
  }

  if (question.type === "single-select-freetext") {
    const val = typeof answer === "object" && !Array.isArray(answer) && answer !== null ? (answer as { selection: string; freetext: string }) : { selection: "", freetext: "" };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.options!.map((opt) => (
          <OptionCard
            key={opt.value}
            option={opt}
            selected={val.selection === opt.value}
            disabled={false}
            onClick={() => onChange({ selection: opt.value, freetext: val.freetext })}
          />
        ))}
        {val.selection && (
          <input
            type="text"
            value={val.freetext}
            onChange={(e) => onChange({ selection: val.selection, freetext: e.target.value })}
            placeholder={question.placeholder}
            style={{
              marginTop: 4,
              padding: "12px 16px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 14,
              color: "#111827",
              outline: "none",
              fontFamily: "inherit",
              width: "100%",
              boxSizing: "border-box",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#2563eb";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e5e7eb";
            }}
          />
        )}
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
        fontSize: 12,
        fontWeight: 500,
        marginRight: 6,
        marginBottom: 4,
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
    return false;
  });
  if (answered.length === 0) {
    return (
      <div
        style={{
          background: "#f9fafb",
          borderLeft: "1px solid #e5e7eb",
          padding: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
          Your answers will appear here as you progress.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#f9fafb", borderLeft: "1px solid #e5e7eb", padding: "40px 32px 32px", overflowY: "auto" }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "#9ca3af",
          marginBottom: 24,
          marginTop: 0,
        }}
      >
        Captured so far
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {answered.map((q) => {
          const answer = answers[q.id];
          if (answer === undefined) return null;
          const chips = getAnswerDisplay(answer);
          return (
            <div key={q.id}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#9ca3af",
                  marginBottom: 6,
                  marginTop: 0,
                }}
              >
                {q.question}
              </p>
              <div>
                {q.type === "freeform" ? (
                  <p style={{ fontSize: 13, color: "#374151", fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>
                    "{chips[0]}"
                  </p>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function StrategyFlow() {
  const initialState: Record<string, StageState> = {};
  STAGES.forEach((stage, idx) => {
    initialState[stage.id] = {
      status: "active",
      answers: {},
      currentQuestion: 0,
      reportStatus: "none",
      report: null,
    };
  });

  const [stageStates, setStageStates] = useState<Record<string, StageState>>(initialState);
  const [activeStageId, setActiveStageId] = useState<string>("frame");
  const [progressValue, setProgressValue] = useState(0);
  const [progressMessage, setProgressMessage] = useState(PROGRESS_MESSAGES[0]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function handleRunReport() {
    updateStage(activeStageId, { reportStatus: "generating" });
    setProgressValue(0);
    setProgressMessage(PROGRESS_MESSAGES[0]);

    // Animate progress bar
    let progress = 0;
    let msgIdx = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += 2;
      if (progress > 85) progress = 85;
      setProgressValue(progress);
    }, 60);

    messageIntervalRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROGRESS_MESSAGES.length;
      setProgressMessage(PROGRESS_MESSAGES[msgIdx]);
    }, 1000);

    try {
      const res = await fetch("/api/strategy/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: activeStageId,
          stageName: activeStage.name,
          questions: activeStage.questions.map((q) => ({ id: q.id, question: q.question, type: q.type })),
          answers: activeState.answers,
        }),
      });

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);

      setProgressValue(100);
      setProgressMessage("Complete");

      const data = await res.json();

      setTimeout(() => {
        const currentIdx = STAGES.findIndex((s) => s.id === activeStageId);
        const nextStage = STAGES[currentIdx + 1];

        setStageStates((prev) => {
          const updated = { ...prev };
          updated[activeStageId] = { ...updated[activeStageId], reportStatus: "complete", report: data.report || null };
          if (nextStage) {
            updated[nextStage.id] = { ...updated[nextStage.id], status: "active" };
          }
          return updated;
        });
      }, 500);
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
      console.error(err);
      updateStage(activeStageId, { reportStatus: "none" });
    }
  }

  function handleContinue() {
    const currentIdx = STAGES.findIndex((s) => s.id === activeStageId);
    const nextStage = STAGES[currentIdx + 1];
    if (nextStage) {
      setActiveStageId(nextStage.id);
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
          height: 56,
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          paddingLeft: 32,
          paddingRight: 32,
          gap: 0,
          background: "#fff",
          flexShrink: 0,
        }}
      >
        {STAGES.map((stage, idx) => {
          const state = stageStates[stage.id];
          const isActive = stage.id === activeStageId;
          const isComplete = state.status === "complete";
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
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: isComplete ? "#059669" : isActive ? "#111827" : "#e5e7eb",
                    color: isComplete || isActive ? "#fff" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
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
        const stageIndex = STAGES.findIndex(s => s.id === activeStage.id);
        return (
          <div style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
            {/* Hero band */}
            <div style={{ padding: "40px 48px 36px" }}>
              <h1 style={{ fontSize: 40, fontWeight: 800, color: "#111827", marginBottom: 6, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {activeStage.name}
              </h1>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af", marginBottom: 20 }}>
                Step {stageIndex + 1} of {STAGES.length}
              </p>
              <p style={{ fontSize: 18, color: "#374151", lineHeight: 1.7, marginBottom: 0 }}>
                {hero?.description ?? activeStage.purpose}
              </p>
            </div>
            {/* Deliverables strip */}
            {hero?.deliverables && (
              <div style={{ padding: "20px 48px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginRight: 4 }}>Outputs</span>
                {hero.deliverables.map((d) => (
                  <span key={d} style={{ fontSize: 12, fontWeight: 500, color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 12px" }}>
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Body */}
      {isGenerating ? (
        /* Progress View */
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 80,
          }}
        >
          <div style={{ width: "100%", maxWidth: 480 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#2563eb",
                marginBottom: 12,
                marginTop: 0,
              }}
            >
              {activeStage.name}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 32, marginTop: 0 }}>
              Generating your report...
            </p>
            <div
              style={{
                height: 4,
                background: "#e5e7eb",
                borderRadius: 2,
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "#2563eb",
                  borderRadius: 2,
                  width: `${progressValue}%`,
                  transition: "width 150ms ease-out",
                }}
              />
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{progressMessage}</p>
          </div>
        </div>
      ) : isReportComplete ? (
        /* Report View */
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Left: Stage complete */}
          <div
            style={{
              width: "35%",
              padding: "48px 40px",
              borderRight: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#d1fae5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                <path d="M1.5 9l6 6L20.5 1.5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#059669",
                marginBottom: 8,
                marginTop: 0,
              }}
            >
              Stage complete
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8, marginTop: 0 }}>
              {activeStage.name}
            </p>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 40, marginTop: 0, lineHeight: 1.6 }}>
              {activeStage.purpose}
            </p>

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
                  padding: "14px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Continue to {nextStage.name}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#059669",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "14px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.5 7.5l4 4 7-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Strategy Complete
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 16, lineHeight: 1.6 }}>
                  All five stages are done. Your strategy has been framed, diagnosed, decided, positioned, and committed.
                </p>
              </div>
            )}
          </div>

          {/* Right: Report */}
          <div style={{ flex: 1, padding: "48px 48px", overflowY: "auto" }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#9ca3af",
                marginBottom: 24,
                marginTop: 0,
              }}
            >
              {activeStage.name} Report
            </p>
            <div style={{ maxWidth: 680 }}>{activeState.report && renderReport(activeState.report)}</div>
          </div>
        </div>
      ) : (
        /* Question Flow View */
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Left: Question area */}
          <div
            style={{
              width: "45%",
              padding: "56px 48px 48px",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >

            {!allAnswered ? (
              <>
                {/* Question text */}
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#111827",
                    lineHeight: 1.4,
                    marginBottom: 8,
                    marginTop: 0,
                  }}
                >
                  {currentQ.question}
                </p>
                <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 24, marginTop: 0 }}>
                  Q{activeState.currentQuestion + 1} of {activeStage.questions.length}
                </p>

                {/* Input */}
                <QuestionInput
                  question={currentQ}
                  answer={currentAnswer}
                  onChange={handleAnswer}
                />

                {/* Back / Next buttons */}
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
                        fontSize: 14,
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
                      fontSize: 14,
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
              /* All answered — show run report */
              <div>
                <div
                  style={{
                    background: "#f9fafb",
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
                        background: "#dbeafe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4"
                          stroke="#2563eb"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                      All questions answered
                    </p>
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                    Run the report to generate your strategic analysis for the {activeStage.name} stage and unlock the next step.
                  </p>
                </div>

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
                      fontSize: 14,
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
                      fontSize: 14,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Edit answers
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Answer summary */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <AnswerSummaryPanel
              stage={activeStage}
              answers={activeState.answers}
              currentQuestion={activeState.currentQuestion}
            />
          </div>
        </div>
      )}
    </div>
  );
}
