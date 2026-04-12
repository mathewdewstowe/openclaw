import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeleteButton } from "@/components/admin/delete-button";
import { UserPlanPicker } from "@/components/admin/user-plan-picker";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const dbAny = db as unknown as Record<string, any>;

  const [users, plans, shares, feedbacks] = await Promise.all([
    db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      isActive: true,
      planId: true,
      plan: { select: { displayName: true } },
      companyAccess: {
        take: 1,
        select: { company: { select: { name: true } } },
      },
      createdAt: true,
      lastLoginAt: true,
    },
  }),
    db.plan.findMany({
      where: { isActive: true },
      select: { id: true, name: true, displayName: true },
      orderBy: { name: "asc" },
    }),
    dbAny.outputShare
      ?.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { sharedBy: true, company: true } })
      .catch(() => []) ?? [],
    dbAny.outputFeedback
      ?.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
      .catch(() => []) ?? [],
  ]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Users</h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{users.length} total</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Email</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Name</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Company</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Role</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Plan</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Last Login</th>
              <th style={{ padding: "10px 12px" }} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "12px", color: "#111827", fontWeight: 500 }}>{u.email}</td>
                <td style={{ padding: "12px", color: "#4b5563" }}>{u.name ?? "—"}</td>
                <td style={{ padding: "12px", color: "#4b5563" }}>{u.companyAccess?.[0]?.company?.name ?? "—"}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                    background: u.systemRole === "super_admin" ? "#fef3c7" : u.systemRole === "admin" ? "#dbeafe" : "#f3f4f6",
                    color: u.systemRole === "super_admin" ? "#92400e" : u.systemRole === "admin" ? "#1e40af" : "#6b7280",
                  }}>
                    {u.systemRole}
                  </span>
                </td>
                <td style={{ padding: "12px" }}>
                  <UserPlanPicker
                    userId={u.id}
                    currentPlanId={u.planId ?? null}
                    currentDisplayName={u.plan?.displayName ?? "Free"}
                    plans={plans}
                  />
                </td>
                <td style={{ padding: "12px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                    background: u.isActive ? "#dcfce7" : "#fee2e2",
                    color: u.isActive ? "#166534" : "#991b1b",
                  }}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "12px", color: "#9ca3af", fontSize: 13 }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-GB") : "Never"}
                </td>
                <td style={{ padding: "12px", textAlign: "right" }}>
                  <DeleteButton
                    url={`/api/admin/users/${u.id}`}
                    label={u.email}
                    disabled={u.id === user.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SharesAndFeedback shares={shares} feedbacks={feedbacks} />
    </div>
  );
}

function SharesAndFeedback({ shares, feedbacks }: { shares: any[]; feedbacks: any[] }) {
  const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 12px 10px", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" };
  const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 };

  return (
    <>
      <div id="shares" style={{ marginTop: 48, marginBottom: 48 }}>
        <p style={sectionLabel}>Report Shares ({shares.length})</p>
        {shares.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No shares yet.</p>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Stage", "Company", "Shared By", "Recipient", "Date"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {shares.map((s: any) => (
                  <tr key={s.id}>
                    <td style={td}><span style={{ textTransform: "capitalize" }}>{s.workflowType}</span></td>
                    <td style={td}>{s.company?.name ?? s.companyId}</td>
                    <td style={td}>{s.sharedBy?.name ?? s.sharedBy?.email ?? s.userId}</td>
                    <td style={td}>{s.recipientEmail}</td>
                    <td style={{ ...td, color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div id="feedback" style={{ marginBottom: 48 }}>
        <p style={sectionLabel}>Report Feedback ({feedbacks.length})</p>
        {feedbacks.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No feedback yet.</p>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Stage", "Overall", "Accuracy", "Depth", "Actionability", "Relevance", "Comment", "Date"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {feedbacks.map((f: any) => (
                  <tr key={f.id}>
                    <td style={td}><span style={{ textTransform: "capitalize" }}>{f.workflowType}</span></td>
                    <td style={td}>{"★".repeat(f.overallRating)}{"☆".repeat(5 - f.overallRating)}</td>
                    <td style={td}>{f.accuracy ?? "—"}</td>
                    <td style={td}>{f.depth ?? "—"}</td>
                    <td style={td}>{f.actionability ?? "—"}</td>
                    <td style={td}>{f.relevance ?? "—"}</td>
                    <td style={{ ...td, maxWidth: 240 }}>{f.comment ?? "—"}</td>
                    <td style={{ ...td, color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(f.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
