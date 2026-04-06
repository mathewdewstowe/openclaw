import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchAndStoreNewsForUser } from "@/lib/news";

// Called by cron worker daily
export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.INTERNAL_SECRET ?? "nthlayer-internal-2026")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find all users who have at least one completed competitor teardown
  const users = await db.user.findMany({
    where: {
      scans: { some: { type: "COMPETITOR_TEARDOWN", status: "COMPLETED" } },
    },
    select: { id: true },
  });

  let totalStored = 0;
  for (const user of users) {
    totalStored += await fetchAndStoreNewsForUser(user.id);
  }

  return NextResponse.json({ ok: true, stored: totalStored, users: users.length });
}
