import { db } from "../db";
import { runModule, executeStep } from "../ai";
import { renderReport } from "../report-renderer";

const TOTAL_STEPS = 14;

async function load(scanId: string, module: string): Promise<Record<string, unknown>> {
  const r = await db.analysisResult.findUnique({ where: { scanId_module: { scanId, module } } });
  return (r?.output ?? {}) as Record<string, unknown>;
}

/** Pick only the specified keys from an object — keeps prompts small */
function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/** Truncate arrays so they don't bloat the prompt */
function trim(obj: Record<string, unknown>, arrayLimit = 5): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = Array.isArray(v) ? (v as unknown[]).slice(0, arrayLimit) : v;
  }
  return out;
}

/**
 * Runs a single step of the competitor teardown pipeline.
 * Returns true if there are more steps to run, false if done.
 */
export async function runCompetitorTeardownStep(scanId: string, stepIndex: number): Promise<boolean> {
  const scan = await db.scan.findUniqueOrThrow({ where: { id: scanId } });

  switch (stepIndex) {
    case 0: {
      await executeStep(scanId, "competitor_snapshot", 1, TOTAL_STEPS, () =>
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
        ), { retries: 0, critical: true }
      );
      return true;
    }

    case 1: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ctx1 = pick(s, ["name", "description", "sector", "hq", "funding"]);
      await executeStep(scanId, "positioning", 2, TOTAL_STEPS, () =>
        runModule(scanId, "POSITIONING_ANALYSIS",
          "You analyse company positioning with brutal honesty.",
          `Company: ${JSON.stringify(ctx1)}
Analyse their positioning. Be concise. Return JSON:
{"statedPositioning":"what they claim","actualPositioning":"where they actually sit","defensibility":"strong|moderate|weak","defensibilityReason":"why (1 sentence)","gaps":["gap1","gap2"],"buyerReason":"why someone buys (1 sentence)","recommendation":"advice (1 sentence)","confidence":0.7}`
        )
      );
      return true;
    }

    case 2: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ctx2 = pick(s, ["name", "description", "sector"]);
      await executeStep(scanId, "product_shape", 3, TOTAL_STEPS, () =>
        runModule(scanId, "PRODUCT_SHAPE",
          "You analyse product architecture and shape from public signals.",
          `Company: ${JSON.stringify(ctx2)}
Analyse their product. Be concise. Return JSON:
{"products":["p1","p2"],"architecture":"assessment (1-2 sentences)","integrations":["i1","i2"],"pricingModel":"how they charge","techStack":["ts1","ts2"],"confidence":0.7}`
        )
      );
      return true;
    }

    case 3: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ps = await load(scanId, "PRODUCT_SHAPE");
      const ctx3 = {
        name: s.name, description: s.description,
        products: (ps.products as string[] | undefined)?.slice(0, 4),
        architecture: ps.architecture,
      };
      await executeStep(scanId, "ai_narrative", 4, TOTAL_STEPS, () =>
        runModule(scanId, "AI_NARRATIVE",
          "You assess AI claims vs reality. Cut through the hype.",
          `Company: ${JSON.stringify(ctx3)}
Assess their AI narrative. Be concise. Return JSON:
{"claims":["c1","c2","c3"],"reality":"honest assessment (1-2 sentences)","gapAnalysis":"where claims exceed reality (1 sentence)","genuineCapabilities":["gc1","gc2"],"confidence":0.7}`
        )
      );
      return true;
    }

    case 4: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ps = await load(scanId, "PRODUCT_SHAPE");
      const ctx4 = {
        name: s.name, sector: s.sector, description: s.description,
        pricingModel: ps.pricingModel,
        products: (ps.products as string[] | undefined)?.slice(0, 3),
      };
      await executeStep(scanId, "gtm_signals", 5, TOTAL_STEPS, () =>
        runModule(scanId, "GTM_SIGNALS",
          "You extract go-to-market signals from public data.",
          `Company: ${JSON.stringify(ctx4)}
Extract GTM signals. Be concise. Return JSON:
{"channels":["c1","c2"],"messaging":"core message (1 sentence)","targetSegments":["s1","s2"],"partnerships":["p1","p2"],"recentCampaigns":["rc1","rc2"],"confidence":0.7}`
        )
      );
      return true;
    }

    case 5: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ps = await load(scanId, "PRODUCT_SHAPE");
      const gtm = await load(scanId, "GTM_SIGNALS");
      const ctx5 = {
        name: s.name, sector: s.sector,
        architecture: ps.architecture, pricingModel: ps.pricingModel,
        messaging: gtm.messaging, channels: (gtm.channels as string[] | undefined)?.slice(0, 3),
      };
      await executeStep(scanId, "strengths", 6, TOTAL_STEPS, () =>
        runModule(scanId, "STRENGTHS",
          "You identify real strengths based on evidence, not claims.",
          `Company: ${JSON.stringify(ctx5)}
Identify strengths (max 5). Be concise. Return JSON:
{"strengths":[{"area":"a","evidence":"e (1 sentence)","durability":"short|medium|long"}],"confidence":0.7}`
        )
      );
      return true;
    }

    case 6: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ps = await load(scanId, "PRODUCT_SHAPE");
      const gtm = await load(scanId, "GTM_SIGNALS");
      const str = await load(scanId, "STRENGTHS");
      const ctx6 = {
        name: s.name, sector: s.sector,
        architecture: ps.architecture, pricingModel: ps.pricingModel,
        messaging: gtm.messaging,
        strengths: trim(str, 3).strengths,
      };
      await executeStep(scanId, "vulnerabilities", 7, TOTAL_STEPS, () =>
        runModule(scanId, "VULNERABILITIES",
          "You identify vulnerabilities — real weaknesses that can be exploited.",
          `Company: ${JSON.stringify(ctx6)}
Identify vulnerabilities (max 5). Be concise. Return JSON:
{"vulnerabilities":[{"area":"a","evidence":"e (1 sentence)","exploitability":"high|medium|low"}],"confidence":0.7}`
        )
      );
      return true;
    }

    case 7: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ps = await load(scanId, "PRODUCT_SHAPE");
      const ai = await load(scanId, "AI_NARRATIVE");
      const gtm = await load(scanId, "GTM_SIGNALS");
      const str = await load(scanId, "STRENGTHS");
      const vuln = await load(scanId, "VULNERABILITIES");
      const ctx7 = {
        name: s.name, sector: s.sector, funding: s.funding,
        pricingModel: ps.pricingModel,
        aiReality: ai.reality,
        channels: (gtm.channels as string[] | undefined)?.slice(0, 3),
        strengths: (str.strengths as Array<{area: string}> | undefined)?.slice(0, 3).map(x => x.area),
        vulnerabilities: (vuln.vulnerabilities as Array<{area: string}> | undefined)?.slice(0, 3).map(x => x.area),
      };
      await executeStep(scanId, "next_moves", 8, TOTAL_STEPS, () =>
        runModule(scanId, "NEXT_MOVES",
          "You predict competitor moves based on signals and patterns.",
          `Company: ${JSON.stringify(ctx7)}
Predict next moves (max 4). Be concise. Return JSON:
{"predictions":[{"move":"m","likelihood":"high|medium|low","timeframe":"t","evidence":"e (1 sentence)"}],"confidence":0.7}`
        )
      );
      return true;
    }

    case 8: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const pos = await load(scanId, "POSITIONING_ANALYSIS");
      const str = await load(scanId, "STRENGTHS");
      const vuln = await load(scanId, "VULNERABILITIES");
      const nm = await load(scanId, "NEXT_MOVES");
      const ctx8 = {
        name: s.name, sector: s.sector,
        actualPositioning: pos.actualPositioning,
        defensibility: pos.defensibility,
        strengths: (str.strengths as Array<{area: string}> | undefined)?.slice(0, 3).map(x => x.area),
        vulnerabilities: (vuln.vulnerabilities as Array<{area: string, exploitability: string}> | undefined)?.slice(0, 3),
        nextMoves: (nm.predictions as Array<{move: string}> | undefined)?.slice(0, 3).map(x => x.move),
      };
      await executeStep(scanId, "response_strategy", 9, TOTAL_STEPS, () =>
        runModule(scanId, "RESPONSE_STRATEGY",
          "You write competitive response strategies. Think like a wartime CEO.",
          `Company: ${JSON.stringify(ctx8)}
Write response strategy. Be direct. Return JSON:
{"ifCompeting":"2-3 paragraph strategy","attackVectors":["av1","av2","av3"],"defensiveActions":["da1","da2","da3"],"strategicAdvice":"summary (1 sentence)","confidence":0.7}`
        )
      );
      return true;
    }

    case 9: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const pos = await load(scanId, "POSITIONING_ANALYSIS");
      const ps = await load(scanId, "PRODUCT_SHAPE");
      const gtm = await load(scanId, "GTM_SIGNALS");
      const str = await load(scanId, "STRENGTHS");
      const vuln = await load(scanId, "VULNERABILITIES");
      const nm = await load(scanId, "NEXT_MOVES");
      const ctx9 = {
        name: s.name, sector: s.sector,
        actualPositioning: pos.actualPositioning,
        defensibility: pos.defensibility,
        pricingModel: ps.pricingModel,
        channels: (gtm.channels as string[] | undefined)?.slice(0, 3),
        strengths: (str.strengths as Array<{area: string}> | undefined)?.slice(0, 3).map(x => x.area),
        vulnerabilities: (vuln.vulnerabilities as Array<{area: string}> | undefined)?.slice(0, 3).map(x => x.area),
        nextMoves: (nm.predictions as Array<{move: string}> | undefined)?.slice(0, 2).map(x => x.move),
      };
      await executeStep(scanId, "product_strategy", 10, TOTAL_STEPS, () =>
        runModule(scanId, "PRODUCT_STRATEGY",
          "You are a product strategist who identifies how to win against a specific competitor. Think offensively.",
          `Company: ${JSON.stringify(ctx9)}
${scan.userQuestion ? `Focus question: ${scan.userQuestion}` : ""}
Return JSON:
{"headline":"one-line verdict","whereToAttack":"which areas (1 sentence)","productBets":["pb1","pb2","pb3"],"messagingAngles":["ma1","ma2","ma3"],"thingsToAvoid":["ta1","ta2"],"urgency":"high|medium|low","confidence":0.7}`
        )
      );
      return true;
    }

    case 10: {
      const snapshot = await load(scanId, "COMPETITOR_SNAPSHOT");
      await executeStep(scanId, "public_financials", 11, TOTAL_STEPS, () =>
        runModule(scanId, "PUBLIC_FINANCIALS",
          "You extract public financial signals from available data. Be precise and cite your basis. If data is unavailable, say so clearly.",
          `Company: ${JSON.stringify(snapshot)}
Extract all available public financial indicators. Return JSON:
{
  "fundingTotal": "total funding raised (e.g. €50M+) or unknown",
  "lastRound": { "type": "Series A/B/etc or unknown", "amount": "amount or unknown", "date": "date or unknown", "investors": ["known investors"] },
  "revenueEstimate": "ARR or revenue estimate from public signals — analyst reports, CEO interviews, job postings, pricing pages. State the basis.",
  "growthSignals": ["signals suggesting growth trajectory — headcount trend, geographic expansion, product launches, partner announcements"],
  "profitabilitySignals": ["any signals about path to profitability or burn"],
  "valuation": "last known or implied valuation if public, else unknown",
  "keyMetrics": ["any publicly stated metrics — NRR, customer count, ACV, etc."],
  "financialHealth": "strong|moderate|uncertain",
  "confidence": 0.4
}`
        )
      );
      return true;
    }

    case 11: {
      const [s, p, ps, ai, g, str, v, nm, rs, pst, fin] = await Promise.all([
        load(scanId, "COMPETITOR_SNAPSHOT"), load(scanId, "POSITIONING_ANALYSIS"), load(scanId, "PRODUCT_SHAPE"),
        load(scanId, "AI_NARRATIVE"), load(scanId, "GTM_SIGNALS"), load(scanId, "STRENGTHS"),
        load(scanId, "VULNERABILITIES"), load(scanId, "NEXT_MOVES"), load(scanId, "RESPONSE_STRATEGY"),
        load(scanId, "PRODUCT_STRATEGY"), load(scanId, "PUBLIC_FINANCIALS"),
      ]);

      await executeStep(scanId, "render_report", 12, TOTAL_STEPS, async () => {
        const sections = [
          { id: "snapshot", title: "Company Snapshot", content: formatSnapshot(s) },
          { id: "financials", title: "Public Financials", content: formatFinancials(fin) },
          { id: "positioning", title: "Positioning", content: formatPositioning(p) },
          { id: "product", title: "Product Shape", content: formatProduct(ps) },
          { id: "ai", title: "AI Narrative", content: formatAI(ai) },
          { id: "gtm", title: "GTM Signals", content: formatGTM(g) },
          { id: "strengths", title: "Strengths", content: formatStrengths(str) },
          { id: "vulnerabilities", title: "Vulnerabilities", content: formatVulnerabilities(v) },
          { id: "next-moves", title: "Likely Next Moves", content: formatNextMoves(nm) },
          { id: "product-strategy", title: "Product Strategy", content: formatProductStrategy(pst) },
          { id: "response", title: "If I Were Competing", content: formatResponse(rs) },
        ];
        const name = (s?.name as string) || new URL(scan.companyUrl).hostname;
        await renderReport(scanId, scan.userId, `Competitor Teardown: ${name}`, sections);
      }, { critical: true });

      await db.scan.update({
        where: { id: scanId },
        data: { status: "COMPLETED", completedAt: new Date(), progress: 100 },
      });
      await db.scanEvent.create({ data: { scanId, event: "scan_completed" } });
      return false; // done
    }

    default:
      return false;
  }
}

