import { db } from "../db";
import { runModule, executeStep } from "../ai";
import { renderReport } from "../report-renderer";
import { crawlCompanySite } from "../url-fetcher";

const TOTAL_STEPS = 14;

const EVIDENCE_DISCIPLINE = `EVIDENCE DISCIPLINE — read carefully:
- Use ONLY the analysis context above. Do NOT introduce facts that aren't supported by it.
- If the upstream data is thin, "Unknown", or marked as "Insufficient data", your output MUST also be thin. Return fewer points and lower confidence rather than fabricate to fill the schema.
- Quote specific phrases from upstream modules where possible.
- Confidence 0.7+ requires real evidence. Use 0.4-0.5 when reasoning from sparse signals. Use 0.2 when the upstream data is missing.
- Sources: only cite URLs that already appear in the upstream sources arrays. Do NOT fabricate URLs.

`;

export async function runProductStrategyStep(scanId: string, stepIndex: number) {
  const scan = await db.scan.findUniqueOrThrow({ where: { id: scanId } });

  const competitors = (scan.competitors || []).filter(Boolean);
  const context = `
Company: ${scan.companyName || "Unknown"} (${scan.companyUrl})
ICPs: ${[scan.icp].filter(Boolean).join("; ") || "Not provided"}
Product inflection point: ${scan.inflectionPoint || "Not provided"}
Known risks (user-supplied): ${scan.risks || "Not provided"}
Big bet: ${scan.bigBet || "Not provided"}
AI ambition: ${scan.aiAmbition || "Not provided"}
Competitors: ${competitors.join(", ") || "None listed"}
${scan.selfWeakness ? `Self-identified weaknesses: ${scan.selfWeakness}` : ""}`.trim();

  const prev = await db.analysisResult.findMany({
    where: { scanId },
    orderBy: { createdAt: "asc" },
  });
  const byModule = Object.fromEntries(prev.map((r) => [r.module, r.output]));

  switch (stepIndex) {
    // ── 0: Company Snapshot ──
    case 0: {
      // Pre-fetch the company website + main nav pages to inject actual content
      // into the prompt (more reliable than relying on Brave search index).
      const crawled = await crawlCompanySite(scan.companyUrl, { maxPerPageChars: 2500, totalMaxChars: 12000 });
      const siteContent = crawled.reachable
        ? `BELOW IS THE ACTUAL CONTENT FROM THE COMPANY WEBSITE — read it carefully and base your snapshot on it:

${crawled.content}

Pages fetched: ${crawled.pagesFetched.join(", ")}`
        : `NOTE: Could not fetch ${scan.companyUrl} directly (${crawled.error}). Try web_search as a fallback, but if that also returns nothing, set fields to "Unknown".`;

      await executeStep(scanId, "company_snapshot", 1, TOTAL_STEPS, () =>
        runModule(scanId, "COMPANY_SNAPSHOT",
          `You build company snapshots from PRIMARY sources only. Be factual.

CRITICAL RULES:
- The actual website content is provided below — use it. Do NOT guess based on the domain name.
- Do NOT confuse the company with similarly-named entities (e.g. Companies House records for similar names).
- The "name" field MUST be the brand name as displayed on their website (look at the TITLE and homepage content).
- Every claim in description/sector/hq/funding MUST come from the content provided.
- If the content is thin or missing a specific field, set that field to "Unknown" — DO NOT speculate.`,
          `${siteContent}

Build a factual snapshot from the content above. Return JSON:
{
  "name": "exact brand name from the website content above",
  "description": "2-3 sentences describing what they do — paraphrase their actual copy",
  "sector": "sector / category — from their own positioning",
  "hq": "location from footer/about page content, else 'Unknown'",
  "teamSize": "estimate if mentioned, else 'Unknown'",
  "funding": "funding info if mentioned, else 'Unknown'",
  "confidence": ${crawled.reachable ? 0.8 : 0.3},
  "sources": ${JSON.stringify(crawled.pagesFetched.length > 0 ? crawled.pagesFetched : [scan.companyUrl])}
}`,
          { webSearch: !crawled.reachable, maxSearches: 2 }
        ), { retries: 2, critical: true }
      );
      break;
    }

    // ── 1: Market Positioning ──
    case 1: {
      const snap = byModule.COMPANY_SNAPSHOT;
      await executeStep(scanId, "market_positioning", 2, TOTAL_STEPS, () =>
        runModule(scanId, "MARKET_POSITIONING",
          `You analyse market positioning with brutal honesty — but ONLY for what you can actually verify from the company's own materials.

If the snapshot data is "Unknown" or thin, your positioning analysis MUST also be thin. Do NOT invent positioning based on the domain name or sector guesses.`,
          `${context}
Snapshot: ${JSON.stringify(snap)}

If the snapshot above shows "Unknown" for most fields, the website was unreachable. In that case, return "Insufficient data — website unreachable" for every field below and confidence: 0.2.

Otherwise, analyse based ONLY on what's actually in the snapshot and what you can verify. Return JSON:
{
  "currentPositioning": "how they position themselves — quote or paraphrase their actual website copy if available, else 'Unknown'",
  "icpFit": "how well they serve their stated ICPs — be specific or say 'Unknown'",
  "territoryFit": "are they in the right markets — only assess if you have data on their territories",
  "competitiveGap": "where there is daylight vs competitors — only if you have evidence",
  "positioningRisk": "where their positioning is unclear or vulnerable",
  "recommendation": "one clear positioning move based on the evidence",
  "confidence": 0.5,
  "sources": ["actual URLs only — no fabrication"]
}`
        )
      );
      break;
    }

    // ── 2: SWOT Analysis ──
    case 2: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const pos = byModule.MARKET_POSITIONING;
      await executeStep(scanId, "swot_analysis", 3, TOTAL_STEPS, () =>
        runModule(scanId, "SWOT_ANALYSIS",
          `You produce SWOT analyses ONLY from evidence in the prior context. You do NOT invent SWOT points.

If the snapshot/positioning data is "Unknown" or thin, you MUST return fewer points (or "Insufficient data") rather than fabricate. A 1-bullet SWOT with real evidence is better than a 4-bullet SWOT of guesses.`,
          `${context}
Snapshot: ${JSON.stringify(snap)}
Positioning: ${JSON.stringify(pos)}

Produce a SWOT analysis based ONLY on the evidence above. Each point MUST reference something specific from the snapshot or positioning. If you can't back a point with evidence, omit it.

Return JSON:
{
  "strengths": ["only points backed by evidence in the context above"],
  "weaknesses": ["only weaknesses you can actually point to"],
  "opportunities": ["only opportunities the evidence supports"],
  "threats": ["only threats the evidence supports"],
  "summary": "one sentence — based only on what you can verify",
  "confidence": 0.5,
  "sources": ["URLs from the snapshot/positioning sources only"]
}`
        )
      );
      break;
    }

    // ── 3: Competitor Landscape ──
    case 3: {
      const snap = byModule.COMPANY_SNAPSHOT;

      // Pre-fetch competitor sites (limit to 3 to stay under Worker budget)
      const competitorData: Array<{ url: string; content: string; reachable: boolean }> = [];
      if (competitors.length > 0) {
        const competitorsToFetch = competitors.slice(0, 3);
        const results = await Promise.all(
          competitorsToFetch.map((c) =>
            crawlCompanySite(c, { maxPerPageChars: 1500, totalMaxChars: 4000 })
              .then((r) => ({ url: c, content: r.content, reachable: r.reachable }))
              .catch(() => ({ url: c, content: "", reachable: false }))
          )
        );
        competitorData.push(...results);
      }

      const competitorContent = competitorData.length > 0
        ? competitorData.map((c) =>
            c.reachable
              ? `\n=== COMPETITOR: ${c.url} ===\n${c.content}`
              : `\n=== COMPETITOR: ${c.url} (site not fetched — mark as Unknown) ===`
          ).join("\n")
        : "";

      await executeStep(scanId, "competitor_snapshot", 4, TOTAL_STEPS, () =>
        runModule(scanId, "COMPETITOR_SNAPSHOT",
          `You analyse competitors from the actual website content provided below. Do NOT speculate.

If a competitor's site content is missing, mark "whatTheyDo" as "Unknown — site not fetched" and threatLevel as "unknown". Do NOT guess.`,
          `${context}
Our company: ${JSON.stringify(snap)}

ACTUAL COMPETITOR WEBSITE CONTENT:
${competitorContent || "No competitor URLs provided."}

Produce a snapshot for each competitor based ONLY on the content above. Return JSON:
{
  "competitors": [
    {
      "name": "exact brand name from their website content above",
      "whatTheyDo": "one sentence — paraphrase their own copy",
      "keyStrength": "biggest advantage based on what they actually offer",
      "keyWeakness": "weakness from public signals only — no guessing",
      "threatLevel": "high|medium|low|unknown"
    }
  ],
  "competitiveDynamic": "one sentence — only if you have evidence on multiple competitors",
  "confidence": 0.7,
  "sources": ${JSON.stringify(competitorData.filter((c) => c.reachable).map((c) => c.url))}
}

${competitors.length === 0 ? "No competitors listed — set competitors to [] and competitiveDynamic to 'No competitors provided.'" : ""}`
        )
      );
      break;
    }

    // ── 4: Emerging Trends ──
    case 4: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const comp = byModule.COMPETITOR_SNAPSHOT;
      await executeStep(scanId, "emerging_trends", 5, TOTAL_STEPS, () =>
        runModule(scanId, "EMERGING_TRENDS",
          `You identify emerging trends ONLY in the specific sector this company operates in. No generic AI/SaaS futurism. If you don't know the sector for sure, say so.`,
          `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snap)}
Competitors: ${JSON.stringify(comp)}

Identify the 3-5 most important emerging trends ACTUALLY affecting this specific sector. If the snapshot/competitor data is too thin to know the sector, return trends: [] and confidence 0.2. Return JSON:
{
  "trends": [
    {
      "trend": "specific trend name",
      "description": "what is happening and why it matters",
      "timeframe": "happening_now|next_6_months|next_12_months",
      "impact": "how this affects the company specifically",
      "action": "what they should do about it"
    }
  ],
  "biggestBlindSpot": "the trend most companies in this space are ignoring",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        )
      );
      break;
    }

    // ── 5: Pricing & Monetisation ──
    case 5: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const pos = byModule.MARKET_POSITIONING;
      const comp = byModule.COMPETITOR_SNAPSHOT;
      await executeStep(scanId, "pricing_monetisation", 6, TOTAL_STEPS, () =>
        runModule(scanId, "PRICING_MONETISATION",
          `You assess pricing strategy from PUBLIC pricing pages only. If pricing isn't public, say so. Don't guess pricing models from sector defaults.`,
          `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snap)}
Positioning: ${JSON.stringify(pos)}
Competitors: ${JSON.stringify(comp)}

Assess their pricing. If you have no evidence of their actual pricing, mark currentModel as "Not publicly disclosed" and confidence 0.3. Return JSON:
{
  "currentModel": "best guess at their pricing model based on public signals (freemium, per-seat, usage, etc.)",
  "competitorPricing": "how competitors price — where is there room to move",
  "pricingStrength": "where their pricing model works well",
  "pricingRisk": "where they are leaving money on the table or misaligned with value",
  "recommendation": "one specific pricing or packaging move to make",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        )
      );
      break;
    }

    // ── 6: Go-to-Market Fit ──
    case 6: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const pos = byModule.MARKET_POSITIONING;
      const comp = byModule.COMPETITOR_SNAPSHOT;
      await executeStep(scanId, "gtm_fit", 7, TOTAL_STEPS, () =>
        runModule(scanId, "GTM_FIT",
          `You assess go-to-market fit from observable signals (their site, hiring, content). If signals are absent, say "Insufficient signal" — do not invent a motion.`,
          `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snap)}
Positioning: ${JSON.stringify(pos)}
Competitors: ${JSON.stringify(comp)}

Assess their go-to-market based ONLY on observable signals from upstream context. Return JSON:
{
  "currentMotion": "what GTM motion they appear to run (PLG, sales-led, channel, etc.)",
  "icpChannelFit": "are they reaching their ICPs through the right channels",
  "competitorGTM": "how competitors go to market — where is there an opening",
  "biggestGTMGap": "the single biggest gap in their go-to-market",
  "recommendation": "one specific GTM move to make",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        )
      );
      break;
    }

    // ── 7: Retention & Moat ──
    case 7: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const swot = byModule.SWOT_ANALYSIS;
      await executeStep(scanId, "retention_moat", 8, TOTAL_STEPS, () =>
        runModule(scanId, "RETENTION_MOAT",
          `You assess defensibility ONLY from concrete features named in the upstream context. No generic moat-talk.`,
          `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snap)}
