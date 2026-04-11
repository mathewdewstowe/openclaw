import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DecisionsLedgerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>A permanent record of what you decided and why</h1>
      </div>

      <div style={{ padding: 32, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, marginBottom: 20 }}>
          Every decision made through Inflexion is logged — what was decided, what assumptions it rested on, what the confidence level was, and what the risks were.
        </p>
        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7 }}>
          Over time this becomes something no other tool offers: an auditable record of how your company thinks and chooses. Essential for leadership onboarding, board alignment, and exit preparation.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/inflexion/settings" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#111827", borderRadius: 8, textDecoration: "none" }}>
          Unlock Decisions Ledger →
        </a>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>Included in paid plan · 14-day trial · No card required</span>
      </div>
    </div>
  );
}