// Keep the original for any direct usage
export async function runCompetitorTeardownPipeline(scanId: string) {
  for (let i = 0; i <= 11; i++) {
    const more = await runCompetitorTeardownStep(scanId, i);
    if (!more) break;
  }
}

function formatSnapshot(d: Record<string, unknown>): string {
  if (!d?.name) return "<p>Not available.</p>";
  return `
    <p><strong>${d.name}</strong></p>
    <p>${d.description}</p>
    <p><strong>Sector:</strong> ${d.sector || "N/A"} | <strong>HQ:</strong> ${d.hq || "N/A"} | <strong>Team:</strong> ${d.teamSize || "N/A"}</p>
    <p><strong>Funding:</strong> ${d.funding || "N/A"}</p>`;
}

function formatPositioning(d: Record<string, unknown>): string {
  if (!d?.statedPositioning) return "<p>Not available.</p>";
  return `
    <p><strong>Stated:</strong> ${d.statedPositioning}</p>
    <p><strong>Actual:</strong> ${d.actualPositioning}</p>
    <p><strong>Defensibility:</strong> ${d.defensibility} — ${d.defensibilityReason}</p>`;
}

function formatProduct(d: Record<string, unknown>): string {
  if (!d?.architecture) return "<p>Not available.</p>";
  return `
    <p><strong>Architecture:</strong> ${d.architecture}</p>
    <p><strong>Pricing:</strong> ${d.pricingModel}</p>
    ${Array.isArray(d.products) ? `<p><strong>Products:</strong> ${(d.products as string[]).join(", ")}</p>` : ""}
    ${Array.isArray(d.integrations) ? `<p><strong>Integrations:</strong> ${(d.integrations as string[]).join(", ")}</p>` : ""}`;
}

