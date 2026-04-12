import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import Link from "next/link";
import AssumptionsClient, { type OutputAssumption } from "./assumptions-client";

export const dynamic = "force-dynamic";

export default async function AssumptionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  let allAssumptions: OutputAssumption[] = [];
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

    const stageOrder = ["frame", "diagnose", "decide", "position", "commit"];
    const seenStages = new Set<string>();
    for (const output of outputs) {
      if (seenStages.has(output.workflowType)) continue;
      seenStages.add(output.workflowType);
      const sections = output.sections as Record<string, unknown>;
      const assumptions = sections?.assumptions;
      if (Array.isArray(assumptions) && assumptions.length > 0) {
        assumptions.forEach((a) => {
          const text = typeof a === "string" ? a : (a as Record<string, string>)?.assumption;
          if (text) allAssumptions.push({ assumption: text, stageId: output.workflowType, outputId: output.id, createdAt: output.createdAt.toISOString() });
        });
      }
    }
    allAssumptions.sort((a, b) => stageOrder.indexOf(a.stageId) - stageOrder.indexOf(b.stageId));

    const statuses = await db.itemStatus.findMany({
      where: { companyId: activeCompany.id, itemType: "assumption" },
      select: { outputId: true, itemType: true, itemIndex: true, status: true },
    });
    for (const s of statuses) {
      initialStatuses[`${s.outputId}_${s.itemType}_${s.itemIndex}`] = s.status;
    }
  }

  if (allAssumptions.length === 0) {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: "0 0 6px" }}>Assumptions</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Key assumptions underlying the strategy for {companyName}</p>
        </div>
        <div style={{ background: "#f9fafb", border: "1.5px dashed #e5e7eb", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No assumptions yet</p>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 auto 24px", maxWidth: 380 }}>Run at least one strategy stage report to surface assumptions.</p>
          <Link href="/inflexion/strategy" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#111827", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Go to Frame <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <AssumptionsClient allAssumptions={allAssumptions} companyName={companyName} companyId={companyId} initialStatuses={initialStatuses} />
    </div>
  );
}
