import { db } from "./db";
import { runInflectionPipeline } from "./pipeline/inflection";
import { runCompetitorTeardownPipeline } from "./pipeline/competitor-teardown";
import { runDealDDPipeline } from "./pipeline/deal-dd";

type JobType = "runInflectionScan" | "runCompetitorTeardown" | "runDealDDScan";

// In production, replace with Trigger.dev. This is an in-process runner
// that executes the pipeline asynchronously so API routes return immediately.
export async function enqueueJob(type: JobType, payload: { scanId: string }) {
  // Fire and forget — runs in background
  setImmediate(() => void executeJob(type, payload));
}

async function executeJob(type: JobType, payload: { scanId: string }) {
  const { scanId } = payload;

  try {
    await db.scan.update({
      where: { id: scanId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    switch (type) {
      case "runInflectionScan":
        await runInflectionPipeline(scanId);
        break;
      case "runCompetitorTeardown":
        await runCompetitorTeardownPipeline(scanId);
        break;
      case "runDealDDScan":
        await runDealDDPipeline(scanId);
        break;
    }

    await db.scan.update({
      where: { id: scanId },
      data: { status: "COMPLETED", completedAt: new Date(), progress: 100 },
    });

    await db.scanEvent.create({
      data: { scanId, event: "scan_completed" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Job ${type} failed for scan ${scanId}:`, message);

    await db.scan.update({
      where: { id: scanId },
      data: { status: "FAILED", errorMessage: message },
    });

    await db.scanEvent.create({
      data: { scanId, event: "scan_failed", metadata: { error: message } },
    });
  }
}
