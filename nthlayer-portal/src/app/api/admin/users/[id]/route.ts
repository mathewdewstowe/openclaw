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

  // Prevent self-deletion
  if (id === user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Prevent deleting other super_admins unless you are super_admin
  const target = await db.user.findUnique({ where: { id }, select: { systemRole: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.systemRole === "super_admin" && user.systemRole !== "super_admin") {
    return NextResponse.json({ error: "Cannot delete a super admin" }, { status: 403 });
  }

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { planId } = body;

  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db.user.update({ where: { id }, data: { planId } });
  return NextResponse.json({ ok: true });
}
