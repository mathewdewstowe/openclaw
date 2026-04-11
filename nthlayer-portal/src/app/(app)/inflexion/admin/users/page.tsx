import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      isActive: true,
      plan: { select: { displayName: true } },
      createdAt: true,
      lastLoginAt: true,
    },
  });

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
                <td style={{ padding: "12px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                    background: u.systemRole === "super_admin" ? "#fef3c7" : u.systemRole === "admin" ? "#dbeafe" : "#f3f4f6",
                    color: u.systemRole === "super_admin" ? "#92400e" : u.systemRole === "admin" ? "#1e40af" : "#6b7280",
                  }}>
                    {u.systemRole}
                  </span>
                </td>
                <td style={{ padding: "12px", color: "#4b5563" }}>{u.plan?.displayName ?? "Free"}</td>
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
    </div>
  );
}
