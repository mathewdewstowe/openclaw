import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { PlanEntitlements } from "@/lib/types/entitlements";
import { PlanEditor } from "@/components/admin/plan-editor";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const plans = await db.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 24 }}>Plans</h1>

      <div style={{ display: "grid", gap: 16 }}>
        {plans.map((p) => (
          <PlanEditor
            key={p.id}
            plan={{
              id: p.id,
              displayName: p.displayName,
              description: p.description,
              priceMonthly: p.priceMonthly,
              entitlements: p.entitlements as unknown as PlanEntitlements,
              userCount: p._count.users,
            }}
          />
        ))}
      </div>

      {/* One-off purchases */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "40px 0 16px" }}>One-off Purchases</h2>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{
          padding: "24px 28px",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>Strategy Document Unlock</p>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#6d28d9", background: "#ede9fe", padding: "2px 8px", borderRadius: 999,
              }}>One-off</span>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
              Unlocks the full 13-section Product Strategy Document for a single company. Generated from all five completed strategy stages — one coherent document, board-ready and fully sourced.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["13-section document", "Word export", "PowerPoint export", "Single company", "Permanent access"].map((tag) => (
                <span key={tag} style={{
                  fontSize: 11, padding: "2px 10px", borderRadius: 999,
                  background: "#f3f4f6", color: "#374151", fontWeight: 500,
                }}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 2px" }}>£750</p>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>one-time · ex. VAT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
