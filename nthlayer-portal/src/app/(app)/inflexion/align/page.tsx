import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AlignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Leadership alignment on choices and priorities</h1>
      </div>

      <div style={{ padding: 32, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7 }}>
          Strategy fails when teams are not aligned. Align takes your Inflexion outputs and makes them legible across your whole leadership layer — so your CEO, product lead, and GTM lead are working from the same picture, the same priorities, and the same trade-offs.
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Features</p>
        {[
          "Shareable decision memos — one link, right context for every reader",
          "Role-based views — CEO, Product, GTM each see what is relevant to them",
          "Commentary and collaboration on outputs",
          "Decision tracking over time",
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", flexShrink: 0, marginTop: 7 }} />
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{item}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/inflexion/settings" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#111827", borderRadius: 8, textDecoration: "none" }}>
          Unlock Align →
        </a>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>Included in paid plan · 14-day trial · No card required</span>
      </div>
    </div>
  );
}
