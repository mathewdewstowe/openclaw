import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";

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
        // Non-fatal — table may not be migrated yet
      }
    }

    // Build a plain-text email body from sections
    const lines: string[] = [
      `The Nth Layer — ${stageName} Report`,
      `Shared by: ${user.email ?? "a team member"}`,
      ``,
    ];

    if (sections) {
      if (sections.executive_summary) lines.push(`EXECUTIVE SUMMARY\n${sections.executive_summary}\n`);
      if (sections.what_matters) lines.push(`WHAT MATTERS MOST\n${sections.what_matters}\n`);
      if (sections.recommendation) lines.push(`RECOMMENDATION\n${sections.recommendation}\n`);
    }

    lines.push(`---\nPowered by The Nth Layer — nthlayer.co.uk`);
    const body_text = lines.join("\n");

    // Send via mailto link — build the response so the client can open it
    // In production, replace this with a real email provider (Resend, Postmark, etc.)
    const mailtoHref = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(`${stageName} Report — The Nth Layer`)}&body=${encodeURIComponent(body_text)}`;

    return NextResponse.json({ ok: true, mailtoHref });
  } catch (err) {
    console.error("[share] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
