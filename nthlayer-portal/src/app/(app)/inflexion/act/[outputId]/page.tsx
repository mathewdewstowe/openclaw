import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { OutputRenderer } from "@/components/output/output-renderer";
import { PlanLiveBar } from "@/components/plan-live-bar";

export default async function ActOutputPage({ params }: { params: Promise<{ outputId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { outputId } = await params;

  const [output, entitlements] = await Promise.all([
    db.output.findUnique({
      where: { id: outputId },
      include: { company: { select: { name: true, id: true } } },
    }),
    getUserEntitlements(user.id),
  ]);

  if (!output) notFound();

  const sections = output.sections as Record<string, unknown>;
  const assumptions = Array.isArray(sections.assumptions) ? sections.assumptions : [];

  // Count competitors tracked for this company
  const competitorCount = await db.competitorProfile.count({
    where: { companyId: output.company.id },
  });

  return (
    <div>
      <PlanLiveBar
        outputId={output.id}
        createdAt={output.createdAt.toISOString()}
        assumptionCount={assumptions.length}
        competitorCount={competitorCount}
      />
      <OutputRenderer
        output={{
          id: output.id,
          title: output.title,
          workflowType: output.workflowType,
          outputType: output.outputType,
          sections,
          confidence: output.confidence,
          sources: output.sources,
          companyName: output.company.name,
          createdAt: output.createdAt.toISOString(),
          version: output.version,
        }}
        visibleSections={entitlements.output_section_limit}
      />
    </div>
  );
}
