import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserCompanies } from "@/lib/entitlements";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Already has a company — go straight to app
  const companyAccess = await getUserCompanies(user.id);
  if (companyAccess.length > 0) redirect("/inflexion/overview");

  return <OnboardingWizard />;
}
