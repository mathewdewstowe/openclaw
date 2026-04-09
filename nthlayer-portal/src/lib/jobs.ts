import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function enqueueJob(
  type: "runSelfScan" | "runInflectionScan" | "runDealDDScan",
  payload: { scanId: string }
) {
  const { executeJobInternal } = await import("./jobs-legacy");
  const jobPromise = executeJobInternal(type, payload);
  try {
    getCloudflareContext().ctx.waitUntil(jobPromise);
  } catch {
    void jobPromise;
  }
}
