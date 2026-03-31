import { db } from "../db";
import { runModule, executeStep } from "../ai";
import { renderReport } from "../report-renderer";

const TOTAL_STEPS = 12;

export async function runCompetitorTeardownPipeline(scanId: string) {
  const scan = await db.scan.findUniqueOrThrow({ where: { id: scanId } });

  // Step 1: Competitor Snapshot
  const snapshot = await executeStep(scanId, "competitor_snapshot", 1, TOTAL_STEPS, () =>
    runModule(scanId, "COMPETITOR_SNAPSHOT",
      "You build company snapshots from public data. Be thorough and factual.",
      `Build a comprehensive snapshot of the company at ${scan.companyUrl}.
Return JSON:
{
  "name": "company name",
  "description": "what they do",
  "founded": "year if known",
  "hq": "location",
  "teamSize": "estimate",
  "funding": "funding info",
  "sector": "sector",
  "sources": ["urls"],
  "confidence": 0.7
}`
    ), { retries: 2, critical: true }
  );

  // Step 2: Positioning
  const positioning = await executeStep(scanId, "positioning", 2, TOTAL_STEPS, () =>
    runModule(scanId, "POSITIONING_ANALYSIS",
      "You analyse company positioning with brutal honesty.",
      `Company: ${JSON.stringify(snapshot)}
Analyse their positioning. Return JSON:
{
  "statedPositioning": "what they claim",
  "actualPositioning": "where they actually sit",
  "defensibility": "strong|moderate|weak",
  "defensibilityReason": "why",
  "gaps": ["positioning gaps"],
  "buyerReason": "why someone buys",
  "recommendation": "positioning advice",
  "confidence": 0.7
}`
    )
  );

  // Step 3: Product Shape
  const productShape = await executeStep(scanId, "product_shape", 3, TOTAL_STEPS, () =>
    runModule(scanId, "PRODUCT_SHAPE",
      "You analyse product architecture and shape from public signals.",
      `Company: ${JSON.stringify(snapshot)}
Analyse their product. Return JSON:
{
  "products": ["product list"],
  "architecture": "product architecture assessment",
  "integrations": ["known integrations"],
  "pricingModel": "how they charge",
  "techStack": ["tech signals"],
  "confidence": 0.7
}`
    )
  );

  // Step 4: AI Narrative
  const aiNarrative = await executeStep(scanId, "ai_narrative", 4, TOTAL_STEPS, () =>
    runModule(scanId, "AI_NARRATIVE",
      "You assess AI claims vs reality. Cut through the hype.",
      `Company: ${JSON.stringify(snapshot)}
Product: ${JSON.stringify(productShape)}
Assess their AI narrative. Return JSON:
{
  "claims": ["AI claims they make"],
  "reality": "honest assessment of AI capability",
  "gapAnalysis": "where claims exceed reality",
  "genuineCapabilities": ["real AI capabilities"],
  "confidence": 0.7
}`
    )
  );

  // Step 5: GTM Signals
  const gtm = await executeStep(scanId, "gtm_signals", 5, TOTAL_STEPS, () =>
    runModule(scanId, "GTM_SIGNALS",
      "You extract go-to-market signals from public data.",
      `Company: ${JSON.stringify(snapshot)}
Product: ${JSON.stringify(productShape)}
Extract GTM signals. Return JSON:
{
  "channels": ["sales channels"],
  "messaging": "core messaging approach",
  "targetSegments": ["target segments"],
  "partnerships": ["known partnerships"],
  "recentCampaigns": ["recent marketing signals"],
  "confidence": 0.7
}`
    )
  );

  // Step 6: Strengths
  const strengths = await executeStep(scanId, "strengths", 6, TOTAL_STEPS, () =>
    runModule(scanId, "STRENGTHS",
      "You identify real strengths based on evidence, not claims.",
      `Company: ${JSON.stringify(snapshot)}
Product: ${JSON.stringify(productShape)}
GTM: ${JSON.stringify(gtm)}
Identify strengths. Return JSON:
{
  "strengths": [{"area": "strength area", "evidence": "what supports this", "durability": "how long this lasts"}],
  "confidence": 0.7
}`
    )
  );

  // Step 7: Vulnerabilities
  const vulnerabilities = await executeStep(scanId, "vulnerabilities", 7, TOTAL_STEPS, () =>
    runModule(scanId, "VULNERABILITIES",
      "You identify vulnerabilities — real weaknesses that can be exploited.",
      `Company: ${JSON.stringify(snapshot)}
Product: ${JSON.stringify(productShape)}
GTM: ${JSON.stringify(gtm)}
Strengths: ${JSON.stringify(strengths)}
Identify vulnerabilities. Return JSON:
{
  "vulnerabilities": [{"area": "vulnerability area", "evidence": "what reveals this", "exploitability": "high|medium|low"}],
  "confidence": 0.7
}`
    )
  );

  // Step 8: Next Moves
  const nextMoves = await executeStep(scanId, "next_moves", 8, TOTAL_STEPS, () =>
    runModule(scanId, "NEXT_MOVES",
      "You predict competitor moves based on signals and patterns.",
      `All analysis:
Snapshot: ${JSON.stringify(snapshot)}
Product: ${JSON.stringify(productShape)}
AI: ${JSON.stringify(aiNarrative)}
GTM: ${JSON.stringify(gtm)}
Strengths: ${JSON.stringify(strengths)}
Vulnerabilities: ${JSON.stringify(vulnerabilities)}

Predict next moves. Return JSON:
{
  "predictions": [{"move": "predicted move", "likelihood": "high|medium|low", "timeframe": "when", "evidence": "why you think this"}],
  "confidence": 0.7
}`
    )
  );

  // Step 9: Response Strategy
  const response = await executeStep(scanId, "response_strategy", 9, TOTAL_STEPS, () =>
    runModule(scanId, "RESPONSE_STRATEGY",
      "You write competitive response strategies. Think like a wartime CEO.",
      `All analysis:
Snapshot: ${JSON.stringify(snapshot)}
Positioning: ${JSON.stringify(positioning)}
Strengths: ${JSON.stringify(strengths)}
Vulnerabilities: ${JSON.stringify(vulnerabilities)}
Next Moves: ${JSON.stringify(nextMoves)}

Write response strategy. Return JSON:
{
  "ifCompeting": "2-3 paragraph strategy for how to compete against this company",
  "attackVectors": ["specific attack vectors"],
  "defensiveActions": ["defensive moves to make"],
  "strategicAdvice": "summary advice",
  "confidence": 0.7
}`
    )
  );

  // Step 10: Render report
  await executeStep(scanId, "render_report", 10, TOTAL_STEPS, async () => {
    const s = snapshot as Record<string, unknown> | null;
    const p = positioning as Record<string, unknown> | null;
    const ps = productShape as Record<string, unknown> | null;
    const ai = aiNarrative as Record<string, unknown> | null;
    const g = gtm as Record<string, unknown> | null;
    const str = strengths as Record<string, unknown> | null;
    const v = vulnerabilities as Record<string, unknown> | null;
    const nm = nextMoves as Record<string, unknown> | null;
    const rs = response as Record<string, unknown> | null;

    const sections = [
      { id: "snapshot", title: "Company Snapshot", content: formatSnapshot(s) },
      { id: "positioning", title: "Positioning", content: formatPositioning(p) },
      { id: "product", title: "Product Shape", content: formatProduct(ps) },
      { id: "ai", title: "AI Narrative", content: formatAI(ai) },
      { id: "gtm", title: "GTM Signals", content: formatGTM(g) },
      { id: "strengths", title: "Strengths", content: formatStrengths(str) },
      { id: "vulnerabilities", title: "Vulnerabilities", content: formatVulnerabilities(v) },
      { id: "next-moves", title: "Likely Next Moves", content: formatNextMoves(nm) },
      { id: "response", title: "If I Were Competing", content: formatResponse(rs) },
    ];

    const name = (s?.name as string) || new URL(scan.companyUrl).hostname;
    await renderReport(scanId, scan.userId, `Competitor Teardown: ${name}`, sections);
  }, { critical: true });
}

