import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminActions } from "./admin-actions";

export default async function AdminScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;

  const scan = await db.scan.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true } },
      results: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      reports: { select: { id: true, version: true, createdAt: true } },
      uploads: true,
    },
  });

  if (!scan) redirect("/admin");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scan Inspection</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 font-mono">{scan.id}</p>
        </div>
        <AdminActions scanId={scan.id} scanStatus={scan.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Type</p>
          <p className="font-mono text-sm mt-1">{scan.type}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Status</p>
          <p className="font-mono text-sm mt-1">{scan.status}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">User</p>
          <p className="text-sm mt-1">{scan.user.email}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Progress</p>
          <p className="font-mono text-sm mt-1">{scan.progress}%</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Inputs</h3>
        <pre className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-xs font-mono overflow-auto max-h-[400px]">
          {JSON.stringify(
            {
              companyUrl: scan.companyUrl,
              companyName: scan.companyName,
              priorities: scan.priorities,
              workflow: scan.workflow,
              competitors: scan.competitors,
              investmentThesis: scan.investmentThesis,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">
          Module Outputs ({scan.results.length})
        </h3>
        <div className="space-y-3">
          {scan.results.map((result) => (
            <details
              key={result.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)]"
            >
              <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm">
                <span className="font-mono">{result.module}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {result.durationMs}ms
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {result.promptTokens || 0} / {result.completionTokens || 0} tokens
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      result.confidence >= 0.8
                        ? "bg-emerald-500/20 text-emerald-400"
                        : result.confidence >= 0.5
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-xs font-mono overflow-auto max-h-[300px] bg-[var(--muted)] rounded p-3">
                  {JSON.stringify(result.output, null, 2)}
                </pre>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">
          Events ({scan.events.length})
        </h3>
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-2 font-medium text-[var(--muted-foreground)]">Event</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--muted-foreground)]">Time</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--muted-foreground)]">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {scan.events.map((event) => (
                <tr key={event.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 font-mono">{event.event}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">
                    {event.createdAt.toISOString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-[var(--muted-foreground)]">
                    {event.metadata ? JSON.stringify(event.metadata) : "—"}
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
