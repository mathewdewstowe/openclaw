import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getWorkflowData } from "@/lib/workflow-data";
import { WorkflowHub } from "@/components/workflow-hub";

export default async function CompetitorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getWorkflowData("competitor_intel");
  if (!data) redirect("/login");

  return <WorkflowHub workflow="competitor_intel" outputs={data.outputs} activeJobs={data.activeJobs} />;
}
