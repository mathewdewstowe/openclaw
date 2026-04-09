import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete all PRODUCT_STRATEGY scans and their data
  const scans = await db.scan.findMany({
    where: { userId: user.id, type: "PRODUCT_STRATEGY" },
    select: { id: true },
  });
  for (const s of scans) {
    await db.scanEvent.deleteMany({ where: { scanId: s.id } });
    await db.analysisResult.deleteMany({ where: { scanId: s.id } });
    await db.report.deleteMany({ where: { scanId: s.id } });
    await db.scan.delete({ where: { id: s.id } });
  }

  // Delete the company profile
  await db.companyProfile.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.companyProfile.findUnique({
    where: { userId: user.id },
  });

  // Also return the latest product strategy scan if any
  const strategyScan = await db.scan.findFirst({
    where: { userId: user.id, type: "PRODUCT_STRATEGY" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, progress: true, createdAt: true },
  });

  return NextResponse.json({ profile, strategyScan });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, url, location, icp1, icp2, icp3, territories, inflectionPoint, risks, bigBet, aiAmbition, selfWeakness, competitor1, competitor2, competitor3, competitor4, competitor5 } = body;

  // Require at least 1 non-empty competitor
  const competitorList = [competitor1, competitor2, competitor3, competitor4, competitor5]
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter(Boolean);
  if (competitorList.length < 1) {
    return NextResponse.json({ error: "At least 1 competitor is required" }, { status: 400 });
  }

  const data = { name, url, location, icp1, icp2, icp3, territories: territories ?? [], inflectionPoint, risks, bigBet, aiAmbition, selfWeakness, competitor1, competitor2, competitor3, competitor4, competitor5 };

  const profile = await db.companyProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  // Auto-trigger a Product Strategy scan if none in last 24h
  let strategyScan = null;
  if (name && url) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db.scan.findFirst({
      where: {
        userId: user.id,
        type: "PRODUCT_STRATEGY",
        createdAt: { gte: oneDayAgo },
      },
    });

    if (!recent) {
      const competitors = [competitor1, competitor2, competitor3, competitor4, competitor5].filter(Boolean);
      strategyScan = await db.scan.create({
        data: {
          userId: user.id,
          type: "PRODUCT_STRATEGY",
          companyUrl: url,
          companyName: name,
          icp: [icp1, icp2, icp3].filter(Boolean).join(" | "),
          bigBet: bigBet || null,
          aiAmbition: aiAmbition || null,
          selfWeakness: selfWeakness || null,
          inflectionPoint: inflectionPoint || null,
          risks: risks || null,
          competitors,
          priorities: [],
          status: "PENDING",
        },
      });
    } else {
      strategyScan = recent;
    }
  }

  return NextResponse.json({ profile, strategyScan });
}
