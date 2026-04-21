import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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

  // Unauthenticated: serve new.html directly from the Cloudflare ASSETS binding
  const { env } = await getCloudflareContext({ async: true });

  if (env.ASSETS) {
    const assetReq = new Request(new URL("/new.html", req.url).toString());
    const res = await env.ASSETS.fetch(assetReq);
    if (res.ok) {
      return new Response(res.body, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=0, must-revalidate",
        },
      });
    }
  }

  // Fallback: redirect to /new
  return NextResponse.redirect(new URL("/new", req.url));
}
