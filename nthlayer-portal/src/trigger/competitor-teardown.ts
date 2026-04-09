import { task } from "@trigger.dev/sdk/v3";
import { db } from "../lib/db";
import { runCompetitorTeardownPipeline } from "../lib/pipeline/competitor-teardown";

export const competitorTeardownTask = task({
  id: "competitor-teardown",
  // No timeout — pipeline can take several minutes
  machine: { preset: "small-1x" },
  run: async (payload: { scanId: string }) => {
    const { scanId } = payload;

    try {
      await db.scan.update({
        where: { id: scanId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      await runCompetitorTeardownPipeline(scanId);

      await db.scan.update({
        where: { id: scanId },
        data: { status: "COMPLETED", completedAt: new Date(), progress: 100 },
      });

      await db.scanEvent.create({
        data: { scanId, event: "scan_completed" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`competitor-teardown failed for scan ${scanId}:`, message);

      await db.scan.update({
        where: { id: scanId },
        data: { status: "FAILED", errorMessage: message },
      });

      await db.scanEvent.create({
        data: { scanId, event: "scan_failed", metadata: { error: message } },
      });

      throw error;
    }
  },
});
