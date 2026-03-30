# Nth Layer Signal Portal — Prompt Contracts

Every analysis module has a defined contract: structured input → structured JSON output.
All prompts include the Nth Layer voice directive.

---

## Voice Directive (prepended to ALL prompts)

```
You are a senior operating partner at a technology-focused private equity firm.
You have 20+ years of experience building and scaling B2B software companies.
You think like a CEO, not a consultant. You are direct, opinionated, and commercially grounded.

Rules:
- Be specific. Name patterns, not platitudes.
- Be opinionated. If something is weak, say so.
- Be concise. Board-level writing. No filler.
- Ground claims in observable evidence.
- If you lack evidence, say so and state your confidence level.
- Never use phrases like "it's important to", "in today's landscape", "leverage synergies".
```

---

## Module Contracts

### 1. INPUT_NORMALISATION

**Input**:
```ts
{
  companyUrl: string
  companyName?: string
  priorities: string[] // max 3
  workflow?: { name: string; steps: string[] }
  competitors: string[] // max 3 URLs
  uploadedText?: string[]
}
```

**Prompt**: Not AI-driven. Programmatic validation + normalisation.

**Output**:
```ts
{
  company: { url: string; name: string; domain: string }
  priorities: string[]
  workflow: { name: string; steps: string[] } | null
  competitors: { url: string; domain: string }[]
  documents: { summary: string; wordCount: number }[]
}
```

---

### 2. COMPANY_RESEARCH

**Input**: `{ companyUrl: string; companyName: string }`

**Prompt**:
```
Analyse the company at {url} ({name}).
Extract: what they do, who they serve, their product(s), pricing model, team signals,
funding stage, tech stack signals, and any recent news or changes.
Use only publicly available information.
```

**Output**:
```ts
{
  description: string
  sector: string
  targetCustomer: string
  products: string[]
  pricingModel: string
  teamSignals: string[]
  fundingStage: string
  techSignals: string[]
  recentChanges: string[]
  sources: string[]
}
```

---

### 3. COMPETITOR_RESEARCH

**Input**: `{ competitors: { url: string; domain: string }[] }`

**Prompt**:
```
For each competitor, extract: what they do, positioning, key differentiators,
pricing signals, GTM approach, recent moves. Public information only.
```

**Output**:
```ts
{
  competitors: Array<{
    url: string
    name: string
    description: string
    positioning: string
    differentiators: string[]
    pricingSignals: string[]
    gtmApproach: string
    recentMoves: string[]
    sources: string[]
  }>
}
```

---

### 4. POSITIONING_ANALYSIS

**Input**: `{ company: CompanyResearch; competitors: CompetitorResearch[]; priorities: string[] }`

**Prompt**:
```
Based on the company profile and competitive landscape:
1. Where is this company actually positioned? (not where they say they are)
2. Is the positioning defensible?
3. Where are the gaps between stated positioning and reality?
4. What would a buyer/customer actually choose them for?

Be direct. If the positioning is weak or generic, say so.
```

**Output**:
```ts
{
  statedPositioning: string
  actualPositioning: string
  defensibility: "strong" | "moderate" | "weak"
  defensibilityReason: string
  gaps: string[]
  buyerReason: string
  recommendation: string
}
```

---

### 5. COMPETITIVE_ANALYSIS

**Input**: `{ company: CompanyResearch; competitors: CompetitorResearch[]; positioning: PositioningOutput }`

**Prompt**:
```
Assess the competitive reality:
1. Who is actually winning and why?
2. Where is this company ahead vs behind?
3. What competitive moves should they fear?
4. Kill list: what competitor weaknesses can be exploited immediately?
```

**Output**:
```ts
{
  marketLeader: string
  leaderReason: string
  companyAdvantages: string[]
  companyDisadvantages: string[]
  threatMoves: string[]
  killList: Array<{ competitor: string; weakness: string; action: string }>
}
```

---

### 6. WORKFLOW_ANALYSIS

**Input**: `{ workflow: { name: string; steps: string[] }; company: CompanyResearch }`

**Prompt**:
```
Analyse the workflow: {name}
Steps: {steps}

1. Where is this workflow broken or inefficient?
2. Where can AI/automation create step-change improvement?
3. What's the realistic ROI of fixing this?
4. What would "10x better" look like?
```

**Output**:
```ts
{
  workflowName: string
  currentState: string
  brokenPoints: string[]
  aiOpportunities: Array<{ step: string; opportunity: string; impact: "high" | "medium" | "low" }>
  estimatedROI: string
  tenXVision: string
}
```

---

### 7. AI_OPERATING_MODEL

**Input**: `{ company: CompanyResearch; workflow: WorkflowOutput; competitors: CompetitorResearch[] }`

**Prompt**:
```
Assess AI readiness and opportunity:
1. How is this company currently using AI? (signals only)
2. How are competitors using AI?
3. What's realistic vs hype in their AI narrative?
4. What AI investments would create genuine operating leverage?
5. What's the risk of doing nothing on AI?
```

**Output**:
```ts
{
  currentAIUsage: string
  competitorAIUsage: string[]
  hypeVsReality: string
  highValueAIInvestments: Array<{ area: string; impact: string; complexity: "low" | "medium" | "high" }>
  doNothingRisk: string
}
```

---

### 8. VALUE_CREATION

**Input**: `{ company: CompanyResearch; positioning: PositioningOutput; competitive: CompetitiveOutput; workflow: WorkflowOutput; ai: AIOutput }`

**Prompt**:
```
Identify the top value creation levers:
1. Revenue acceleration opportunities
2. Margin improvement opportunities
3. Product moat opportunities
4. Operational efficiency gains
5. M&A or partnership angles

Rank by impact and feasibility. Be specific about numbers where possible.
```

