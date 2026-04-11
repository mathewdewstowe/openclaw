import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCompany } from "@/lib/entitlements";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hasAccess = await canAccessCompany(user.id, id);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await db.company.findUnique({
    where: { id },
    include: {
      _count: { select: { jobs: true, outputs: true, competitors: true } },
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ company });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hasAccess = await canAccessCompany(user.id, id);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, url, sector, location, description, profile } = body;

  const company = await db.company.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(sector !== undefined && { sector }),
      ...(location !== undefined && { location }),
      ...(description !== undefined && { description }),
      ...(profile !== undefined && { profile }),
    },
  });

  return NextResponse.json({ company });
}
