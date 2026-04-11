import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements, getMaxCompanies, getUserCompanies } from "@/lib/entitlements";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, url, sector, location, description, profile } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Check company limits
  const entitlements = await getUserEntitlements(user.id);
  const maxCompanies = getMaxCompanies(entitlements);
  if (maxCompanies !== -1) {
    const current = await getUserCompanies(user.id);
    if (current.length >= maxCompanies) {
      return NextResponse.json({ error: "company_limit_reached", max: maxCompanies }, { status: 403 });
    }
  }

  // Split into two queries — Neon HTTP adapter does not support transactions
  const company = await db.company.create({
    data: {
      name,
      url: url ?? null,
      sector: sector ?? null,
      location: location ?? null,
      description: description ?? null,
      profile: profile ?? undefined,
      createdById: user.id,
    },
  });

  await db.userCompanyAccess.create({
    data: { userId: user.id, companyId: company.id, role: "owner" },
  });

  return NextResponse.json({ company }, { status: 201 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await getUserCompanies(user.id);
  return NextResponse.json({ companies: companies.map((ca) => ({ ...ca.company, role: ca.role })) });
}