SWOT: ${JSON.stringify(swot)}

Assess retention/moat based on upstream evidence. Return JSON:
{
  "switchingCosts": "how hard is it for a customer to leave — and why",
  "moatType": "what kind of moat they have or could build (data, network, integration, brand, none)",
  "retentionRisk": "biggest risk to customer retention",
  "churnDrivers": ["top 2-3 likely reasons customers would churn"],
  "moatRecommendation": "one specific thing to do to deepen the moat",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        )
      );
      break;
    }

    // ── 8: Build vs Buy vs Partner ──
    case 8: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const swot = byModule.SWOT_ANALYSIS;
      const trends = byModule.EMERGING_TRENDS;
      await executeStep(scanId, "build_buy_partner", 9, TOTAL_STEPS, () =>
        runModule(scanId, "BUILD_BUY_PARTNER",
          `You recommend build/buy/partner ONLY for capabilities the upstream evidence shows the company actually needs. Don't invent capability gaps.`,
          `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snap)}
SWOT: ${JSON.stringify(swot)}
Emerging Trends: ${JSON.stringify(trends)}

For each capability the upstream evidence shows is needed, recommend build, buy, or partner. Return JSON:
{
  "capabilities": [
    {
      "capability": "specific capability needed",
      "recommendation": "build|buy|partner",
      "rationale": "why this approach for this capability",
      "urgency": "now|next_quarter|later"
    }
  ],
  "overallStrategy": "one sentence — their overall make-vs-buy philosophy should be…",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        )
      );
      break;
    }

    // ── 9: Product Priorities ──
    case 9: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const pos = byModule.MARKET_POSITIONING;
      const swot = byModule.SWOT_ANALYSIS;
      const comp = byModule.COMPETITOR_SNAPSHOT;
      const trends = byModule.EMERGING_TRENDS;
      await executeStep(scanId, "product_priorities", 10, TOTAL_STEPS, () =>
        runModule(scanId, "PRODUCT_PRIORITIES",
          `You recommend priorities anchored DIRECTLY to weaknesses, threats, and opportunities the upstream analysis identified. Each priority MUST cite which upstream finding it addresses.`,
          `${EVIDENCE_DISCIPLINE}${context}
Analysis so far:
Snapshot: ${JSON.stringify(snap)}
Positioning: ${JSON.stringify(pos)}
SWOT: ${JSON.stringify(swot)}
Competitors: ${JSON.stringify(comp)}
Emerging Trends: ${JSON.stringify(trends)}

Recommend 3-5 product priorities. Each rationale MUST reference a specific upstream finding. If upstream analysis is too thin, return fewer priorities. Return JSON:
{
  "priorities": [
    {
      "priority": "specific product priority",
      "rationale": "why this matters commercially",
      "urgency": "now|next_quarter|later",
      "impact": "high|medium"
    }
  ],
  "thingsToStop": ["things to deprioritise or kill"],
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        )
      );
      break;
    }

    // ── 10: AI Opportunity ──
    case 10: {
      const snap = byModule.COMPANY_SNAPSHOT;
      const swot = byModule.SWOT_ANALYSIS;
      await executeStep(scanId, "ai_opportunity", 11, TOTAL_STEPS, () =>
        runModule(scanId, "AI_OPPORTUNITY",
          `You assess AI opportunities tied to the company's ACTUAL product surface area (from upstream context). No generic AI buzzword lists.`,
          `${EVIDENCE_DISCIPLINE}${context}
Snapshot: ${JSON.stringify(snap)}
SWOT: ${JSON.stringify(swot)}

Their AI ambition: "${scan.aiAmbition || "Not specified"}"

Assess AI opportunities ONLY tied to what we know about their product. If we don't know their product, return quickWins: [] and confidence 0.3. Return JSON:
{
  "feasibility": "high|medium|low",
  "quickWins": ["2-3 concrete AI features they could ship in 90 days"],
  "bigBets": ["1-2 longer-term AI plays worth investing in"],
  "avoidList": ["AI approaches that would be a waste of time for this company"],
  "recommendation": "one sentence — what to do on AI right now",
  "confidence": 0.7,
  "sources": ["specific URL or public source", "another source"]
}`
        )
      );
      break;
    }

    // ── 11: Risks Assessment ──
    case 11: {
      // Slim context — pick only the highest-signal fields to fit the 30s budget
      const snap = byModule.COMPANY_SNAPSHOT as Record<string, unknown> | undefined;
      const swot = byModule.SWOT_ANALYSIS as Record<string, unknown> | undefined;
      const comp = byModule.COMPETITOR_SNAPSHOT as Record<string, unknown> | undefined;
      const trends = byModule.EMERGING_TRENDS as Record<string, unknown> | undefined;

      const slim = {
        company: snap?.name,
        sector: snap?.sector,
        weaknesses: (swot?.weaknesses as string[] | undefined)?.slice(0, 4),
        threats: (swot?.threats as string[] | undefined)?.slice(0, 4),
        competitorDynamic: comp?.competitiveDynamic,
        topTrends: (trends?.trends as Array<{ trend: string; impact: string }> | undefined)?.slice(0, 3).map((t) => `${t.trend}: ${t.impact}`),
      };

      await executeStep(scanId, "risks_assessment", 12, TOTAL_STEPS, () =>
        runModule(scanId, "RISKS_ASSESSMENT",
          `You assess strategic risks with cold honesty. Tight output only. Every risk must tie to upstream evidence.`,
          `Context: ${JSON.stringify(slim)}

User-supplied risks: ${scan.risks || "None provided"}

Return JSON (max 5 risks, keep strings short):
{
  "userRiskAssessment": "1-sentence assessment of user's stated risks (or 'No risks provided')",
  "risks": [
    {
      "risk": "risk (short)",
      "category": "market|competitive|product|gtm|financial|execution|regulatory|ai",
      "likelihood": "high|medium|low",
      "impact": "high|medium|low",
      "evidence": "specific upstream finding (short)",
      "mitigation": "concrete action (short)"
    }
  ],
  "topThreeRisks": ["risk 1", "risk 2", "risk 3"],
  "blindSpots": ["2-3 blind spots, short"],
  "confidence": 0.6,
  "sources": []
}`
        )
      );
      break;
    }

    // ── 12: 90-Day Action Plan ──
    case 12: {
      const priorities = byModule.PRODUCT_PRIORITIES;
      const pricing = byModule.PRICING_MONETISATION;
      const gtm = byModule.GTM_FIT;
      const moat = byModule.RETENTION_MOAT;
      const bbp = byModule.BUILD_BUY_PARTNER;
      const ai = byModule.AI_OPPORTUNITY;
      const risks = byModule.RISKS_ASSESSMENT;
      await executeStep(scanId, "action_plan", 13, TOTAL_STEPS, () =>
        runModule(scanId, "ACTION_PLAN",
          `You write 90-day action plans for CEOs. Be concrete — names of actions, not categories. Think in 3 phases: Week 1-2, Month 1, Month 2-3. Every action must either advance a priority OR mitigate a top risk.`,
          `${EVIDENCE_DISCIPLINE}${context}
Product Priorities: ${JSON.stringify(priorities)}
Pricing: ${JSON.stringify(pricing)}
GTM: ${JSON.stringify(gtm)}
Retention & Moat: ${JSON.stringify(moat)}
Build/Buy/Partner: ${JSON.stringify(bbp)}
AI Opportunity: ${JSON.stringify(ai)}
Risks Assessment: ${JSON.stringify(risks)}

Write a 90-day action plan. Every action MUST either (a) advance a specific upstream priority, or (b) mitigate a specific upstream risk. Return JSON:
{
  "phase1": {
    "label": "Week 1-2: Quick wins",
    "actions": ["specific action 1", "specific action 2", "specific action 3"]
  },
  "phase2": {
    "label": "Month 1: Foundation",
    "actions": ["specific action 1", "specific action 2", "specific action 3"]
  },
  "phase3": {
    "label": "Month 2-3: Build momentum",
    "actions": ["specific action 1", "specific action 2", "specific action 3"]
  },
  "successMetric": "one sentence — how you'll know this 90 days was successful",
  "confidence": 0.6,
  "sources": ["URLs from upstream only"]
}`
        )
      );
      break;
    }

    // ── 13: Render Report ──
    case 13: {
      const snap = byModule.COMPANY_SNAPSHOT as Record<string, unknown> | null;
      const pos = byModule.MARKET_POSITIONING as Record<string, unknown> | null;
      const swot = byModule.SWOT_ANALYSIS as Record<string, unknown> | null;
      const comp = byModule.COMPETITOR_SNAPSHOT as Record<string, unknown> | null;
      const trends = byModule.EMERGING_TRENDS as Record<string, unknown> | null;
      const pricing = byModule.PRICING_MONETISATION as Record<string, unknown> | null;
      const gtm = byModule.GTM_FIT as Record<string, unknown> | null;
      const moat = byModule.RETENTION_MOAT as Record<string, unknown> | null;
      const bbp = byModule.BUILD_BUY_PARTNER as Record<string, unknown> | null;
      const priorities = byModule.PRODUCT_PRIORITIES as Record<string, unknown> | null;
      const ai = byModule.AI_OPPORTUNITY as Record<string, unknown> | null;
      const risks = byModule.RISKS_ASSESSMENT as Record<string, unknown> | null;
      const action = byModule.ACTION_PLAN as Record<string, unknown> | null;

      await executeStep(scanId, "render_report", 14, TOTAL_STEPS, async () => {
        const src = (d: Record<string, unknown> | null): string[] =>
          (Array.isArray(d?.sources) ? (d?.sources as string[]) : []).filter(Boolean);

        const sections = [
          { id: "snapshot", title: "Company Snapshot", content: fmtSnapshot(snap), sources: src(snap) },
          { id: "positioning", title: "Market Positioning", content: fmtPositioning(pos), sources: src(pos) },
          { id: "swot", title: "SWOT Analysis", content: fmtSWOT(swot), sources: src(swot) },
          { id: "competitors", title: "Competitor Landscape", content: fmtCompetitors(comp), sources: src(comp) },
          { id: "trends", title: "Emerging Trends", content: fmtTrends(trends), sources: src(trends) },
          { id: "pricing", title: "Pricing & Monetisation", content: fmtPricing(pricing), sources: src(pricing) },
          { id: "gtm", title: "Go-to-Market Fit", content: fmtGTM(gtm), sources: src(gtm) },
          { id: "moat", title: "Retention & Moat", content: fmtMoat(moat), sources: src(moat) },
          { id: "bbp", title: "Build vs Buy vs Partner", content: fmtBBP(bbp), sources: src(bbp) },
          { id: "priorities", title: "Product Priorities", content: fmtPriorities(priorities), sources: src(priorities) },
          { id: "ai", title: "AI Opportunity", content: fmtAI(ai), sources: src(ai) },
          { id: "risks", title: "Risks Assessment", content: fmtRisks(risks), sources: src(risks) },
          { id: "action", title: "90-Day Action Plan", content: fmtAction(action), sources: src(action) },
        ];

        const name = (snap?.name as string) || scan.companyName || "Your Company";
        await renderReport(scanId, scan.userId, `Product Strategy: ${name}`, sections);

        await db.scan.update({
          where: { id: scanId },
          data: { status: "COMPLETED", completedAt: new Date(), progress: 100 },
        });
      }, { critical: true });
      break;
    }
  }
}

