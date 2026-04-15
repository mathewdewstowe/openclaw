import { NextResponse } from "next/server";

// Disabled — phase 2
export async function POST() {
  return NextResponse.json({ error: "Coming soon — phase 2" }, { status: 503 });
}
