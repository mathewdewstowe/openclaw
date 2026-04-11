import { db } from "./db";
import type { WorkflowType, OutputSections } from "./types/output";
import { WORKFLOW_META } from "./types/output";
import { startDiagnoseSession } from "./agents/diagnose";
import { startDecideSession } from "./agents/decide";
import { startPositionSession } from "./agents/position";
import { startActSession } from "./agents/act";

/**
 * Agent runner. Routes to the real Claude agent for supported workflows,
 * falls back to mock output for others (to be replaced incrementally).
 */
export async function runAgent(jobId: string): Promise<void> {
  // Route to real agents for supported workflows
  const job = await db.job.findUnique({ where: { id: jobId }, select: { workflowType: true } });
  if (!job) return;

  if (job.workflowType === "diagnose") return startDiagnoseSession(jobId);
  if (job.workflowType === "decide") return startDecideSession(jobId);
  if (job.workflowType === "position") return startPositionSession(jobId);
  if (job.workflowType === "act") return startActSession(jobId);

  // ── Mock fallback for other workflows ──────────────────────
  const fullJob = await db.job.findUnique({
    where: { id: jobId },
    include: { company: { select: { name: true, url: true, sector: true } } },
  });
  if (!fullJob) return;

  // Mark running
  await db.job.update({ where: { id: jobId }, data: { status: "running", startedAt: new Date() } });
  await db.jobEvent.create({ data: { jobId, event: "started", metadata: { workflowType: fullJob.workflowType } } });

  try {
    // Simulate progress
    for (let progress = 20; progress <= 80; progress += 20) {
      await sleep(1500);
      await db.job.update({ where: { id: jobId }, data: { progress } });
      await db.jobEvent.create({ data: { jobId, event: `progress_${progress}` } });
    }

    // Generate mock output
    const sections = generateMockOutput(fullJob.workflowType as WorkflowType, fullJob.company.name);
    const meta = WORKFLOW_META[fullJob.workflowType as WorkflowType];
    const outputType = meta?.outputTypes[0] ?? "strategic_diagnosis";

    const output = await db.output.create({
      data: {
        companyId: fullJob.companyId,
        workflowType: fullJob.workflowType,
        outputType,
        title: `${meta?.label ?? fullJob.workflowType} — ${fullJob.company.name}`,
        sections: sections as object,
        confidence: 0.72,
        sources: ["Public market data", "Competitive analysis", "Industry reports"],
      },
    });

    // Complete
    await db.job.update({
      where: { id: jobId },
      data: {
        status: "completed",
        progress: 100,
        outputId: output.id,
        completedAt: new Date(),
      },
    });
    await db.jobEvent.create({ data: { jobId, event: "completed", metadata: { outputId: output.id } } });

  } catch (err) {
    await db.job.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: String(err) },
    });
    await db.jobEvent.create({ data: { jobId, event: "failed", metadata: { error: String(err) } } });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Mock output generator ──────────────────────────────────

function generateMockOutput(workflowType: WorkflowType, companyName: string): OutputSections {
  const base: OutputSections = {
    executive_summary: `This ${workflowType} analysis for ${companyName} identifies key strategic opportunities and risks based on available market signals. The company operates in a competitive landscape with significant room for differentiation through focused execution on core value propositions.`,

    what_matters: `Three factors dominate the strategic picture for ${companyName}:\n\n1. Market timing — the window for category leadership is narrowing as competitors consolidate\n2. Product-market fit signals suggest strong resonance with mid-market buyers but weak enterprise traction\n3. The current GTM motion has diminishing returns at the current ARR band`,

    recommendation: `${companyName} should prioritise deepening product differentiation in its strongest segment rather than expanding horizontally. The evidence suggests that focused execution will compound faster than breadth at this stage. Specifically: double down on the mid-market ICP, build defensible integrations, and defer enterprise motions until the core platform is category-defining.`,

    business_implications: `This strategic direction has three primary implications:\n\n1. Revenue: Short-term growth rate may moderate (15-20% vs 25-30%) but with higher quality, more defensible revenue\n2. Product: Engineering investment shifts from feature breadth to depth and reliability\n3. Team: GTM team needs reorientation from outbound volume to consultative mid-market sales`,

    evidence_base: {
      sources: [
        "G2 competitive landscape data (Q1 2026)",
        "Industry analyst reports — Gartner, Forrester",
        "Public financial filings of comparable companies",
        "Customer review sentiment analysis (200+ reviews)",
        "Job posting analysis of key competitors",
      ],
      quotes: [
        "Mid-market buyers cite integration depth as their primary selection criterion, ahead of price.",
        "Three of five major competitors have announced enterprise-focused pivots, leaving the mid-market underserved.",
      ],
    },

    assumptions: [
      "Current market conditions persist for the next 12-18 months",
      "No major regulatory changes affect the competitive landscape",
      "The company maintains its current engineering velocity",
      "Mid-market buying behavior continues to favour specialist solutions over platforms",
    ],

    confidence: {
      score: 0.72,
      rationale: "Confidence is moderate-high. Market signals are consistent and well-evidenced, but the analysis is based on public signals only. Internal data (pipeline, churn cohorts, NPS by segment) would significantly increase confidence.",
    },

    risks: [
      { risk: "Competitor acquires a key integration partner", severity: "high" as const, mitigation: "Build redundant integration paths and invest in proprietary data connectors" },
      { risk: "Mid-market segment contracts due to macro conditions", severity: "medium" as const, mitigation: "Maintain optionality to move up-market with a lightweight enterprise SKU" },
      { risk: "Key technical talent leaves during strategic pivot", severity: "medium" as const, mitigation: "Align incentive structures with 18-month strategic milestones" },
    ],

    actions: [
      { action: "Commission deep-dive customer research on mid-market ICP", owner: "Product", deadline: "30 days", priority: "critical" as const },
      { action: "Audit integration roadmap against mid-market requirements", owner: "Engineering", deadline: "45 days", priority: "high" as const },
      { action: "Restructure GTM metrics around mid-market conversion", owner: "Revenue", deadline: "60 days", priority: "high" as const },
      { action: "Draft competitive positioning document for sales enablement", owner: "Marketing", deadline: "30 days", priority: "medium" as const },
    ],

    monitoring: [
      { metric: "Mid-market win rate", target: ">40%", frequency: "Monthly" },
      { metric: "Integration adoption rate", target: ">60% of active accounts", frequency: "Monthly" },
      { metric: "Net revenue retention (mid-market)", target: ">110%", frequency: "Quarterly" },
      { metric: "Competitive displacement rate", target: "<5% of renewals", frequency: "Quarterly" },
    ],
  };

  return base;
}
