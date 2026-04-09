import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the user's company profile
  const profile = await db.companyProfile.findUnique({ where: { userId: user.id } });
  if (!profile || !profile.name || !profile.url) {
    return NextResponse.json({ error: "Complete your company profile first" }, { status: 400 });
  }

  // Delete all existing PRODUCT_STRATEGY scans and their data for this user
  const oldScans = await db.scan.findMany({
    where: { userId: user.id, type: "PRODUCT_STRATEGY" },
    select: { id: true },
  });
  for (const s of oldScans) {
    await db.scanEvent.deleteMany({ where: { scanId: s.id } });
    await db.analysisResult.deleteMany({ where: { scanId: s.id } });
    await db.report.deleteMany({ where: { scanId: s.id } });
    await db.scan.delete({ where: { id: s.id } });
  }

  // Create a fresh scan
  const competitors = [
    profile.competitor1,
    profile.competitor2,
    profile.competitor3,
    profile.competitor4,
    profile.competitor5,
  ].filter((c): c is string => Boolean(c));

  const strategyScan = await db.scan.create({
    data: {
      userId: user.id,
      type: "PRODUCT_STRATEGY",
      companyUrl: profile.url,
      companyName: profile.name,
      icp: [profile.icp1, profile.icp2, profile.icp3].filter(Boolean).join(" | "),
      bigBet: profile.bigBet || null,
      aiAmbition: profile.aiAmbition || null,
      selfWeakness: profile.selfWeakness || null,
      inflectionPoint: profile.inflectionPoint || null,
      risks: profile.risks || null,
      competitors,
      priorities: [],
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, strategyScan });
}
