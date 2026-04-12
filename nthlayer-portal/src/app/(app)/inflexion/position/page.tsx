import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getWorkflowData } from "@/lib/workflow-data";
import { WorkflowHub } from "@/components/workflow-hub";

export const dynamic = "force-dynamic";

export default async function PositionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getWorkflowData("position");
  if (!data) redirect("/login");

  return <WorkflowHub workflow="position" outputs={data.outputs} activeJobs={data.activeJobs} diagnoseOutput={data.diagnoseOutput} />;
}