function formatAI(d: Record<string, unknown>): string {
  if (!d?.reality) return "<p>Not available.</p>";
  return `
    <p><strong>Reality:</strong> ${d.reality}</p>
    <p><strong>Gap:</strong> ${d.gapAnalysis}</p>
    ${Array.isArray(d.claims) ? `<h3>Claims</h3><ul>${(d.claims as string[]).map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.genuineCapabilities) ? `<h3>Genuine Capabilities</h3><ul>${(d.genuineCapabilities as string[]).map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}`;
}

function formatGTM(d: Record<string, unknown>): string {
  if (!d?.messaging) return "<p>Not available.</p>";
  return `
    <p><strong>Messaging:</strong> ${d.messaging}</p>
    ${Array.isArray(d.channels) ? `<p><strong>Channels:</strong> ${(d.channels as string[]).join(", ")}</p>` : ""}
    ${Array.isArray(d.targetSegments) ? `<p><strong>Segments:</strong> ${(d.targetSegments as string[]).join(", ")}</p>` : ""}
    ${Array.isArray(d.partnerships) ? `<p><strong>Partnerships:</strong> ${(d.partnerships as string[]).join(", ")}</p>` : ""}`;
}

function formatStrengths(d: Record<string, unknown>): string {
  if (!d || !Array.isArray(d.strengths)) return "<p>Not available.</p>";
  return `<ul>${(d.strengths as Array<Record<string, string>>).map((s) =>
    `<li><strong>${s.area}:</strong> ${s.evidence} (Durability: ${s.durability})</li>`
  ).join("")}</ul>`;
}

