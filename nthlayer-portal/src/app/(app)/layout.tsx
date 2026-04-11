import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserEntitlements, getUserPlanName, getUserCompanies } from "@/lib/entitlements";
import { AppShellV2 } from "@/components/app-shell-v2";
import type { PlanEntitlements } from "@/lib/types/entitlements";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [entitlements, planName, companyAccess] = await Promise.all([
    getUserEntitlements(user.id),
    getUserPlanName(user.id),
    getUserCompanies(user.id),
  ]);

  // Redirect to onboarding wizard if no company configured
  // Admin users can bypass (they may need to access admin panel without a company)
  if (companyAccess.length === 0 && user.systemRole !== "super_admin" && user.systemRole !== "admin") {
    redirect("/onboarding");
  }

  const companies = companyAccess.map((ca) => ({
    id: ca.company.id,
    name: ca.company.name,
    url: ca.company.url,
    sector: ca.company.sector,
    role: ca.role,
  }));

  return (
    <AppShellV2
      email={user.email}
      planName={planName}
      systemRole={user.systemRole ?? "member"}
      entitlements={entitlements as unknown as PlanEntitlements}
      companies={companies}
    >
      {children}
    </AppShellV2>
  );
}
