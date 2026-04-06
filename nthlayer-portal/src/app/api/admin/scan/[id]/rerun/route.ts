import { after } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";
import { runCompetitorTeardownStep } from "@/lib/pipeline/competitor-teardown";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const scan = await db.scan.findUnique({ where: { id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.analysisResult.deleteMany({ where: { scanId: id } });
  await db.report.deleteMany({ where: { scanId: id } });
  await db.scanEvent.deleteMany({ where: { scanId: id, event: { startsWith: "pipeline_advance_" } } });
  await db.scan.update({
    where: { id },
    data: { status: "PENDING", progress: 0, startedAt: null, completedAt: null, errorMessage: null },
  });

  if (scan.type === "COMPETITOR_TEARDOWN") {
    const scanId = id;
    after(async () => {
      try {
        await db.scan.update({ where: { id: scanId }, data: { status: "RUNNING", startedAt: new Date() } });
        await runCompetitorTeardownStep(scanId, 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await db.scanEvent.create({ data: { scanId, event: "step_0_error", metadata: { error: message } } }).catch(() => null);
      }
    });
  } else {
    const jobType = scan.type === "INFLECTION" ? "runInflectionScan" : "runDealDDScan";
    await enqueueJob(jobType, { scanId: id });
  }

  return NextResponse.json({ ok: true });
}
