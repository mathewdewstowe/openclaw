"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanEntitlements } from "@/lib/types/entitlements";

interface Plan {
  id: string;
  displayName: string;
  description: string | null;
  priceMonthly: number | null;
  entitlements: PlanEntitlements;
  userCount: number;
}

const BOOLEAN_KEYS: (keyof PlanEntitlements)[] = [
  "access_diagnose", "access_decide", "access_position",
  "access_act", "access_competitor", "access_export", "access_portfolio",
];

const NUMBER_KEYS: (keyof PlanEntitlements)[] = [
  "max_companies", "max_jobs_per_month", "output_section_limit",
];

export function PlanEditor({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(plan.description ?? "");
  const [price, setPrice] = useState(plan.priceMonthly !== null ? String(plan.priceMonthly / 100) : "");
  const [ent, setEnt] = useState<PlanEntitlements>({ ...plan.entitlements });

  const ent_ = plan.entitlements;

  async function save() {
    setSaving(true);
    const priceMonthly = price.trim() === "" ? null : Math.round(parseFloat(price) * 100);
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, priceMonthly, entitlements: ent }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div style={{ padding: "20px 24px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{plan.displayName}</h2>
          {editing ? (
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                fontSize: 13, color: "#374151", width: "100%", maxWidth: 400,
                border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px",
              }}
            />
          ) : (
            <p style={{ fontSize: 13, color: "#6b7280" }}>{plan.description}</p>
          )}
        </div>
        <div style={{ textAlign: "right", marginLeft: 24 }}>
          {editing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#9ca3af" }}>$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Custom"
                style={{
                  fontSize: 18, fontWeight: 700, width: 80, textAlign: "right",
                  border: "1px solid #d1d5db", borderRadius: 6, padding: "2px 6px",
                }}
              />
              <span style={{ fontSize: 13, color: "#9ca3af" }}>/mo</span>
            </div>
          ) : (
            <p style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
              {plan.priceMonthly ? `$${(plan.priceMonthly / 100).toFixed(0)}` : "Custom"}
              <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>/mo</span>
            </p>
          )}
          <p style={{ fontSize: 12, color: "#9ca3af" }}>{plan.userCount} users</p>
        </div>
      </div>

      {editing ? (
        <div>
          {/* Boolean toggles */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {BOOLEAN_KEYS.map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ent[key] as boolean}
                  onChange={(e) => setEnt((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                  {key.replace("access_", "")}
                </span>
              </label>
            ))}
          </div>
          {/* Number inputs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            {NUMBER_KEYS.map((key) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                  {key.replace(/_/g, " ")}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    min={-1}
                    value={ent[key] as number}
                    onChange={(e) => setEnt((prev) => ({ ...prev, [key]: parseInt(e.target.value) }))}
                    style={{
                      width: 72, fontSize: 13, border: "1px solid #d1d5db",
                      borderRadius: 6, padding: "4px 8px",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>(-1 = ∞)</span>
                </div>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6,
                background: "#111827", color: "#fff", border: "none", cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDescription(plan.description ?? "");
                setPrice(plan.priceMonthly !== null ? String(plan.priceMonthly / 100) : "");
                setEnt({ ...plan.entitlements });
              }}
              style={{
                fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6,
                background: "#f3f4f6", color: "#374151", border: "none", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {Object.entries(ent_).map(([key, val]) => {
              if (typeof val === "boolean") {
                return (
                  <span key={key} style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
                    background: val ? "#dcfce7" : "#f3f4f6",
                    color: val ? "#166534" : "#9ca3af",
                  }}>
                    {key.replace("access_", "")}
                  </span>
                );
              }
              return (
                <span key={key} style={{
                  fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
                  background: "#f3f4f6", color: "#6b7280",
                }}>
                  {key.replace(/_/g, " ")}: {val === -1 ? "unlimited" : val}
                </span>
              );
            })}
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{
              fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
              background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            Edit plan
          </button>
        </div>
      )}
    </div>
  );
}
