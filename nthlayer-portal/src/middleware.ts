import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/onboarding",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
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
