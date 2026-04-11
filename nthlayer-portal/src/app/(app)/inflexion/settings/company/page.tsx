import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserCompanies } from "@/lib/entitlements";
import { CompanyProfileForm } from "@/components/company-profile-form";

export default async function CompanySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const ca = companyAccess[0];
  if (!ca) redirect("/onboarding");

  const company = ca.company;

  return (
    <CompanyProfileForm
      company={{
        id: company.id,
        name: company.name,
        url: company.url,
        sector: company.sector,
        location: company.location,
        description: company.description,
        profile: (company.profile ?? null) as {
          userType?: "operator" | "investor";
          sector?: string;
          location?: string;
          description?: string;
          icp1?: string;
          icp2?: string;
          icp3?: string;
          inflectionPoint?: string;
          risks?: string;
          bigBet?: string;
          competitors?: string[];
        } | null,
      }}
    />
  );
}
