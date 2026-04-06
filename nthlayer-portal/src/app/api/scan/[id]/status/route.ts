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
      reports: { select: { id: true }, take: 1 },
      events: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: scan.id,
    type: scan.type,
    status: scan.status,
    progress: scan.progress,
    currentStep: scan.events[scan.events.length - 1]?.event,
    events: scan.events.map((e) => ({
      event: e.event,
      createdAt: e.createdAt,
      metadata: e.metadata,
    })),
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
    errorMessage: scan.errorMessage,
    report: scan.reports[0] ? { id: scan.reports[0].id } : null,
  });
}
