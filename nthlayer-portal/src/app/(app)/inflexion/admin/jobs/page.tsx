import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  frame: "Frame",
  diagnose: "Diagnose",
  decide: "Decide",
  position: "Position",
  commit: "Commit",
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  completed: { bg: "#dcfce7", color: "#166534" },
  running:   { bg: "#dbeafe", color: "#1d4ed8" },
  pending:   { bg: "#fef9c3", color: "#854d0e" },
  failed:    { bg: "#fee2e2", color: "#991b1b" },
};

export default async function AdminJobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  type FeedbackRow = { jobId: string | null; userId: string; workflowType: string; overallRating: number; accuracy: number | null; depth: number | null; actionability: number | null; relevance: number | null; comment: string | null; createdAt: Date };
  type ShareRow = { id: string; recipientEmail: string; workflowType: string; stageName: string; sharedById: string; companyId: string; createdAt: Date; sharedBy: { email: string }; company: { name: string } };

  const dbAny = db as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]>; count: () => Promise<number> }>;

  const [jobs, stageCounts, feedbackRows, shareRows] = await Promise.all([
    db.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        company: { select: { name: true } },
        user: { select: { email: true } },
      },
    }),
    Promise.all(
      ["frame", "diagnose", "decide", "position", "commit"].map((stage) =>
        db.job.count({ where: { workflowType: stage } }).then((count) => ({ stage, count }))
      )
    ),
    dbAny.outputFeedback.findMany({
      select: { jobId: true, userId: true, workflowType: true, overallRating: true, accuracy: true, depth: true, actionability: true, relevance: true, comment: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }).catch(() => []) as Promise<FeedbackRow[]>,
    dbAny.outputShare.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { sharedBy: { select: { email: true } }, company: { select: { name: true } } },
    }).catch(() => []) as Promise<ShareRow[]>,
  ]);

  const feedbackByJobId = new Map((feedbackRows as FeedbackRow[]).filter(f => f.jobId).map(f => [f.jobId!, f]));

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Jobs</h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{jobs.length} shown</span>
      </div>

      {/* Stage breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 28 }}>
        {stageCounts.map(({ stage, count }) => (
          <div key={stage} style={{ padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#f9fafb" }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{count}</p>
            <p style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{stage}</p>
          </div>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div style={{ padding: 32, border: "1px dashed #d1d5db", borderRadius: 12, textAlign: "center", color: "#6b7280" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No jobs yet</p>
          <p style={{ fontSize: 14 }}>Jobs will appear here when users run analyses.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Stage</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Company</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>User</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Progress</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Feedback</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const statusStyle = STATUS_STYLE[j.status] ?? { bg: "#f3f4f6", color: "#6b7280" };
                const fb = feedbackByJobId.get(j.id);
                return (
                  <tr key={j.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px", color: "#111827", fontWeight: 500 }}>
                      {STAGE_LABEL[j.workflowType] ?? j.workflowType}
                    </td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{j.company.name}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{j.user.email}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                        padding: "2px 8px", borderRadius: 999,
                        background: statusStyle.bg, color: statusStyle.color,
                      }}>
                        {j.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{j.progress ?? 0}%</td>
                    <td style={{ padding: "12px" }}>
                      {fb ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#059669" }}>
                          {"★".repeat(fb.overallRating)}{"☆".repeat(5 - fb.overallRating)}
                          <span style={{ color: "#6b7280", fontWeight: 400, marginLeft: 2 }}>({fb.overallRating}/5)</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px", color: "#9ca3af", fontSize: 13 }}>{j.createdAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Shares ── */}
      <div id="shares" style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Report Shares</h2>
        {(shareRows as ShareRow[]).length === 0 ? (
          <p style={{ fontSize: 14, color: "#9ca3af" }}>No shares yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Stage</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Company</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Shared By</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Recipient Email</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {(shareRows as ShareRow[]).map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px", color: "#111827", fontWeight: 500, textTransform: "capitalize" }}>{s.stageName}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{s.company.name}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{s.sharedBy.email}</td>
                    <td style={{ padding: "12px", color: "#2563eb" }}>{s.recipientEmail}</td>
                    <td style={{ padding: "12px", color: "#9ca3af", fontSize: 13 }}>{s.createdAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Feedback ── */}
      <div id="feedback" style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Report Feedback</h2>
        {(feedbackRows as FeedbackRow[]).length === 0 ? (
          <p style={{ fontSize: 14, color: "#9ca3af" }}>No feedback yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Stage</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Overall</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Accuracy</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Depth</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Actionability</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Relevance</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Comment</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {(feedbackRows as FeedbackRow[]).map((f, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px", color: "#111827", fontWeight: 500, textTransform: "capitalize" }}>{f.workflowType}</td>
                    <td style={{ padding: "12px", fontWeight: 700, color: "#059669" }}>{f.overallRating}/5</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{f.accuracy ?? "—"}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{f.depth ?? "—"}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{f.actionability ?? "—"}</td>
                    <td style={{ padding: "12px", color: "#4b5563" }}>{f.relevance ?? "—"}</td>
                    <td style={{ padding: "12px", color: "#6b7280", fontSize: 13, maxWidth: 240 }}>{f.comment || "—"}</td>
                    <td style={{ padding: "12px", color: "#9ca3af", fontSize: 13 }}>{f.createdAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
