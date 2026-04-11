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
    </div>
  );
}
