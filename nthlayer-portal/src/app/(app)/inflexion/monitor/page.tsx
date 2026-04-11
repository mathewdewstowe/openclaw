import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MonitorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Live strategy intelligence</h1>
      </div>

      <div style={{ padding: 32, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, marginBottom: 20 }}>
          Monitor watches your market, your competitors, and the assumptions your strategy rests on — and alerts you the moment something changes.
        </p>
        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7 }}>
          The longer you use Inflexion, the more valuable Monitor becomes. Every assumption you log in Decide is tracked here. Every competitor move is mapped against your positioning. Every market shift is assessed against your current bets.
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>What is tracked</p>
        {[
          "Assumption invalidation — alerted when a bet assumption breaks",
          "Competitor movement — GTM signals, hiring, pricing, product changes",
          "Market shifts — ICP dynamics, category changes, AI signals",
          "Strategy drift — when your stated direction diverges from market reality",
          '"Since last time" briefing — personalised summary on every return visit',
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", flexShrink: 0, marginTop: 7 }} />
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{item}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/inflexion/settings" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#111827", borderRadius: 8, textDecoration: "none" }}>
          Unlock Monitor →
        </a>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>Included in paid plan · 14-day trial · No card required</span>
      </div>
    </div>
  );
}
