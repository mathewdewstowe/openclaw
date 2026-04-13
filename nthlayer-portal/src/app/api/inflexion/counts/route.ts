import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserCompanies } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;
  if (!activeCompany) return NextResponse.json({ actions: 0, risks: 0, assumptions: 0, metrics: 0 });

  const outputs = await db.output.findMany({
    where: { companyId: activeCompany.id },
    select: { workflowType: true, sections: true },
    orderBy: { createdAt: "desc" },
  });

  const seenStages = new Set<string>();
  let actions = 0, risks = 0, assumptions = 0, metrics = 0;

  for (const output of outputs) {
    if (seenStages.has(output.workflowType)) continue;
    seenStages.add(output.workflowType);
    const sections = output.sections as Record<string, unknown>;
    if (Array.isArray(sections?.actions)) actions += sections.actions.length;
    if (Array.isArray(sections?.risks)) risks += sections.risks.length;
    if (Array.isArray(sections?.assumptions)) assumptions += sections.assumptions.length;
    if (Array.isArray(sections?.monitoring)) metrics += sections.monitoring.length;
  }

  return NextResponse.json({ actions, risks, assumptions, metrics });
}
