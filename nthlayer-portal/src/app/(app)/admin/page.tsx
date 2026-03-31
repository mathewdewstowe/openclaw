import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  RUNNING: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
  FAILED: "bg-red-500/20 text-red-400",
  PARTIAL: "bg-orange-500/20 text-orange-400",
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard");

  const scans = await db.scan.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { email: true } },
      reports: { select: { id: true }, take: 1 },
    },
  });

  // Metrics
  const totalScans = await db.scan.count();
  const completedScans = await db.scan.count({ where: { status: "COMPLETED" } });
  const failedScans = await db.scan.count({ where: { status: "FAILED" } });
  const totalReports = await db.report.count();
  const reportsOpened = await db.report.count({ where: { openedAt: { not: null } } });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Inspect scans, review outputs, rerun jobs.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Scans", value: totalScans },
          { label: "Completed", value: completedScans },
          { label: "Failed", value: failedScans },
          { label: "Reports", value: totalReports },
          { label: "Reports Opened", value: reportsOpened },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">{m.label}</p>
            <p className="text-2xl font-bold font-mono mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">All Scans</h3>
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
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
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {scan.createdAt.toLocaleDateString()}
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