// ── Formatters ──

function fmtSnapshot(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>${d.name}</strong> — ${d.description}</p>
    <p><strong>Sector:</strong> ${d.sector || "N/A"} | <strong>HQ:</strong> ${d.hq || "N/A"} | <strong>Team:</strong> ${d.teamSize || "N/A"}</p>
    <p><strong>Funding:</strong> ${d.funding || "N/A"}</p>`;
}

function fmtPositioning(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Current positioning:</strong> ${d.currentPositioning}</p>
    <p><strong>ICP fit:</strong> ${d.icpFit}</p>
    <p><strong>Territory fit:</strong> ${d.territoryFit}</p>
    <p><strong>Competitive gap:</strong> ${d.competitiveGap}</p>
    <p><strong>Positioning risk:</strong> ${d.positioningRisk}</p>
    <p><strong>Recommendation:</strong> ${d.recommendation}</p>`;
}

function fmtSWOT(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const quad = (label: string, items: unknown) =>
    Array.isArray(items) ? `<h3>${label}</h3><ul>${(items as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>` : "";
  return `
    ${quad("Strengths", d.strengths)}
    ${quad("Weaknesses", d.weaknesses)}
    ${quad("Opportunities", d.opportunities)}
    ${quad("Threats", d.threats)}
    <p><strong>Key takeaway:</strong> ${d.summary}</p>`;
}

