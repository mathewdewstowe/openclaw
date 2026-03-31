import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const scan = await db.scan.findFirst({
    where: { id, userId: user.id },
    include: {
      reports: { orderBy: { version: "desc" }, take: 1 },
      results: true,
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const report = scan.reports[0];
  if (!report) {
    return NextResponse.json({ error: "Report not ready" }, { status: 404 });
  }

  // Track open event
  if (!report.openedAt) {
    await db.report.update({
      where: { id: report.id },
      data: { openedAt: new Date() },
    });
    await db.scanEvent.create({
      data: { scanId: scan.id, event: "report_opened" },
    });
  }

  // Build transparency data
  const transparency = {
    inputs: {
      companyUrl: scan.companyUrl,
      companyName: scan.companyName,
      priorities: scan.priorities,
      workflow: scan.workflow,
      competitors: scan.competitors,
    },
    modules: scan.results.map((r) => ({
      module: r.module,
      confidence: r.confidence,
      durationMs: r.durationMs,
      sources: r.sources,
    })),
    mode: scan.mode,
  };

  return NextResponse.json({
    report: {
      id: report.id,
      title: report.title,
      htmlContent: report.htmlContent,
      pdfUrl: report.pdfUrl,
      version: report.version,
    },
    transparency,
  });
}
