import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const output = await db.output.findUnique({
    where: { id },
    include: {
      company: { select: { name: true } },
      job: { select: { id: true, status: true, progress: true } },
    },
  });

  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ output });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const output = await db.output.findUnique({
    where: { id },
    include: { company: { select: { createdById: true } } },
  });

  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (output.company.createdById !== user.id && user.systemRole !== "super_admin" && user.systemRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.output.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
