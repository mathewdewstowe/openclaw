import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { db } from "@/lib/db";
import { runCompetitorTeardownStep } from "@/lib/pipeline/competitor-teardown";

export async function POST(req: Request) {
  const { scanId, stepIndex } = await req.json().catch(() => ({}));
  if (!scanId || stepIndex === undefined) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Use workers.dev URL to avoid custom domain loopback failure
  const workerUrl = process.env.WORKER_URL ?? new URL(req.url).origin;

  // Capture ctx NOW, while still in the request context, before returning the response.
  let cfCtx: { waitUntil: (p: Promise<unknown>) => void } | null = null;
  try {
    cfCtx = getCloudflareContext().ctx;
  } catch {}

  const work = async () => {
    await db.scanEvent.create({
      data: { scanId, event: `step_${stepIndex}_received` },
    }).catch(() => null);

    try {
      const scan = await db.scan.findUnique({ where: { id: scanId } });
      if (!scan || scan.status === "FAILED" || scan.status === "COMPLETED") return;

      if (stepIndex === 0) {
        await db.scan.update({
          where: { id: scanId },
          data: { status: "RUNNING", startedAt: new Date() },
        });
      }

      const hasMore = await runCompetitorTeardownStep(scanId, stepIndex);

      if (hasMore) {
        const internalSecret = process.env.INTERNAL_SECRET ?? "nthlayer-internal-2026";
        const nextUrl = `${workerUrl}/api/jobs/run`;
        const chainResult = await fetch(nextUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
          body: JSON.stringify({ scanId, stepIndex: stepIndex + 1 }),
        }).then(r => `${r.status}`).catch(e => `ERR:${e}`);
        await db.scanEvent.create({
          data: { scanId, event: `step_${stepIndex}_chain`, metadata: { nextUrl, chainResult } },
        }).catch(() => null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await db.scan.update({ where: { id: scanId }, data: { status: "FAILED", errorMessage: message } }).catch(() => null);
      await db.scanEvent.create({ data: { scanId, event: "scan_failed", metadata: { error: message, stepIndex } } }).catch(() => null);
    }
  };

  // Register work with waitUntil so the Worker stays alive after this response is sent.
  if (cfCtx) {
    cfCtx.waitUntil(work());
  } else {
    void work();
  }

  // Return immediately — work runs in the background via waitUntil.
  return NextResponse.json({ ok: true });
}
