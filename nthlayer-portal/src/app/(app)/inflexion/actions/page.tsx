import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import Link from "next/link";
import ActionsClient, { type OutputAction } from "./actions-client";

export const dynamic = "force-dynamic";

type Action = { action: string; owner?: string; deadline?: string; priority?: string };

export default async function ActionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  let allActions: OutputAction[] = [];
  let companyName = "your company";
  let companyId = "";
  let initialStatuses: Record<string, string> = {};

  if (activeCompany) {
    companyName = activeCompany.name;
    companyId = activeCompany.id;

    const outputs = await db.output.findMany({
      where: { companyId: activeCompany.id },
      select: { id: true, workflowType: true, sections: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const seenStages = new Set<string>();
    for (const output of outputs) {
      if (seenStages.has(output.workflowType)) continue;
      seenStages.add(output.workflowType);
      const sections = output.sections as Record<string, unknown>;
      const actions = sections?.actions as Action[] | undefined;
      if (Array.isArray(actions) && actions.length > 0) {
        actions.forEach((a) => allActions.push({ ...a, stageId: output.workflowType, outputId: output.id, createdAt: output.createdAt.toISOString() }));
      }
    }

    const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    const stageOrder = ["frame", "diagnose", "decide", "position", "commit"];
    allActions.sort((a, b) => {
      const pa = priorityOrder[a.priority ?? ""] ?? 3;
      const pb = priorityOrder[b.priority ?? ""] ?? 3;
      if (pa !== pb) return pa - pb;
      return stageOrder.indexOf(a.stageId) - stageOrder.indexOf(b.stageId);
    });

    const statuses = await db.itemStatus.findMany({
      where: { companyId: activeCompany.id, itemType: "action" },
      select: { outputId: true, itemType: true, itemIndex: true, status: true },
    });
    for (const s of statuses) {
      initialStatuses[`${s.outputId}_${s.itemType}_${s.itemIndex}`] = s.status;
    }
  }

  if (allActions.length === 0) {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: "0 0 6px" }}>Actions</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>All priority actions across every strategy stage for {companyName}</p>
        </div>
        <div style={{ background: "#f9fafb", border: "1.5px dashed #e5e7eb", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No actions yet</p>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 auto 24px", maxWidth: 380 }}>Run at least one strategy stage report to generate actions.</p>
          <Link href="/inflexion/strategy" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#111827", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Go to Frame <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <ActionsClient allActions={allActions} companyName={companyName} companyId={companyId} initialStatuses={initialStatuses} />
    </div>
  );
}
