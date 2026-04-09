import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { selfScanSchema } from "@/lib/validations";
import { enqueueJob } from "@/lib/jobs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = selfScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { companyUrl, icp, priorities, bigBet, aiAmbition, competitors, selfWeakness } = parsed.data;

  const scan = await db.scan.create({
    data: {
      userId: user.id,
      type: "SELF_SCAN",
      companyUrl,
      icp,
      priorities,
      bigBet,
      aiAmbition,
      competitors,
      selfWeakness,
    },
  });

  await db.scanEvent.create({
    data: { scanId: scan.id, event: "scan_started", metadata: { type: "SELF_SCAN" } },
  });

  await enqueueJob("runSelfScan", { scanId: scan.id });

  return NextResponse.json({ scanId: scan.id });
}