function formatSnapshot(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>${d.name}</strong></p>
    <p>${d.description}</p>
    <p><strong>Sector:</strong> ${d.sector || "N/A"} | <strong>HQ:</strong> ${d.hq || "N/A"} | <strong>Team:</strong> ${d.teamSize || "N/A"}</p>
    <p><strong>Funding:</strong> ${d.funding || "N/A"}</p>`;
}

function formatPositioning(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Stated:</strong> ${d.statedPositioning}</p>
    <p><strong>Actual:</strong> ${d.actualPositioning}</p>
    <p><strong>Defensibility:</strong> ${d.defensibility} — ${d.defensibilityReason}</p>`;
}

function formatProduct(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Architecture:</strong> ${d.architecture}</p>
    <p><strong>Pricing:</strong> ${d.pricingModel}</p>
    ${Array.isArray(d.products) ? `<p><strong>Products:</strong> ${(d.products as string[]).join(", ")}</p>` : ""}
    ${Array.isArray(d.integrations) ? `<p><strong>Integrations:</strong> ${(d.integrations as string[]).join(", ")}</p>` : ""}`;
}

function formatAI(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Reality:</strong> ${d.reality}</p>
    <p><strong>Gap:</strong> ${d.gapAnalysis}</p>
    ${Array.isArray(d.claims) ? `<h3>Claims</h3><ul>${(d.claims as string[]).map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.genuineCapabilities) ? `<h3>Genuine Capabilities</h3><ul>${(d.genuineCapabilities as string[]).map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}`;
}

