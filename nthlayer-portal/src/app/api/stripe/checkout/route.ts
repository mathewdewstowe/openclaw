import { NextResponse } from "next/server";

// Payment gateway is currently disabled.
export async function POST() {
  return NextResponse.json({ error: "Payments are not currently enabled." }, { status: 503 });
}
