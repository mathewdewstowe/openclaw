import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const scan = await db.scan.findFirst({
    where: { id, userId: user.id },
    include: { results: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // Return raw outputs keyed by module name
  const data: Record<string, unknown> = {};
  for (const r of scan.results) {
    data[r.module] = r.output;
  }

  return NextResponse.json({ scanId: scan.id, type: scan.type, status: scan.status, data });
}
