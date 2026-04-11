import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runningJobs = await db.job.findMany({
    where: { userId: user.id, status: "running" },
    select: { id: true, workflowType: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const jobs = runningJobs.map((j) => ({
    id: j.id,
    stageId: j.workflowType,
    sessionId: (j.metadata as Record<string, unknown> | null)?.sessionId as string | undefined,
    startedAt: j.createdAt,
  }));

  return NextResponse.json({ jobs });
}
