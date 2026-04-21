import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const ADMIN_EMAIL = "matthew@nthlayer.co.uk";
const FROM = "Nth Layer <noreply@nthlayer.co.uk>";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr>
          <td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 32px">
            <span style="font-size:13px;font-weight:700;color:#39ff7a;letter-spacing:0.05em;text-transform:uppercase">Nth Layer · Diagnostic Lead</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
            <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 20px">Someone started the diagnostic</h2>
            <table cellpadding="0" cellspacing="0" style="width:100%">
              <tr>
                <td style="padding:8px 0;font-size:13px;font-weight:600;color:#6b7280;width:80px;vertical-align:top">Email</td>
                <td style="padding:8px 0;font-size:13px;color:#111827"><a href="mailto:${email}" style="color:#111827">${email}</a></td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;font-weight:600;color:#6b7280;vertical-align:top">Time</td>
                <td style="padding:8px 0;font-size:13px;color:#111827">${new Date().toUTCString()}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f3f4f6;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;padding:16px 32px">
            <p style="font-size:11px;color:#9ca3af;margin:0">Quick Diagnostic · nthlayer.co.uk</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    sendEmail({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `Diagnostic lead: ${email}`,
      html,
      text: `Someone started the diagnostic\n\nEmail: ${email}\nTime: ${new Date().toUTCString()}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never error to the user
  }
}
