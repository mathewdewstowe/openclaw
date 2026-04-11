import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PLAN_ENTITLEMENTS } from "../src/lib/types/entitlements";

const adapter = new PrismaNeonHTTP(process.env.DATABASE_URL!, {});
const db = new PrismaClient({ adapter });

const PLANS = [
  {
    name: "free",
    displayName: "Free",
    description: "Get started with strategic diagnosis",
    priceMonthly: 0,
    priceAnnual: 0,
    sortOrder: 0,
  },
  {
    name: "pro",
    displayName: "Pro",
    description: "Full diagnosis with strategic decisions and positioning",
    priceMonthly: 4900, // $49
    priceAnnual: 47000, // $470
    sortOrder: 1,
  },
  {
    name: "operator",
    displayName: "Operator",
    description: "Complete strategic operating system for operators",
    priceMonthly: 14900, // $149
    priceAnnual: 143000, // $1,430
    sortOrder: 2,
  },
  {
    name: "portfolio",
    displayName: "Portfolio",
    description: "Multi-company intelligence for investors and portfolio leaders",
    priceMonthly: 49900, // $499
    priceAnnual: 479000, // $4,790
    sortOrder: 3,
  },
  {
    name: "enterprise",
    displayName: "Enterprise",
    description: "Custom deployment with dedicated support",
    priceMonthly: null,
    priceAnnual: null,
    sortOrder: 4,
  },
] as const;

async function main() {
  console.log("Seeding plans...");

  for (const plan of PLANS) {
    const entitlements = PLAN_ENTITLEMENTS[plan.name as keyof typeof PLAN_ENTITLEMENTS];
    await db.plan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceAnnual: plan.priceAnnual,
        entitlements: entitlements as object,
        sortOrder: plan.sortOrder,
      },
      create: {
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceAnnual: plan.priceAnnual,
        entitlements: entitlements as object,
        sortOrder: plan.sortOrder,
      },
    });
    console.log(`  ${plan.displayName} plan upserted`);
  }

  // Assign Matthew as super_admin with operator plan
  const operatorPlan = await db.plan.findUnique({ where: { name: "operator" } });
  const matthew = await db.user.findUnique({ where: { email: "matthew@nthlayer.co.uk" } });
  if (operatorPlan && matthew) {
    await db.user.update({
      where: { id: matthew.id },
      data: { systemRole: "super_admin", planId: operatorPlan.id },
    });
    console.log("  Matthew assigned super_admin + operator plan");
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
