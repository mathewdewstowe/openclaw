import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STAGES = ["frame", "diagnose", "decide", "position", "commit"];

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const dbAny = db as unknown as Record<string, any>;

  const [userCount, companyCount, jobCount, outputCount, shareCount, feedbackCount, stageCounts, shares, feedbacks] =
    await Promise.all([
      db.user.count(),
      db.company.count(),
      db.job.count(),
      db.output.count(),
      dbAny.outputShare?.count().catch(() => 0) ?? 0,
      dbAny.outputFeedback?.count().catch(() => 0) ?? 0,
      Promise.all(
        STAGES.map((stage) =>
          db.job.count({ where: { workflowType: stage } }).then((count) => ({ stage, count }))
        )
      ),
      dbAny.outputShare
        ?.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { sharedBy: true, company: true },
        })
        .catch(() => []) ?? [],
      dbAny.outputFeedback
        ?.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
        })
        .catch(() => []) ?? [],
    ]);

  const stats = [
    { label: "Users", value: userCount, href: "/inflexion/admin/users" },
    { label: "Companies", value: companyCount, href: "/inflexion/admin/companies" },
    { label: "Jobs", value: jobCount, href: "/inflexion/admin/jobs" },
    { label: "Outputs", value: outputCount, href: "#" },
    { label: "Shares", value: shareCount, href: "#shares" },
    { label: "Feedback", value: feedbackCount, href: "#feedback" },
    { label: "Item Feedback", value: "→", href: "/inflexion/admin/feedback" },
  ];

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "0 12px 10px",
    borderBottom: "1px solid #e5e7eb",
  };
  const td: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 13,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "top",
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 24 }}>Admin</h1>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 16 }}>
        {stats.filter((s) => s.label !== "Item Feedback").map((s) => (
          <a
            key={s.label}
            href={s.href}
            style={{ display: "block", padding: "20px", border: "1px solid #e5e7eb", borderRadius: 12, textDecoration: "none", background: "#fff" }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{s.value}</p>
            <p style={{ fontSize: 13, color: "#6b7280" }}>{s.label}</p>
          </a>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
        <a
          href="/inflexion/admin/system-report"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            background: "#1e3a5f",
            border: "none",
            borderRadius: 12,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>System Architecture Report</p>
            <p style={{ fontSize: 13, color: "#93c5fd", margin: 0 }}>Full pipeline documentation — stages, agents, system prompts, data flow, question schema. Download as PDF.</p>
          </div>
          <span style={{ fontSize: 20, color: "#60a5fa", flexShrink: 0, marginLeft: 16 }}>↓</span>
        </a>

        <a
          href="/inflexion/admin/question-reference"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            background: "#1e3a2f",
            border: "none",
            borderRadius: 12,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Question Reference</p>
            <p style={{ fontSize: 13, color: "#86efac", margin: 0 }}>All 38 questions across 5 stages — types, options, constraints, required fields. Download as PDF.</p>
          </div>
          <span style={{ fontSize: 20, color: "#4ade80", flexShrink: 0, marginLeft: 16 }}>↓</span>
        </a>

        <a
          href="/inflexion/admin/feedback"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            background: "#111827",
            border: "none",
            borderRadius: 12,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Analysis Feedback</p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Review item-level ✓/✗ ratings from users across all strategy stages</p>
          </div>
          <span style={{ fontSize: 20, color: "#a3e635", flexShrink: 0, marginLeft: 16 }}>→</span>
        </a>
      </div>{/* end CTAs div */}

      {/* Jobs by stage */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Jobs by stage</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 48 }}>
        {stageCounts.map(({ stage, count }) => (
          <a
            key={stage}
            href="/inflexion/admin/jobs"
            style={{ display: "block", padding: "16px 20px", border: "1px solid #e5e7eb", borderRadius: 12, textDecoration: "none", background: "#f9fafb" }}
          >
            <p style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{count}</p>
            <p style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{stage}</p>
          </a>
        ))}
      </div>

      {/* Shares */}
      <div id="shares" style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
          Report Shares ({shareCount})
        </p>
        {shares.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No shares yet.</p>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Stage", "Company", "Shared By", "Recipient", "Date"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shares.map((s: any) => (
                  <tr key={s.id}>
                    <td style={td}><span style={{ textTransform: "capitalize" }}>{s.workflowType}</span></td>
                    <td style={td}>{s.company?.name ?? s.companyId}</td>
                    <td style={td}>{s.sharedBy?.name ?? s.sharedBy?.email ?? s.userId}</td>
                    <td style={td}>{s.recipientEmail}</td>
                    <td style={{ ...td, color: "#9ca3af", whiteSpace: "nowrap" }}>
                      {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div id="feedback" style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
          Report Feedback ({feedbackCount})
        </p>
        {feedbacks.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No feedback yet.</p>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Stage", "Overall", "Accuracy", "Depth", "Actionability", "Relevance", "Comment", "Date"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((f: any) => (
                  <tr key={f.id}>
                    <td style={td}><span style={{ textTransform: "capitalize" }}>{f.workflowType}</span></td>
                    <td style={td}>{"★".repeat(f.overallRating)}{"☆".repeat(5 - f.overallRating)}</td>
                    <td style={td}>{f.accuracy ?? "—"}</td>
                    <td style={td}>{f.depth ?? "—"}</td>
                    <td style={td}>{f.actionability ?? "—"}</td>
                    <td style={td}>{f.relevance ?? "—"}</td>
                    <td style={{ ...td, maxWidth: 240 }}>{f.comment ?? "—"}</td>
                    <td style={{ ...td, color: "#9ca3af", whiteSpace: "nowrap" }}>
                      {new Date(f.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
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
