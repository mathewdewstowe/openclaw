import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  frame:    { label: "Frame",    color: "#374151", bg: "#f3f4f6" },
  diagnose: { label: "Diagnose", color: "#1e40af", bg: "#dbeafe" },
  decide:   { label: "Decide",   color: "#6d28d9", bg: "#ede9fe" },
  position: { label: "Position", color: "#065f46", bg: "#d1fae5" },
  commit:   { label: "Commit",   color: "#92400e", bg: "#fef3c7" },
};

const TYPE_LABELS: Record<string, string> = {
  risk: "Risk", action: "Action", monitor: "Monitor",
};

function pct(a: number, total: number) {
  if (!total) return "—";
  return `${Math.round((a / total) * 100)}%`;
}

export default async function FeedbackAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const dbAny = db as unknown as Record<string, any>;

  let allFeedback: Array<{
    id: string; outputId: string; companyId: string; userId: string;
    itemType: string; itemIndex: number; itemText: string;
    workflowType: string; feedback: string; createdAt: Date;
  }> = [];

  try {
    allFeedback = await dbAny.itemFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
  } catch {
    // table may not exist yet
  }

  const total = allFeedback.length;
  const accepted = allFeedback.filter((f) => f.feedback === "accepted").length;
  const declined = allFeedback.filter((f) => f.feedback === "declined").length;

  // By stage
  const byStage: Record<string, { accepted: number; declined: number }> = {};
  for (const f of allFeedback) {
    if (!byStage[f.workflowType]) byStage[f.workflowType] = { accepted: 0, declined: 0 };
    byStage[f.workflowType][f.feedback as "accepted" | "declined"]++;
  }

  // By item type
  const byType: Record<string, { accepted: number; declined: number }> = {};
  for (const f of allFeedback) {
    if (!byType[f.itemType]) byType[f.itemType] = { accepted: 0, declined: 0 };
    byType[f.itemType][f.feedback as "accepted" | "declined"]++;
  }

  // Most declined items (top 20)
  const declinedItems = allFeedback
    .filter((f) => f.feedback === "declined")
    .slice(0, 20);

  // Most accepted items (top 20)
  const acceptedItems = allFeedback
    .filter((f) => f.feedback === "accepted")
    .slice(0, 20);

  // Per-company stats
  const byCompany: Record<string, { accepted: number; declined: number; companyId: string }> = {};
  for (const f of allFeedback) {
    if (!byCompany[f.companyId]) byCompany[f.companyId] = { accepted: 0, declined: 0, companyId: f.companyId };
    byCompany[f.companyId][f.feedback as "accepted" | "declined"]++;
  }

  // Fetch company names
  const companyIds = Object.keys(byCompany);
  const companies = companyIds.length > 0
    ? await db.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Link href="/inflexion/admin" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>← Admin</Link>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>Analysis Feedback</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "6px 0 0" }}>User accept/decline ratings on risks, actions, and monitoring items — tracks analysis quality over time.</p>
      </div>

      {/* Top-level stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total ratings", value: total, color: "#111827", bg: "#f9fafb" },
          { label: "Accepted", value: accepted, sub: pct(accepted, total), color: "#065f46", bg: "#d1fae5" },
          { label: "Declined", value: declined, sub: pct(declined, total), color: "#991b1b", bg: "#fee2e2" },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "20px 24px" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{s.label}</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: s.color, margin: 0, letterSpacing: "-0.03em" }}>{s.value}</p>
            {s.sub && <p style={{ fontSize: 13, color: s.color, margin: "4px 0 0" }}>{s.sub} of total</p>}
          </div>
        ))}
      </div>

      {/* By stage + by type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* By stage */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>By Stage</h2>
          {Object.entries(byStage).length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>No data yet</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Stage", "✓ Accept", "✗ Decline", "Rate"].map((h) => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["frame","diagnose","decide","position","commit"].filter((s) => byStage[s]).map((stageId) => {
                  const d = byStage[stageId];
                  const meta = STAGE_META[stageId] ?? { label: stageId, color: "#6b7280", bg: "#f3f4f6" };
                  const stageTotal = d.accepted + d.declined;
                  return (
                    <tr key={stageId}>
                      <td style={{ padding: "8px 0", fontSize: 13 }}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: meta.bg, color: meta.color }}>{meta.label}</span></td>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#065f46", fontWeight: 600 }}>{d.accepted}</td>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#991b1b", fontWeight: 600 }}>{d.declined}</td>
                      <td style={{ padding: "8px 0", fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden", maxWidth: 60 }}>
                            <div style={{ height: "100%", width: `${stageTotal ? (d.accepted / stageTotal) * 100 : 0}%`, background: "#10b981", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "#374151" }}>{pct(d.accepted, stageTotal)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* By type */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>By Item Type</h2>
          {Object.entries(byType).length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>No data yet</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Type", "✓ Accept", "✗ Decline", "Rate"].map((h) => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byType).map(([type, d]) => {
                  const typeTotal = d.accepted + d.declined;
                  return (
                    <tr key={type}>
                      <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 600, color: "#374151" }}>{TYPE_LABELS[type] ?? type}</td>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#065f46", fontWeight: 600 }}>{d.accepted}</td>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#991b1b", fontWeight: 600 }}>{d.declined}</td>
                      <td style={{ padding: "8px 0", fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden", maxWidth: 60 }}>
                            <div style={{ height: "100%", width: `${typeTotal ? (d.accepted / typeTotal) * 100 : 0}%`, background: "#10b981", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "#374151" }}>{pct(d.accepted, typeTotal)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Per-company */}
      {Object.keys(byCompany).length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>By Company</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Company", "✓ Accept", "✗ Decline", "Total", "Acceptance rate"].map((h) => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(byCompany).sort((a, b) => (b.accepted + b.declined) - (a.accepted + a.declined)).map((d) => {
                const t = d.accepted + d.declined;
                return (
                  <tr key={d.companyId}>
                    <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 600, color: "#111827" }}>{companyMap[d.companyId] ?? d.companyId.slice(0, 8)}</td>
                    <td style={{ padding: "8px 0", fontSize: 13, color: "#065f46", fontWeight: 600 }}>{d.accepted}</td>
                    <td style={{ padding: "8px 0", fontSize: 13, color: "#991b1b", fontWeight: 600 }}>{d.declined}</td>
                    <td style={{ padding: "8px 0", fontSize: 13, color: "#6b7280" }}>{t}</td>
                    <td style={{ padding: "8px 0", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 80, height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${t ? (d.accepted / t) * 100 : 0}%`, background: "#10b981", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: "#374151" }}>{pct(d.accepted, t)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Most declined items — learning signal */}
      {declinedItems.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Most Recent Declined Items</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>Items users marked as inaccurate or irrelevant — use to improve prompts.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {declinedItems.map((f) => {
              const meta = STAGE_META[f.workflowType] ?? { label: f.workflowType, color: "#6b7280", bg: "#f3f4f6" };
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", background: "#fffbfb", border: "1px solid #fecaca", borderLeft: "3px solid #ef4444", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", background: "#fee2e2", borderRadius: 20, padding: "2px 8px", flexShrink: 0, marginTop: 2 }}>✗</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "#111827", margin: "0 0 4px", lineHeight: 1.4 }}>{f.itemText}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: meta.bg, color: meta.color }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{TYPE_LABELS[f.itemType] ?? f.itemType}</span>
                      <span style={{ fontSize: 11, color: "#d1d5db" }}>{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Most accepted items */}
      {acceptedItems.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Most Recent Accepted Items</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>Items users confirmed as accurate — patterns to reinforce in prompts.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {acceptedItems.map((f) => {
              const meta = STAGE_META[f.workflowType] ?? { label: f.workflowType, color: "#6b7280", bg: "#f3f4f6" };
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderLeft: "3px solid #10b981", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#065f46", background: "#d1fae5", borderRadius: 20, padding: "2px 8px", flexShrink: 0, marginTop: 2 }}>✓</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "#111827", margin: "0 0 4px", lineHeight: 1.4 }}>{f.itemText}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: meta.bg, color: meta.color }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{TYPE_LABELS[f.itemType] ?? f.itemType}</span>
                      <span style={{ fontSize: 11, color: "#d1d5db" }}>{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {total === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 18 }}>📊</p>
          <p style={{ margin: 0, fontWeight: 600, color: "#374151" }}>No feedback yet</p>
          <p style={{ margin: "6px 0 0" }}>Users will see ✓/✗ buttons on risks, actions, and monitoring items.</p>
        </div>
      )}
    </div>
  );
}
