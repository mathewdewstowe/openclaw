import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStrategySession, advanceTransformationSession, TRANSFORMATION_STAGE_IDS, type TransformationJobState, type CompanyContext } from "@/lib/agents/strategy-sessions";
import { getUserCompanies } from "@/lib/entitlements";
import { sendReportCompleteNotification } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const jobId = searchParams.get("jobId");

  // ── Transformation multi-agent polling (by jobId) ──
  if (jobId) {
    return handleTransformationStatus(req, jobId);
  }

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId or jobId" }, { status: 400 });
  }

  const result = await checkStrategySession(sessionId);

  // When complete, persist the output and mark the job done
  if (result.status === "complete" && result.sections) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.warn("[status] No user found — skipping DB persist");
        return NextResponse.json(result);
      }

      // Find the job by sessionId in metadata (any status, so we don't miss it)
      const allJobs = await db.job.findMany({
        where: { userId: user.id },
        select: { id: true, companyId: true, workflowType: true, status: true, outputId: true, metadata: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      const job = allJobs.find(
        (j) => (j.metadata as Record<string, unknown> | null)?.sessionId === sessionId
      );

      // If the job already has an outputId, it was already persisted — skip
      if (job?.outputId) {
        return NextResponse.json(result);
      }

      // Determine companyId: from job if it exists, or from user's first company
      let companyId = job?.companyId;
      let workflowType = job?.workflowType ?? "frame";
      if (!companyId) {
        const companies = await getUserCompanies(user.id);
        companyId = companies[0]?.company?.id;
      }

      if (!companyId) {
        console.warn("[status] No companyId found — cannot persist output");
        return NextResponse.json(result);
      }

      const sections = result.sections as Record<string, unknown>;
      const confidence =
        typeof sections.confidence === "object" &&
        sections.confidence !== null &&
        "score" in sections.confidence
          ? Number((sections.confidence as { score: number }).score)
          : null;

      // Stage-specific tags reflecting what each agent actually generates
      const STAGE_TAGS: Record<string, string[]> = {
        frame:    ["Strategic Problem", "Market Context", "Winning Conditions", "Decision Boundaries", "Core Strategic Question"],
        diagnose: ["Business Assessment", "Product-Market Fit", "Competitive Landscape", "Emerging Direction", "Benchmark Gaps"],
        decide:   ["Strategic Options", "Recommended Direction", "What Must Be True", "Kill Criteria"],
        position: ["Target Customer", "Positioning Statement", "Competitive Advantage", "Structural Defensibility"],
        commit:   ["Strategic Bets", "OKRs", "100-Day Plan", "Governance Rhythm", "Resource Allocation"],
        why_now:        ["Urgency Signals", "Competitive Triggers", "Cost of Inaction", "Sector Benchmarks"],
        current_state:  ["Process Maturity", "AI Tooling", "Stack Readiness", "Exposure Map"],
        future_moves:   ["Automation Opportunities", "Build/Buy/Partner", "Move Portfolio"],
        mobilise:       ["Leadership Alignment", "Sponsor Conviction", "Resistance Map"],
        embed:          ["Success Criteria", "Measurement Framework", "Board Proof Points"],
      };
      const tags = STAGE_TAGS[workflowType] ?? [];

      const output = await db.output.create({
        data: {
          companyId,
          workflowType,
          outputType: `${workflowType}_report`,
          title: `${workflowType.charAt(0).toUpperCase() + workflowType.slice(1)} Report`,
          sections: sections as object,
          confidence,
          sources: [],
          tags,
          version: 1,
        },
      });

      // Persist strategic bets to DB when Commit stage completes
      if (workflowType === "commit" && Array.isArray(sections.strategic_bets)) {
        const bets = sections.strategic_bets as Array<{
          // New Inflexion format
          "Bet name"?: string; "Type"?: string; "Hypothesis"?: string; "Minimum viable test"?: string;
          // Legacy format
          bet?: string; action?: string; outcome?: string; hypothesis?: string; type?: string; investment?: string;
        }>;
        try {
          await db.strategicBet.createMany({
            data: bets.map((b, idx) => ({
              companyId,
              outputId: output.id,
              betIndex: idx,
              name: b["Bet name"] ?? b.bet ?? `Bet ${idx + 1}`,
              action: b["Minimum viable test"] ?? b.action ?? b.investment ?? "",
              outcome: b.outcome ?? "",
              hypothesis: b["Hypothesis"] ?? b.hypothesis ?? "",
              betType: b["Type"] ?? b.type ?? "Strategic",
            })),
            skipDuplicates: true,
          });
        } catch (betErr) {
          console.error("[status] Failed to persist strategic bets:", betErr);
        }
      }

      // Extract item counts for the email
      const itemCounts = {
        actions: Array.isArray(sections.actions) ? (sections.actions as unknown[]).length : 0,
        risks: Array.isArray(sections.risks) ? (sections.risks as unknown[]).length : 0,
        assumptions: Array.isArray(sections.assumptions) ? (sections.assumptions as unknown[]).length : 0,
        metrics: Array.isArray(sections.monitoring) ? (sections.monitoring as unknown[]).length : 0,
      };

      // Send report-complete notification to user (BCC admin)
      const company = await db.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }).catch(() => null);
      sendReportCompleteNotification({
        userName: user.name ?? user.email,
        userEmail: user.email,
        companyName: company?.name ?? "your company",
        workflowType,
        counts: itemCounts,
      });

      if (job) {
        await db.job.update({
          where: { id: job.id },
          data: {
            status: "completed",
            outputId: output.id,
            completedAt: new Date(),
            progress: 100,
          },
        });
      } else {
        // No job record existed — create a completed one so the strategy page can find it
        await db.job.create({
          data: {
            companyId,
            userId: user.id,
            workflowType,
            status: "completed",
            outputId: output.id,
            completedAt: new Date(),
            progress: 100,
            metadata: { sessionId },
          },
        });
      }

      // ── Items 9 & 10: Background contradiction detection + stale flagging ──
      // Fire-and-forget — does not block the response
      const outputId = output.id;
      const capturedSections = sections;
      const capturedWorkflowType = workflowType;
      const capturedCompanyId = companyId;

      (async () => {
        try {
          const STAGE_ORDER = TRANSFORMATION_STAGE_IDS.includes(capturedWorkflowType)
            ? ["why_now", "current_state", "future_moves", "mobilise", "embed"]
            : ["frame", "diagnose", "decide", "position", "commit"];
          const currentIdx = STAGE_ORDER.indexOf(capturedWorkflowType);
          if (currentIdx <= 0) return; // Frame has no prior stages

          // Fetch most-recent prior stage outputs
          const priorOutputs = await db.output.findMany({
            where: {
              companyId: capturedCompanyId,
              workflowType: { in: STAGE_ORDER.slice(0, currentIdx) },
            },
            select: { id: true, workflowType: true, sections: true },
            orderBy: { createdAt: "desc" },
          });

          const seen = new Set<string>();
          const priorByStage: Record<string, { id: string; sections: Record<string, unknown> }> = {};
          for (const o of priorOutputs) {
            if (!seen.has(o.workflowType)) {
              seen.add(o.workflowType);
              priorByStage[o.workflowType] = {
                id: o.id,
                sections: o.sections as Record<string, unknown>,
              };
            }
          }
          if (Object.keys(priorByStage).length === 0) return;

          // Summarise the new output for comparison
          const newSummary = [
            capturedSections.executive_summary ? `Executive Summary: ${String(capturedSections.executive_summary).slice(0, 400)}` : "",
            Array.isArray(capturedSections.assumptions)
              ? `Assumptions: ${(capturedSections.assumptions as (string | Record<string, unknown>)[]).slice(0, 5).map((a) => typeof a === "string" ? a : (a.text as string) ?? "").join("; ")}`
              : "",
            capturedSections.recommendation ? `Recommendation: ${String(capturedSections.recommendation).slice(0, 400)}` : "",
          ].filter(Boolean).join("\n");

          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

          const contradictionResults: Record<string, string[]> = {};

          for (const [stageId, prior] of Object.entries(priorByStage)) {
            const s = prior.sections;
            const priorSummary = [
              s.executive_summary ? `${stageId} summary: ${String(s.executive_summary).slice(0, 400)}` : "",
              Array.isArray(s.assumptions)
                ? `${stageId} assumptions: ${(s.assumptions as (string | Record<string, unknown>)[]).slice(0, 3).map((a) => typeof a === "string" ? a : (a.text as string) ?? "").join("; ")}`
                : "",
              s.recommendation ? `${stageId} recommendation: ${String(s.recommendation).slice(0, 300)}` : "",
            ].filter(Boolean).join("\n");

            const response = await aiClient.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 400,
              messages: [{
                role: "user",
                content: `Do these two strategic stage outputs directly contradict each other on facts, direction, or key assumptions? Only flag genuine contradictions — not differences in emphasis or detail. Max 3 short strings, or [] if none.

Prior stage (${stageId}): ${priorSummary}

New stage (${capturedWorkflowType}): ${newSummary}

Return raw JSON array of short strings only.`,
              }],
            });

            const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
            try {
              const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
              const found = JSON.parse(clean);
              if (Array.isArray(found) && found.length > 0) {
                contradictionResults[stageId] = found as string[];
              }
            } catch { /* ignore parse errors */ }
          }

          // Item 9: Store contradictions found in the new output's sections
          if (Object.keys(contradictionResults).length > 0) {
            await db.output.update({
              where: { id: outputId },
              data: {
                sections: { ...capturedSections, _contradictions: contradictionResults } as object,
              },
            });
          }

          // Item 10: Flag prior outputs as stale where contradictions were found
          for (const [stageId, reasons] of Object.entries(contradictionResults)) {
            const prior = priorByStage[stageId];
            if (prior) {
              await db.output.update({
                where: { id: prior.id },
                data: {
                  sections: {
                    ...prior.sections,
                    _stale: true,
                    _staledBy: capturedWorkflowType,
                    _staleReasons: reasons,
                  } as object,
                },
              });
            }
          }
        } catch (err) {
          console.error("[status] Background contradiction check failed:", err);
        }
      })();

    } catch (err) {
      console.error("[status] Failed to persist output:", err);
    }
  }

  return NextResponse.json(result);
}

