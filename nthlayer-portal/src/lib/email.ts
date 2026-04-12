const ADMIN_EMAIL = "matthew@nthlayer.co.uk";
const FROM = "Nth Layer <noreply@nthlayer.co.uk>";

/**
 * Send email via Resend API (raw fetch — works on Cloudflare Workers).
 */
export async function sendEmail({
  to,
  bcc,
  subject,
  html,
  text,
  from = FROM,
}: {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY not set — email not sent");
    return;
  }

  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (bcc) body.bcc = Array.isArray(bcc) ? bcc : [bcc];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[email] Resend error ${res.status}: ${err}`);
  }
}

/** Fire-and-forget admin notification */
export function notifyAdmin(subject: string, text: string) {
  sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html: `<pre style="font-family:sans-serif;font-size:14px;color:#111">${text}</pre>`,
    text,
  }).catch(() => {});
}

// ─── HTML email templates ─────────────────────────────────────

function baseTemplate(content: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 32px">
            <span style="font-size:13px;font-weight:700;color:#a3e635;letter-spacing:0.05em;text-transform:uppercase">Nth Layer · Inflexion</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;padding:16px 32px">
            <p style="font-size:11px;color:#9ca3af;margin:0">You're receiving this from the Nth Layer Inflexion platform. Questions? Reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send notification when a new user signs up (to admin).
 */
export function sendNewUserNotification({
  name,
  email,
  company,
  jobTitle,
}: {
  name: string;
  email: string;
  company?: string;
  jobTitle?: string;
}) {
  const text = `New user registered on Nth Layer Inflexion.\n\nName: ${name}\nEmail: ${email}\nCompany: ${company ?? "—"}\nJob Title: ${jobTitle ?? "—"}\nTime: ${new Date().toUTCString()}`;
  const html = baseTemplate(`
    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 20px">New user signed up</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%">
      ${[["Name", name], ["Email", email], ["Company", company ?? "—"], ["Job Title", jobTitle ?? "—"], ["Time", new Date().toUTCString()]].map(([label, value]) => `
      <tr>
        <td style="padding:8px 0;font-size:13px;font-weight:600;color:#6b7280;width:120px;vertical-align:top">${label}</td>
        <td style="padding:8px 0;font-size:13px;color:#111827">${value}</td>
      </tr>`).join("")}
    </table>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6">
      <a href="https://portal.nthlayer.co.uk/inflexion/admin/users" style="display:inline-block;background:#111827;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View in Admin</a>
    </div>
  `);

  sendEmail({ to: ADMIN_EMAIL, subject: `New signup: ${name} — ${company ?? email}`, html, text }).catch(() => {});
}

const STAGE_NAMES: Record<string, string> = {
  frame: "Frame", diagnose: "Diagnose", decide: "Decide", position: "Position", commit: "Commit",
};

/**
 * Send notification when a strategy report completes (to user, BCC admin).
 */
export function sendReportCompleteNotification({
  userName,
  userEmail,
  companyName,
  workflowType,
}: {
  userName: string;
  userEmail: string;
  companyName: string;
  workflowType: string;
}) {
  const stageName = STAGE_NAMES[workflowType] ?? workflowType.charAt(0).toUpperCase() + workflowType.slice(1);
  const subject = `Your ${stageName} report is ready — ${companyName}`;
  const reportUrl = "https://portal.nthlayer.co.uk/inflexion/strategy";

  const text = `Hi ${userName},\n\nYour ${stageName} strategy report for ${companyName} has completed and is ready to view.\n\nOpen your report: ${reportUrl}\n\nNth Layer Inflexion`;

  const html = baseTemplate(`
    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px">Your ${stageName} report is ready</h2>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px">Hi ${userName}, your strategy report for <strong style="color:#111827">${companyName}</strong> has finished generating.</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #111827;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 4px">${stageName} Report</p>
      <p style="font-size:13px;color:#6b7280;margin:0">Ready to view in Inflexion</p>
    </div>

    <a href="${reportUrl}" style="display:inline-block;background:#111827;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">View Report →</a>

    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0">This report was generated for ${companyName} on the Nth Layer Inflexion platform.</p>
  `);

  sendEmail({
    to: userEmail,
    bcc: ADMIN_EMAIL,
    subject,
    html,
    text,
  }).catch(() => {});
}
