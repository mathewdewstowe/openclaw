import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createToken } from "@/lib/auth";

// Handles native form POST — sets cookie via server-side redirect so
// iOS Safari stores the cookie without any JS/fetch timing issues.
export async function POST(req: NextRequest) {
  try {
    let email = "";
    let password = "";

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      email = (formData.get("email") as string | null)?.trim() ?? "";
      password = (formData.get("password") as string | null) ?? "";
    } else {
      const body = await req.json().catch(() => ({})) as { email?: string; password?: string };
      email = body.email?.trim() ?? "";
      password = body.password ?? "";
    }

    if (!email || !password) {
      return NextResponse.redirect(new URL("/login?error=Please+enter+your+email+and+password", req.url));
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.redirect(new URL("/login?error=Invalid+credentials", req.url));
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.redirect(new URL("/login?error=Invalid+credentials", req.url));
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = await createToken(user.id);

    const maxAge = 60 * 60 * 24 * 7;
    const cookieStr = [
      `token=${token}`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
      `Max-Age=${maxAge}`,
      `Path=/`,
    ].join("; ");

    // Return an HTML page that sets the cookie and uses meta-refresh (GET)
    // to navigate to the app. This avoids 307 POST-preservation issues on iOS Safari.
    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=/inflexion/overview">
</head><body>Signing in...</body></html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": cookieStr,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Login form error:", error);
    return NextResponse.redirect(new URL("/login?error=Something+went+wrong", req.url));
  }
}
