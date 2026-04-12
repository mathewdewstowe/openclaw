import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeleteButton } from "@/components/admin/delete-button";
import { CompanyPlanPicker } from "@/components/admin/company-plan-picker";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const dbAny = db as unknown as Record<string, any>;

  const [companies, plans, shares, feedbacks] = await Promise.all([
    db.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, jobs: true, outputs: true } },
        portfolio: { select: { name: true } },
        users: {
          take: 1,
          include: { user: { select: { plan: { select: { id: true, displayName: true } } } } },
        },
      },
    }),
    db.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } }),
    dbAny.outputShare?.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { sharedBy: true, company: true } }).catch(() => []) ?? [],
    dbAny.outputFeedback?.findMany({ orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []) ?? [],
  ]);

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Companies</h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{companies.length} total</span>
      </div>

      {companies.length === 0 ? (
        <div style={{ padding: 32, border: "1px dashed #d1d5db", borderRadius: 12, textAlign: "center", color: "#6b7280" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No companies yet</p>
          <p style={{ fontSize: 14 }}>Companies are created when users set up their profiles.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Name</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Sector</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Plan</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Users</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Jobs</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Outputs</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Portfolio</th>
                <th style={{ padding: "10px 12px" }} />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const currentPlanName = c.users[0]?.user?.plan?.displayName ?? null;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px", color: "#111827", fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{c.sector ?? "—"}</td>
                    <td style={{ padding: "12px" }}>
                      <CompanyPlanPicker
                        companyId={c.id}
                        currentPlanName={currentPlanName}
                        plans={plans}
                      />
                    </td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{c._count.users}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{c._count.jobs}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{c._count.outputs}</td>
                    <td style={{ padding: "12px", color: "#9ca3af" }}>{c.portfolio?.name ?? "—"}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <DeleteButton url={`/api/admin/companies/${c.id}`} label={c.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Shares */}
      <div id="shares" style={{ marginTop: 48, marginBottom: 48 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Report Shares ({shares.length})</p>
        {shares.length === 0 ? <p style={{ fontSize: 13, color: "#9ca3af" }}>No shares yet.</p> : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Stage", "Company", "Shared By", "Recipient", "Date"].map(h => <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 12px 10px", borderBottom: "1px solid #e5e7eb" }}>{h}</th>)}</tr></thead>
              <tbody>
                {shares.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}><span style={{ textTransform: "capitalize" }}>{s.workflowType}</span></td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{s.company?.name ?? s.companyId}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{s.sharedBy?.name ?? s.sharedBy?.email ?? s.userId}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{s.recipientEmail}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#9ca3af", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>{new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div id="feedback" style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Report Feedback ({feedbacks.length})</p>
        {feedbacks.length === 0 ? <p style={{ fontSize: 13, color: "#9ca3af" }}>No feedback yet.</p> : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Stage", "Overall", "Accuracy", "Depth", "Actionability", "Relevance", "Comment", "Date"].map(h => <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 12px 10px", borderBottom: "1px solid #e5e7eb" }}>{h}</th>)}</tr></thead>
              <tbody>
                {feedbacks.map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}><span style={{ textTransform: "capitalize" }}>{f.workflowType}</span></td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{"★".repeat(f.overallRating)}{"☆".repeat(5 - f.overallRating)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{f.accuracy ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{f.depth ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{f.actionability ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{f.relevance ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6", maxWidth: 240 }}>{f.comment ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#9ca3af", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>{new Date(f.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
