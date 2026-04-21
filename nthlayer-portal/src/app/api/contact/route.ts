import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, company, jobtitle, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr>
          <td style="background:#111827;border-radius:12px 12px 0 0;padding:24px 32px">
            <span style="font-size:12px;font-weight:700;color:#a3e635;letter-spacing:0.08em;text-transform:uppercase">Nth Layer · New enquiry</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
            <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 24px">New contact form submission</h2>
            <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
              ${[['Name', name], ['Email', email], ['Company', company || '—'], ['Job title', jobtitle || '—']].map(([label, value]) => `
              <tr>
                <td style="padding:8px 0;font-size:13px;font-weight:600;color:#6b7280;width:110px;vertical-align:top;border-bottom:1px solid #f3f4f6">${label}</td>
                <td style="padding:8px 0;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6">${value}</td>
              </tr>`).join('')}
            </table>
            <div style="background:#f9fafb;border-left:3px solid #a3e635;padding:16px 20px;border-radius:0 6px 6px 0">
              <p style="font-size:12px;font-weight:600;color:#6b7280;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.06em">Message</p>
              <p style="font-size:14px;color:#111827;margin:0;line-height:1.6;white-space:pre-wrap">${message}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f3f4f6;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;padding:14px 32px">
            <p style="font-size:11px;color:#9ca3af;margin:0">Submitted via nthlayer.co.uk</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `New enquiry from nthlayer.co.uk\n\nName: ${name}\nEmail: ${email}\nCompany: ${company || '—'}\nJob title: ${jobtitle || '—'}\n\nMessage:\n${message}`;

    await sendEmail({
      to: 'matthew@nthlayer.co.uk',
      subject: `New enquiry: ${name}${company ? ` — ${company}` : ''}`,
      html,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
