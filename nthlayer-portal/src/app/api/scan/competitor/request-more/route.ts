import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdmin } from "@/lib/email";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await db.scan.count({
    where: { userId: user.id, type: "COMPETITOR_TEARDOWN" },
  });

  notifyAdmin(
    `Teardown limit request: ${user.name || user.email}`,
    `A user has requested more competitor teardowns.\n\nName: ${user.name || "—"}\nEmail: ${user.email}\nCompany: ${user.company || "—"}\nJob title: ${user.jobTitle || "—"}\nCurrent teardown count: ${count}\nTime: ${new Date().toISOString()}`
  );

  return NextResponse.json({ ok: true });
}
