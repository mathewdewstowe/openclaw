import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { planId } = await req.json() as { planId: string };

  if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

  // Get all users linked to this company
  const accesses = await db.userCompanyAccess.findMany({
    where: { companyId: id },
    select: { userId: true },
  });

  if (accesses.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const userIds = accesses.map((a) => a.userId);

  await db.user.updateMany({
    where: { id: { in: userIds } },
    data: { planId },
  });

  return NextResponse.json({ ok: true, updated: userIds.length });
}
