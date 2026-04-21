import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { DiagnosticScores } from '@/lib/diagnostic/scoring';

const BASE_URL = 'https://inflexion.nthlayer.co.uk';

function scoreBar(score: number): string {
  const filled = Math.round(score / 2);
  const empty = 5 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function diagnosticEmailHtml(
  scores: DiagnosticScores,
  verdict: Record<string, string>,
  diagnosticId: string,
) {
  const registrationUrl = `${BASE_URL}/register?diagnostic_id=${diagnosticId}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
        <tr>
          <td style="padding:0 0 24px">
            <span style="font-size:11px;font-weight:700;color:#39ff7a;letter-spacing:0.12em;text-transform:uppercase">Nth Layer · Inflexion</span>
          </td>
        </tr>
        <tr>
          <td style="background:#111;border:1px solid rgba(57,255,122,0.2);padding:40px 40px 32px">
            <p style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#39ff7a;margin:0 0 16px">Your AI readiness diagnostic</p>
            <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 28px;line-height:1.3;letter-spacing:-0.02em">${verdict.headline}</h1>

            <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px">
              ${[
                { label: 'PRODUCT', score: scores.product, line: verdict.product_line },
                { label: 'PEOPLE', score: scores.people, line: verdict.people_line },
                { label: 'PROCESS', score: scores.process, line: verdict.process_line },
              ]
                .map(
                  d => `
              <tr>
                <td style="padding:0 0 20px">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span style="font-size:9px;font-weight:700;letter-spacing:0.14em;color:#39ff7a;text-transform:uppercase">${d.label}</span>
                    <span style="font-size:9px;font-weight:700;color:#39ff7a">${d.score}/10</span>
                  </div>
                  <div style="height:2px;background:#222;border-radius:2px;margin-bottom:8px">
                    <div style="height:2px;background:#39ff7a;border-radius:2px;width:${d.score * 10}%"></div>
                  </div>
                  <p style="font-size:13px;color:#888;margin:0;line-height:1.5">${d.line}</p>
                </td>
              </tr>`,
                )
                .join('')}
            </table>

            <div style="border-top:1px solid #222;padding-top:20px;margin-bottom:28px">
              <p style="font-size:13px;color:#aaa;font-style:italic;margin:0;line-height:1.6">${verdict.cta_hook}</p>
            </div>

            <a href="${registrationUrl}" style="display:inline-block;background:#39ff7a;color:#0a0a0a;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:14px 28px;text-decoration:none;box-shadow:0 0 20px rgba(57,255,122,0.4)">Start the full assessment →</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 0">
            <p style="font-size:11px;color:#333;margin:0;line-height:1.6">You're receiving this because you completed the Nth Layer quick diagnostic. Questions? Reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      email,
      scores,
      verdict,
      diagnosticId: existingId,
    }: {
      email: string;
      scores: DiagnosticScores;
      verdict: Record<string, string>;
      diagnosticId?: string;
    } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Upsert: update existing record with email, or create new
    let diagnosticId = existingId;
    if (existingId) {
      await prisma.diagnostic.update({
        where: { id: existingId },
        data: { email },
      });
    } else {
      const diagnostic = await prisma.diagnostic.create({
        data: {
          productScore: scores.product,
          peopleScore: scores.people,
          processScore: scores.process,
          answers: scores.answers as object[],
          verdict: verdict as object,
          email,
        },
      });
      diagnosticId = diagnostic.id;
    }

    const registrationUrl = `${BASE_URL}/register?diagnostic_id=${diagnosticId}`;

    const html = diagnosticEmailHtml(scores, verdict, diagnosticId!);
    const text = `Your AI readiness diagnostic\n\n${verdict.headline}\n\nPRODUCT: ${scores.product}/10\n${verdict.product_line}\n\nPEOPLE: ${scores.people}/10\n${verdict.people_line}\n\nPROCESS: ${scores.process}/10\n${verdict.process_line}\n\n${verdict.cta_hook}\n\nStart the full assessment: ${registrationUrl}`;

    await sendEmail({
      to: email,
      subject: 'Your AI readiness diagnostic — Nth Layer',
      html,
      text,
      from: 'Nth Layer <noreply@nthlayer.co.uk>',
    });

    return NextResponse.json({ ok: true, diagnosticId });
  } catch (err) {
    console.error('[diagnostic/email]', err);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }
}
