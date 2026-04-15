import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements, getUserPlanName } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { PlanCards } from "./plan-cards";

export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [planName, entitlements, plans, fullUser] = await Promise.all([
    getUserPlanName(user.id),
    getUserEntitlements(user.id),
    db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, stripeSubscriptionId: true },
    }),
  ]);

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Choose your plan
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          You are currently on the <strong>{planName}</strong> plan.
        </p>
      </div>

      <PlanCards
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceAnnual: p.priceAnnual,
          entitlements: p.entitlements as Record<string, unknown>,
          hasStripePrice: !!(p.stripePriceIdMonthly || p.stripePriceIdAnnual),
        }))}
        currentPlanName={planName}
        hasSubscription={!!fullUser?.stripeSubscriptionId}
        hasCustomer={!!fullUser?.stripeCustomerId}
      />
    </div>
  );
}
