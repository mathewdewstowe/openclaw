import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { competitorTeardownSchema } from "@/lib/validations";
import { enqueueJob } from "@/lib/jobs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = competitorTeardownSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const scan = await db.scan.create({
    data: {
      userId: user.id,
      type: "COMPETITOR_TEARDOWN",
      companyUrl: parsed.data.companyUrl,
      priorities: [],
      competitors: [],
    },
  });

  await db.scanEvent.create({
    data: { scanId: scan.id, event: "scan_started", metadata: { type: "COMPETITOR_TEARDOWN" } },
  });

  await enqueueJob("runCompetitorTeardown", { scanId: scan.id });

  return NextResponse.json({ scanId: scan.id });
}
