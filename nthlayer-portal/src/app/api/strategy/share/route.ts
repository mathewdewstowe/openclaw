import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      stageId: string;
      stageName: string;
      recipientEmail: string;
      sections?: Record<string, unknown>;
    };

    const { stageId, stageName, recipientEmail, sections } = body;
    if (!recipientEmail || !stageId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get company for tracking
    const companies = await getUserCompanies(user.id);
    const companyId = companies[0]?.company?.id;
    const companyName = companies[0]?.company?.name ?? "your company";

    // Track the share in DB (graceful if table not yet migrated)
    if (companyId) {
      try {
        await (db as unknown as { outputShare: { create: (args: unknown) => Promise<unknown> } }).outputShare.create({
          data: {
            companyId,
            sharedById: user.id,
            recipientEmail,
            workflowType: stageId,
            stageName,
          },
        });
      } catch {
        // Non-fatal
      }
    }

    // Build HTML email from sections
    const senderName = user.name ?? user.email;

    const sectionHtml = sections ? [
      sections.executive_summary ? `
        <h2 style="font-size:16px;font-weight:700;color:#111827;margin:28px 0 8px;border-top:1px solid #e5e7eb;padding-top:20px">Executive Summary</h2>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">${String(sections.executive_summary).replace(/\n/g, "<br>")}</p>` : "",
      sections.what_matters ? `
        <h2 style="font-size:16px;font-weight:700;color:#111827;margin:28px 0 8px;border-top:1px solid #e5e7eb;padding-top:20px">What Matters</h2>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">${String(sections.what_matters).replace(/\n/g, "<br>")}</p>` : "",
      sections.recommendation ? `
        <h2 style="font-size:16px;font-weight:700;color:#111827;margin:28px 0 8px;border-top:1px solid #e5e7eb;padding-top:20px">Recommendation</h2>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">${String(sections.recommendation).replace(/\n/g, "<br>")}</p>` : "",
      sections.business_implications ? `
        <h2 style="font-size:16px;font-weight:700;color:#111827;margin:28px 0 8px;border-top:1px solid #e5e7eb;padding-top:20px">Business & Strategic Implications</h2>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">${String(sections.business_implications).replace(/\n/g, "<br>")}</p>` : "",
    ].filter(Boolean).join("") : "";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <!-- Header -->
    <div style="background:#111827;padding:28px 32px">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#a3e635;margin:0 0 8px">Nth Layer · Inflexion</p>
      <h1 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 4px">${stageName} Report</h1>
      <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0">${companyName} · Shared by ${senderName}</p>
    </div>
    <!-- Body -->
    <div style="padding:24px 32px 32px">
      ${sectionHtml || `<p style="font-size:14px;color:#6b7280">No content available for this report.</p>`}
    </div>
    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #e5e7eb;background:#f9fafb">
      <p style="font-size:12px;color:#9ca3af;margin:0">Powered by <a href="https://nthlayer.co.uk" style="color:#111827;font-weight:600;text-decoration:none">The Nth Layer</a> · inflexion.nthlayer.co.uk</p>
    </div>
  </div>
</body>
</html>`;

    const text = [
      `${stageName} Report — ${companyName}`,
      `Shared by: ${senderName}`,
      ``,
      sections?.executive_summary ? `EXECUTIVE SUMMARY\n${sections.executive_summary}` : "",
      sections?.what_matters ? `\nWHAT MATTERS\n${sections.what_matters}` : "",
      sections?.recommendation ? `\nRECOMMENDATION\n${sections.recommendation}` : "",
      `\n---\nPowered by The Nth Layer — nthlayer.co.uk`,
    ].filter(Boolean).join("\n");

    await sendEmail({
      to: recipientEmail,
      bcc: "matthew@nthlayer.co.uk",
      subject: `${stageName} Report — ${companyName} (via Nth Layer)`,
      html,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[share] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
