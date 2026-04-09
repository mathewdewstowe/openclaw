import { db } from "../db";
import { runModule, executeStep } from "../ai";
import { renderReport } from "../report-renderer";

const TOTAL_STEPS = 14;

const EVIDENCE_DISCIPLINE = `EVIDENCE DISCIPLINE — read carefully:
- Use ONLY the company context provided above. Do NOT introduce facts that aren't supported by it.
- If the upstream snapshot is thin, "Unknown", or marked as "Insufficient data", your output MUST also be thin. Return fewer items rather than fabricate to fill the schema.
- Quote specific phrases from upstream modules where possible.
- Confidence 0.7+ requires real evidence. Use 0.4-0.5 when reasoning from sparse signals. Use 0.2 when upstream data is missing.
- Sources: only cite URLs that already appear in upstream sources. Do NOT fabricate URLs.

`;

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
          `You build competitor snapshots from PRIMARY sources only. Be factual.

CRITICAL RULES:
- You MUST use web_search to fetch the actual company website BEFORE writing anything.
- Read the homepage, /about, /product, /pricing pages of the EXACT URL given.
- Do NOT guess based on the domain name. Do NOT confuse the company with similarly-named entities (Companies House records, look-alike domains).
- If web_search returns no results for the exact URL, set fields to "Unknown" — DO NOT speculate.
- The "name" field MUST be the brand name as displayed on their actual website, not an inferred legal entity.`,
          `Use web_search to fetch the homepage at ${scan.companyUrl}. Read what the site actually says about the company.

Then build a factual snapshot. Return JSON:
{
  "name": "exact brand name from their website",
  "description": "2-3 sentences describing what they do — based on the website's own copy",
  "founded": "year if mentioned, else 'Unknown'",
  "hq": "location from their website's footer or about page, else 'Unknown'",
  "teamSize": "estimate if mentioned, else 'Unknown'",
  "funding": "funding info if mentioned, else 'Unknown'",
  "sector": "sector / category — from their own positioning",
  "sources": ["${scan.companyUrl}", "other URLs you actually fetched"],
  "confidence": 0.7
}

If web_search fails to return content for ${scan.companyUrl}, set name to the URL hostname and all other fields to "Unknown — website unreachable" with confidence 0.2. Do NOT guess.`,
          { webSearch: true, maxSearches: 3 }
        ), { retries: 0, critical: true }
      );
      return true;
    }

    case 1: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ctx1 = pick(s, ["name", "description", "sector", "hq", "funding"]);
      await executeStep(scanId, "positioning", 2, TOTAL_STEPS, () =>
        runModule(scanId, "POSITIONING_ANALYSIS",
          `You analyse positioning ONLY from the snapshot below. If snapshot is "Unknown", return "Insufficient data" for every field and confidence 0.2.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx1)}
Analyse their positioning based ONLY on the snapshot above. Return JSON:
{"statedPositioning":"what they claim — from snapshot","actualPositioning":"where they actually sit","defensibility":"strong|moderate|weak|unknown","defensibilityReason":"why (1 sentence)","gaps":["gap1","gap2"],"buyerReason":"why someone buys (1 sentence)","recommendation":"advice (1 sentence)","confidence":0.5}`
        )
      );
      return true;
    }

    case 2: {
      const s = await load(scanId, "COMPETITOR_SNAPSHOT");
      const ctx2 = pick(s, ["name", "description", "sector"]);
      await executeStep(scanId, "product_shape", 3, TOTAL_STEPS, () =>
        runModule(scanId, "PRODUCT_SHAPE",
          `You analyse product architecture from PUBLIC signals only. Don't invent products or pricing. If unknown, return empty arrays and "Unknown".`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx2)}
Return JSON based ONLY on the snapshot above:
{"products":["only products you can name from upstream"],"architecture":"assessment (1-2 sentences) or 'Unknown'","integrations":["only verified"],"pricingModel":"how they charge or 'Not publicly disclosed'","techStack":["only verified"],"confidence":0.5}`
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
          `You assess AI claims ONLY from what's verifiable in the upstream context. If they make no AI claims in the upstream data, return empty arrays — don't invent AI claims for them.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx3)}
Return JSON:
{"claims":["only AI claims actually mentioned in upstream — empty array if none"],"reality":"honest assessment or 'No AI claims found in public materials'","gapAnalysis":"only if there are claims to assess","genuineCapabilities":["verified only"],"confidence":0.5}`
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
          `You extract GTM signals from public data only. Don't invent partnerships or campaigns.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx4)}
