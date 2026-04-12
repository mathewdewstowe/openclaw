import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import Link from "next/link";
import RisksClient, { type OutputRisk } from "./risks-client";

export const dynamic = "force-dynamic";

type Risk = { risk: string; severity?: string; mitigation?: string };

export default async function RisksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  let allRisks: OutputRisk[] = [];
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
      const risks = sections?.risks as Risk[] | undefined;
      if (Array.isArray(risks) && risks.length > 0) {
        risks.forEach((r) => allRisks.push({ ...r, stageId: output.workflowType, outputId: output.id, createdAt: output.createdAt.toISOString() }));
      }
    }

    const severityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const stageOrder = ["frame", "diagnose", "decide", "position", "commit"];
    allRisks.sort((a, b) => {
      const sa = severityOrder[a.severity ?? ""] ?? 4;
      const sb = severityOrder[b.severity ?? ""] ?? 4;
      if (sa !== sb) return sa - sb;
      return stageOrder.indexOf(a.stageId) - stageOrder.indexOf(b.stageId);
    });

    // Fetch existing statuses
    const statuses = await db.itemStatus.findMany({
      where: { companyId: activeCompany.id, itemType: "risk" },
      select: { outputId: true, itemType: true, itemIndex: true, status: true },
    });
    for (const s of statuses) {
      initialStatuses[`${s.outputId}_${s.itemType}_${s.itemIndex}`] = s.status;
    }
  }

  if (allRisks.length === 0) {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: "0 0 6px" }}>Risks</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>All risks identified across every strategy stage for {companyName}</p>
        </div>
        <div style={{ background: "#f9fafb", border: "1.5px dashed #e5e7eb", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No risks yet</p>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 auto 24px", maxWidth: 380 }}>Run at least one strategy stage report to surface risks.</p>
          <Link href="/inflexion/strategy" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#111827", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Go to Frame <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <RisksClient allRisks={allRisks} companyName={companyName} companyId={companyId} initialStatuses={initialStatuses} />
    </div>
  );
}