function fmtCompetitors(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const comps = Array.isArray(d.competitors)
    ? (d.competitors as Array<Record<string, string>>).map((c) => `
      <div style="margin-bottom:1rem;padding:0.75rem 1rem;border:1px solid #e5e7eb;border-radius:8px;">
        <p><strong>${c.name}</strong> — ${c.whatTheyDo}</p>
        <p style="font-size:0.875rem;color:#4b5563;margin-top:0.25rem;">
          <strong>Strength:</strong> ${c.keyStrength} |
          <strong>Weakness:</strong> ${c.keyWeakness} |
          <strong>Threat:</strong> ${c.threatLevel}
        </p>
      </div>`).join("")
    : "";
  return `${comps}<p><strong>Competitive dynamic:</strong> ${d.competitiveDynamic}</p>`;
}

function fmtTrends(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const trends = Array.isArray(d.trends)
    ? (d.trends as Array<Record<string, string>>).map((t) => `
      <div style="margin-bottom:1rem;padding:0.75rem 1rem;border:1px solid #e5e7eb;border-radius:8px;">
        <p><strong>${t.trend}</strong> <em style="color:#6b7280;">(${t.timeframe?.replace(/_/g, " ")})</em></p>
        <p style="font-size:0.875rem;color:#374151;margin-top:0.25rem;">${t.description}</p>
        <p style="font-size:0.875rem;margin-top:0.25rem;"><strong>Impact:</strong> ${t.impact}</p>
        <p style="font-size:0.875rem;margin-top:0.25rem;"><strong>Action:</strong> ${t.action}</p>
      </div>`).join("")
    : "";
  return `${trends}<p><strong>Biggest blind spot:</strong> ${d.biggestBlindSpot}</p>`;
}

