import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import OnePagerPage from "@/app/one-pager/page";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/inflexion/overview");
  return <OnePagerPage />;
}
