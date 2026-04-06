import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db.competitorNewsItem.findMany({
    where: { userId: user.id },
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take: 100,
  });

  // Group by company name
  const companies = Array.from(new Set(items.map((i) => i.companyName)));
  const grouped: Record<string, typeof items> = {};
  for (const company of companies) {
    grouped[company] = items.filter((i) => i.companyName === company);
  }

  return NextResponse.json({ grouped, total: items.length });
}
