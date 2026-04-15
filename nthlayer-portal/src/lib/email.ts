const ADMIN_EMAIL = "matthew@nthlayer.co.uk";
const FROM = "Nth Layer <noreply@nthlayer.co.uk>";
const BASE_URL = "https://inflexion.nthlayer.co.uk";

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
 * Send welcome email to new user + admin notification.
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
  const appUrl = `${BASE_URL}/inflexion/overview`;

  // Welcome email to new user
  const welcomeHtml = baseTemplate(`
    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px">Welcome to Inflexion, ${name}</h2>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px">Your account is set up and ready. Inflexion runs your strategy end-to-end — from framing the problem to committing to a plan.</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #a3e635;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 6px">Get started in 3 steps</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px">1. Complete your company profile</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px">2. Run the Frame stage to define the strategic problem</p>
      <p style="font-size:13px;color:#6b7280;margin:0">3. Work through each stage to build your full strategy</p>
    </div>

    <a href="${appUrl}" style="display:inline-block;background:#111827;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">Open Inflexion →</a>

    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0">If you have any questions, just reply to this email.</p>
  `);
  const welcomeText = `Welcome to Inflexion, ${name}!\n\nYour account is ready. Open the app here: ${appUrl}\n\nNth Layer Inflexion`;

  sendEmail({
    to: email,
    subject: `Welcome to Inflexion, ${name}`,
    html: welcomeHtml,
    text: welcomeText,
  }).catch(() => {});

  // Admin notification
  const adminText = `New user registered on Nth Layer Inflexion.\n\nName: ${name}\nEmail: ${email}\nCompany: ${company ?? "—"}\nJob Title: ${jobTitle ?? "—"}\nTime: ${new Date().toUTCString()}`;
  const adminHtml = baseTemplate(`
    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 20px">New user signed up</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%">
      ${[["Name", name], ["Email", email], ["Company", company ?? "—"], ["Job Title", jobTitle ?? "—"], ["Time", new Date().toUTCString()]].map(([label, value]) => `
      <tr>
        <td style="padding:8px 0;font-size:13px;font-weight:600;color:#6b7280;width:120px;vertical-align:top">${label}</td>
        <td style="padding:8px 0;font-size:13px;color:#111827">${value}</td>
      </tr>`).join("")}
    </table>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6">
      <a href="${BASE_URL}/inflexion/admin/users" style="display:inline-block;background:#111827;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View in Admin</a>
    </div>
  `);

  return sendEmail({ to: ADMIN_EMAIL, subject: `New signup: ${name} — ${company ?? email}`, html: adminHtml, text: adminText }).catch(() => {});
}

const STAGE_NAMES: Record<string, string> = {
  frame: "Frame", diagnose: "Diagnose", decide: "Decide", position: "Position", bet: "Bet", commit: "Commit",
};

/**
 * Send notification when a strategy report completes (to user, BCC admin).
 */
