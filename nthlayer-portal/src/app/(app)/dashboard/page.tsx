import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const scanTypes = [
  {
    title: "Inflection Scan",
    description: "Run a full strategic scan on your company. Positioning, competitive reality, value creation, and CEO actions.",
    href: "/scan/inflection/new",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    title: "Competitor Teardown",
    description: "Tear down any competitor using public signals only. No uploads needed — just a URL.",
    href: "/scan/competitor/new",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  },
  {
    title: "Deal / DD Scan",
    description: "Assess a target company for investment. Product risk, GTM risk, AI realism, and value creation levers.",
    href: "/scan/deal/new",
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
];

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  RUNNING: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
  FAILED: "bg-red-500/20 text-red-400",
  PARTIAL: "bg-orange-500/20 text-orange-400",
};

const typeLabels: Record<string, string> = {
  INFLECTION: "Inflection",
  COMPETITOR_TEARDOWN: "Teardown",
  DEAL_DD: "Deal DD",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const scans = await db.scan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { reports: { select: { id: true }, take: 1 } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Run structured analysis. Get operator-grade signal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scanTypes.map((scan) => (
          <Link
            key={scan.href}
            href={scan.href}
            className="group rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 hover:border-[var(--primary)]/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-md bg-[var(--primary)]/10 p-2">
                <svg className="h-5 w-5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={scan.icon} />
                </svg>
              </div>
              <h3 className="font-semibold">{scan.title}</h3>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              {scan.description}
            </p>
            <div className="mt-4 text-sm text-[var(--primary)] group-hover:underline">
              Start scan →
            </div>
          </Link>
        ))}
      </div>

      {scans.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{typeLabels[scan.type] || scan.type}</span>
                    </td>
                    <td className="px-4 py-3">{scan.companyName || scan.companyUrl}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[scan.status] || ""}`}>
                        {scan.status === "RUNNING" && (
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                        )}
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {scan.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/scan/${scan.id}`}
                        className="text-[var(--primary)] hover:underline text-xs"
                      >
                        {scan.status === "COMPLETED" ? "View Report" : "View Status"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
