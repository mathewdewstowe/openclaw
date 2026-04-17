import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserCompanies } from "@/lib/entitlements";
import { db } from "@/lib/db";

const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"] as const;

function countSources(sections: Record<string, unknown>): number {
  const eb = sections?.evidence_base as { sources?: unknown[] } | undefined;
  if (!Array.isArray(eb?.sources)) return 0;
  return eb!.sources.filter(Boolean).length;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ count: 0 });

    const companyAccess = await getUserCompanies(user.id);
    const activeCompany = companyAccess[0]?.company;
    if (!activeCompany) return NextResponse.json({ count: 0 });

    const outputs = await db.output.findMany({
      where: {
        companyId: activeCompany.id,
        workflowType: { in: [...STAGE_ORDER] },
      },
      select: { workflowType: true, sections: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // Deduplicate per stage, count sources
    const seen = new Set<string>();
    let total = 0;
    for (const o of outputs) {
      if (seen.has(o.workflowType)) continue;
      seen.add(o.workflowType);
      total += countSources(o.sections as Record<string, unknown>);
    }

    return NextResponse.json({ count: total }, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
