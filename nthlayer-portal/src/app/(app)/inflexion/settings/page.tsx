import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlanName, getUserCompanies } from "@/lib/entitlements";
import { AddCompanyForm } from "@/components/add-company-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [planName, companyAccess] = await Promise.all([
    getUserPlanName(user.id),
    getUserCompanies(user.id),
  ]);

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 24 }}>Settings</h1>

      {/* Profile */}
      <div style={{ padding: "20px 24px", border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Profile</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Email</p>
            <p style={{ fontSize: 14, color: "#111827" }}>{user.email}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Name</p>
            <p style={{ fontSize: 14, color: "#111827" }}>{user.name ?? "Not set"}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Role</p>
            <p style={{ fontSize: 14, color: "#111827" }}>{user.systemRole}</p>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div style={{ padding: "20px 24px", border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12 }}>Plan</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: 999,
            background: planName === "Free" ? "#f3f4f6" : "#dbeafe",
            color: planName === "Free" ? "#6b7280" : "#1d4ed8",
          }}>
            {planName}
          </span>
        </div>
      </div>

      {/* Companies */}
      <div style={{ padding: "20px 24px", border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Companies</h2>
        </div>
        {companyAccess.length === 0 ? (
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>No companies configured.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {companyAccess.map((ca) => (
              <div key={ca.company.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                border: "1px solid #f3f4f6",
                borderRadius: 8,
              }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{ca.company.name}</span>
                  {ca.company.sector && (
                    <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>{ca.company.sector}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{ca.role}</span>
              </div>
            ))}
          </div>
        )}
        <AddCompanyForm />
      </div>
    </div>
  );
}
