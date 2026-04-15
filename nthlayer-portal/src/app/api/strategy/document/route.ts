/**
 * POST /api/strategy/document
 *
 * Multi-agent strategy document generation pipeline.
 * Streams Server-Sent Events (SSE) showing progress, then the final Markdown.
 *
 * Pipeline:
 *   1. Resolver   — converts 5 stage outputs into canonical synthesis object
 *   2. [parallel] — 6 section writers each write their sections
 *   3. Final Editor — assembles into one coherent document
 *
 * The agents are defined in Claude Managed Agents (IDs in .env.local).
 * Execution uses direct messages.create() calls for reliable SSE streaming.
 */

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements, canAccessCompany } from "@/lib/entitlements";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const MODEL = "claude-opus-4-6";

// ─── System prompts (mirror what's in Managed Agents) ───────────────────────

const RESOLVER_PROMPT = `You are the Resolver Agent for Inflexion final document generation.

Your job is to convert five stage outputs into one canonical synthesis object.

Inputs:
- Frame
- Diagnose
- Decide
- Position
- Commit

Output:
A structured synthesis object for downstream section agents.

Your synthesis object must contain:

- company_name
- strategy_title
- date
- cascade_confidence_score
- strategic_moment
- what_changed
- why_now
- time_horizon
- decision_scope
- current_reality
- key_constraints
- key_contradictions
- competitive_position
- analyst_positioning
- strategic_options_considered
- rejected_options
- recommended_direction
- rationale_for_choice
- strategic_trade_offs
- what_must_be_true
- target_customer
- primary_economic_buyer
- primary_mobiliser
- secondary_stakeholders
- market_position
- value_proposition
- competitive_frame
- narrative_gap
- wedge
- source_of_defensibility
- strategic_bets
- anti_portfolio
- what_is_committed_now
- what_is_deferred
- first_100_days
- success_measures
- governance
- risks
- kill_criteria
- resource_and_investment_implications
- team_and_capability_implications
- value_creation_implications
- market_perception_evidence
- confidence_waterfall
- open_questions
- evidence_gaps
- hypothesis_register

Resolver rules:
1. De-duplicate aggressively
2. Resolve contradictions where possible
3. Flag unresolved contradictions under open_questions and evidence_gaps
4. Remove stale logic from rejected paths
5. Keep geography logic consistent
6. Keep buyer logic consistent
7. Keep only one surviving chosen strategy
8. Preserve uncertainty honestly
9. Do not overclaim unsupported capabilities
10. Keep commitments only where Commit supports them

Return only the synthesis object in structured Markdown using headings and bullets.
Do not write prose sections.`;

const EXEC_SUMMARY_PROMPT = `You are the Executive Summary Agent for Inflexion's Final Synthesis Report.

Input: canonical synthesis object from the Resolver Agent.

Write only:
## Executive Summary

Rules:
- State the recommended direction in the first paragraph
- Include the cascade confidence score
- No more than 5 short paragraphs
- High signal only — no stage language, no jargon
- Board-ready tone: direct, no hedging

Return only the section header and content.`;

const STRATEGIC_CONTEXT_PROMPT = `You are the Strategic Context Agent for Inflexion's Final Synthesis Report.

Input: canonical synthesis object from the Resolver Agent.

Write only:
## The Strategic Moment
## Current Reality
## Competitive Landscape

Rules:
- Strategic Moment: what changed, why now, the time horizon, scope of the decision — updated with any context from later stages
- Current Reality: the 3–5 facts that dominate the picture — constraints, contradictions, binding conditions — distilled to essentials
- Competitive Landscape: where the business sits relative to competitors, how the landscape shapes the decision, what the dynamics mean for strategy (this is separate from Market Position in section 9)
- Use only the strongest evidence-backed points
- Avoid repeating facts across sections
- No stage language

Return only the three section headers and their content.`;

const STRATEGIC_CHOICE_PROMPT = `You are the Strategic Choice Agent for Inflexion's Final Synthesis Report.

Input: canonical synthesis object from the Resolver Agent.

Write only:
## Strategic Options Considered
## Recommended Direction
## Strategic Trade-offs
## What Must Be True

Rules:
- Strategic Options Considered: all options including status quo, with decision matrix (weighted scoring) showing why each was or was not chosen
- Recommended Direction: one explicit direction with full rationale
- Strategic Trade-offs: what is NOT being pursued and why — placed immediately after the recommendation so the commitment is unambiguous
- What Must Be True: consolidated testable assumptions from all five stages, deduplicated, priority-ranked, each with: assumption, source stage, validation status, test method
- No execution plans, no owners, no deadlines in Options or Direction sections
- No stage language

Return only the four section headers and their content.`;

