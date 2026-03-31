import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { integration } = await req.json();
  if (!integration) {
    return NextResponse.json({ error: "Integration required" }, { status: 400 });
  }

  await db.integrationInterest.create({
    data: { email: user.email, integration },
  });

  return NextResponse.json({ ok: true });
}
