import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createToken } from "@/lib/auth";

// Handles native form POST — validates credentials, sets a shared-domain
// cookie, and redirects to the transformation app on inflexion.nthlayer.co.uk.
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

    // Redirect to the transformation app after login.
    // Domain=.nthlayer.co.uk covers both the portal and inflexion subdomain.
    const res = NextResponse.redirect(
      "https://inflexion.nthlayer.co.uk/transformation/inflexion/overview",
      { status: 302 }
    );
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      domain: ".nthlayer.co.uk",
    });
    return res;
  } catch (error) {
    console.error("Login form error:", error);
    return NextResponse.redirect(new URL("/login?error=Something+went+wrong", req.url));
  }
}
