import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import Link from "next/link";
import MonitoringClient, { type OutputMonitor } from "./monitoring-client";

export const dynamic = "force-dynamic";

type MonitorItem = { metric: string; target?: string; frequency?: string };

export default async function MonitoringPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  let allItems: OutputMonitor[] = [];
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
      const monitoring = sections?.monitoring as MonitorItem[] | undefined;
      if (Array.isArray(monitoring) && monitoring.length > 0) {
        monitoring.forEach((m) => {
          if (m.metric) allItems.push({ ...m, stageId: output.workflowType, outputId: output.id, createdAt: output.createdAt.toISOString() });
        });
      }
    }

    allItems.sort((a, b) => stageOrder.indexOf(a.stageId) - stageOrder.indexOf(b.stageId));

    const statuses = await db.itemStatus.findMany({
      where: { companyId: activeCompany.id, itemType: "monitoring" },
      select: { outputId: true, itemType: true, itemIndex: true, status: true },
    });
    for (const s of statuses) {
      initialStatuses[`${s.outputId}_${s.itemType}_${s.itemIndex}`] = s.status;
    }
  }

  if (allItems.length === 0) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: "0 0 6px" }}>Metrics</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Metrics and signals to track for {companyName}</p>
        </div>
        <div style={{ background: "#f9fafb", border: "1.5px dashed #e5e7eb", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No monitoring metrics yet</p>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 auto 24px", maxWidth: 380 }}>Run at least one strategy stage report to generate monitoring metrics.</p>
          <Link href="/inflexion/strategy" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#111827", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Go to Frame <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <MonitoringClient allItems={allItems} companyName={companyName} companyId={companyId} initialStatuses={initialStatuses} />
    </div>
  );
}