Return JSON:
{"channels":["only verified channels"],"messaging":"core message from their copy or 'Unknown'","targetSegments":["only verified"],"partnerships":["only verified — empty array if none found"],"recentCampaigns":["only verified — empty array if none found"],"confidence":0.5}`
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
          `You identify strengths ONLY backed by evidence in the upstream context. Each strength MUST cite a specific evidence item from upstream. No speculation.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx5)}
Return JSON. Include 0-5 strengths — only ones you can back with evidence:
{"strengths":[{"area":"area","evidence":"specific evidence from upstream (1 sentence)","durability":"short|medium|long"}],"confidence":0.5}`
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
          `You identify vulnerabilities ONLY from observable signals in the upstream context. Each vulnerability MUST cite specific evidence. No invented weaknesses.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx6)}
Return JSON. Include 0-5 vulnerabilities — only ones you can back with evidence:
{"vulnerabilities":[{"area":"area","evidence":"specific evidence (1 sentence)","exploitability":"high|medium|low"}],"confidence":0.5}`
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
          `You predict moves ONLY from concrete signals in the upstream context (job postings, product launches, hiring trends, recent news). No generic speculation.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx7)}
Return JSON. Include 0-4 predictions — only ones backed by signal:
{"predictions":[{"move":"specific predicted move","likelihood":"high|medium|low","timeframe":"timeframe","evidence":"specific upstream signal (1 sentence)"}],"confidence":0.4}`
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
          `You write competitive response strategies tied DIRECTLY to vulnerabilities and next moves identified upstream. Each attack vector MUST exploit a specific upstream finding.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx8)}
Return JSON. If upstream vulnerabilities/moves are empty, return "Insufficient upstream data" for ifCompeting and confidence 0.3:
{"ifCompeting":"2-3 paragraph strategy anchored to upstream findings","attackVectors":["each tied to a specific upstream vulnerability"],"defensiveActions":["each tied to a specific upstream next-move"],"strategicAdvice":"summary (1 sentence)","confidence":0.5}`
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
          `You write product strategy anchored to specific vulnerabilities and product gaps from upstream. No generic advice.`,
          `${EVIDENCE_DISCIPLINE}Company: ${JSON.stringify(ctx9)}
${scan.userQuestion ? `Focus question: ${scan.userQuestion}` : ""}
Return JSON. Each product bet/messaging angle MUST tie to a specific upstream finding:
{"headline":"one-line verdict","whereToAttack":"which areas (1 sentence) — based on upstream vulnerabilities","productBets":["each tied to a specific upstream gap"],"messagingAngles":["each contrasts with their actual positioning"],"thingsToAvoid":["specific to their strengths"],"urgency":"high|medium|low","confidence":0.5}`
        )
      );
      return true;
    }

    case 10: {
      const snapshot = await load(scanId, "COMPETITOR_SNAPSHOT");
      await executeStep(scanId, "public_financials", 11, TOTAL_STEPS, () =>
        runModule(scanId, "PUBLIC_FINANCIALS",
          `You extract financial signals from web_search results only. NEVER fabricate funding rounds, revenue, or valuations. If data is missing, say "Unknown" — do NOT guess.

CRITICAL: Don't confuse the company with similarly-named entities in funding databases. Verify it's the SAME company.`,
          `Use web_search to find public financial data on the company in the snapshot below. Focus on Crunchbase, Pitchbook, press releases, official funding announcements.

Snapshot: ${JSON.stringify(snapshot)}

Return JSON. Use "Unknown" liberally if data isn't verifiable:
{
  "fundingTotal": "total funding raised or 'Unknown'",
  "lastRound": { "type": "Series A/B/etc or 'Unknown'", "amount": "amount or 'Unknown'", "date": "date or 'Unknown'", "investors": ["only verified — empty array if unknown"] },
  "revenueEstimate": "estimate with stated basis (e.g. 'Crunchbase 2024') or 'Not publicly disclosed'",
  "growthSignals": ["only verified — empty array if none"],
  "profitabilitySignals": ["only verified — empty array if none"],
  "valuation": "last known valuation or 'Unknown'",
  "keyMetrics": ["only publicly stated — empty array if none"],
  "financialHealth": "strong|moderate|uncertain|unknown",
  "confidence": 0.3
}`,
          { webSearch: true, maxSearches: 2 }
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
  const healthColour = health === "strong" ? "#1e293b" : health === "moderate" ? "#d97706" : "#6b7280";
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
