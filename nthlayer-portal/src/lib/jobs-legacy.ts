import { db } from "./db";
import { runSelfScanPipeline } from "./pipeline/self-scan";

export async function executeJobInternal(
  type: string,
  payload: { scanId: string }
) {
  const { scanId } = payload;
  try {
    await db.scan.update({
      where: { id: scanId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    if (type === "runSelfScan") {
      await runSelfScanPipeline(scanId);
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
