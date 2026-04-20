import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // DB unavailable — fall through to marketing page
  }
  if (user) redirect("/inflexion/strategy");
  redirect("/new");
}
