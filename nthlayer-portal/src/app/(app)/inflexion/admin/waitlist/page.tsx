import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminWaitlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.systemRole !== "super_admin" && user.systemRole !== "admin") redirect("/inflexion/overview");

  const entries = await db.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "10px 14px",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 13,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "top",
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Early Waitlist</h1>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Signups from inflexion.nthlayer.co.uk</p>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "8px 16px",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a3e635", display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{entries.length}</span>
          <span style={{ fontSize: 13, color: "#6b7280" }}>total</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "48px 32px",
            textAlign: "center",
            background: "#fafafa",
          }}
        >
          <p style={{ fontSize: 15, color: "#9ca3af" }}>No waitlist signups yet.</p>
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Name", "Email", "Company", "Role", "Signed Up"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{ transition: "background 100ms" }}>
                  <td style={td}>{entry.name ?? <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td style={td}>
                    <a
                      href={`mailto:${entry.email}`}
                      style={{ color: "#0d2b3e", textDecoration: "none", fontWeight: 500 }}
                    >
                      {entry.email}
                    </a>
                  </td>
                  <td style={td}>{entry.company ?? <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td style={td}>{entry.role ?? <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td style={{ ...td, color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    <span style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                      {new Date(entry.createdAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
