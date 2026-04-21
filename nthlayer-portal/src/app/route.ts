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

  // Unauthenticated: proxy new.html at the clean root URL
  const assetUrl = new URL("/new.html", req.url);
  const asset = await fetch(assetUrl.toString());

  if (!asset.ok) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(asset.body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
