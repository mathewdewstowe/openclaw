import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.systemRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    description?: string;
    priceMonthly?: number | null;
    entitlements?: Record<string, unknown>;
  };

  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const updated = await db.plan.update({
    where: { id },
    data: {
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.priceMonthly !== undefined ? { priceMonthly: body.priceMonthly } : {}),
      ...(body.entitlements !== undefined ? { entitlements: body.entitlements as object } : {}),
    },
  });

  return NextResponse.json({ ok: true, plan: updated });
}
