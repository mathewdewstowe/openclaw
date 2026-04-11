import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/entitlements";
import { db } from "@/lib/db";

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entitlements = await getUserEntitlements(user.id);

  if (!entitlements.access_portfolio) {
    return (
      <div style={{ maxWidth: 960 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Portfolio</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>Multi-company strategic intelligence</p>

        <div style={{
          padding: 40,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          textAlign: "center",
          background: "#fafafa",
        }}>
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#9ca3af" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Portfolio view requires an upgrade</p>
          <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, margin: "0 auto 16px" }}>
            Aggregate strategic intelligence across multiple companies with the Portfolio plan.
          </p>
          <span style={{
            display: "inline-block",
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "#111827",
            borderRadius: 8,
            cursor: "pointer",
          }}>
            Upgrade Plan
          </span>
        </div>
      </div>
    );
  }

  const portfolios = await db.portfolio.findMany({
    where: { createdById: user.id },
    include: {
      companies: {
        select: { id: true, name: true, sector: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Portfolio</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>Multi-company strategic intelligence</p>
        </div>
      </div>

      {portfolios.length === 0 ? (
        <div style={{
          padding: 32,
          border: "1px dashed #d1d5db",
          borderRadius: 12,
          textAlign: "center",
          color: "#6b7280",
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No portfolios yet</p>
          <p style={{ fontSize: 14 }}>Create a portfolio to group companies and view aggregate intelligence.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {portfolios.map((p) => (
            <a
              key={p.id}
              href={`/inflexion/portfolio/${p.id}`}
              style={{
                display: "block",
                padding: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                textDecoration: "none",
                background: "#fff",
              }}
            >
              <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{p.name}</p>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                {p.companies.length} {p.companies.length === 1 ? "company" : "companies"}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
