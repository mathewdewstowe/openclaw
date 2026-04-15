/**
 * Reset all job/output data for a given user email so they can re-run reports.
 * Usage: ANTHROPIC_API_KEY=... npx tsx scripts/reset-user-data.ts matthew+haiilo2@nthlayer.co.uk
 *
 * Deletes: Job, Output (and related OutputShare, OutputTag) for the user's companies.
 * Does NOT delete the user account, company profile, or company access.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-user-data.ts <email>");
    process.exit(1);
  }

  // Find user
  const user = await db.user.findFirst({
    where: { email },
    include: {
      companyAccess: { include: { company: { select: { id: true, name: true } } } },
    },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const companies = user.companyAccess.map((a) => a.company);
  console.log(`User: ${user.email} (${user.id})`);
  console.log(`Companies: ${companies.map((c) => `${c.name} (${c.id})`).join(", ")}`);

  for (const company of companies) {
    const companyId = company.id;

    // Count before
    const jobCount = await db.job.count({ where: { companyId } });
    const outputCount = await db.output.count({ where: { companyId } });
    console.log(`\n${company.name}: ${jobCount} jobs, ${outputCount} outputs`);

    if (jobCount === 0 && outputCount === 0) {
      console.log("  Nothing to delete.");
      continue;
    }

    // Delete OutputShare and OutputTag first (FK constraints)
    try {
      const shares = await (db as unknown as { outputShare: { deleteMany: (a: unknown) => Promise<{ count: number }> } }).outputShare.deleteMany({ where: { companyId } });
      console.log(`  Deleted ${shares.count} output shares`);
    } catch { /* table may not exist */ }

    try {
      const tags = await (db as unknown as { outputTag: { deleteMany: (a: unknown) => Promise<{ count: number }> } }).outputTag.deleteMany({
        where: { output: { companyId } },
      });
      console.log(`  Deleted ${tags.count} output tags`);
    } catch { /* table may not exist */ }

    // Delete outputs
    const deletedOutputs = await db.output.deleteMany({ where: { companyId } });
    console.log(`  Deleted ${deletedOutputs.count} outputs`);

    // Delete jobs
    const deletedJobs = await db.job.deleteMany({ where: { companyId } });
    console.log(`  Deleted ${deletedJobs.count} jobs`);
  }

  console.log("\n✓ Done — user can now re-run all reports.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
