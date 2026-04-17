import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const ADMIN_EMAIL = "matthew@nthlayer.co.uk";
const FROM = "Nth Layer <noreply@nthlayer.co.uk>";

export async function POST(req: Request) {
  const { email, name, company, role } = await req.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!name || !company || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Upsert so duplicate submissions don't error
  const entry = await db.waitlistEntry.upsert({
    where: { email },
    update: { name, company, role },
    create: { email, name, company, role },
  });

  // Notify admin
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr>
          <td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 32px">
            <span style="font-size:13px;font-weight:700;color:#a3e635;letter-spacing:0.05em;text-transform:uppercase">Nth Layer · Inflexion Waitlist</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
            <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 20px">New waitlist signup</h2>
            <table cellpadding="0" cellspacing="0" style="width:100%">
              ${[["Name", name ?? "—"], ["Email", email], ["Company", company ?? "—"], ["Role", role ?? "—"], ["Time", new Date().toUTCString()]]
                .map(([label, value]) => `
              <tr>
                <td style="padding:8px 0;font-size:13px;font-weight:600;color:#6b7280;width:100px;vertical-align:top">${label}</td>
                <td style="padding:8px 0;font-size:13px;color:#111827">${value}</td>
              </tr>`).join("")}
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f3f4f6;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;padding:16px 32px">
            <p style="font-size:11px;color:#9ca3af;margin:0">Inflexion early waitlist · inflexion.nthlayer.co.uk</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `New Inflexion waitlist signup\n\nName: ${name ?? "—"}\nEmail: ${email}\nCompany: ${company ?? "—"}\nRole: ${role ?? "—"}\nTime: ${new Date().toUTCString()}`;

  sendEmail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `Waitlist: ${name ?? email}${company ? ` — ${company}` : ""}`,
    html,
    text,
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: entry.id });
}
