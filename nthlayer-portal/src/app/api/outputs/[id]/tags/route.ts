import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const output = await db.output.findUnique({
    where: { id },
    select: { id: true, tags: true, companyId: true },
  });

  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify user has access to this output's company
  const access = await db.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: output.companyId } },
  });
  if (!access && user.systemRole !== "super_admin" && user.systemRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ tags: output.tags });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("tags" in body) ||
    !Array.isArray((body as Record<string, unknown>).tags) ||
    !(body as Record<string, unknown[]>).tags.every((t) => typeof t === "string")
  ) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }

  const tags = (body as { tags: string[] }).tags;

  const output = await db.output.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });

  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify user has access to this output's company
  const access = await db.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: output.companyId } },
  });
  if (!access && user.systemRole !== "super_admin" && user.systemRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.output.update({
    where: { id },
    data: { tags },
    select: { id: true, tags: true },
  });

  return NextResponse.json({ tags: updated.tags });
}
