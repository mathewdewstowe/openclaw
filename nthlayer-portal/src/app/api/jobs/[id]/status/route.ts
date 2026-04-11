import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkAgentSession } from "@/lib/agents/check-session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await db.job.findUnique({
    where: { id },
    select: { status: true, progress: true, outputId: true, errorMessage: true },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Advance the agent on each poll (short operation ~1s)
  if (job.status === "running" || job.status === "pending") {
    await checkAgentSession(id).catch(console.error);
    // Re-fetch after potential update
    const updated = await db.job.findUnique({
      where: { id },
      select: { status: true, progress: true, outputId: true, errorMessage: true },
    });
    return NextResponse.json(updated ?? job);
  }

  return NextResponse.json(job);
}
