import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";

const stageOrder = ["frame", "diagnose", "decide", "position", "commit"];
const stageNames: Record<string, string> = {
  frame: "Frame", diagnose: "Diagnose", decide: "Decide", position: "Position", commit: "Commit",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;
  if (!activeCompany) return NextResponse.json({ companyName: "", context: "", completedStages: 0 });

  const outputs = await db.output.findMany({
    where: { companyId: activeCompany.id },
    select: { workflowType: true, sections: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const seen = new Set<string>();
  const latest = outputs.filter((o) => { if (seen.has(o.workflowType)) return false; seen.add(o.workflowType); return true; });
  const byStage = Object.fromEntries(latest.map((o) => [o.workflowType, o]));

  const contextParts: string[] = [];
  for (const stageId of stageOrder) {
    const o = byStage[stageId];
    if (!o) continue;
    const s = o.sections as Record<string, unknown>;
    const parts = [`=== ${stageNames[stageId]} Stage Report ===`];
    if (s.executive_summary) parts.push(`Executive Summary:\n${s.executive_summary}`);
    if (s.what_matters) parts.push(`What Matters Most:\n${s.what_matters}`);
    if (s.recommendation) parts.push(`Recommendation:\n${s.recommendation}`);
    if (s.business_implications) parts.push(`Business Implications:\n${s.business_implications}`);
    if (Array.isArray(s.assumptions) && (s.assumptions as unknown[]).length > 0) {
      const aLines = (s.assumptions as (string | Record<string, unknown>)[]).map((a) => `- ${typeof a === "string" ? a : (a.text as string) ?? ""}`);
      parts.push(`Key Assumptions:\n${aLines.join("\n")}`);
    }
    if (Array.isArray(s.risks) && (s.risks as unknown[]).length > 0) {
      const rLines = (s.risks as { risk: string; severity: string; mitigation: string }[]).map((r) => `- [${r.severity}] ${r.risk} — ${r.mitigation}`);
      parts.push(`Risks:\n${rLines.join("\n")}`);
    }
    if (s.icp_signal && typeof s.icp_signal === "object") {
      const icp = s.icp_signal as { stated_icp?: string; actual_icp?: string; alignment?: string; divergence_note?: string; signal_strength?: string };
      parts.push(`ICP Signal:\nAlignment: ${icp.alignment ?? ""} (${icp.signal_strength ?? ""} evidence)\nStated ICP: ${icp.stated_icp ?? ""}\nActual ICP: ${icp.actual_icp ?? ""}${icp.divergence_note ? `\nGap: ${icp.divergence_note}` : ""}`);
    }
    if (Array.isArray(s.hypothesis_register) && (s.hypothesis_register as unknown[]).length > 0) {
      const hLines = (s.hypothesis_register as { hypothesis: string; status: string; evidence?: string }[]).map((h) => `- [${h.status}] ${h.hypothesis}${h.evidence ? ` (${h.evidence})` : ""}`);
      parts.push(`Hypothesis Register:\n${hLines.join("\n")}`);
    }
    if (Array.isArray(s.kill_criteria) && (s.kill_criteria as unknown[]).length > 0) {
      const kcLines = (s.kill_criteria as { criterion: string; trigger: string; response: string }[]).map((k) => `- ${k.criterion}: ${k.trigger} → ${k.response}`);
      parts.push(`Kill Criteria:\n${kcLines.join("\n")}`);
    }
    contextParts.push(parts.join("\n\n"));
  }

  return NextResponse.json({
    companyName: activeCompany.name,
    context: contextParts.join("\n\n---\n\n"),
    completedStages: stageOrder.filter((s) => byStage[s]).length,
  });
}
