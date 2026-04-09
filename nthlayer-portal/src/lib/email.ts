/**
 * Send email via Resend API.
 * API key is stored as a Cloudflare secret (RESEND_API_KEY).
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  from = "Nth Layer Portal <portal@nthlayer.co.uk>",
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set — email not sent");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend error: ${res.status} ${err}`);
  }
}

/**
 * Notify matthew@nthlayer.co.uk about something (fire-and-forget).
 */
export function notifyAdmin(subject: string, text: string) {
  sendEmail({
    to: "matthew@nthlayer.co.uk",
    subject,
    text,
  }).catch(() => {});
}
