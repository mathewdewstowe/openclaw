import { db } from "../db";
import { runModule, executeStep } from "../ai";
import { renderReport } from "../report-renderer";

const TOTAL_STEPS = 12;

const EVIDENCE_DISCIPLINE = `EVIDENCE DISCIPLINE — read carefully:
- Use ONLY the analysis context above. Do NOT introduce facts that aren't supported by it.
- If upstream data is "Unknown" or thin, your output MUST also be thin. Return fewer items rather than fabricate.
- Quote specific phrases from upstream where possible.
- Confidence 0.7+ requires real evidence. Use 0.4-0.5 when sparse. Use 0.2 when upstream is missing.
- Sources: only cite URLs that already appear in upstream sources. Do NOT fabricate URLs.

`;

export async function runDealDDPipeline(scanId: string) {
  const scan = await db.scan.findUniqueOrThrow({ where: { id: scanId } });

  // Step 1: Company Research
  const companyResearch = await executeStep(scanId, "company_research", 1, TOTAL_STEPS, () =>
    runModule(scanId, "COMPANY_RESEARCH",
      `You research target companies for due diligence from PRIMARY sources. You MUST use web_search to fetch the actual company website BEFORE writing anything. Do NOT guess. Do NOT confuse with similarly-named entities. If web_search fails, set fields to "Unknown — website unreachable".

DD context: investors will rely on this. Hallucinated facts could cost millions. Be ruthlessly honest about gaps.`,
      `Use web_search to fetch ${scan.companyUrl}. Read the actual website.
${scan.investmentThesis ? `Investment thesis context: ${scan.investmentThesis}` : ""}

Return JSON. Use "Unknown" liberally if not verifiable:
{
  "description": "from their actual copy or 'Unknown'",
  "sector": "from their positioning or 'Unknown'",
  "targetCustomer": "from their site or 'Unknown'",
  "products": ["only verified — empty array if unknown"],
  "pricingModel": "from pricing page or 'Not publicly disclosed'",
  "teamSignals": ["only observable signals"],
  "fundingStage": "if visible or 'Unknown'",
  "techSignals": ["only verified"],
  "recentChanges": ["only verified"],
  "sources": ["${scan.companyUrl}", "other URLs you actually fetched"],
  "confidence": 0.7
}

If web_search fails, set all fields to "Unknown — website unreachable" and confidence 0.2.`,
      { webSearch: true, maxSearches: 3 }
    ), { retries: 2, critical: true }
  );

  // Step 2: Product Shape
  const productShape = await executeStep(scanId, "product_shape", 2, TOTAL_STEPS, () =>
    runModule(scanId, "PRODUCT_SHAPE",
      "You analyse product shape for DD.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Analyse product. Return JSON:
{
  "products": ["products"],
  "architecture": "assessment",
  "integrations": ["integrations"],
  "pricingModel": "pricing",
  "techStack": ["tech"],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 3: GTM Signals
  const gtm = await executeStep(scanId, "gtm_signals", 3, TOTAL_STEPS, () =>
    runModule(scanId, "GTM_SIGNALS",
      "You extract GTM signals for DD assessment.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Extract GTM signals. Return JSON:
{
  "channels": ["channels"],
  "messaging": "messaging approach",
  "targetSegments": ["segments"],
  "partnerships": ["partnerships"],
  "recentCampaigns": ["campaigns"],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 4: AI Narrative
  const aiNarrative = await executeStep(scanId, "ai_narrative", 4, TOTAL_STEPS, () =>
    runModule(scanId, "AI_NARRATIVE",
      "You assess AI claims vs reality for investors.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Product: ${JSON.stringify(productShape)}
Assess AI claims. Return JSON:
{
  "claims": ["claims"],
  "reality": "honest assessment",
  "gapAnalysis": "gaps",
  "genuineCapabilities": ["real capabilities"],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 5: Product Risk
  const productRisk = await executeStep(scanId, "product_risk", 5, TOTAL_STEPS, () =>
    runModule(scanId, "PRODUCT_RISK",
      "You assess product risk for investors. Be direct about red flags.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Product: ${JSON.stringify(productShape)}
Assess product risks. Return JSON:
{
  "risks": [{"risk": "risk description", "severity": "high|medium|low", "evidence": "what supports this", "mitigant": "what could reduce this risk"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 6: GTM Risk
  const gtmRisk = await executeStep(scanId, "gtm_risk", 6, TOTAL_STEPS, () =>
    runModule(scanId, "GTM_RISK",
      "You assess go-to-market risk for investors.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
GTM: ${JSON.stringify(gtm)}
Assess GTM risks. Return JSON:
{
  "risks": [{"risk": "risk", "severity": "high|medium|low", "evidence": "evidence", "mitigant": "mitigant"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 7: AI Realism
  const aiRealism = await executeStep(scanId, "ai_realism", 7, TOTAL_STEPS, () =>
    runModule(scanId, "AI_REALISM",
      "You score AI realism for investors. Cut through hype.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
AI Narrative: ${JSON.stringify(aiNarrative)}
Score AI realism. Return JSON:
{
  "assessment": "overall assessment",
  "hypeScore": 5,
  "genuineCapabilities": ["real capabilities"],
  "overclaimedCapabilities": ["overclaimed"],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 8: Execution Risk
  const executionRisk = await executeStep(scanId, "execution_risk", 8, TOTAL_STEPS, () =>
    runModule(scanId, "EXECUTION_RISK",
      "You assess execution risk based on team and operational signals.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Assess execution risks. Return JSON:
{
  "risks": [{"risk": "risk", "severity": "high|medium|low", "evidence": "evidence", "mitigant": "mitigant"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 9: Value Creation Levers
  const valueLevers = await executeStep(scanId, "value_creation_levers", 9, TOTAL_STEPS, () =>
    runModule(scanId, "VALUE_CREATION_LEVERS",
      "You identify value creation levers for PE investors.",
      `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(companyResearch)}
Product: ${JSON.stringify(productShape)}
GTM: ${JSON.stringify(gtm)}
Product Risk: ${JSON.stringify(productRisk)}
GTM Risk: ${JSON.stringify(gtmRisk)}

Identify value creation levers. Return JSON:
{
  "levers": [{"lever": "lever", "category": "revenue|margin|moat|efficiency|inorganic", "impact": "high|medium|low", "timeframe": "when", "prerequisite": "what needs to happen first"}],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 10: Board Narrative
  const narrative = await executeStep(scanId, "board_narrative", 10, TOTAL_STEPS, () =>
    runModule(scanId, "BOARD_NARRATIVE",
      "You write DD executive summaries for investment committees.",
      `${scan.investmentThesis ? `Investment thesis: ${scan.investmentThesis}` : ""}
Company: ${JSON.stringify(companyResearch)}
Product Risk: ${JSON.stringify(productRisk)}
GTM Risk: ${JSON.stringify(gtmRisk)}
AI Realism: ${JSON.stringify(aiRealism)}
Execution Risk: ${JSON.stringify(executionRisk)}
Value Levers: ${JSON.stringify(valueLevers)}

Write a DD executive summary. Return JSON:
{
  "narrative": "2-3 paragraphs markdown",
  "confidence": 0.8
}`
    )
  );

  // Step 11: Render report
  await executeStep(scanId, "render_report", 11, TOTAL_STEPS, async () => {
    const n = narrative as Record<string, unknown> | null;
    const pr = productRisk as Record<string, unknown> | null;
    const gr = gtmRisk as Record<string, unknown> | null;
    const ar = aiRealism as Record<string, unknown> | null;
    const er = executionRisk as Record<string, unknown> | null;
    const vl = valueLevers as Record<string, unknown> | null;

    const sections = [
      { id: "summary", title: "Executive Summary", content: formatNarrative(n) },
      { id: "product-risk", title: "Product Risk", content: formatRisks(pr) },
      { id: "gtm-risk", title: "GTM Risk", content: formatRisks(gr) },
      { id: "ai-realism", title: "AI Realism", content: formatAIRealism(ar) },
      { id: "execution-risk", title: "Execution Risk", content: formatRisks(er) },
      { id: "value-creation", title: "Value Creation Levers", content: formatLevers(vl) },
    ];

    const label = scan.companyName || new URL(scan.companyUrl).hostname;
    await renderReport(scanId, scan.userId, `Deal DD: ${label}`, sections);
  }, { critical: true });
}

function formatNarrative(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return (d.narrative as string || "").split("\n\n").map((p) => `<p>${p}</p>`).join("");
}

function formatRisks(d: Record<string, unknown> | null): string {
  if (!d || !Array.isArray(d.risks)) return "<p>Not available.</p>";
  return `<ul>${(d.risks as Array<Record<string, string>>).map((r) =>
    `<li><strong>[${r.severity}]</strong> ${r.risk}<br/>Evidence: ${r.evidence}<br/>Mitigant: ${r.mitigant}</li>`
  ).join("")}</ul>`;
}

function formatAIRealism(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Assessment:</strong> ${d.assessment}</p>
    <p><strong>Hype Score:</strong> ${d.hypeScore}/10</p>
    ${Array.isArray(d.genuineCapabilities) ? `<h3>Genuine</h3><ul>${(d.genuineCapabilities as string[]).map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.overclaimedCapabilities) ? `<h3>Overclaimed</h3><ul>${(d.overclaimedCapabilities as string[]).map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}`;
}

function formatLevers(d: Record<string, unknown> | null): string {
  if (!d || !Array.isArray(d.levers)) return "<p>Not available.</p>";
  return `<ul>${(d.levers as Array<Record<string, string>>).map((l) =>
    `<li><strong>[${l.category}]</strong> ${l.lever} — Impact: ${l.impact}, Timeframe: ${l.timeframe}<br/>Prerequisite: ${l.prerequisite}</li>`
  ).join("")}</ul>`;
}
