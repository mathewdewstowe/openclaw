import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { inflectionScanSchema } from "@/lib/validations";
import { enqueueJob } from "@/lib/jobs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = inflectionScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { companyUrl, companyName, priorities, workflow, competitors } = parsed.data;

  const scan = await db.scan.create({
    data: {
      userId: user.id,
      type: "INFLECTION",
      companyUrl,
      companyName,
      priorities,
      workflow,
      competitors,
    },
  });

  await db.scanEvent.create({
    data: { scanId: scan.id, event: "scan_started", metadata: { type: "INFLECTION" } },
  });

  await enqueueJob("runInflectionScan", { scanId: scan.id });

  return NextResponse.json({ scanId: scan.id });
}
