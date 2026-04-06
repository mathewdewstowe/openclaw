import { after } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runCompetitorTeardownStep } from "@/lib/pipeline/competitor-teardown";

// Called by Cloudflare Cron every minute via wrangler scheduled trigger
export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.INTERNAL_SECRET ?? "nthlayer-internal-2026")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find all running/pending competitor teardown scans
  const activeScans = await db.scan.findMany({
    where: { type: "COMPETITOR_TEARDOWN", status: { in: ["PENDING", "RUNNING"] } },
    select: { id: true },
  });

  for (const { id } of activeScans) {
    const completedCount = await db.analysisResult.count({ where: { scanId: id } });
    const nextStep = completedCount;
    if (nextStep > 11) continue;

    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const alreadyTriggered = await db.scanEvent.findFirst({
      where: { scanId: id, event: `pipeline_advance_${nextStep}`, createdAt: { gte: sixtySecondsAgo } },
    });
    if (alreadyTriggered) continue;

    await db.scanEvent.create({ data: { scanId: id, event: `pipeline_advance_${nextStep}` } });

    const scanId = id;
    after(async () => {
      try {
        const current = await db.scan.findUnique({ where: { id: scanId }, select: { status: true } });
        if (!current || current.status === "COMPLETED" || current.status === "FAILED") return;
        if (nextStep === 0) {
          await db.scan.update({ where: { id: scanId }, data: { status: "RUNNING", startedAt: new Date() } });
        }
        await runCompetitorTeardownStep(scanId, nextStep);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await db.scanEvent.create({ data: { scanId, event: `step_${nextStep}_error`, metadata: { error: message } } }).catch(() => null);
      }
    });
  }

  return NextResponse.json({ ok: true, advanced: activeScans.length });
}
