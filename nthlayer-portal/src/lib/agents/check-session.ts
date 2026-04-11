import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import type { OutputSections } from "@/lib/types/output";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultHeaders: { "anthropic-beta": "agents-2025-05-01" },
});

// Maps workflowType → output metadata
const WORKFLOW_OUTPUT_META: Record<string, { outputType: string; titlePrefix: string }> = {
  diagnose: { outputType: "strategic_diagnosis", titlePrefix: "Strategic Diagnosis" },
  decide: { outputType: "strategic_choices", titlePrefix: "Decide" },
  position: { outputType: "positioning_analysis", titlePrefix: "Position" },
  act: { outputType: "ninety_day_plan", titlePrefix: "Act" },
};

/**
 * Check a running agent session once and advance it.
 * Called on each client poll (~every 3s). Fast: ~1s per call.
 */
export async function checkAgentSession(jobId: string): Promise<void> {
  // Load job with metadata (contains sessionId, approvedIds)
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      companyId: true,
      workflowType: true,
      status: true,
      progress: true,
      metadata: true,
    },
  });
  if (!job) return;

  // Only process running or pending jobs that have a sessionId
  const meta = (job.metadata ?? {}) as Record<string, unknown>;
  const sessionId = meta.sessionId as string | undefined;
  if (!sessionId) return;

  // Load company name
  const company = await db.company.findUnique({
    where: { id: job.companyId },
    select: { name: true },
  });
  const companyName = company?.name ?? "Unknown Company";

  const workflowMeta = WORKFLOW_OUTPUT_META[job.workflowType] ?? {
    outputType: "strategic_diagnosis",
    titlePrefix: job.workflowType,
  };

  try {
    // Fetch session status and ALL events (paginate to handle >100 events)
    const session = await client.beta.sessions.retrieve(sessionId);

    const eventsPage = await client.beta.sessions.events.list(sessionId, {
      limit: 1000,
    });
    const events = eventsPage.data ?? [];

    // ── Check for custom tool use (agent done) ──
    const toolEvent = events.find(
      (e) => (e as unknown as Record<string, unknown>).type === "agent.custom_tool_use"
    );

    if (toolEvent) {
      const te = toolEvent as unknown as Record<string, unknown>;
      const rawSections = (te.input ?? {}) as Record<string, unknown>;

      const sections: OutputSections = {
        executive_summary: String(rawSections.executive_summary ?? ""),
        what_matters: String(rawSections.what_matters ?? ""),
        recommendation: String(rawSections.recommendation ?? ""),
        business_implications: String(rawSections.business_implications ?? ""),
        evidence_base: (rawSections.evidence_base ?? { sources: [], quotes: [] }) as OutputSections["evidence_base"],
        assumptions: (rawSections.assumptions ?? []) as string[],
        confidence: (rawSections.confidence ?? { score: 0.6, rationale: "" }) as OutputSections["confidence"],
        risks: (rawSections.risks ?? []) as OutputSections["risks"],
        actions: (rawSections.actions ?? []) as OutputSections["actions"],
        monitoring: (rawSections.monitoring ?? []) as OutputSections["monitoring"],
      };

      const confidenceScore =
        typeof sections.confidence === "object" && sections.confidence !== null
          ? (sections.confidence as { score: number }).score
          : 0.65;

      const output = await db.output.create({
        data: {
          companyId: job.companyId,
          workflowType: job.workflowType,
          outputType: workflowMeta.outputType,
          title: `${workflowMeta.titlePrefix} — ${companyName}`,
          sections: sections as object,
          confidence: confidenceScore,
          sources: ((sections.evidence_base as { sources?: string[] })?.sources) ?? [],
        },
      });

      await db.job.update({
        where: { id: jobId },
        data: { status: "completed", progress: 100, outputId: output.id, completedAt: new Date() },
      });
      await db.jobEvent.create({
        data: { jobId, event: "completed", metadata: { outputId: output.id, sessionId } },
      });

      // Archive session to keep Console tidy
      await client.beta.sessions.archive(sessionId).catch(() => {});
      return;
    }

    // ── If session terminated and no custom tool — mark failed ──
    if (session.status === "terminated") {
      await db.job.update({
        where: { id: jobId },
        data: { status: "failed", errorMessage: "Agent session terminated without producing output" },
      });
      await db.jobEvent.create({
        data: { jobId, event: "failed", metadata: { error: "session_terminated", sessionId } },
      });
      return;
    }

    // ── Progress updates based on event types ──
    const hasThinking = events.some((e) => {
      const t = (e as unknown as Record<string, unknown>).type as string;
      return t === "agent.thinking" || t === "agent.text";
    });
    const hasMcpResult = events.some(
      (e) => (e as unknown as Record<string, unknown>).type === "agent.mcp_tool_result"
    );

    if (hasThinking && (job.progress ?? 0) < 40) {
      await db.job.update({ where: { id: jobId }, data: { progress: 40 } }).catch(() => {});
    }
    if (hasMcpResult && (job.progress ?? 0) < 70) {
      await db.job.update({ where: { id: jobId }, data: { progress: 70 } }).catch(() => {});
    }

    // ── Check if idle with requires_action (MCP tools need approval) ──
    if (session.status === "idle") {
      const lastIdleEvent = [...events].reverse().find(
        (e) => (e as unknown as Record<string, unknown>).type === "session.status_idle"
      );
      const stopReason = lastIdleEvent
        ? ((lastIdleEvent as unknown as Record<string, unknown>).stop_reason as Record<string, unknown> | undefined)
        : undefined;

      if (stopReason?.type === "requires_action") {
        const approvedIds = Array.isArray(meta.approvedIds) ? (meta.approvedIds as string[]) : [];
        const approvedSet = new Set<string>(approvedIds);
        const pendingIds = ((stopReason.event_ids as string[]) ?? []).filter((id) => !approvedSet.has(id));

        if (pendingIds.length > 0) {
          await client.beta.sessions.events.send(sessionId, {
            events: pendingIds.map((id) => ({
              type: "user.tool_confirmation" as const,
              tool_use_id: id,
              result: "allow" as const,
            })),
          }).catch(() => {});

          const newApprovedIds = [...approvedIds, ...pendingIds];
          await db.job.update({
            where: { id: jobId },
            data: {
              progress: Math.max(job.progress ?? 0, 60),
              metadata: { ...meta, approvedIds: newApprovedIds },
            },
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Non-fatal — just log, don't fail the job (next poll will retry)
    console.error(`[checkAgentSession] Error checking session for job ${jobId}:`, err);
  }
}