export function sendReportCompleteNotification({
  userName,
  userEmail,
  companyName,
  workflowType,
  counts,
}: {
  userName: string;
  userEmail: string;
  companyName: string;
  workflowType: string;
  counts?: { actions: number; risks: number; assumptions: number; metrics: number };
}) {
  const stageName = STAGE_NAMES[workflowType] ?? workflowType.charAt(0).toUpperCase() + workflowType.slice(1);
  const subject = `Your ${stageName} report is ready — ${companyName}`;
  const reportUrl = `${BASE_URL}/inflexion/strategy`;

  // Build counts summary
  const countParts: string[] = [];
  if (counts?.actions) countParts.push(`${counts.actions} Action${counts.actions > 1 ? "s" : ""}`);
  if (counts?.risks) countParts.push(`${counts.risks} Risk${counts.risks > 1 ? "s" : ""}`);
  if (counts?.assumptions) countParts.push(`${counts.assumptions} Assumption${counts.assumptions > 1 ? "s" : ""}`);
  if (counts?.metrics) countParts.push(`${counts.metrics} Metric${counts.metrics > 1 ? "s" : ""}`);
  const totalItems = (counts?.actions ?? 0) + (counts?.risks ?? 0) + (counts?.assumptions ?? 0) + (counts?.metrics ?? 0);
  const countsSummary = countParts.join(" · ");

  const text = `Hi ${userName},\n\nYour ${stageName} strategy report for ${companyName} is ready.${totalItems > 0 ? `\n\nThis report generated ${totalItems} items for you to review: ${countsSummary}.` : ""}\n\nIMPORTANT — Please accept or reject each Action, Risk, Assumption, and Metric in this report before moving to the next stage.\n\n• ACCEPT = this item is relevant and accurate — it will be reinforced in future reports\n• REJECT = this item is off-base or irrelevant — the system learns to deprioritise similar items\n\nWithout your feedback, the system can't distinguish signal from noise. Every accept or reject you give directly improves the quality of every subsequent report.\n\nThis takes 2 minutes.\n\nOpen your report: ${reportUrl}\n\nNth Layer Inflexion`;

  // Build count badges HTML
  const countBadgesHtml = countParts.length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 20px">
        ${countParts.map((p) => `<span style="display:inline-block;background:rgba(163,230,53,0.15);color:#a3e635;font-size:13px;font-weight:700;padding:6px 14px;border-radius:6px">${p}</span>`).join("")}
      </div>`
    : "";

  const html = baseTemplate(`
    <h2 style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px">Your ${stageName} report is ready</h2>
    <p style="font-size:14px;color:#6b7280;margin:0 0 28px">Hi ${userName}, your strategy report for <strong style="color:#111827">${companyName}</strong> has finished generating.${totalItems > 0 ? ` This report generated <strong style="color:#111827">${totalItems} items</strong> for you to review.` : ""}</p>

    <!-- Action call-out — prominent -->
    <div style="background:#111827;border-radius:10px;padding:24px 28px;margin-bottom:24px">
      <p style="font-size:11px;font-weight:700;color:#a3e635;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px">Action required</p>
      <p style="font-size:18px;font-weight:700;color:#ffffff;margin:0 0 4px;line-height:1.4">Accept or reject each item in this report</p>
      <p style="font-size:14px;color:#d1d5db;margin:0 0 4px">Review every Action, Risk, Assumption, and Metric below.</p>
      ${countBadgesHtml}

      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px">
        <tr>
          <td style="padding:10px 14px;background:rgba(163,230,53,0.1);border-radius:6px 6px 0 0;border-bottom:1px solid rgba(255,255,255,0.08)">
            <p style="font-size:13px;font-weight:700;color:#a3e635;margin:0 0 4px">✓ Accept</p>
            <p style="font-size:13px;color:#d1d5db;margin:0;line-height:1.5">This item is relevant and accurate. Accepting reinforces similar analysis in future reports — the system learns what matters to your business.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:0 0 6px 6px">
            <p style="font-size:13px;font-weight:700;color:#f87171;margin:0 0 4px">✗ Reject</p>
            <p style="font-size:13px;color:#d1d5db;margin:0;line-height:1.5">This item is off-base or irrelevant. Rejecting teaches the system to deprioritise similar items — so future reports focus on what actually matters.</p>
          </td>
        </tr>
      </table>

      <p style="font-size:14px;color:#d1d5db;margin:0 0 8px;line-height:1.6">This takes 2 minutes — and it's the most valuable thing you can do right now. Every accept or reject you give trains the system to understand your business better.</p>
      <p style="font-size:13px;color:#9ca3af;margin:0;line-height:1.5">Without your feedback, the system can't distinguish signal from noise. Your input is what makes the analysis improve over time.</p>
    </div>

    <a href="${reportUrl}" style="display:inline-block;background:#a3e635;color:#111827;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px">Review your ${stageName} report →</a>

    <p style="font-size:12px;color:#9ca3af;margin:0">Generated for ${companyName} · Nth Layer Inflexion</p>
  `);

  sendEmail({
    to: userEmail,
    bcc: ADMIN_EMAIL,
    subject,
    html,
    text,
  }).catch(() => {});
}
