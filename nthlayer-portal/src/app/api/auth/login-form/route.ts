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
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=/inflexion/strategy">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:20px}
    .logo{width:44px;height:44px;background:#111827;border-radius:10px;display:flex;align-items:center;justify-content:center}
    .spinner{width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#111827;border-radius:50%;animation:spin .7s linear infinite}
    .label{font-size:14px;color:#6b7280;font-weight:500}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3e635" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"/>
      </svg>
    </div>
    <div class="spinner"></div>
    <p class="label">Signing in…</p>
  </div>
</body>
</html>`;

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
