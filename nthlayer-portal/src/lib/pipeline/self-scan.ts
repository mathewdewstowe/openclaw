import { db } from "../db";
import { runModule, executeStep } from "../ai";
import { renderReport } from "../report-renderer";

const TOTAL_STEPS = 8;

const EVIDENCE_DISCIPLINE = `EVIDENCE DISCIPLINE — read carefully:
- Use ONLY the analysis context above. Do NOT introduce facts that aren't supported by it.
- If upstream data is "Unknown" or thin, your output MUST also be thin. Return fewer points and lower confidence rather than fabricate.
- Quote specific phrases from upstream where possible.
- Confidence 0.7+ requires real evidence. Use 0.4-0.5 when sparse. Use 0.2 when upstream is missing.
- Sources: only cite URLs that already appear in upstream sources. Do NOT fabricate URLs.

`;

export async function runSelfScanPipeline(scanId: string) {
  const scan = await db.scan.findUniqueOrThrow({ where: { id: scanId } });

  const context = `
Company URL: ${scan.companyUrl}
ICP: ${scan.icp || "Not provided"}
Priorities: ${(scan.priorities || []).map((p, i) => `${i + 1}. ${p}`).join(", ")}
Big bet: ${scan.bigBet || "Not provided"}
AI ambition: ${scan.aiAmbition || "Not provided"}
Competitors: ${(scan.competitors || []).join(", ")}
${scan.selfWeakness ? `Self-identified weaknesses: ${scan.selfWeakness}` : ""}`.trim();

  // Step 1: Company Snapshot
  const snapshot = await executeStep(scanId, "company_snapshot", 1, TOTAL_STEPS, () =>
    runModule(scanId, "COMPANY_SNAPSHOT",
      `You build snapshots from PRIMARY sources. You MUST use web_search to fetch the actual company website BEFORE writing anything. Do NOT guess from the domain. Do NOT confuse with similarly-named entities. If web_search returns nothing for the exact URL, set fields to "Unknown — website unreachable".`,
      `Use web_search to fetch ${scan.companyUrl}. Read what the site actually says.

Return JSON:
{
  "name": "exact brand name from their website",
  "description": "2-3 sentences from their actual copy",
  "sector": "from their own positioning",
  "hq": "from footer/about page or 'Unknown'",
  "teamSize": "if mentioned, else 'Unknown'",
  "funding": "if mentioned, else 'Unknown'",
  "confidence": 0.7,
  "sources": ["${scan.companyUrl}", "other URLs you actually fetched"]
}

If web_search fails, set name to URL hostname, all other fields to "Unknown — website unreachable", confidence 0.2.`,
      { webSearch: true, maxSearches: 3 }
    ), { retries: 2, critical: true }
  );

  // Step 2: Positioning Analysis
  const positioning = await executeStep(scanId, "positioning", 2, TOTAL_STEPS, () =>
    runModule(scanId, "POSITIONING_ANALYSIS",
      `You analyse positioning from the snapshot only. If snapshot is "Unknown", return "Insufficient data" everywhere with confidence 0.2.`,
      `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snapshot)}

Analyse positioning vs stated priorities — based ONLY on snapshot above. Return JSON:
{
  "statedPositioning": "what they appear to claim",
  "perceivedStrength": "where they are genuinely strong",
  "positioningRisk": "where their positioning is unclear or vulnerable",
  "icpFit": "honest assessment of how well they know and serve their ICP",
  "recommendation": "one clear positioning recommendation",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 3: Competitive Reality
  const competitiveReality = await executeStep(scanId, "competitive_reality", 3, TOTAL_STEPS, () =>
    runModule(scanId, "COMPETITIVE_REALITY",
      `You give an honest competitive read from upstream evidence. If competitors are unknown to you, say so — don't invent competitor capabilities.`,
      `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snapshot)}
Positioning: ${JSON.stringify(positioning)}

Analyse competitive reality vs the listed competitors. Return JSON:
{
  "competitivePosition": "overall competitive position — leading|parity|behind",
  "whereTheyWin": "where this company has a genuine edge",
  "whereTheyLose": "where competitors beat them",
  "biggestThreat": "which competitor or dynamic is the biggest threat and why",
  "selfWeaknessAssessment": "${scan.selfWeakness ? `The company identified these weaknesses: ${scan.selfWeakness}. Are they right? What are they missing?` : "What are the real weaknesses based on public signals?"}",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 4: Value Creation View
  const valueCreation = await executeStep(scanId, "value_creation", 4, TOTAL_STEPS, () =>
    runModule(scanId, "VALUE_CREATION",
      `You identify value drivers from upstream evidence only. No generic value-creation advice.`,
      `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snapshot)}
Positioning: ${JSON.stringify(positioning)}

Assess value creation based ONLY on the priorities/big bet stated above and upstream snapshot. Return JSON:
{
  "coreValueDriver": "the single biggest source of value",
  "prioritiesAssessment": "are the 3 stated priorities the right ones? What's missing?",
  "bigBetAssessment": "is the big bet the right bet given the competitive context?",
  "returnOnFocus": "what they should double down on for maximum leverage",
  "riskToValue": "biggest risk to value creation",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 5: AI Feasibility
  const aiFeasibility = await executeStep(scanId, "ai_feasibility", 5, TOTAL_STEPS, () =>
    runModule(scanId, "AI_FEASIBILITY",
      `You assess AI feasibility tied to the company's actual product surface area. Don't speculate about competitor AI activity if you have no evidence.`,
      `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snapshot)}

Assess the AI ambition: "${scan.aiAmbition || "Not specified"}". If no AI ambition was provided, return feasibility "unknown" and confidence 0.3. Return JSON:
{
  "feasibility": "high|medium|low",
  "feasibilityReason": "why",
  "competitorAIReality": "what competitors are actually doing with AI",
  "gapRisk": "risk of falling behind on AI",
  "recommendation": "what to actually do on AI — be specific",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 6: Strategic Bets
  const strategicBets = await executeStep(scanId, "strategic_bets", 6, TOTAL_STEPS, () =>
    runModule(scanId, "STRATEGIC_BETS",
      `You recommend bets anchored DIRECTLY to upstream weaknesses, opportunities, and value drivers. Each bet MUST cite which upstream finding it addresses.`,
      `${EVIDENCE_DISCIPLINE}${context}
Full analysis:
Snapshot: ${JSON.stringify(snapshot)}
Positioning: ${JSON.stringify(positioning)}
Competitive Reality: ${JSON.stringify(competitiveReality)}
Value Creation: ${JSON.stringify(valueCreation)}
AI: ${JSON.stringify(aiFeasibility)}

Recommend the 1-3 most important strategic bets. Each rationale MUST reference a specific upstream finding. If upstream is too thin, return fewer bets. Return JSON:
{
  "bets": [
    {
      "bet": "specific strategic bet",
      "rationale": "why this matters",
      "urgency": "now|soon|later",
      "effort": "high|medium|low"
    }
  ],
  "thingsToStop": ["what to stop doing or de-prioritise"],
  "northStar": "one sentence: what winning looks like in 18 months",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
    )
  );

  // Step 7: Render report
  await executeStep(scanId, "render_report", 7, TOTAL_STEPS, async () => {
    const snap = snapshot as Record<string, unknown> | null;
    const pos = positioning as Record<string, unknown> | null;
    const comp = competitiveReality as Record<string, unknown> | null;
    const val = valueCreation as Record<string, unknown> | null;
    const ai = aiFeasibility as Record<string, unknown> | null;
    const bets = strategicBets as Record<string, unknown> | null;

    const sections = [
      { id: "snapshot", title: "Company Snapshot", content: formatSnapshot(snap) },
      { id: "positioning", title: "Positioning", content: formatPositioning(pos) },
      { id: "competitive", title: "Competitive Reality", content: formatCompetitive(comp) },
      { id: "value", title: "Value Creation", content: formatValueCreation(val) },
      { id: "ai", title: "AI Feasibility", content: formatAI(ai) },
      { id: "bets", title: "Strategic Bets", content: formatBets(bets) },
    ];

    const name = (snap?.name as string) || new URL(scan.companyUrl).hostname;
    await renderReport(scanId, scan.userId, `Self Scan: ${name}`, sections);
  }, { critical: true });
}

function formatSnapshot(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>${d.name}</strong> — ${d.description}</p>
    <p><strong>Sector:</strong> ${d.sector || "N/A"} | <strong>HQ:</strong> ${d.hq || "N/A"} | <strong>Team:</strong> ${d.teamSize || "N/A"}</p>
    <p><strong>Funding:</strong> ${d.funding || "N/A"}</p>`;
}

function formatPositioning(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Stated positioning:</strong> ${d.statedPositioning}</p>
    <p><strong>Genuine strength:</strong> ${d.perceivedStrength}</p>
    <p><strong>Positioning risk:</strong> ${d.positioningRisk}</p>
    <p><strong>ICP fit:</strong> ${d.icpFit}</p>
    <p><strong>Recommendation:</strong> ${d.recommendation}</p>`;
}

function formatCompetitive(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Overall position:</strong> ${d.competitivePosition}</p>
    <p><strong>Where you win:</strong> ${d.whereTheyWin}</p>
    <p><strong>Where you lose:</strong> ${d.whereTheyLose}</p>
    <p><strong>Biggest threat:</strong> ${d.biggestThreat}</p>
    <p><strong>Weakness assessment:</strong> ${d.selfWeaknessAssessment}</p>`;
}

function formatValueCreation(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Core value driver:</strong> ${d.coreValueDriver}</p>
    <p><strong>Priorities assessment:</strong> ${d.prioritiesAssessment}</p>
    <p><strong>Big bet assessment:</strong> ${d.bigBetAssessment}</p>
    <p><strong>Return on focus:</strong> ${d.returnOnFocus}</p>
    <p><strong>Risk to value:</strong> ${d.riskToValue}</p>`;
}

function formatAI(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Feasibility:</strong> ${d.feasibility} — ${d.feasibilityReason}</p>
    <p><strong>Competitor AI reality:</strong> ${d.competitorAIReality}</p>
    <p><strong>Gap risk:</strong> ${d.gapRisk}</p>
    <p><strong>Recommendation:</strong> ${d.recommendation}</p>`;
}

function formatBets(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const bets = Array.isArray(d.bets)
    ? `<ol>${(d.bets as Array<Record<string, string>>).map((b) =>
        `<li><strong>${b.bet}</strong> — ${b.rationale} <em>(${b.urgency}, ${b.effort} effort)</em></li>`
      ).join("")}</ol>`
    : "";
  const stop = Array.isArray(d.thingsToStop)
    ? `<h3>Stop doing</h3><ul>${(d.thingsToStop as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";
  return `
    ${bets}
    ${stop}
    <p><strong>What winning looks like:</strong> ${d.northStar}</p>`;
}
