import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function PortfolioDetailPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { portfolioId } = await params;

  const portfolio = await db.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      companies: {
        include: {
          _count: { select: { jobs: true, outputs: true } },
        },
      },
    },
  });

  if (!portfolio) notFound();

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{portfolio.name}</h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          {portfolio.description ?? `${portfolio.companies.length} companies`}
        </p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {portfolio.companies.map((c) => (
          <div key={c.id} style={{
            padding: "20px",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{c.name}</p>
                <p style={{ fontSize: 13, color: "#6b7280" }}>{c.sector ?? "No sector"}</p>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6b7280" }}>
                <span>{c._count.jobs} jobs</span>
                <span>{c._count.outputs} outputs</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