const MARKET_STRATEGY_PROMPT = `You are the Market Strategy Agent for Inflexion's Final Synthesis Report.

Input: canonical synthesis object from the Resolver Agent.

Write only:
## Market Position
## Competitive Advantage
## Market Perception Evidence

Rules:
- Market Position: target customer, primary economic buyer, buying trigger, value proposition, competitive frame — how the company will be understood in market
- Competitive Advantage: the initial wedge, what is real today vs. what must be built, how the position compounds over time. Be explicit about what is NOT a moat.
- Market Perception Evidence: consolidated third-party evidence from reviewers, analysts, and comparison sites — shows positioning is evidence-aligned, not aspirational. Source: G2, TrustRadius, Gartner Peer Insights, comparison articles.
- One clear position, one clear buyer model
- No inflated moat claims
- Distinguish what is real today from what must be built
- No execution planning, no stage language

Return only the three section headers and their content.`;

const COMMITMENT_PROMPT = `You are the Commitment Agent for Inflexion's Final Synthesis Report.

Input: canonical synthesis object from the Resolver Agent.

Write only:
## Strategic Bets
## First 100 Days & Success Measures
## Governance, Risks & Kill Criteria
## Resource & Investment Implications
## Exit or Value-Creation Implications

Rules:
- Strategic Bets: 3–5 named bets with per-bet confidence scores, dependencies noted, minimum viable tests, anti-portfolio (what is explicitly not being bet on and why)
- First 100 Days: milestones at 30/60/90 days with owners, gate criteria, deliverables, and kill criterion triggers per milestone
- Governance: review cadence (weekly/monthly/quarterly), consolidated risk register (all stages, deduplicated, severity + mitigation + owner), pre-agreed kill triggers
- Resource & Investment: what gets funded, paused, protected, reallocated; horizon allocation with workstream assignments; explicit product trade-offs
- Exit or Value-Creation Implications: financial scenario modelling direction (pipeline impact → ARR impact), how this strategy affects revenue multiples, exit comparables, strategic acquirer interest, growth quality metrics
- 3–5 strategic bets maximum
- First 100 days must be concrete and owned
- Kill criteria must be explicit with threshold and response
- No stage language

Return only the five section headers and their content.`;

const APPENDIX_PROMPT = `You are the Appendix Agent for Inflexion's Final Synthesis Report.

Input: canonical synthesis object from the Resolver Agent.

Write only:
## Appendix A: Confidence Waterfall
## Appendix B: Evidence Gap Register
## Appendix C: Hypothesis Register
## Appendix D: Sources

Rules:
- Confidence Waterfall: overall score decomposed by stage (Frame → Diagnose → Decide → Position → Commit), where analysis is strongest and weakest, what each gap costs in confidence
- Evidence Gap Register: what was needed, what was confirmed (source + stage), what remains unvalidated, confidence cost of each gap
- Hypothesis Register: every hypothesis from Frame through Commit — hypothesis text, source (user input / web research / inferred), stage introduced, status (confirmed / refuted / partially validated / unvalidated), evidence if validated/refuted
- Sources: complete URL list across all stages, deduplicated, each with source URL, what it confirmed, which stage cited it
- Keep tight — only items material to decision quality
- No repetition from the main body

Return only the four appendix headers and their content.`;

