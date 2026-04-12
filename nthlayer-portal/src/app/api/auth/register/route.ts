import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { cookies } from "next/headers";
import { sendNewUserNotification } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = String(firstIssue?.path?.[0] ?? "input");
      const msg = firstIssue?.message || "Invalid input";
      return NextResponse.json(
        { error: `${field}: ${msg}` },
        { status: 400 }
      );
    }

    const { name, company, jobTitle, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { name, company, jobTitle, email, passwordHash },
    });

    // Notify matthew@nthlayer.co.uk of new signup (fire-and-forget)
    sendNewUserNotification({ name, email, company, jobTitle });

    const token = await createToken(user.id);
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
