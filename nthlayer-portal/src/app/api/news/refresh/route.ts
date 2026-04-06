import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchAndStoreNewsForUser } from "@/lib/news";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stored = await fetchAndStoreNewsForUser(user.id, true); // force = true
  return NextResponse.json({ ok: true, stored });
}