// ── Transformation multi-agent status handler ──

const TRANSFORMATION_STAGE_TAGS: Record<string, string[]> = {
  why_now:        ["Urgency Signals", "Competitive Triggers", "Cost of Inaction", "Sector Benchmarks"],
  current_state:  ["Process Maturity", "AI Tooling", "Stack Readiness", "Exposure Map"],
  future_moves:   ["Automation Opportunities", "Build/Buy/Partner", "Move Portfolio"],
  mobilise:       ["Leadership Alignment", "Sponsor Conviction", "Resistance Map"],
  embed:          ["Success Criteria", "Measurement Framework", "Board Proof Points"],
};

const STAGE_NAMES: Record<string, string> = {
  why_now: "Why Now", current_state: "Current State", future_moves: "Future Moves", mobilise: "Mobilise", embed: "Embed",
};

async function handleTransformationStatus(req: NextRequest, jobId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: { id: true, companyId: true, userId: true, workflowType: true, status: true, outputId: true, metadata: true },
    });

    if (!job || job.userId !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Already completed — return saved sections from the Output record
    if (job.status === "completed" && job.outputId) {
      const output = await db.output.findUnique({
        where: { id: job.outputId },
        select: { sections: true },
      });
      return NextResponse.json({ status: "complete", jobId, sections: output?.sections ?? {} });
    }

    const metadata = job.metadata as Record<string, unknown> | null;
    const transformationState = metadata?.transformationState as TransformationJobState | undefined;
    if (!transformationState) {
      return NextResponse.json({ error: "Invalid job state" }, { status: 400 });
    }

    const storedAnswers = (metadata?.answers ?? {}) as Record<string, string | string[] | { selection: string; freetext: string }>;
    const storedQuestions = (metadata?.questions ?? []) as Array<{ id: string; question: string; type: string }>;

    // Fetch company context
    const companyAccess = await getUserCompanies(user.id);
    const newCompany = companyAccess[0]?.company ?? null;
    const companyProfile = (newCompany as unknown as { profile?: Record<string, unknown> | null })?.profile ?? {};
    const competitors = (Array.isArray(companyProfile.competitors) ? (companyProfile.competitors as string[]) : [])
      .filter((c) => typeof c === "string" && c.trim().length > 0);

    const companyContext: CompanyContext = {
      name: newCompany?.name ?? "Unknown",
      url: newCompany?.url ?? null,
      sector: newCompany?.sector ?? null,
      location: (newCompany as unknown as { location?: string | null })?.location ?? null,
      territory: typeof companyProfile.territory === "string" ? companyProfile.territory : null,
      icp1: typeof companyProfile.icp1 === "string" ? companyProfile.icp1 : null,
      icp2: typeof companyProfile.icp2 === "string" ? companyProfile.icp2 : null,
      icp3: typeof companyProfile.icp3 === "string" ? companyProfile.icp3 : null,
      competitors,
    };

    // Advance the transformation session
    const result = await advanceTransformationSession(
      transformationState,
      companyContext,
      storedQuestions,
      storedAnswers,
    );

    // Update job metadata with new state
    await db.job.update({
      where: { id: jobId },
      data: {
        metadata: { ...metadata, transformationState: result.state } as object,
      },
    }).catch(() => {});

    // If complete, persist output
    if (result.status === "complete" && result.sections) {
      const workflowType = job.workflowType;
      const tags = TRANSFORMATION_STAGE_TAGS[workflowType] ?? [];
      const sections = result.sections;
      const confidence =
        typeof sections.confidence === "object" &&
        sections.confidence !== null &&
        "score" in (sections.confidence as Record<string, unknown>)
          ? Number((sections.confidence as { score: number }).score)
          : null;

      const stageName = STAGE_NAMES[workflowType] ?? workflowType;

      const output = await db.output.create({
        data: {
          companyId: job.companyId,
          workflowType,
          outputType: `${workflowType}_report`,
          title: `${stageName} Report`,
          sections: sections as object,
          confidence,
          sources: [],
          tags,
          version: 1,
        },
      });

      await db.job.update({
        where: { id: jobId },
        data: {
          status: "completed",
          outputId: output.id,
          completedAt: new Date(),
          progress: 100,
        },
      });

      // Send notification
      const company = await db.company.findUnique({
        where: { id: job.companyId },
        select: { name: true },
      }).catch(() => null);

      const allFindings = Array.isArray(sections.key_findings) ? (sections.key_findings as unknown[]).length : 0;
      const allRecs = Array.isArray(sections.recommendations) ? (sections.recommendations as unknown[]).length : 0;

      sendReportCompleteNotification({
        userName: user.name ?? user.email,
        userEmail: user.email,
        companyName: company?.name ?? "your company",
        workflowType,
        counts: { actions: allRecs, risks: 0, assumptions: allFindings, metrics: 0 },
      });
    }

    if (result.status === "failed") {
      await db.job.update({
        where: { id: jobId },
        data: { status: "failed" },
      }).catch(() => {});
    }

    return NextResponse.json({
      status: result.status,
      agents: result.agents,
      sections: result.sections,
      jobId,
    });
  } catch (err) {
    console.error("[transformation-status] Error:", err);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
