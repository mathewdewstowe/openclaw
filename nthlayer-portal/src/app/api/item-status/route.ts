import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";

// GET /api/item-status?companyId=xxx  — fetch all statuses for a company
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  // Verify user has access to this company
  const access = await getUserCompanies(user.id);
  if (!access.some((a) => a.company.id === companyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statuses = await db.itemStatus.findMany({
    where: { companyId },
    select: { outputId: true, itemType: true, itemIndex: true, status: true, updatedAt: true },
  });

  return NextResponse.json({ statuses });
}

// PATCH /api/item-status  — create or update a single item status
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    outputId: string;
    companyId: string;
    itemType: string;
    itemIndex: number;
    status: string;
  };

  const { outputId, companyId, itemType, itemIndex, status } = body;
  if (!outputId || !companyId || !itemType || itemIndex === undefined || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify user has access to this company
  const access = await getUserCompanies(user.id);
  if (!access.some((a) => a.company.id === companyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.itemStatus.upsert({
    where: { outputId_itemType_itemIndex: { outputId, itemType, itemIndex } },
    create: { outputId, companyId, itemType, itemIndex, status, updatedBy: user.id },
    update: { status, updatedBy: user.id },
  });

  return NextResponse.json({ status: updated.status });
}