function formatVulnerabilities(d: Record<string, unknown>): string {
  if (!d || !Array.isArray(d.vulnerabilities)) return "<p>Not available.</p>";
  return `<ul>${(d.vulnerabilities as Array<Record<string, string>>).map((v) =>
    `<li><strong>${v.area}:</strong> ${v.evidence} (Exploitability: ${v.exploitability})</li>`
  ).join("")}</ul>`;
}

function formatNextMoves(d: Record<string, unknown>): string {
  if (!d || !Array.isArray(d.predictions)) return "<p>Not available.</p>";
  return `<ul>${(d.predictions as Array<Record<string, string>>).map((p) =>
    `<li><strong>${p.move}</strong> — Likelihood: ${p.likelihood}, Timeframe: ${p.timeframe}<br/>${p.evidence}</li>`
  ).join("")}</ul>`;
}

function formatProductStrategy(d: Record<string, unknown>): string {
  if (!d?.headline) return "<p>Not available.</p>";
  return `
    <p><strong>${d.headline}</strong></p>
    <p><strong>Where to attack:</strong> ${d.whereToAttack}</p>
    <p><strong>Urgency:</strong> ${d.urgency}</p>
    ${Array.isArray(d.productBets) ? `<h3>Product Bets</h3><ul>${(d.productBets as string[]).map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.messagingAngles) ? `<h3>Messaging Angles</h3><ul>${(d.messagingAngles as string[]).map((m) => `<li>${m}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.thingsToAvoid) ? `<h3>Don't Compete Here</h3><ul>${(d.thingsToAvoid as string[]).map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}`;
}

