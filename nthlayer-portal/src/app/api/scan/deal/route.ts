import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dealDDSchema } from "@/lib/validations";
import { enqueueJob } from "@/lib/jobs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = dealDDSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const scan = await db.scan.create({
    data: {
      userId: user.id,
      type: "DEAL_DD",
      companyUrl: parsed.data.companyUrl,
      investmentThesis: parsed.data.investmentThesis,
      priorities: [],
      competitors: [],
    },
  });

  await db.scanEvent.create({
    data: { scanId: scan.id, event: "scan_started", metadata: { type: "DEAL_DD" } },
  });

  await enqueueJob("runDealDDScan", { scanId: scan.id });

  return NextResponse.json({ scanId: scan.id });
}
