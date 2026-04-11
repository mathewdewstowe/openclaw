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

  const [companies, plans] = await Promise.all([
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
    </div>
  );
}
