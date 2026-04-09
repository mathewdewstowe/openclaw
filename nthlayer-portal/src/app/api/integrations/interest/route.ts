import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { email, integration } = await req.json();
  if (!email || !integration) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await db.integrationInterest.create({ data: { email, integration } });
  return NextResponse.json({ ok: true });
}
