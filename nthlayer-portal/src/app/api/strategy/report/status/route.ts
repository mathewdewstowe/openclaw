import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStrategySession } from "@/lib/agents/strategy-sessions";
import { getUserCompanies } from "@/lib/entitlements";
import { sendReportCompleteNotification } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
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
        frame:    ["Strategic Problem", "Market Context", "Winning Conditions", "Decision Boundaries", "Strategic Hypothesis"],
        diagnose: ["Business Assessment", "Product-Market Fit", "Competitive Landscape", "Unit Economics", "Capability Assessment"],
        decide:   ["Strategic Options", "Recommended Direction", "What Must Be True", "Kill Criteria"],
        position: ["Target Customer", "Competitive Advantage", "Positioning Statement", "Structural Defensibility"],
        commit:   ["Strategic Bets", "OKRs", "100-Day Plan", "Kill Criteria", "Resource Allocation"],
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
          const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"];
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
              ? `Assumptions: ${(capturedSections.assumptions as string[]).slice(0, 5).join("; ")}`
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
                ? `${stageId} assumptions: ${(s.assumptions as string[]).slice(0, 3).join("; ")}`
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
