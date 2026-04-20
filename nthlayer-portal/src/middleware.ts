import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/login-form",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/waitlist",
  "/api/diagnostic/verdict",
  "/api/diagnostic/save",
  "/api/diagnostic/email",
  "/onboarding",
  "/one-pager",
];

// Exact public paths (startsWith would incorrectly open all sub-routes)
const publicExact = ["/", "/inflexion", "/new"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rewrite marketing pages to static HTML
  if (pathname === "/new") {
    return NextResponse.rewrite(new URL("/new.html", req.url));
  }

  if (pathname === "/inflexion") {
    return NextResponse.rewrite(new URL("/inflexion.html", req.url));
  }

  // Enforce HTTPS in production (Cloudflare sets x-forwarded-proto)
  if (
    process.env.NODE_ENV === "production" &&
    req.headers.get("x-forwarded-proto") === "http"
  ) {
    const httpsUrl = req.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, { status: 301 });
  }

  // Public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Exact-match public paths
  if (publicExact.includes(pathname)) {
    return NextResponse.next();
  }

  // Stripe webhook (no auth — verified by signature)
  if (pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  // Internal cron/job endpoints
  if (pathname === "/api/cron/advance-scans" || pathname === "/api/cron/fetch-news") {
    const internalSecret = process.env.INTERNAL_SECRET || "nthlayer-internal-2026";
    if (req.headers.get("x-internal-secret") === internalSecret) {
      return NextResponse.next();
    }
  }

  const token = req.cookies.get("token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
