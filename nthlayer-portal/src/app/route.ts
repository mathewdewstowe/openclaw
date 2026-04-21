import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Authenticated users go straight to the app
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // DB unavailable — fall through to marketing page
  }

  if (user) {
    return NextResponse.redirect(new URL("/inflexion/strategy", req.url));
  }

  // Unauthenticated: redirect to marketing page (history.replaceState in new.html
  // immediately restores the / URL in the browser bar)
  return NextResponse.redirect(new URL("/new", req.url), { status: 302 });
}
