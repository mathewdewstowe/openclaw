import { NextResponse } from "next/server";

// Disabled — phase 2
export async function POST() {
  return NextResponse.json({ ok: true, message: "Disabled — phase 2" });
}
