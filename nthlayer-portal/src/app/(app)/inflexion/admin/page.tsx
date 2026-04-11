import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STAGES = ["frame", "diagnose", "decide", "position", "commit"];

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const [userCount, companyCount, jobCount, outputCount, stageCounts] = await Promise.all([
    db.user.count(),
    db.company.count(),
    db.job.count(),
    db.output.count(),
    Promise.all(
      STAGES.map((stage) =>
        db.job.count({ where: { workflowType: stage } }).then((count) => ({ stage, count }))
      )
    ),
  ]);

  const stats = [
    { label: "Users", value: userCount, href: "/inflexion/admin/users" },
    { label: "Companies", value: companyCount, href: "/inflexion/admin/companies" },
    { label: "Jobs", value: jobCount, href: "/inflexion/admin/jobs" },
    { label: "Outputs", value: outputCount, href: "#" },
  ];

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 24 }}>Admin</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 40 }}>
        {stats.map((s) => (
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

      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Jobs by stage</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
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
    </div>
  );
}
