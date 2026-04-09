import { after } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { competitorTeardownSchema } from "@/lib/validations";
import { runCompetitorTeardownStep } from "@/lib/pipeline/competitor-teardown";

const MAX_TEARDOWNS = 3;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await db.scan.count({
    where: { userId: user.id, type: "COMPETITOR_TEARDOWN" },
  });
  const isAdmin = user.role === "ADMIN";

  return NextResponse.json({
    count,
    max: MAX_TEARDOWNS,
    limitReached: !isAdmin && count >= MAX_TEARDOWNS,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce limit: max 3 competitor teardowns per user (admins exempt)
  if (user.role !== "ADMIN") {
    const count = await db.scan.count({
      where: { userId: user.id, type: "COMPETITOR_TEARDOWN" },
    });
    if (count >= MAX_TEARDOWNS) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", message: `You've reached your limit of ${MAX_TEARDOWNS} competitor teardowns.`, count, max: MAX_TEARDOWNS },
        { status: 403 }
      );
    }
  }

  const body = await req.json();
  const parsed = competitorTeardownSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { companyName, companyUrl, userQuestion } = parsed.data;

  const scan = await db.scan.create({
    data: {
      userId: user.id,
      type: "COMPETITOR_TEARDOWN",
      companyName,
      companyUrl,
      userQuestion,
      priorities: [],
      competitors: [],
    },
  });

  await db.scanEvent.create({
    data: { scanId: scan.id, event: "scan_started", metadata: { type: "COMPETITOR_TEARDOWN" } },
  });

  // Kick off step 0 immediately in background (fits in 30s Worker budget)
  // Cron worker handles steps 1-10 every 60s
  const scanId = scan.id;
  after(async () => {
    try {
      await db.scan.update({ where: { id: scanId }, data: { status: "RUNNING", startedAt: new Date() } });
      await runCompetitorTeardownStep(scanId, 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await db.scanEvent.create({ data: { scanId, event: "step_0_error", metadata: { error: message } } }).catch(() => null);
    }
  });

  return NextResponse.json({ scanId: scan.id });
}