**Output**:
```ts
{
  levers: Array<{
    category: "revenue" | "margin" | "moat" | "efficiency" | "inorganic"
    lever: string
    impact: "high" | "medium" | "low"
    feasibility: "high" | "medium" | "low"
    timeframe: string
    detail: string
  }>
}
```

---

### 9. STRATEGIC_BETS

**Input**: `{ company: CompanyResearch; valueCreation: ValueCreationOutput; competitive: CompetitiveOutput }`

**Prompt**:
```
Define 3-5 strategic bets this company should make:
For each bet:
- What is it?
- Why now?
- What's the upside?
- What's the risk?
- What does success look like in 12 months?

These should be bold but grounded. Not obvious. Not safe.
```

**Output**:
```ts
{
  bets: Array<{
    title: string
    description: string
    whyNow: string
    upside: string
    risk: string
    successIn12Months: string
  }>
}
```

---

### 10. CEO_ACTIONS

**Input**: `{ bets: StrategicBetsOutput; valueCreation: ValueCreationOutput; competitive: CompetitiveOutput }`

**Prompt**:
```
Write the CEO's 90-day action plan.
- Week 1-2: immediate actions
- Week 3-6: build phase
- Week 7-12: execution phase

Each action must be specific, assignable, and measurable.
No vague "explore" or "consider" actions.
```

**Output**:
```ts
{
  immediate: Array<{ action: string; owner: string; metric: string }>
  buildPhase: Array<{ action: string; owner: string; metric: string }>
  executionPhase: Array<{ action: string; owner: string; metric: string }>
}
```

---

### 11. DO_NOTHING

**Input**: `{ company: CompanyResearch; competitive: CompetitiveOutput; ai: AIOutput }`

**Prompt**:
```
Paint the picture of what happens if this company changes nothing.
- 6 month outlook
- 12 month outlook
- 24 month outlook

Be honest and direct. This should create urgency without being alarmist.
Include specific competitive threats and market shifts.
```

**Output**:
```ts
{
  sixMonths: string
  twelveMonths: string
  twentyFourMonths: string
  biggestRisk: string
  probabilityOfDecline: "high" | "medium" | "low"
}
```

---

### 12. BOARD_NARRATIVE

**Input**: `{ all previous module outputs }`

**Prompt**:
```
Write a board-level executive summary. 2-3 paragraphs max.
- Lead with the single most important finding
- Include the key tension or risk
- End with the recommended path forward
- Write for a board that has 5 minutes to read this

This is the opening of the report. It must be sharp.
```

**Output**:
```ts
{
  narrative: string // 2-3 paragraphs, markdown
}
```

---

### 13. EDITORIAL_OUTPUT

**Input**: `{ all module outputs, boardNarrative }`

**Prompt**:
```
Review the full analysis for:
1. Consistency — do modules contradict each other?
2. Specificity — replace any vague statements with concrete ones
3. Tone — ensure operator voice throughout, no consultant-speak
4. Gaps — flag anything that feels unsupported

Return the final edited versions of any sections that need changes.
```

**Output**:
```ts
{
  edits: Array<{ module: string; original: string; revised: string; reason: string }>
  overallQuality: "publishable" | "needs_revision" | "significant_issues"
  flags: string[]
}
```

---

## Competitor Teardown Modules

### COMPETITOR_SNAPSHOT
**Input**: `{ competitorUrl: string }`
**Output**: `{ name, description, founded, hq, teamSize, funding, sector, sources[] }`

### PRODUCT_SHAPE
**Input**: `{ snapshot: CompetitorSnapshot }`
**Output**: `{ products[], architecture, integrations[], pricingModel, techStack[] }`

### AI_NARRATIVE
**Input**: `{ snapshot, productShape }`
**Output**: `{ claims[], reality, gapAnalysis, genuineCapabilities[] }`

### GTM_SIGNALS
**Input**: `{ snapshot, productShape }`
**Output**: `{ channels[], messaging, targetSegments[], partnerships[], recentCampaigns[] }`

### STRENGTHS
**Input**: `{ snapshot, productShape, gtm }`
**Output**: `{ strengths: Array<{ area, evidence, durability }> }`

### VULNERABILITIES
**Input**: `{ snapshot, productShape, gtm, strengths }`
**Output**: `{ vulnerabilities: Array<{ area, evidence, exploitability }> }`

### NEXT_MOVES
**Input**: `{ all teardown modules }`
**Output**: `{ predictions: Array<{ move, likelihood, timeframe, evidence }> }`

### RESPONSE_STRATEGY
**Input**: `{ all teardown modules }`
**Output**: `{ ifCompeting: string, attackVectors[], defensiveActions[], strategicAdvice: string }`

---

## Deal DD Modules

### PRODUCT_RISK
**Input**: `{ company research, product shape }`
**Output**: `{ risks: Array<{ risk, severity, evidence, mitigant }> }`

### GTM_RISK
**Input**: `{ company research, GTM signals }`
**Output**: `{ risks: Array<{ risk, severity, evidence, mitigant }> }`

### AI_REALISM
**Input**: `{ company research, AI narrative }`
**Output**: `{ assessment, hypeScore: 1-10, genuineCapabilities[], overclaimedCapabilities[] }`

### EXECUTION_RISK
**Input**: `{ company research, team signals }`
**Output**: `{ risks: Array<{ risk, severity, evidence, mitigant }> }`

### VALUE_CREATION_LEVERS
**Input**: `{ all DD modules }`
**Output**: `{ levers: Array<{ lever, category, impact, timeframe, prerequisite }> }`
