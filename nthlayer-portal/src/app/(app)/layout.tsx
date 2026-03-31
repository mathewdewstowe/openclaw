import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <main className="flex-1 ml-64">
        <div className="border-b border-[var(--border)] px-8 py-4 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--muted-foreground)]">{user.email}</span>
            {user.role === "ADMIN" && (
              <span className="text-xs bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
