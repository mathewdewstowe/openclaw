import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, notifyAdmin } from "@/lib/email";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return success — never reveal whether email exists
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = generateToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const baseUrl = process.env.WORKER_URL || "https://portal.nthlayer.co.uk";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send reset email to user
    sendEmail({
      to: user.email,
      subject: "Reset your Nth Layer password",
      text: `Hi ${user.name || ""},\n\nReset your Nth Layer password by clicking the link below. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, ignore this email.\n\n— Nth Layer`,
      html: `<p>Hi ${user.name || ""},</p><p>Reset your Nth Layer password by clicking the link below. This link expires in 1 hour.</p><p><a href="${resetUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;">Reset password</a></p><p>Or copy this link: ${resetUrl}</p><p style="color:#888;font-size:12px;">If you did not request this, ignore this email.</p>`,
    }).catch(() => {});

    // Notify admin as backup
    notifyAdmin(
      `Password reset requested: ${user.email}`,
      `Password reset requested by: ${user.email}\nReset URL (valid 1 hour): ${resetUrl}\n\nForward this link to the user if they don't receive their email.`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
