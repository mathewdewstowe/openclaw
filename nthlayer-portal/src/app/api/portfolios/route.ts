import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/entitlements";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.access_portfolio) {
    return NextResponse.json({ error: "Portfolio access requires an upgrade" }, { status: 403 });
  }

  const portfolios = await db.portfolio.findMany({
    where: { createdById: user.id },
    include: {
      companies: {
        select: { id: true, name: true, sector: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ portfolios });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.access_portfolio) {
    return NextResponse.json({ error: "Portfolio access requires an upgrade" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description } = body as { name?: string; description?: string };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const portfolio = await db.portfolio.create({
    data: {
      name: name.trim(),
      description: description?.trim() ?? null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ portfolio }, { status: 201 });
}
