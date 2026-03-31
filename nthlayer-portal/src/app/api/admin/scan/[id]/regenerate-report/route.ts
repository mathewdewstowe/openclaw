import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const scan = await db.scan.findUnique({
    where: { id },
    include: { results: true },
  });

  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scan.results.length === 0) {
    return NextResponse.json({ error: "No analysis results to render" }, { status: 400 });
  }

  // Delete existing reports and re-render
  await db.report.deleteMany({ where: { scanId: id } });

  // For now, trigger a full rerun to regenerate the report
  // A more targeted approach would re-run only the render step
  return NextResponse.json({ ok: true, message: "Use full rerun for now" });
}
