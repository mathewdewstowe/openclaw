import { db } from "../db";
import { runModule, executeStep } from "../ai";
import { renderReport } from "../report-renderer";

const TOTAL_STEPS = 17;

const EVIDENCE_DISCIPLINE = `EVIDENCE DISCIPLINE — read carefully:
- Use ONLY the analysis context above. Do NOT introduce facts that aren't supported by it.
- If upstream data is "Unknown" or thin, your output MUST also be thin. Return fewer items rather than fabricate.
- Quote specific phrases from upstream where possible.
- Confidence 0.7+ requires real evidence. Use 0.4-0.5 when sparse. Use 0.2 when upstream is missing.
- Sources: only cite URLs that already appear in upstream sources. Do NOT fabricate URLs.

`;

export async function runInflectionPipeline(scanId: string) {
  const scan = await db.scan.findUniqueOrThrow({
    where: { id: scanId },
    include: { uploads: true },
  });

  const workflow = scan.workflow as { name: string; steps: string[] } | null;

  // Step 1: Company Research
  const companyResearch = await executeStep(scanId, "company_research", 1, TOTAL_STEPS, () =>
    runModule(scanId, "COMPANY_RESEARCH",
      `You research companies from PRIMARY sources. You MUST use web_search to fetch the actual company website BEFORE writing anything. Do NOT guess from the domain. Do NOT confuse with similarly-named entities. If web_search returns nothing for the exact URL, set fields to "Unknown — website unreachable".`,
      `Use web_search to fetch ${scan.companyUrl}${scan.companyName ? ` (${scan.companyName})` : ""}. Read what the site actually says.

Extract and return JSON. Use "Unknown" liberally if not verifiable:
{
  "description": "from their actual copy or 'Unknown'",
  "sector": "from their own positioning or 'Unknown'",
  "targetCustomer": "from their site or 'Unknown'",
  "products": ["only verified — empty array if unknown"],
  "pricingModel": "from pricing page or 'Not publicly disclosed'",
  "teamSignals": ["only observable signals"],
  "fundingStage": "if visible or 'Unknown'",
  "techSignals": ["only verified — empty array if unknown"],
  "recentChanges": ["only verified — empty array if unknown"],
  "sources": ["${scan.companyUrl}", "other URLs you actually fetched"],
  "confidence": 0.7
}

If web_search fails, set all fields to "Unknown — website unreachable" and confidence 0.2.`,
      { webSearch: true, maxSearches: 3 }
    ), { retries: 2, critical: true }
  );

  // Step 2: Competitor Research
  const competitorResearch = await executeStep(scanId, "competitor_research", 2, TOTAL_STEPS, () =>
    runModule(scanId, "COMPETITOR_RESEARCH",
      `You research competitors from PRIMARY sources. Use web_search to fetch each competitor's actual website. Do NOT speculate. Mark anything you can't verify as "Unknown".`,
      `Use web_search to fetch each competitor's website.

Competitors: ${scan.competitors.join(", ")}

Return JSON. Each field must come from their actual site or be marked Unknown:
{
  "competitors": [
    {
      "url": "url",
      "name": "exact brand name from their site",
      "description": "from their actual copy",
      "positioning": "from their site",
      "differentiators": ["only verified"],
      "pricingSignals": ["only from their pricing page"],
      "gtmApproach": "from their site or 'Unknown'",
      "recentMoves": ["only verified"],
      "sources": ["urls you actually fetched"]
    }
  ],
  "confidence": 0.6
}`,
      { webSearch: true, maxSearches: 3 }
    ), { retries: 2, critical: false }
  );

  // Step 3: Positioning Analysis
  const positioning = await executeStep(scanId, "positioning", 3, TOTAL_STEPS, () =>
    runModule(scanId, "POSITIONING_ANALYSIS",
      "You analyse company positioning with brutal honesty. Return structured JSON.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Competitors: ${JSON.stringify(competitorResearch)}
Their stated priorities: ${scan.priorities.join("; ")}

Assess positioning. Return JSON:
{
  "statedPositioning": "what they claim",
  "actualPositioning": "where they actually sit",
  "defensibility": "strong|moderate|weak",
  "defensibilityReason": "why",
  "gaps": ["gap between stated and actual"],
  "buyerReason": "why someone actually buys this",
  "recommendation": "what to do about it",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 4: Competitive Analysis
  const competitive = await executeStep(scanId, "competitive", 4, TOTAL_STEPS, () =>
    runModule(scanId, "COMPETITIVE_ANALYSIS",
      "You assess competitive reality. Be direct about who is winning and why.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Competitors: ${JSON.stringify(competitorResearch)}
Positioning: ${JSON.stringify(positioning)}

Return JSON:
{
  "marketLeader": "who is winning",
  "leaderReason": "why",
  "companyAdvantages": ["advantages"],
  "companyDisadvantages": ["disadvantages"],
  "threatMoves": ["competitive moves to fear"],
  "killList": [{"competitor": "name", "weakness": "what", "action": "exploit how"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 5: Workflow Analysis
  const workflowAnalysis = workflow
    ? await executeStep(scanId, "workflow", 5, TOTAL_STEPS, () =>
        runModule(scanId, "WORKFLOW_ANALYSIS",
          "You analyse business workflows and identify AI/automation opportunities.",
          `Workflow: ${workflow.name}
Steps: ${workflow.steps.join(" → ")}
Company: ${JSON.stringify(companyResearch)}

Return JSON:
{
  "workflowName": "${workflow.name}",
  "currentState": "assessment",
  "brokenPoints": ["what's broken"],
  "aiOpportunities": [{"step": "step name", "opportunity": "what AI can do", "impact": "high|medium|low"}],
  "estimatedROI": "realistic ROI estimate",
  "tenXVision": "what 10x better looks like",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        ), { critical: false }
      )
    : null;

  // Step 6: AI Operating Model
  const aiModel = await executeStep(scanId, "ai_operating_model", 6, TOTAL_STEPS, () =>
    runModule(scanId, "AI_OPERATING_MODEL",
      "You assess AI readiness and opportunity realistically. No hype.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Competitors: ${JSON.stringify(competitorResearch)}
Workflow: ${JSON.stringify(workflowAnalysis)}

Return JSON:
{
  "currentAIUsage": "how they use AI now",
  "competitorAIUsage": ["how competitors use AI"],
  "hypeVsReality": "honest assessment",
  "highValueAIInvestments": [{"area": "area", "impact": "impact", "complexity": "low|medium|high"}],
  "doNothingRisk": "what happens if they ignore AI",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 7: Value Creation
  const valueCreation = await executeStep(scanId, "value_creation", 7, TOTAL_STEPS, () =>
    runModule(scanId, "VALUE_CREATION",
      "You identify concrete value creation levers. Be specific about impact.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Positioning: ${JSON.stringify(positioning)}
Competitive: ${JSON.stringify(competitive)}
Workflow: ${JSON.stringify(workflowAnalysis)}
AI: ${JSON.stringify(aiModel)}

Identify top value creation levers. Return JSON:
{
  "levers": [{"category": "revenue|margin|moat|efficiency|inorganic", "lever": "what", "impact": "high|medium|low", "feasibility": "high|medium|low", "timeframe": "when", "detail": "specifics"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 8: Strategic Bets
  const bets = await executeStep(scanId, "strategic_bets", 8, TOTAL_STEPS, () =>
    runModule(scanId, "STRATEGIC_BETS",
      "You define bold but grounded strategic bets. Not obvious. Not safe.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Value Creation: ${JSON.stringify(valueCreation)}
Competitive: ${JSON.stringify(competitive)}

Define 3-5 strategic bets. Return JSON:
{
  "bets": [{"title": "bet name", "description": "what", "whyNow": "timing", "upside": "upside", "risk": "risk", "successIn12Months": "what success looks like"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 9: CEO Actions
  const ceoActions = await executeStep(scanId, "ceo_actions", 9, TOTAL_STEPS, () =>
    runModule(scanId, "CEO_ACTIONS",
      "You write specific, assignable CEO action plans. No vague actions.",
      `Bets: ${JSON.stringify(bets)}
Value Creation: ${JSON.stringify(valueCreation)}
Competitive: ${JSON.stringify(competitive)}

Write the CEO's 90-day action plan. Return JSON:
{
  "immediate": [{"action": "specific action", "owner": "role", "metric": "success metric"}],
  "buildPhase": [{"action": "action", "owner": "role", "metric": "metric"}],
  "executionPhase": [{"action": "action", "owner": "role", "metric": "metric"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 10: Do Nothing Scenario
  const doNothing = await executeStep(scanId, "do_nothing", 10, TOTAL_STEPS, () =>
    runModule(scanId, "DO_NOTHING",
      "You paint honest pictures of inaction. Create urgency without alarmism.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Competitive: ${JSON.stringify(competitive)}
AI: ${JSON.stringify(aiModel)}

What happens if this company changes nothing? Return JSON:
{
  "sixMonths": "6 month outlook",
  "twelveMonths": "12 month outlook",
  "twentyFourMonths": "24 month outlook",
  "biggestRisk": "single biggest risk",
  "probabilityOfDecline": "high|medium|low",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 11: Board Narrative
  const narrative = await executeStep(scanId, "board_narrative", 11, TOTAL_STEPS, () =>
    runModule(scanId, "BOARD_NARRATIVE",
      "You write board-level executive summaries. Sharp. 2-3 paragraphs max.",
      `All analysis:
Positioning: ${JSON.stringify(positioning)}
Competitive: ${JSON.stringify(competitive)}
Workflow: ${JSON.stringify(workflowAnalysis)}
AI: ${JSON.stringify(aiModel)}
Value Creation: ${JSON.stringify(valueCreation)}
Bets: ${JSON.stringify(bets)}
CEO Actions: ${JSON.stringify(ceoActions)}
Do Nothing: ${JSON.stringify(doNothing)}

Write a board-level executive summary. Lead with the most important finding. Return JSON:
{
  "narrative": "2-3 paragraphs in markdown",
  "confidence": 0.8
}`
    )
  );

  // Step 12: Render report
  await executeStep(scanId, "render_report", 12, TOTAL_STEPS, async () => {
    const n = narrative as Record<string, unknown> | null;
    const p = positioning as Record<string, unknown> | null;
    const c = competitive as Record<string, unknown> | null;
    const w = workflowAnalysis as Record<string, unknown> | null;
    const a = aiModel as Record<string, unknown> | null;
    const v = valueCreation as Record<string, unknown> | null;
    const b = bets as Record<string, unknown> | null;
    const ce = ceoActions as Record<string, unknown> | null;
    const dn = doNothing as Record<string, unknown> | null;

    const sections = [
      { id: "executive-summary", title: "Executive Summary", content: formatMarkdown(n?.narrative as string) },
      { id: "positioning", title: "Positioning", content: formatPositioning(p) },
      { id: "competitive-reality", title: "Competitive Reality", content: formatCompetitive(c) },
      { id: "workflow-ai", title: "Workflow & AI Opportunity", content: formatWorkflow(w, a) },
      { id: "value-creation", title: "Value Creation", content: formatValueCreation(v) },
      { id: "strategic-bets", title: "Strategic Bets", content: formatBets(b) },
      { id: "ceo-actions", title: "90-Day CEO Actions", content: formatCEOActions(ce) },
      { id: "do-nothing", title: "Do Nothing Scenario", content: formatDoNothing(dn) },
    ];

    const companyLabel = scan.companyName || new URL(scan.companyUrl).hostname;
    await renderReport(scanId, scan.userId, `Inflection Scan: ${companyLabel}`, sections);
  }, { critical: true });
}

function formatMarkdown(text?: string): string {
  if (!text) return "<p>Analysis not available.</p>";
  return text
    .split("\n\n")
    .map((p) => `<p>${p}</p>`)
    .join("\n");
}

function formatPositioning(data: Record<string, unknown> | null): string {
  if (!data) return "<p>Analysis not available.</p>";
  return `
    <p><strong>Stated positioning:</strong> ${data.statedPositioning || "N/A"}</p>
    <p><strong>Actual positioning:</strong> ${data.actualPositioning || "N/A"}</p>
    <p><strong>Defensibility:</strong> ${data.defensibility || "N/A"} — ${data.defensibilityReason || ""}</p>
    ${Array.isArray(data.gaps) ? `<h3>Gaps</h3><ul>${(data.gaps as string[]).map((g) => `<li>${g}</li>`).join("")}</ul>` : ""}
    <p><strong>Why buyers choose you:</strong> ${data.buyerReason || "N/A"}</p>
    <p><strong>Recommendation:</strong> ${data.recommendation || "N/A"}</p>`;
}

function formatCompetitive(data: Record<string, unknown> | null): string {
  if (!data) return "<p>Analysis not available.</p>";
  return `
    <p><strong>Market leader:</strong> ${data.marketLeader || "N/A"} — ${data.leaderReason || ""}</p>
    ${Array.isArray(data.companyAdvantages) ? `<h3>Your Advantages</h3><ul>${(data.companyAdvantages as string[]).map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(data.companyDisadvantages) ? `<h3>Your Disadvantages</h3><ul>${(data.companyDisadvantages as string[]).map((d) => `<li>${d}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(data.killList) ? `<h3>Kill List</h3><ul>${(data.killList as Array<Record<string, string>>).map((k) => `<li><strong>${k.competitor}:</strong> ${k.weakness} → ${k.action}</li>`).join("")}</ul>` : ""}`;
}

function formatWorkflow(w: Record<string, unknown> | null, ai: Record<string, unknown> | null): string {
  let html = "";
  if (w) {
    html += `
      <p><strong>Workflow:</strong> ${w.workflowName || "N/A"}</p>
      <p>${w.currentState || ""}</p>
      ${Array.isArray(w.brokenPoints) ? `<h3>Broken Points</h3><ul>${(w.brokenPoints as string[]).map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
      ${Array.isArray(w.aiOpportunities) ? `<h3>AI Opportunities</h3><ul>${(w.aiOpportunities as Array<Record<string, string>>).map((o) => `<li><strong>${o.step}:</strong> ${o.opportunity} (${o.impact} impact)</li>`).join("")}</ul>` : ""}
      <p><strong>10x vision:</strong> ${w.tenXVision || "N/A"}</p>`;
  }
  if (ai) {
    html += `
      <h3>AI Operating Model</h3>
      <p><strong>Current AI usage:</strong> ${ai.currentAIUsage || "N/A"}</p>
      <p><strong>Hype vs reality:</strong> ${ai.hypeVsReality || "N/A"}</p>
      <p><strong>Do-nothing risk:</strong> ${ai.doNothingRisk || "N/A"}</p>`;
  }
  return html || "<p>Analysis not available.</p>";
}

function formatValueCreation(data: Record<string, unknown> | null): string {
  if (!data || !Array.isArray(data.levers)) return "<p>Analysis not available.</p>";
  return `<ul>${(data.levers as Array<Record<string, string>>).map((l) =>
    `<li><strong>[${l.category}]</strong> ${l.lever} — Impact: ${l.impact}, Feasibility: ${l.feasibility}, Timeframe: ${l.timeframe}<br/>${l.detail}</li>`
  ).join("")}</ul>`;
}

function formatBets(data: Record<string, unknown> | null): string {
  if (!data || !Array.isArray(data.bets)) return "<p>Analysis not available.</p>";
  return (data.bets as Array<Record<string, string>>).map((b) => `
    <h3>${b.title}</h3>
    <p>${b.description}</p>
    <p><strong>Why now:</strong> ${b.whyNow}</p>
    <p><strong>Upside:</strong> ${b.upside}</p>
    <p><strong>Risk:</strong> ${b.risk}</p>
    <p><strong>Success in 12 months:</strong> ${b.successIn12Months}</p>
  `).join("<hr/>");
}

function formatCEOActions(data: Record<string, unknown> | null): string {
  if (!data) return "<p>Analysis not available.</p>";
  let html = "";
  for (const [phase, label] of [["immediate", "Week 1-2: Immediate"], ["buildPhase", "Week 3-6: Build"], ["executionPhase", "Week 7-12: Execute"]] as const) {
    const items = data[phase];
    if (Array.isArray(items)) {
      html += `<h3>${label}</h3><ul>${(items as Array<Record<string, string>>).map((a) =>
        `<li><strong>${a.action}</strong> — Owner: ${a.owner}, Metric: ${a.metric}</li>`
      ).join("")}</ul>`;
    }
  }
  return html || "<p>Analysis not available.</p>";
}

function formatDoNothing(data: Record<string, unknown> | null): string {
  if (!data) return "<p>Analysis not available.</p>";
  return `
    <h3>6 Months</h3><p>${data.sixMonths || "N/A"}</p>
    <h3>12 Months</h3><p>${data.twelveMonths || "N/A"}</p>
    <h3>24 Months</h3><p>${data.twentyFourMonths || "N/A"}</p>
    <p><strong>Biggest risk:</strong> ${data.biggestRisk || "N/A"}</p>
    <p><strong>Probability of decline:</strong> ${data.probabilityOfDecline || "N/A"}</p>`;
}