const FINAL_EDITOR_PROMPT = `You are the Final Editor / Assembler Agent for Inflexion's Final Synthesis Report.

You receive six section groups. Assemble them into one final Markdown strategy document.

Required final structure:

# Product Strategy
**Company:** [Company Name]
**Date:** [Date]
**Produced by:** Inflexion by Nth Layer
**Cascade Confidence:** [X]%

## Executive Summary
## The Strategic Moment
## Current Reality
## Competitive Landscape
## Strategic Options Considered
## Recommended Direction
## Strategic Trade-offs
## What Must Be True
## Market Position
## Competitive Advantage
## Market Perception Evidence
## Strategic Bets
## First 100 Days & Success Measures
## Governance, Risks & Kill Criteria
## Resource & Investment Implications
## Exit or Value-Creation Implications
## Appendix A: Confidence Waterfall
## Appendix B: Evidence Gap Register
## Appendix C: Hypothesis Register
## Appendix D: Sources

Assembler rules:
1. Open with a 2–3 sentence Methodology Preamble before the Executive Summary: "This strategy was developed through a five-stage analytical cascade (Frame, Diagnose, Decide, Position, Commit), each producing independent analysis with explicit confidence scoring and evidence citation. The recommendations below synthesise findings across all five stages."
2. Make the document read as one authored narrative
3. Remove repetition
4. Keep recommendation clear early
5. Keep buyer logic consistent
6. Keep writing tight — no stage language, no consulting clichés

Formatting: valid Markdown only. No HTML, no code fences, no stage labels.

Final QA — if any answer is no, revise:
1. Does it read like one authored strategy?
2. Is the recommendation clear early?
3. Is repetition removed?
4. Is buyer logic consistent?
5. Does Strategic Trade-offs appear immediately after Recommended Direction?
6. Is the output in the exact required format?

Return only the final Markdown document.`;

// ─── Managed Agent IDs (optional — falls back to direct messages if not set) ──

const DOCUMENT_AGENT_IDS: Record<string, string | undefined> = {
  resolver:          process.env.STRATEGY_DOC_RESOLVER_AGENT_ID,
  exec_summary:      process.env.STRATEGY_DOC_EXEC_SUMMARY_AGENT_ID,
  strategic_context: process.env.STRATEGY_DOC_STRATEGIC_CONTEXT_AGENT_ID,
  strategic_choice:  process.env.STRATEGY_DOC_STRATEGIC_CHOICE_AGENT_ID,
  market_strategy:   process.env.STRATEGY_DOC_MARKET_STRATEGY_AGENT_ID,
  commitment:        process.env.STRATEGY_DOC_COMMITMENT_AGENT_ID,
  appendix:          process.env.STRATEGY_DOC_APPENDIX_AGENT_ID,
  final_editor:      process.env.STRATEGY_DOC_FINAL_EDITOR_AGENT_ID,
};

const DOCUMENT_ENVIRONMENT_ID = process.env.STRATEGY_ENVIRONMENT_ID ?? "env_01BG6FT972a92oDBJcBMwt2y";

// ─── Helper: run one agent call and return text ──────────────────────────────

async function runAgent(agentKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const agentId = DOCUMENT_AGENT_IDS[agentKey];

  // Use managed agent via sessions API if agent ID is configured
  if (agentId && DOCUMENT_ENVIRONMENT_ID) {
    const agentClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
    });

    const session = await agentClient.beta.sessions.create({
      agent: agentId,
      environment_id: DOCUMENT_ENVIRONMENT_ID,
      title: `Document ${agentKey}`,
    });

    await agentClient.beta.sessions.events.send(session.id, {
      events: [{ type: "user.message", content: [{ type: "text", text: userMessage }] }],
    });

    // Poll for completion
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const eventsPage = await agentClient.beta.sessions.events.list(session.id, { limit: 100 });
      const events = (eventsPage as { data?: unknown[] }).data ?? [];

      // Look for agent text response
      const textEvent = events.find(
        (e) => (e as Record<string, unknown>).type === "agent.text"
      );
      if (textEvent) {
        await agentClient.beta.sessions.archive(session.id).catch(() => {});
        return ((textEvent as Record<string, unknown>).text as string) ?? "";
      }

      const session_ = await agentClient.beta.sessions.retrieve(session.id);
      if (session_.status === "terminated") break;
    }

    await agentClient.beta.sessions.archive(agentId).catch(() => {});
    return "";
  }

  // Fallback: direct messages.create()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

// ─── Helper: format stage output as readable text ────────────────────────────

