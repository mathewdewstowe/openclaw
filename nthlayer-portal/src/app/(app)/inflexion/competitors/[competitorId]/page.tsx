import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { OutputRenderer } from "@/components/output/output-renderer";

export default async function CompetitorDetailPage({ params }: { params: Promise<{ competitorId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin") notFound();
  const { competitorId } = await params;

  // competitorId could be an output ID or a competitor profile ID
  const output = await db.output.findUnique({
    where: { id: competitorId },
    include: { company: { select: { name: true } } },
  });

  if (!output) notFound();

  const entitlements = await getUserEntitlements(user.id);

  return (
    <OutputRenderer
      output={{
        id: output.id,
        title: output.title,
        workflowType: output.workflowType,
        outputType: output.outputType,
        sections: output.sections as Record<string, unknown>,
        confidence: output.confidence,
        sources: output.sources,
        tags: output.tags ?? [],
        companyName: output.company.name,
        createdAt: output.createdAt.toISOString(),
        version: output.version,
      }}
      visibleSections={entitlements.output_section_limit}
    />
  );
}
