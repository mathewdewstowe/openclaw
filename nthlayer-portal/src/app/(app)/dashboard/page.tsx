import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DeleteScanButton } from "@/components/delete-scan-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  RUNNING: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-slate-500/20 text-slate-400",
  FAILED: "bg-red-500/20 text-red-400",
  PARTIAL: "bg-orange-500/20 text-orange-400",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  type ScanWithReport = Awaited<ReturnType<typeof db.scan.findMany>>[number] & {
    reports: { id: string; pdfUrl: string | null }[];
  };
  let scans: ScanWithReport[] = [];
  try {
    const raw = await db.scan.findMany({
      where: { userId: user.id, type: "COMPETITOR_TEARDOWN" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        reports: {
          select: { id: true, pdfUrl: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    scans = raw as ScanWithReport[];
  } catch {
    // DB hiccup — render empty list with refresh prompt
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitor Teardowns</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Sharp strategic reads on competitors using public signals only.
          </p>
        </div>
        <Link
          href="/scan/competitor/new"
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          New Teardown →
        </Link>
      </div>

      {scans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <div className="rounded-md bg-[var(--primary)]/10 p-3 w-fit mx-auto mb-4">
            <svg className="h-6 w-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium">No teardowns yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-4">
            Enter a competitor URL and get a sharp strategic read in minutes.
          </p>
          <Link
            href="/scan/competitor/new"
            className="inline-flex rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            Run your first teardown →
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Competitor</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Date</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]"></th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const pdfUrl = scan.reports[0]?.pdfUrl;
                return (
                  <tr key={scan.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{scan.companyName || scan.companyUrl}</div>
                      {scan.companyName && (
                        <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{scan.companyUrl}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[scan.status] || ""}`}>
                        {scan.status === "RUNNING" && (
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                        )}
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {scan.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-4">
                        <DeleteScanButton scanId={scan.id} />
                        {scan.status === "COMPLETED" && (
                          <DownloadPdfButton scanId={scan.id} />
                        )}
                        <Link
                          href={`/scan/${scan.id}`}
                          className="text-[var(--primary)] hover:underline text-xs"
                        >
                          {scan.status === "COMPLETED" ? "View Report →" : "View Status →"}
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
