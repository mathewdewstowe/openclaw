import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdvisePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Guided strategic judgment</h1>
      </div>

      <div style={{ padding: 32, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, marginBottom: 20 }}>
          Advise interprets your Inflexion outputs in the context of your specific company — surfacing the trade-offs that matter most and guiding your leadership toward the right decisions.
        </p>
        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7 }}>
          It combines AI-led analysis with the option to augment with senior advisory from The Nth Layer where the stakes are highest.
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        {[
          "Given your revenue target, these bets carry too much risk.",
          "Your GTM motion is misaligned with your stated ICP.",
          "You are underinvesting in retention relative to acquisition.",
        ].map((quote, i) => (
          <blockquote key={i} style={{ borderLeft: "3px solid #e5e7eb", paddingLeft: 16, paddingTop: 12, paddingBottom: 12, marginBottom: 12, fontStyle: "italic", fontSize: 15, color: "#6b7280" }}>
            &ldquo;{quote}&rdquo;
          </blockquote>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/inflexion/settings" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#111827", borderRadius: 8, textDecoration: "none" }}>
          Unlock Advise →
        </a>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>Included in paid plan · 14-day trial · No card required</span>
      </div>
    </div>
  );
}