function formatStageOutput(stageName: string, sections: Record<string, unknown>): string {
  const lines = [`## ${stageName} Stage Output\n`];
  for (const [key, value] of Object.entries(sections)) {
    if (value === null || value === undefined) continue;
    lines.push(`### ${key}`);
    if (typeof value === "string") {
      lines.push(value);
    } else {
      lines.push(JSON.stringify(value, null, 2));
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ─── SSE helper ──────────────────────────────────────────────────────────────

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { companyId } = (await req.json()) as { companyId: string };
  if (!companyId) {
    return new Response("companyId required", { status: 400 });
  }

  // Auth checks
  const [hasAccess, entitlements] = await Promise.all([
    canAccessCompany(user.id, companyId),
    getUserEntitlements(user.id),
  ]);
  if (!hasAccess) return new Response("Forbidden", { status: 403 });
  if (!entitlements.access_export) {
    return new Response(JSON.stringify({ error: "upgrade_required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch the 5 stage outputs
  const stageOutputs = await db.output.findMany({
    where: {
      companyId,
      workflowType: { in: ["frame", "diagnose", "decide", "position", "commit"] },
    },
    select: { workflowType: true, sections: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Deduplicate — keep most recent per stage
  const stageMap: Record<string, Record<string, unknown>> = {};
  for (const o of stageOutputs) {
    if (!stageMap[o.workflowType]) {
      stageMap[o.workflowType] = o.sections as Record<string, unknown>;
    }
  }

  const missingStages = ["frame", "diagnose", "decide", "position", "commit"].filter(
    (s) => !stageMap[s]
  );
  if (missingStages.length > 0) {
    return new Response(
      JSON.stringify({ error: "incomplete_stages", missing: missingStages }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // SSE streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: Record<string, unknown> = {}) => {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      };

      try {
        // ── Step 1: Resolver ───────────────────────────────────────────────
        send("progress", { step: "resolver", message: "Resolving stage outputs into synthesis object..." });

        const stageText = [
          formatStageOutput("Frame", stageMap.frame),
          formatStageOutput("Diagnose", stageMap.diagnose),
          formatStageOutput("Decide", stageMap.decide),
          formatStageOutput("Position", stageMap.position),
          formatStageOutput("Commit", stageMap.commit),
        ].join("\n\n---\n\n");

        const synthesis = await runAgent(
          "resolver",
          RESOLVER_PROMPT,
          `Here are the five stage outputs:\n\n${stageText}\n\nProduce the canonical synthesis object.`
        );

        send("progress", { step: "resolver_done", message: "Synthesis object ready. Writing sections..." });

        // ── Step 2: Parallel section writers ──────────────────────────────
        send("progress", { step: "sections", message: "Writing 6 sections in parallel..." });

        const sectionPrompt = `Here is the canonical synthesis object:\n\n${synthesis}\n\nWrite your assigned sections now.`;

        const [
          execSummary,
          strategicContext,
          strategicChoice,
          marketStrategy,
          commitment,
          appendix,
        ] = await Promise.all([
          runAgent("exec_summary", EXEC_SUMMARY_PROMPT, sectionPrompt),
          runAgent("strategic_context", STRATEGIC_CONTEXT_PROMPT, sectionPrompt),
          runAgent("strategic_choice", STRATEGIC_CHOICE_PROMPT, sectionPrompt),
          runAgent("market_strategy", MARKET_STRATEGY_PROMPT, sectionPrompt),
          runAgent("commitment", COMMITMENT_PROMPT, sectionPrompt),
          runAgent("appendix", APPENDIX_PROMPT, sectionPrompt),
        ]);

        send("progress", { step: "sections_done", message: "All sections written. Assembling final document..." });

        // ── Step 3: Final Editor ───────────────────────────────────────────
        const assemblyInput = [
          "SECTION GROUP 1 — Executive Summary:",
          execSummary,
          "\n---\nSECTION GROUP 2 — Strategic Context:",
          strategicContext,
          "\n---\nSECTION GROUP 3 — Strategic Choice:",
          strategicChoice,
          "\n---\nSECTION GROUP 4 — Market Strategy:",
          marketStrategy,
          "\n---\nSECTION GROUP 5 — Commitment:",
          commitment,
          "\n---\nSECTION GROUP 6 — Appendix:",
          appendix,
        ].join("\n\n");

        const finalDocument = await runAgent(
          "final_editor",
          FINAL_EDITOR_PROMPT,
          `Assemble these six section groups into the final strategy document:\n\n${assemblyInput}`
        );

        // ── Done ───────────────────────────────────────────────────────────
        send("complete", { document: finalDocument });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
