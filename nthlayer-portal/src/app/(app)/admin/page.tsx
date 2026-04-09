import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

const ADMIN_EMAILS = ["matthew@nthlayer.co.uk"];

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-700",
  RUNNING: "bg-blue-500/20 text-blue-700",
  COMPLETED: "bg-emerald-500/20 text-emerald-700",
  FAILED: "bg-red-500/20 text-red-700",
  PARTIAL: "bg-orange-500/20 text-orange-700",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  const isAdmin = user && (user.role === "ADMIN" || ADMIN_EMAILS.includes(user.email));
  if (!isAdmin) redirect("/dashboard");

  // Users with their scan counts
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      scans: {
        select: { id: true, type: true, status: true },
      },
    },
  });

  const usersWithMetrics = users.map((u) => {
    const teardowns = u.scans.filter((s) => s.type === "COMPETITOR_TEARDOWN").length;
    const completedTeardowns = u.scans.filter((s) => s.type === "COMPETITOR_TEARDOWN" && s.status === "COMPLETED").length;
    const productStrategy = u.scans.find((s) => s.type === "PRODUCT_STRATEGY" && s.status === "COMPLETED");
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      company: u.company,
      jobTitle: u.jobTitle,
      role: u.role,
      firstLoginAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      teardowns,
      completedTeardowns,
      hasProductStrategy: !!productStrategy,
    };
  });

  // Latest scans
  const scans = await db.scan.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { email: true } },
      reports: { select: { id: true }, take: 1 },
    },
  });

  // Metrics
  const totalUsers = users.length;
  const totalScans = await db.scan.count();
  const completedScans = await db.scan.count({ where: { status: "COMPLETED" } });
  const failedScans = await db.scan.count({ where: { status: "FAILED" } });
  const completedStrategies = usersWithMetrics.filter((u) => u.hasProductStrategy).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          User activity, scans, and product strategy completion.
        </p>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Users", value: totalUsers },
          { label: "Total Scans", value: totalScans },
          { label: "Completed", value: completedScans },
          { label: "Failed", value: failedScans },
          { label: "Strategies Done", value: completedStrategies },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">{m.label}</p>
            <p className="text-2xl font-bold font-mono mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Users</h3>
        <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Email</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Name</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Company</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Job Title</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">First Login</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Last Login</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted-foreground)]">Teardowns</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted-foreground)]">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {usersWithMetrics.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs">
                    {u.email}
                    {u.role === "ADMIN" && (
                      <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-700">
                        ADMIN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-xs">{u.company || "—"}</td>
                  <td className="px-4 py-3 text-xs">{u.jobTitle || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                    {fmtDate(u.firstLoginAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                    {fmtDate(u.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-mono">
                    {u.completedTeardowns}/{u.teardowns}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.hasProductStrategy ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                        ✓
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent scans */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
        <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">ID</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">User</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Type</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Company</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Progress</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Date</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{scan.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{scan.user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs">{scan.type}</td>
                  <td className="px-4 py-3 text-xs truncate max-w-[200px]">{scan.companyName || scan.companyUrl}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[scan.status] || ""}`}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{scan.progress}%</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                    {fmtDate(scan.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/scan/${scan.id}`}
                      className="text-[var(--primary)] hover:underline text-xs"
                    >
                      Inspect
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
