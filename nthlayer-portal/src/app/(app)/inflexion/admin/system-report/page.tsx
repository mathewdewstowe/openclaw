import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function SystemReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/admin");

  return (
    <div>
      {/* Screen-only header */}
      <div className="no-print" style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>System Architecture Report</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>Full technical and product documentation of the Inflexion strategy pipeline. Admin only.</p>
        </div>
        <PrintButton />
      </div>

      {/* Report body — prints cleanly */}
      <div id="system-report" style={{ fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 900, margin: "0 auto", color: "#111827", lineHeight: 1.7 }}>

        {/* ── Cover ── */}
        <div style={{ borderBottom: "3px solid #111827", paddingBottom: 32, marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280", marginBottom: 12 }}>Nth Layer · Inflexion Platform · Internal Documentation</p>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", color: "#111827", marginBottom: 8, lineHeight: 1.2 }}>System Architecture & Agent Flow Report</h1>
          <p style={{ fontSize: 16, color: "#374151", marginBottom: 24 }}>
            A complete technical and product reference for the Inflexion strategy pipeline — covering all five stages, Claude Managed Agent configuration, system prompts, input schemas, data cascade logic, and downstream feature wiring.
          </p>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              { label: "Stages", value: "5" },
              { label: "Claude Agents", value: "5" },
              { label: "Input types", value: "6" },
              { label: "Output sections", value: "10" },
              { label: "Downstream features", value: "5" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 0 }}>{value}</p>
                <p style={{ fontSize: 12, color: "#6b7280", fontFamily: "system-ui, sans-serif" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 1. System Overview ── */}
        <Section num="1" title="System Overview">
          <p>
            Inflexion is a structured strategy engine that guides operators, investors, and portfolio company CEOs through a five-stage strategic reasoning process. Each stage is powered by a dedicated Claude Managed Agent with a bespoke system prompt, web search capability (except Commit), and a defined output schema.
          </p>
          <p>
            The pipeline is sequential and cascading: outputs from earlier stages are passed in full as context to each subsequent agent. By the time the final Commit stage runs, the agent has access to the complete output of all four prior stages.
          </p>
          <p>
            Users interact through a structured Q&A interface for each stage. Answers are formatted into a user message sent to the agent alongside company context, persona framing, evidence rules, and prior stage outputs. The agent returns structured JSON via a custom tool call (<code>produce_strategic_diagnosis</code>), which is stored as an <code>Output</code> record in the database.
          </p>

          <SubHeading>Flow Summary</SubHeading>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#111827", color: "#fff" }}>
                  {["Stage", "Purpose", "Web Search", "Context In", "Context Out"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Frame", "Define the inflection point and what winning looks like", "Yes", "None (first stage)", "Strategic problem, hypothesis, winning conditions, boundaries"],
                  ["Diagnose", "Assess current reality across market, competitive, and capability dimensions", "Yes", "Frame full output", "PMF status, competitive position, unit economics, capability gaps"],
                  ["Decide", "Evaluate strategic options and choose with explicit criteria", "Yes", "Frame + Diagnose full outputs", "Chosen direction, WWHTBT conditions, kill criteria, staged investment plan"],
                  ["Position", "Translate direction into a precise market stance", "Yes", "Frame + Diagnose + Decide full outputs", "Target ICP, positioning statement, structural defensibility plan"],
                  ["Commit", "Synthesise into bets, OKRs, 100-day plan, governance", "No", "All four prior stage full outputs", "Strategic bets, OKRs, 100-day plan, kill criteria, governance rhythm"],
                ].map(([stage, purpose, web, contextIn, contextOut], i) => (
                  <tr key={stage} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{stage}</td>
                    <td style={{ padding: "10px 14px" }}>{purpose}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>{web === "Yes" ? "✓" : "✗"}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{contextIn}</td>
                    <td style={{ padding: "10px 14px", color: "#374151" }}>{contextOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 2. Claude Managed Agents Infrastructure ── */}
        <Section num="2" title="Claude Managed Agents Infrastructure">
          <p>
            Each stage runs on a dedicated Claude Managed Agent created in the Anthropic Agents Console. The agents are pre-configured with system prompts, tools (web search, <code>produce_strategic_diagnosis</code>), and environment access. The application uses the <code>agents-2025-05-01</code> beta API.
          </p>

          <SubHeading>Agent Registry</SubHeading>
          <CodeBlock>{`AGENT_IDS = {
  frame:    "agent_011CZxASTpo7h65YQMRVDDYN",
  diagnose: "agent_011CZumeXoZuFJ35jRA8Ta2R",
  decide:   "agent_011CZvZtjfw9foNabrMh92ii",
  position: "agent_011CZvZtkfyRGNw3S3RMjHMj",
  commit:   "agent_011CZvZtmvNzntBKmhqtcwAS",
}

ENVIRONMENT_ID = "env_01BG6FT972a92oDBJcBMwt2y"`}</CodeBlock>

          <SubHeading>Session Lifecycle</SubHeading>
          <ol style={{ paddingLeft: 20, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
            <li style={{ marginBottom: 8 }}><strong>Session created</strong> — <code>client.beta.sessions.create()</code> with agent ID, environment ID, title, and stage metadata.</li>
            <li style={{ marginBottom: 8 }}><strong>User message sent</strong> — <code>client.beta.sessions.events.send()</code> sends a single user message containing: persona framing + evidence discipline + stage instructions + company block + prior stage context + formatted Q&A answers + tool call instruction.</li>
            <li style={{ marginBottom: 8 }}><strong>Agent runs</strong> — The agent uses web search (except Commit), reasons through the inputs, and calls <code>produce_strategic_diagnosis</code> with its structured JSON output.</li>
            <li style={{ marginBottom: 8 }}><strong>Polling</strong> — The app polls <code>GET /api/strategy/report/status?sessionId=...</code> every 3 seconds. The poller fetches all session events and looks for <code>agent.custom_tool_use</code>.</li>
            <li style={{ marginBottom: 8 }}><strong>MCP tool confirmations</strong> — If the session enters <code>idle</code> with <code>stop_reason.type === "requires_action"</code>, the poller auto-approves all pending tool use IDs.</li>
            <li style={{ marginBottom: 8 }}><strong>Output extracted</strong> — When <code>agent.custom_tool_use</code> is found, <code>te.input</code> contains the full sections JSON. The session is archived.</li>
            <li style={{ marginBottom: 8 }}><strong>Persisted</strong> — An <code>Output</code> database record is created. The <code>Job</code> record is updated to <code>completed</code> with the output ID.</li>
          </ol>

          <SubHeading>Tools Available to Agents</SubHeading>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  {["Tool", "Available in stages", "Purpose"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["web_search", "Frame, Diagnose, Decide, Position", "Retrieves live market data, competitor news, analyst reports, macro trends. Requires MCP tool confirmation (auto-approved by poller)."],
                  ["produce_strategic_diagnosis", "All stages", "Custom tool — the agent calls this when analysis is complete. Input is the full OutputSections JSON. Acts as the signal that the session is done."],
                ].map(([tool, stages, purpose], i) => (
                  <tr key={tool} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>{tool}</td>
                    <td style={{ padding: "8px 12px" }}>{stages}</td>
                    <td style={{ padding: "8px 12px" }}>{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 3. User Message Construction ── */}
        <Section num="3" title="User Message Construction">
          <p>Every agent receives a single user message built from six blocks, assembled in this order:</p>
          <CodeBlock>{`[1] Persona Framing        — Role-specific lens (PE, VC, CEO, etc.)
[2] Evidence Discipline   — MANDATORY rules about fabrication, citations, confidence
[3] Stage Instructions    — Stage-specific research requirements and section structure
[4] Company Block         — Name, URL, sector, location, territory, ICPs, competitors
[5] Prior Stage Context   — Full output of every completed prior stage (cascade)
[6] User Inputs           — Formatted Q&A from the stage questionnaire
    → "Call the produce_strategic_diagnosis tool when done."`}</CodeBlock>

          <SubHeading>Evidence Discipline Block (injected into all stages)</SubHeading>
          <CodeBlock>{`## Evidence Discipline — MANDATORY
- Do NOT fabricate data, statistics, market share figures, or company-specific facts
- Only cite URLs you have actually retrieved via web search in this session
- If a fact is unverifiable, explicitly say "unverified" and reflect this in the confidence score
- Confidence scoring: 0.8+ = strong evidence base; 0.4–0.6 = directional signals only; 0.2 = speculative
- Quote specific phrases directly from the user inputs rather than paraphrasing them
- Do not invent competitor behaviours, market sizes, or growth rates`}</CodeBlock>

          <SubHeading>Company Block Format</SubHeading>
          <CodeBlock>{`## Company: [name]
Website: [url]
Sector: [sector]
Location: [location]
Primary market territory: [territory]

### Ideal Customer Profiles
1. [icp1]
2. [icp2]
3. [icp3]

### Known Competitors
[comma-separated list]`}</CodeBlock>

          <SubHeading>Prior Stage Context Format</SubHeading>
          <CodeBlock>{`## Prior Stage Findings — Complete Cascade Context

The following contains the FULL output from each completed prior stage.
Use ALL of this evidence when synthesising your response — do not rely
only on the executive summaries.

### Frame Stage — Full Output
[full formatted sections from Frame output]

---

### Diagnose Stage — Full Output
[full formatted sections from Diagnose output]

---

[continues for each completed prior stage]`}</CodeBlock>
        </Section>

        {/* ── 4. Persona Framing ── */}
        <Section num="4" title="Persona Framing">
          <p>The selected persona from Stage 1 (Frame) is passed through all subsequent stages. It modifies the analytical lens and communication register of every output.</p>

          {[
            {
              persona: "PE Partner / Principal",
              trigger: "\"pe partner\" or \"pe principal\"",
              framing: `Frame every insight through the lens of investment thesis validation and value creation events. Emphasise EBITDA trajectory, margin expansion, multiple expansion opportunities, capital allocation efficiency, return on invested capital, exit readiness. Be quantitative. Prioritise commercially material findings over operational detail.`,
            },
            {
              persona: "VC Investor",
              trigger: "\"vc investor\" or \"vc \"",
              framing: `Frame every insight through the lens of total addressable market size and growth trajectory, 10x outcome potential, funding positioning, competitive moat and structural advantages, founder/team/market timing risk. Prioritise growth potential and defensibility over near-term profitability.`,
            },
            {
              persona: "Portfolio Company CEO",
              trigger: "\"portfolio company ceo\" or \"ceo\"",
              framing: `Be direct and execution-focused. Emphasise P&L reality, board accountability, organisational capacity, decision rights, near-term vs long-term trade-offs with explicit sequencing. Avoid strategic abstractions. Translate every recommendation into concrete actions.`,
            },
            {
              persona: "Portfolio Leadership Team",
              trigger: "\"portfolio leadership\" or \"leadership team\"",
              framing: `Balance strategic insight with operational reality. Emphasise cross-functional implications (product, commercial, ops, finance), resource constraints, leadership alignment, execution risk, quick wins vs strategic investments. Write for a senior operator audience, not just the CEO.`,
            },
            {
              persona: "Independent Advisor / Fractional CPO",
              trigger: "\"advisor\", \"fractional\", or \"cpo\"",
              framing: `Provide board-ready recommendations with clear rationale. Reference established frameworks (Helmer's 7 Powers, JTBD, Wardley mapping) where relevant. Provide honest assessment of what the data does and does not support. Include explicit assumptions and confidence levels. Surface options the leadership team may not be considering. Write with the authority of a trusted outside perspective.`,
            },
          ].map(({ persona, trigger, framing }) => (
            <div key={persona} style={{ marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 20px", background: "#f9fafb" }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, fontFamily: "system-ui, sans-serif" }}>{persona}</p>
              <p style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace", marginBottom: 8 }}>Triggered when persona contains: {trigger}</p>
              <p style={{ fontSize: 13, color: "#374151", fontFamily: "system-ui, sans-serif", margin: 0 }}>{framing}</p>
            </div>
          ))}
        </Section>

        {/* ── 5. Stage 1: Frame ── */}
        <StageSection
          num="5"
          stageNum="01"
          stageId="frame"
          stageName="Frame"
          agentId="agent_011CZxASTpo7h65YQMRVDDYN"
          webSearch={true}
          purpose="Define the inflection point, establish what winning looks like in 24–36 months, and set the decision boundaries that all subsequent stages operate within."
          why="Without a clear frame, every downstream analysis drifts. The Frame stage forces explicit articulation of why now, what winning means, and what is and isn't in scope — providing the anchor point all other stages reference."
          contextIn="None — Frame is the first stage. It receives only company context and user inputs."
          contextOut="Strategic problem statement, winning conditions, decision boundaries, strategic hypothesis, macro/market context, assumptions, confidence score, risks, actions, monitoring metrics."
          systemPrompt={`## Stage Instructions: FRAME
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
- In recommendation: use sub-section "### Strategic Hypothesis"`}
        />

        {/* ── 6. Stage 2: Diagnose ── */}
        <StageSection
          num="6"
          stageNum="02"
          stageId="diagnose"
          stageName="Diagnose"
          agentId="agent_011CZumeXoZuFJ35jRA8Ta2R"
          webSearch={true}
          purpose="Assess current reality across product-market fit, competitive position, unit economics, and operational capability — separating the gaps that constrain strategic options from operational noise."
          why="Strategy built on wishful thinking fails. Diagnose forces an honest, structured assessment of where the business actually stands before options are evaluated. It separates real constraints from noise, and grounds the Decide stage in fact rather than preference."
          contextIn="Full Frame output (strategic problem, hypothesis, winning conditions, macro context, assumptions, risks, actions)."
          contextOut="PMF assessment, competitive landscape analysis, unit economics diagnosis, capability gap matrix, evidence base with citations, confidence score, risks, actions, monitoring metrics."
          systemPrompt={`## Stage Instructions: DIAGNOSE
Build a structured fact base. Structure your analysis around:
1. The problem — where product-market fit is real versus forced, and why it matters
2. The opportunity — which competitive dynamics create an opening if acted on
3. The hypothesis — what the diagnostic data suggests about the company's actual position
4. The assumptions — what must be true for the diagnosis to hold

Use web search to research before forming your analysis:
- Recent news about named competitors (funding, product launches, pricing changes, leadership moves, layoffs)
- Macro and sector-level trends that constrain or accelerate the strategic options
- Financial health signals for the sector (VC sentiment, public market multiples, fundraising conditions)
- Any recent analyst reports, news articles, or industry commentary relevant to this company's market

Cite URLs for all externally sourced claims. Separate the constraining gaps from operational noise. Output must include an honest assessment of where the business genuinely stands — do not soften difficult findings.

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Business Assessment"
- In what_matters: use sub-sections "### Product-Market Fit", "### Competitive Landscape"
- In recommendation: use sub-sections "### Unit Economics", "### Capability Assessment"`}
        />

        {/* ── 7. Stage 3: Decide ── */}
        <StageSection
          num="7"
          stageNum="03"
          stageId="decide"
          stageName="Decide"
          agentId="agent_011CZvZtjfw9foNabrMh92ii"
          webSearch={true}
          purpose="Surface genuine strategic options — including inaction — and pressure-test each against what must be true for it to succeed. Produce a committed direction with explicit assumptions and kill criteria."
          why="Most strategy processes produce a list of options but avoid commitment. Decide forces a choice, makes the assumptions explicit, and sets the conditions under which the strategy would change. The WWHTBT framework (What Would Have to Be True) is the core analytical tool."
          contextIn="Full Frame output + Full Diagnose output."
          contextOut="Evaluated options with WWHTBT conditions for each, recommended direction, kill criteria, staged investment logic, evidence base, confidence score, risks, actions, monitoring metrics."
          systemPrompt={`## Stage Instructions: DECIDE
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
- Has anything changed recently that affects the risk profile of each option?
- What are comparable companies doing — is there a playbook or counter-example?
- What does current financial market sentiment say about businesses taking each approach?

Output is a committed strategic direction — not a list of possibilities — with assumptions and trade-offs visible.

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Strategic Options"
- In recommendation: use sub-sections "### Recommended Direction", "### What Must Be True", "### Kill Criteria"`}
        />

        {/* ── 8. Stage 4: Position ── */}
        <StageSection
          num="8"
          stageNum="04"
          stageId="position"
          stageName="Position"
          agentId="agent_011CZvZtkfyRGNw3S3RMjHMj"
          webSearch={true}
          purpose="Translate the chosen strategic direction into a precise market stance — defining exactly who is served, what the business does better than any alternative, and how structural advantages are built."
          why="A strategy without a position is directionless execution. Positioning forces specificity: not 'we serve mid-market' but 'we serve mid-market finance teams at Series B SaaS companies who need audit-grade data pipelines'. This specificity gives product, GTM, and commercial teams a single coherent target."
          contextIn="Full Frame output + Full Diagnose output + Full Decide output."
          contextOut="Target ICP definition, job-to-be-done, competitive advantage analysis (Hamilton Helmer's 7 Powers referenced), positioning statement, structural defensibility plan, moat-building roadmap, confidence score, risks, actions, monitoring metrics."
          systemPrompt={`## Stage Instructions: POSITION
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
- What are the named and emerging competitors doing right now?
- What do customers in this category actually care about?
- Are there macro or technology trends that create or close positioning windows?
- What financing or M&A activity signals where the category is heading?

Output gives product, GTM, and commercial teams a single coherent position to build from.

REQUIRED SECTION STRUCTURE:
- In executive_summary: begin with "### Target Customer"
- In what_matters: use sub-section "### Competitive Advantage"
- In recommendation: use sub-sections "### Positioning Statement", "### Structural Defensibility"`}
        />

        {/* ── 9. Stage 5: Commit ── */}
        <StageSection
          num="9"
          stageNum="05"
          stageId="commit"
          stageName="Commit"
          agentId="agent_011CZvZtmvNzntBKmhqtcwAS"
          webSearch={false}
          purpose="Synthesise all prior stage findings into a single board-ready strategic document with resourced bets, measurable OKRs, a 100-day execution plan, kill criteria, and a governance rhythm."
          why="Without commitment, strategy is theatre. Commit translates direction into decisions: which bets to back with resources, how progress will be measured, what would cause a change of course, and who is accountable for what by when. It is the only stage that does NOT use web search — all evidence has been gathered. Commit synthesises, not researches."
          contextIn="Full Frame output + Full Diagnose output + Full Decide output + Full Position output. All four prior stages."
          contextOut="Named strategic bets with hypotheses, OKR architecture, 100-day plan (30/60/90 milestones), kill criteria, governance rhythm, horizon allocation, confidence score, risks, actions, monitoring metrics."
          systemPrompt={`## Stage Instructions: COMMIT (FINAL SYNTHESIS)
This is the FINAL strategic report. You MUST synthesise ALL prior stage findings into a single cohesive, board-ready strategic document. Do NOT simply repeat or summarise what was said in prior stages — synthesise it into a unified direction. Structure your synthesis around:
1. The problem — the inflection the business is navigating, distilled from all five stages
2. The opportunity — the specific strategic bet that addresses the problem
3. The hypothesis — what the strategy is betting on, made explicit
4. The assumptions — what must remain true for the strategy to hold

The output must include:
- Strategic bets: name each bet with its hypothesis
- OKRs: at least 3, each with an objective and 2–3 key results
- 100-day plan: milestones at 30, 60, and 90 days with specific named owners and concrete deliverables
- Kill criteria: the conditions that would cause you to change direction
- Governance rhythm: how and how often progress is reviewed
- Horizon allocation: how resources are split across now / next / later

Do NOT use web search — all evidence has been gathered in prior stages. Synthesise from the prior stage context provided. Make the strategy coherent, not a composite of five separate reports.

REQUIRED SECTION STRUCTURE:
- In recommendation: use sub-sections "### Strategic Bets", "### What Must Be True", "### Kill Criteria"
- In what_matters: use sub-section "### OKRs"
- In business_implications: use sub-sections "### 100-Day Plan", "### Resource Allocation"`}
        />

        {/* ── 10. Output Schema ── */}
        <Section num="10" title="Output Schema">
          <p>
            Every stage produces an <code>Output</code> record stored in the database. All outputs share the same 10-section JSON schema, regardless of which stage produced them. The agent populates these sections by calling the <code>produce_strategic_diagnosis</code> tool.
          </p>
          <CodeBlock>{`type OutputSections = {
  executive_summary:      string                    // Narrative summary. Frame sub-section depends on stage.
  what_matters:           string                    // The 3 factors dominating the strategic picture.
  recommendation:         string                    // The specific recommendation or direction.
  business_implications:  string                    // What this means for revenue, product, team.
  evidence_base: {
    sources:  string[]                              // URLs and source descriptions. Only cited if actually retrieved.
    quotes:   string[]                              // Direct quotes from external sources or user inputs.
  }
  assumptions:            string[]                  // Explicit assumptions the analysis rests on.
  confidence: {
    score:    number                                // 0–1. 0.8+ strong; 0.4–0.6 directional; 0.2 speculative.
    rationale: string                               // Why this confidence level was assigned.
  }
  risks: Array<{
    risk:       string
    severity:   "high" | "medium" | "low"
    mitigation: string
  }>
  actions: Array<{
    action:   string
    owner:    string
    deadline: string
    priority: "critical" | "high" | "medium" | "low"
  }>
  monitoring: Array<{
    metric:    string
    target:    string
    frequency: string
  }>
}`}</CodeBlock>

          <SubHeading>Database Record (Output model)</SubHeading>
          <CodeBlock>{`Output {
  id            String    // CUID
  companyId     String
  jobId         String?
  workflowType  String    // "frame" | "diagnose" | "decide" | "position" | "commit"
  outputType    String    // e.g. "strategic_diagnosis", "executive_strategic_brief"
  title         String    // e.g. "Diagnose Report — Acme Corp"
  sections      Json      // OutputSections above
  version       Int       // Increments per stage per company
  confidence    Float?    // Mirrored from sections.confidence.score
  sources       String[]  // Mirrored from sections.evidence_base.sources
  tags          String[]  // User-applied tags (default [])
  createdAt     DateTime
  updatedAt     DateTime
}`}</CodeBlock>
        </Section>

        {/* ── 11. Data Cascade Between Stages ── */}
        <Section num="11" title="Data Cascade Between Stages">
          <p>
            When a user arrives at each stage, the server fetches the most recent completed output for every prior stage and passes the full formatted content as context to the agent. This is not a summary — it is the complete output text of each prior stage.
          </p>

          <SubHeading>What passes from each stage</SubHeading>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  {["From stage", "Data passed to next stages", "Format"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Frame", "Strategic problem, winning conditions, decision boundaries, strategic hypothesis, macro context, assumptions, risks, confidence", "Full formatted sections (all 10 fields)"],
                  ["Diagnose", "PMF assessment, competitive landscape, unit economics, capability gaps, cited evidence with URLs", "Full formatted sections (all 10 fields)"],
                  ["Decide", "Evaluated options, recommended direction, WWHTBT conditions, kill criteria, staged investment plan", "Full formatted sections (all 10 fields)"],
                  ["Position", "Target ICP, job-to-be-done, competitive advantage type, positioning statement, structural defensibility roadmap", "Full formatted sections (all 10 fields)"],
                  ["Commit", "Final synthesis only — not cascaded further", "N/A — terminal stage"],
                ].map(([from, data, format], i) => (
                  <tr key={from} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>{from}</td>
                    <td style={{ padding: "8px 12px" }}>{data}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{format}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SubHeading>Company context (passed to all stages)</SubHeading>
          <p>In addition to prior stage outputs, every agent also receives the full company profile:</p>
          <ul style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, paddingLeft: 20 }}>
            {["Company name", "Website URL", "Sector", "Location / country", "Primary market territory", "Up to 3 Ideal Customer Profiles (ICP1, ICP2, ICP3)", "Named competitor list"].map(item => (
              <li key={item} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
          <p>This data comes from the Company model and is set during onboarding / company settings.</p>

          <SubHeading>Persona (passed to all stages)</SubHeading>
          <p>The persona selected in Stage 1 (Frame) is stored with the job/output metadata and re-injected into every subsequent stage's user message as the persona framing block. This ensures consistent analytical lens throughout the entire pipeline.</p>

          <SubHeading>Code reference: priorSections passed to suggest-bets API</SubHeading>
          <p>The AI bet suggestion feature (Stage 5 pre-fill) also uses the cascade pattern. It calls <code>POST /api/strategy/suggest-bets</code> with all prior stage sections:</p>
          <CodeBlock>{`// From strategy-flow-v2.tsx — called when user reaches the strategic_bets question
const res = await fetch("/api/strategy/suggest-bets", {
  method: "POST",
  body: JSON.stringify({
    companyName,
    persona,
    priorSections: {  // passed from server via initialCompletedOutputs prop
      frame:    completedOutputs.frame,
      diagnose: completedOutputs.diagnose,
      decide:   completedOutputs.decide,
      position: completedOutputs.position,
    }
  })
});
// Returns 8 structured bets: { "Bet name", "Type", "Hypothesis", "Minimum viable test" }
// Types: Strategic | Capability | Sequencing
// User selects/edits up to 5 as their strategic_bets answers`}</CodeBlock>
        </Section>

        {/* ── 12. Question Input Types ── */}
        <Section num="12" title="Question Input Types">
          <p>The strategy Q&A interface uses six distinct input types. Answers are serialised and formatted before being included in the agent user message.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  {["Type", "UI", "Stored as", "Formatted in message as"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["single-select", "Radio / pill buttons", "string", "Plain text value"],
                  ["multi-select", "Checkbox pills, optional maxSelections", "string[]", "Comma-separated values"],
                  ["free-text", "Open textarea", "string", "Plain text"],
                  ["structured-repeater", "Repeating form with defined fields (e.g. Bet name + Action + Outcome + Hypothesis)", "Array<Record<string, string>>", "Numbered entries: 'Entry 1:\\n  Field: value\\n  Field: value'"],
                  ["percentage-split", "Three sliders that must total 100%", "{ h1: number; h2: number; h3: number }", "'Now: X%, Next: Y%, Later: Z%'"],
                  ["rank", "Drag-rank ordering", "string[] (ordered)", "Ordered list"],
                ].map(([type, ui, stored, formatted], i) => (
                  <tr key={type} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{type}</td>
                    <td style={{ padding: "8px 12px" }}>{ui}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{stored}</td>
                    <td style={{ padding: "8px 12px" }}>{formatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 13. Downstream Features ── */}
        <Section num="13" title="Downstream Features Using Stage Outputs">
          <p>Once a stage output is stored, several features extract and surface specific sections across all completed stages. These run independently of the strategy pipeline and give users persistent, trackable views into their strategy outputs.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                feature: "Actions Tracker",
                path: "/inflexion/actions",
                source: "sections.actions[] from all completed stages",
                extracts: "action, owner, deadline, priority",
                capability: "Users can mark status (not started / in progress / done / blocked / deferred), rate items ✓/✗ for quality feedback, filter by stage.",
              },
              {
                feature: "Risks Tracker",
                path: "/inflexion/risks",
                source: "sections.risks[] from all completed stages",
                extracts: "risk, severity, mitigation",
                capability: "Status tracking (open / monitoring / mitigated / closed / escalated), ✓/✗ feedback, filter by stage, severity badge colouring.",
              },
              {
                feature: "Assumptions Tracker",
                path: "/inflexion/assumptions",
                source: "sections.assumptions[] from all completed stages",
                extracts: "assumption text",
                capability: "Status tracking (unvalidated / validated / invalidated / needs testing / monitoring), ✓/✗ feedback, filter by stage.",
              },
              {
                feature: "Monitoring Tracker",
                path: "/inflexion/monitoring",
                source: "sections.monitoring[] from all completed stages",
                extracts: "metric, target, frequency",
                capability: "Status tracking (active / paused / hit target / missed target / superseded), ✓/✗ feedback, filter by stage.",
              },
              {
                feature: "Ask Inflexion (Chat)",
                path: "/inflexion/chat",
                source: "All completed stage outputs (full sections)",
                extracts: "All sections loaded into chat system prompt",
                capability: "Claude answers questions with citations in [Stage · Section] format. Context is built from all completed outputs for the active company.",
              },
              {
                feature: "Strategy Deck",
                path: "/inflexion/overview (CTA when all 5 stages complete)",
                source: "All 5 stage sections",
                extracts: "13 structured slide data points from across the pipeline",
                capability: "Generates a board-ready PowerPoint (.pptx) via pptxgenjs loaded from CDN. Slide content is pulled from specific sections of each stage output.",
              },
            ].map(({ feature, path, source, extracts, capability }) => (
              <div key={feature} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, margin: 0, fontFamily: "system-ui, sans-serif" }}>{feature}</p>
                  <code style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{path}</code>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 12px", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
                  <span style={{ color: "#9ca3af", fontWeight: 600 }}>Source</span><span>{source}</span>
                  <span style={{ color: "#9ca3af", fontWeight: 600 }}>Extracts</span><span><code style={{ fontSize: 11 }}>{extracts}</code></span>
                  <span style={{ color: "#9ca3af", fontWeight: 600 }}>Capability</span><span>{capability}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 14. Quality & Feedback Loops ── */}
        <Section num="14" title="Quality & Feedback Loops">
          <p>The platform has two feedback mechanisms designed to measure and improve output quality over time.</p>
          <SubHeading>Report-level Feedback (OutputFeedback model)</SubHeading>
          <p>At the end of each completed stage report, users can submit a star rating (1–5) with dimensional scores for accuracy, depth, actionability, and relevance, plus a free-text comment. Visible in <code>/inflexion/admin/feedback</code> with by-stage breakdown.</p>
          <SubHeading>Item-level Feedback (ItemFeedback model)</SubHeading>
          <p>On every action, risk, assumption, and monitoring item across all tracker pages, users can click ✓ (accepted) or ✗ (declined). This is stored per user per item. The admin feedback page aggregates these signals by stage, type, and company to surface which parts of the analysis users find most and least credible. This data is the primary signal for improving system prompt quality over time.</p>
        </Section>

        {/* ── 15. Standard vs Stage-Specific Output Sections ── */}
        <Section num="15" title="Output Sections: Standard vs Stage-Specific">
          <p>
            Every stage output shares the same 10-section schema. Eight sections are standard across all stages — the content varies but the structure is identical. Two sections have stage-specific sub-headings that the agent is instructed to use exactly, enabling the report renderer to create navigable section pills.
          </p>

          <SubHeading>Standard sections (identical schema, all stages)</SubHeading>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  {["Section", "Type", "Content across all stages"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["evidence_base", "{ sources: string[]; quotes: string[] }", "Cited URLs from web search + direct quotes. Empty in Commit (no web search)."],
                  ["assumptions", "string[]", "Explicit assumptions the analysis rests on. Extracted to Assumptions Tracker."],
                  ["confidence", "{ score: number; rationale: string }", "0–1 score. 0.8+ = strong; 0.4–0.6 = directional; 0.2 = speculative."],
                  ["risks", "Array<{ risk, severity, mitigation }>", "Extracted to Risks Tracker. Severity: high / medium / low."],
                  ["actions", "Array<{ action, owner, deadline, priority }>", "Extracted to Actions Tracker. Priority: critical / high / medium / low."],
                  ["monitoring", "Array<{ metric, target, frequency }>", "Extracted to Monitoring Tracker."],
                ].map(([section, type, content], i) => (
                  <tr key={section} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{section}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{type}</td>
                    <td style={{ padding: "8px 12px" }}>{content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SubHeading>Stage-specific sections (same keys, different required sub-headings)</SubHeading>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  {["Stage", "executive_summary starts with", "what_matters sub-sections", "recommendation sub-sections", "business_implications sub-sections"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Frame", "### The Strategic Problem", "### Macro & Market Context · ### Winning Conditions · ### Decision Boundaries", "### Strategic Hypothesis", "—"],
                  ["Diagnose", "### Business Assessment", "### Product-Market Fit · ### Competitive Landscape", "### Unit Economics · ### Capability Assessment", "—"],
                  ["Decide", "### Strategic Options", "—", "### Recommended Direction · ### What Must Be True · ### Kill Criteria", "—"],
                  ["Position", "### Target Customer", "### Competitive Advantage", "### Positioning Statement · ### Structural Defensibility", "—"],
                  ["Commit", "—", "### OKRs", "### Strategic Bets · ### What Must Be True · ### Kill Criteria", "### 100-Day Plan · ### Resource Allocation"],
                ].map(([stage, exec, matters, rec, biz], i) => (
                  <tr key={stage} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>{stage}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#374151" }}>{exec}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#374151" }}>{matters}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#374151" }}>{rec}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#374151" }}>{biz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Footer ── */}
        <div style={{ borderTop: "2px solid #111827", paddingTop: 24, marginTop: 48 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
            Nth Layer · Inflexion Platform · Internal documentation · Admin only · Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #system-report { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          pre { white-space: pre-wrap !important; }
          tr { page-break-inside: avoid; }
          h2, h3 { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em" }}>{num.padStart(2, "0")}</span>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em", fontFamily: "system-ui, sans-serif" }}>{title}</h2>
      </div>
      <div style={{ fontSize: 14, fontFamily: "system-ui, sans-serif", lineHeight: 1.8, color: "#374151" }}>
        {children}
      </div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 28, marginBottom: 10, fontFamily: "system-ui, sans-serif" }}>
      {children}
    </h3>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: "#0f172a",
      color: "#e2e8f0",
      borderRadius: 8,
      padding: "16px 20px",
      fontSize: 12,
      lineHeight: 1.6,
      overflowX: "auto",
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      marginBottom: 16,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }}>
      {children}
    </pre>
  );
}

function StageSection({
  num, stageNum, stageId, stageName, agentId, webSearch,
  purpose, why, contextIn, contextOut, systemPrompt,
}: {
  num: string; stageNum: string; stageId: string; stageName: string; agentId: string; webSearch: boolean;
  purpose: string; why: string; contextIn: string; contextOut: string; systemPrompt: string;
}) {
  const stageColours: Record<string, { bg: string; text: string; border: string }> = {
    frame:    { bg: "#f3f4f6", text: "#374151", border: "#9ca3af" },
    diagnose: { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
    decide:   { bg: "#ede9fe", text: "#6d28d9", border: "#7c3aed" },
    position: { bg: "#d1fae5", text: "#065f46", border: "#059669" },
    commit:   { bg: "#fef3c7", text: "#92400e", border: "#d97706" },
  };
  const col = stageColours[stageId] ?? stageColours.frame;

  return (
    <Section num={num} title={`Stage ${stageNum}: ${stageName}`}>
      {/* Stage header bar */}
      <div style={{ background: col.bg, borderLeft: `4px solid ${col.border}`, borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "system-ui, sans-serif", color: col.text, textTransform: "uppercase", letterSpacing: "0.08em" }}>Stage {stageNum} · {stageName}</span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>Agent: {agentId}</span>
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "system-ui, sans-serif", color: webSearch ? "#059669" : "#dc2626" }}>
            {webSearch ? "✓ Web Search" : "✗ No Web Search (synthesis only)"}
          </span>
        </div>
        <p style={{ fontSize: 14, color: "#374151", margin: 0, fontFamily: "system-ui, sans-serif" }}>{purpose}</p>
      </div>

      <SubHeading>Why this stage exists</SubHeading>
      <p>{why}</p>

      <SubHeading>Context In</SubHeading>
      <p>{contextIn}</p>

      <SubHeading>Context Out (what passes to later stages)</SubHeading>
      <p>{contextOut}</p>

      <SubHeading>System Prompt (Stage Instructions block)</SubHeading>
      <CodeBlock>{systemPrompt}</CodeBlock>
    </Section>
  );
}
