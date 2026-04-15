"use client";

import { useState } from "react";

interface PlanData {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number | null;
  priceAnnual: number | null;
  entitlements: Record<string, unknown>;
  hasStripePrice: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  access_diagnose: "Diagnose",
  access_decide: "Decide",
  access_position: "Position",
  access_act: "Act & Commit",
  access_competitor: "Competitor Intel",
  access_export: "Export",
  access_portfolio: "Portfolio Management",
};

export function PlanCards({
  plans,
  currentPlanName,
  hasSubscription,
  hasCustomer,
}: {
  plans: PlanData[];
  currentPlanName: string;
  hasSubscription: boolean;
  hasCustomer: boolean;
}) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong");
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleManageBilling() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {/* Interval toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setInterval("monthly")}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: interval === "monthly" ? "#111827" : "#fff",
            color: interval === "monthly" ? "#fff" : "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("annual")}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: interval === "annual" ? "#111827" : "#fff",
            color: interval === "annual" ? "#fff" : "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Annual <span style={{ fontSize: 11, color: interval === "annual" ? "#93c5fd" : "#9ca3af" }}>Save 20%</span>
        </button>
      </div>

      {/* Manage billing (if subscribed) */}
      {hasSubscription && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={handleManageBilling}
            disabled={loading === "portal"}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {loading === "portal" ? "Loading..." : "Manage Billing & Invoices"}
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {plans.map((plan) => {
          const isCurrent = plan.displayName === currentPlanName;
          const price = interval === "annual" ? plan.priceAnnual : plan.priceMonthly;
          const monthlyEquiv = interval === "annual" && plan.priceAnnual ? Math.round(plan.priceAnnual / 12) : price;

          return (
            <div
              key={plan.id}
              style={{
                padding: "24px 20px",
                border: isCurrent ? "2px solid #2563eb" : "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#fff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{plan.displayName}</h3>
                  {isCurrent && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#dbeafe",
                      color: "#1d4ed8",
                    }}>
                      Current
                    </span>
                  )}
                </div>
                {plan.description && (
                  <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{plan.description}</p>
                )}
              </div>

              {/* Price */}
              <div style={{ marginBottom: 16 }}>
                {price ? (
                  <>
                    <span style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
                      ${Math.round((monthlyEquiv ?? 0) / 100)}
                    </span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>/mo</span>
                    {interval === "annual" && (
                      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        Billed ${Math.round((plan.priceAnnual ?? 0) / 100)}/year
                      </p>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>Free</span>
                )}
              </div>

              {/* Features */}
              <div style={{ flex: 1, marginBottom: 16 }}>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                  const has = !!plan.entitlements[key];
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: has ? "#059669" : "#d1d5db" }}>
                        {has ? "\u2713" : "\u2717"}
                      </span>
                      <span style={{ fontSize: 12, color: has ? "#374151" : "#9ca3af" }}>{label}</span>
                    </div>
                  );
                })}
                <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 8, paddingTop: 8 }}>
                  <p style={{ fontSize: 11, color: "#6b7280" }}>
                    {(plan.entitlements.max_companies as number) === -1
                      ? "Unlimited companies"
                      : `${plan.entitlements.max_companies} company${(plan.entitlements.max_companies as number) > 1 ? "ies" : ""}`}
                  </p>
                  <p style={{ fontSize: 11, color: "#6b7280" }}>
                    {(plan.entitlements.max_jobs_per_month as number) === -1
                      ? "Unlimited analyses/month"
                      : `${plan.entitlements.max_jobs_per_month} analyses/month`}
                  </p>
                </div>
              </div>

              {/* CTA */}
              {isCurrent ? (
                <div style={{
                  padding: "10px 0",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#6b7280",
                }}>
                  Current plan
                </div>
              ) : plan.name === "free" ? (
                <div style={{
                  padding: "10px 0",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#9ca3af",
                }}>
                  Free tier
                </div>
              ) : plan.name === "enterprise" ? (
                <a
                  href="mailto:hello@nthlayer.co.uk?subject=Enterprise%20Plan"
                  style={{
                    display: "block",
                    padding: "10px 0",
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    textDecoration: "none",
                  }}
                >
                  Contact Sales
                </a>
              ) : plan.hasStripePrice ? (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                  style={{
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "none",
                    background: "#111827",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading === plan.id ? "not-allowed" : "pointer",
                    opacity: loading === plan.id ? 0.6 : 1,
                  }}
                >
                  {loading === plan.id ? "Redirecting..." : "Subscribe"}
                </button>
              ) : (
                <div style={{
                  padding: "10px 0",
                  textAlign: "center",
                  fontSize: 12,
                  color: "#9ca3af",
                }}>
                  Coming soon
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