function formatGTM(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Messaging:</strong> ${d.messaging}</p>
    ${Array.isArray(d.channels) ? `<p><strong>Channels:</strong> ${(d.channels as string[]).join(", ")}</p>` : ""}
    ${Array.isArray(d.targetSegments) ? `<p><strong>Segments:</strong> ${(d.targetSegments as string[]).join(", ")}</p>` : ""}
    ${Array.isArray(d.partnerships) ? `<p><strong>Partnerships:</strong> ${(d.partnerships as string[]).join(", ")}</p>` : ""}`;
}

function formatStrengths(d: Record<string, unknown> | null): string {
  if (!d || !Array.isArray(d.strengths)) return "<p>Not available.</p>";
  return `<ul>${(d.strengths as Array<Record<string, string>>).map((s) =>
    `<li><strong>${s.area}:</strong> ${s.evidence} (Durability: ${s.durability})</li>`
  ).join("")}</ul>`;
}

function formatVulnerabilities(d: Record<string, unknown> | null): string {
  if (!d || !Array.isArray(d.vulnerabilities)) return "<p>Not available.</p>";
  return `<ul>${(d.vulnerabilities as Array<Record<string, string>>).map((v) =>
    `<li><strong>${v.area}:</strong> ${v.evidence} (Exploitability: ${v.exploitability})</li>`
  ).join("")}</ul>`;
}

function formatNextMoves(d: Record<string, unknown> | null): string {
  if (!d || !Array.isArray(d.predictions)) return "<p>Not available.</p>";
  return `<ul>${(d.predictions as Array<Record<string, string>>).map((p) =>
    `<li><strong>${p.move}</strong> — Likelihood: ${p.likelihood}, Timeframe: ${p.timeframe}<br/>${p.evidence}</li>`
  ).join("")}</ul>`;
}

function formatResponse(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <div>${(d.ifCompeting as string || "").split("\n\n").map((p) => `<p>${p}</p>`).join("")}</div>
    ${Array.isArray(d.attackVectors) ? `<h3>Attack Vectors</h3><ul>${(d.attackVectors as string[]).map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.defensiveActions) ? `<h3>Defensive Actions</h3><ul>${(d.defensiveActions as string[]).map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
    <p><strong>Strategic advice:</strong> ${d.strategicAdvice || "N/A"}</p>`;
}
