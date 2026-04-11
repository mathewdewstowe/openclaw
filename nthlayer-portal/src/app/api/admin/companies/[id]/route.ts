import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  await db.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
