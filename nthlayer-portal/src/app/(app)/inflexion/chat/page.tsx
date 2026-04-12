import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import ChatClient from "./chat-client";

export const dynamic = "force-dynamic";

const stageOrder = ["frame", "diagnose", "decide", "position", "commit"];
const stageNames: Record<string, string> = {
  frame: "Frame",
  diagnose: "Diagnose",
  decide: "Decide",
  position: "Position",
  commit: "Commit",
};

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  if (!activeCompany) {
    return (
      <div style={{ padding: "40px", color: "#6b7280", fontSize: 14 }}>
        No company found.
      </div>
    );
  }

  const outputs = await db.output.findMany({
    where: { companyId: activeCompany.id },
    select: { id: true, workflowType: true, sections: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Deduplicate — keep only the most recent per workflowType
  const seen = new Set<string>();
  const latestOutputs = outputs.filter((o) => {
    if (seen.has(o.workflowType)) return false;
    seen.add(o.workflowType);
    return true;
  });

  const outputsByStage = Object.fromEntries(
    latestOutputs.map((o) => [o.workflowType, o])
  );

  // Build context string from all available stage outputs
  const contextParts: string[] = [];
  for (const stageId of stageOrder) {
    const output = outputsByStage[stageId];
    if (!output) continue;
    const s = output.sections as Record<string, unknown>;
    const parts: string[] = [`=== ${stageNames[stageId]} Stage Report ===`];
    if (s.executive_summary) parts.push(`Executive Summary:\n${s.executive_summary}`);
    if (s.what_matters) parts.push(`What Matters Most:\n${s.what_matters}`);
    if (s.recommendation) parts.push(`Recommendation:\n${s.recommendation}`);
    if (s.business_implications) parts.push(`Business Implications:\n${s.business_implications}`);
    if (Array.isArray(s.assumptions) && (s.assumptions as string[]).length > 0) {
      parts.push(
        `Key Assumptions:\n${(s.assumptions as string[]).map((a) => `- ${a}`).join("\n")}`
      );
    }
    contextParts.push(parts.join("\n\n"));
  }
  const fullContext = contextParts.join("\n\n---\n\n");

  const completedStages = stageOrder.filter((s) => outputsByStage[s]).length;

  return (
    <ChatClient
      companyName={activeCompany.name}
      context={fullContext}
      completedStages={completedStages}
    />
  );
}