function fmtPricing(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Current model:</strong> ${d.currentModel}</p>
    <p><strong>Competitor pricing:</strong> ${d.competitorPricing}</p>
    <p><strong>Strength:</strong> ${d.pricingStrength}</p>
    <p><strong>Risk:</strong> ${d.pricingRisk}</p>
    <p><strong>Recommendation:</strong> ${d.recommendation}</p>`;
}

function fmtGTM(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  return `
    <p><strong>Current motion:</strong> ${d.currentMotion}</p>
    <p><strong>ICP channel fit:</strong> ${d.icpChannelFit}</p>
    <p><strong>Competitor GTM:</strong> ${d.competitorGTM}</p>
    <p><strong>Biggest gap:</strong> ${d.biggestGTMGap}</p>
    <p><strong>Recommendation:</strong> ${d.recommendation}</p>`;
}

function fmtMoat(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const drivers = Array.isArray(d.churnDrivers)
    ? `<h3>Churn drivers</h3><ul>${(d.churnDrivers as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";
  return `
    <p><strong>Switching costs:</strong> ${d.switchingCosts}</p>
    <p><strong>Moat type:</strong> ${d.moatType}</p>
    <p><strong>Retention risk:</strong> ${d.retentionRisk}</p>
    ${drivers}
    <p><strong>Recommendation:</strong> ${d.moatRecommendation}</p>`;
}

function fmtBBP(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const caps = Array.isArray(d.capabilities)
    ? (d.capabilities as Array<Record<string, string>>).map((c) => `
      <div style="margin-bottom:0.75rem;padding:0.75rem 1rem;border:1px solid #e5e7eb;border-radius:8px;">
        <p><strong>${c.capability}</strong> — <em>${c.recommendation}</em> (${c.urgency})</p>
        <p style="font-size:0.875rem;color:#4b5563;margin-top:0.25rem;">${c.rationale}</p>
      </div>`).join("")
    : "";
  return `${caps}<p><strong>Overall strategy:</strong> ${d.overallStrategy}</p>`;
}

function fmtPriorities(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const list = Array.isArray(d.priorities)
    ? `<ol>${(d.priorities as Array<Record<string, string>>).map((p) =>
        `<li><strong>${p.priority}</strong> — ${p.rationale} <em>(${p.urgency}, ${p.impact} impact)</em></li>`
      ).join("")}</ol>`
    : "";
  const stop = Array.isArray(d.thingsToStop)
    ? `<h3>Deprioritise</h3><ul>${(d.thingsToStop as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";
  return `${list}${stop}`;
}

function fmtAI(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const quickWins = Array.isArray(d.quickWins)
    ? `<h3>Quick wins (90 days)</h3><ul>${(d.quickWins as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";
  const bigBets = Array.isArray(d.bigBets)
    ? `<h3>Big bets</h3><ul>${(d.bigBets as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";
  const avoid = Array.isArray(d.avoidList)
    ? `<h3>Avoid</h3><ul>${(d.avoidList as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";
  return `
    <p><strong>Feasibility:</strong> ${d.feasibility}</p>
    ${quickWins}${bigBets}${avoid}
    <p><strong>Recommendation:</strong> ${d.recommendation}</p>`;
}

function fmtAction(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";
  const phase = (p: unknown) => {
    const ph = p as Record<string, unknown> | null;
    if (!ph) return "";
    return `
      <h3>${ph.label}</h3>
      <ul>${Array.isArray(ph.actions) ? (ph.actions as string[]).map((a) => `<li>${a}</li>`).join("") : ""}</ul>`;
  };
  return `
    ${phase(d.phase1)}
    ${phase(d.phase2)}
    ${phase(d.phase3)}
    <p><strong>Success metric:</strong> ${d.successMetric}</p>`;
}

function fmtRisks(d: Record<string, unknown> | null): string {
  if (!d) return "<p>Not available.</p>";

  const parts: string[] = [];

  if (d.userRiskAssessment) {
    parts.push(`<p><strong>Your stated risks:</strong> ${d.userRiskAssessment}</p>`);
  }

  if (Array.isArray(d.topThreeRisks) && (d.topThreeRisks as string[]).length > 0) {
    parts.push(`<h3>Top 3 Risks</h3><ol>${(d.topThreeRisks as string[]).map((r) => `<li>${r}</li>`).join("")}</ol>`);
  }

  if (Array.isArray(d.risks) && (d.risks as unknown[]).length > 0) {
    const rows = (d.risks as Array<Record<string, string>>).map((r) => {
      const lk = (r.likelihood || "").toLowerCase();
      const im = (r.impact || "").toLowerCase();
      const color = (lk === "high" && im === "high") ? "#dc2626" : (lk === "low" || im === "low") ? "#6b7280" : "#d97706";
      return `
        <div style="margin-bottom:1rem;padding:0.75rem 1rem;border:1px solid #e5e7eb;border-radius:8px;border-left:3px solid ${color};">
          <p><strong>${r.risk}</strong> <span style="font-size:0.7rem;color:${color};text-transform:uppercase;font-weight:600;">(${r.category})</span></p>
          <p style="font-size:0.8125rem;color:#4b5563;margin-top:0.25rem;">
            <strong>Likelihood:</strong> ${r.likelihood} · <strong>Impact:</strong> ${r.impact}
          </p>
          <p style="font-size:0.8125rem;color:#374151;margin-top:0.25rem;"><strong>Evidence:</strong> ${r.evidence}</p>
          <p style="font-size:0.8125rem;color:#374151;margin-top:0.25rem;"><strong>Mitigation:</strong> ${r.mitigation}</p>
        </div>`;
    }).join("");
    parts.push(`<h3>Risk Register</h3>${rows}`);
  }

  if (Array.isArray(d.blindSpots) && (d.blindSpots as string[]).length > 0) {
    parts.push(`<h3>Blind Spots</h3><ul>${(d.blindSpots as string[]).map((s) => `<li>${s}</li>`).join("")}</ul>`);
  }

  return parts.join("");
}