function formatResponse(d: Record<string, unknown>): string {
  if (!d?.ifCompeting) return "<p>Not available.</p>";
  return `
    <div>${(d.ifCompeting as string || "").split("\n\n").map((p) => `<p>${p}</p>`).join("")}</div>
    ${Array.isArray(d.attackVectors) ? `<h3>Attack Vectors</h3><ul>${(d.attackVectors as string[]).map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.defensiveActions) ? `<h3>Defensive Actions</h3><ul>${(d.defensiveActions as string[]).map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
    <p><strong>Strategic advice:</strong> ${d.strategicAdvice || "N/A"}</p>`;
}

function formatFinancials(d: Record<string, unknown>): string {
  if (!d?.financialHealth) return "<p>No public financial data available.</p>";
  const health = d.financialHealth as string;
  const healthColour = health === "strong" ? "#059669" : health === "moderate" ? "#d97706" : "#6b7280";
  return `
    <p><strong>Financial Health:</strong> <span style="color:${healthColour};font-weight:600;text-transform:capitalize">${health}</span></p>
    <p><strong>Total Funding:</strong> ${d.fundingTotal || "Unknown"}</p>
    ${d.lastRound ? `<p><strong>Last Round:</strong> ${(d.lastRound as Record<string,string>).type || "Unknown"} — ${(d.lastRound as Record<string,string>).amount || "Unknown"} (${(d.lastRound as Record<string,string>).date || "date unknown"})</p>` : ""}
    ${d.lastRound && Array.isArray((d.lastRound as Record<string,unknown>).investors) && ((d.lastRound as Record<string,unknown>).investors as string[]).length ? `<p><strong>Investors:</strong> ${((d.lastRound as Record<string,unknown>).investors as string[]).join(", ")}</p>` : ""}
    ${d.revenueEstimate ? `<p><strong>Revenue Estimate:</strong> ${d.revenueEstimate}</p>` : ""}
    ${d.valuation ? `<p><strong>Valuation:</strong> ${d.valuation}</p>` : ""}
    ${Array.isArray(d.keyMetrics) && (d.keyMetrics as string[]).length ? `<h3>Stated Metrics</h3><ul>${(d.keyMetrics as string[]).map((m) => `<li>${m}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.growthSignals) && (d.growthSignals as string[]).length ? `<h3>Growth Signals</h3><ul>${(d.growthSignals as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>` : ""}
    ${Array.isArray(d.profitabilitySignals) && (d.profitabilitySignals as string[]).length ? `<h3>Profitability Signals</h3><ul>${(d.profitabilitySignals as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>` : ""}`;
}
