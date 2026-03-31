import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";

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

  // Reset scan
  await db.analysisResult.deleteMany({ where: { scanId: id } });
  await db.report.deleteMany({ where: { scanId: id } });
  await db.scan.update({
    where: { id },
    data: {
      status: "PENDING",
      progress: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    },
  });

  const jobType = scan.type === "INFLECTION"
    ? "runInflectionScan"
    : scan.type === "COMPETITOR_TEARDOWN"
    ? "runCompetitorTeardown"
    : "runDealDDScan";

  await enqueueJob(jobType as "runInflectionScan" | "runCompetitorTeardown" | "runDealDDScan", { scanId: id });

  return NextResponse.json({ ok: true });
}
