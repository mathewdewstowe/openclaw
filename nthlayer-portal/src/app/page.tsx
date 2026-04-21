import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  // Unauthenticated users are served new.html at / by middleware — this only
  // runs when a token is present (authenticated users).
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // DB unavailable — redirect to marketing page
    redirect("/new");
  }
  if (user) redirect("/inflexion/strategy");
  // Token existed but invalid/expired — send to login
  redirect("/login");
}
