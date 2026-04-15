import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";

async function resolveCompanyId(userId: string, providedCompanyId?: string | null): Promise<string | null> {
  if (providedCompanyId) return providedCompanyId;
  const companies = await getUserCompanies(userId);
  return companies[0]?.company?.id ?? null;
}

// POST — save bet selections for the current user
// Accepts either { betIds: string[] } (DB IDs) or { betNames: string[] } (match by name)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    companyId?: string;
    betIds?: string[];
    betNames?: string[];
    commitOutputId?: string;
  };

  const companyId = await resolveCompanyId(user.id, body.companyId);
  if (!companyId) return NextResponse.json({ error: "No company found" }, { status: 400 });

  try {
    let betIds = body.betIds ?? [];

    // If betNames provided instead of betIds, resolve DB IDs by name within this company
    if (betIds.length === 0 && Array.isArray(body.betNames) && body.betNames.length > 0) {
      const bets = await db.strategicBet.findMany({
        where: { companyId, name: { in: body.betNames } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      betIds = bets.map((b) => b.id);
    }

    if (betIds.length === 0) {
      return NextResponse.json({ ok: true, note: "No matching bets found" });
    }

    // Upsert each selection
    await Promise.all(
      betIds.map((betId) =>
        db.strategicBetSelection.upsert({
          where: { betId_userId: { betId, userId: user.id } },
          update: { commitOutputId: body.commitOutputId ?? undefined },
          create: { companyId, userId: user.id, betId, commitOutputId: body.commitOutputId },
        })
      )
    );

    // Remove any prior selections for this company that are no longer selected
    await db.strategicBetSelection.deleteMany({
      where: {
        companyId,
        userId: user.id,
        betId: { notIn: betIds },
      },
    });

    return NextResponse.json({ ok: true, selected: betIds.length });
  } catch (err) {
    console.error("[bet-selections] POST failed:", err);
    return NextResponse.json({ error: "Failed to save selections" }, { status: 500 });
  }
}

// GET — load all bet selections for the current user
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = await resolveCompanyId(user.id, searchParams.get("companyId"));
  if (!companyId) return NextResponse.json({ selections: [] });

  try {
    const selections = await db.strategicBetSelection.findMany({
      where: { companyId, userId: user.id },
      include: {
        bet: {
          select: {
            id: true,
            name: true,
            action: true,
            outcome: true,
            hypothesis: true,
            betType: true,
            betIndex: true,
          },
        },
      },
    });

    return NextResponse.json({ selections });
  } catch (err) {
    console.error("[bet-selections] GET failed:", err);
    return NextResponse.json({ selections: [] });
  }
}
