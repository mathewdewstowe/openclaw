"use client";

import { useState } from "react";

const integrations = [
  { id: "crm", label: "CRM", description: "Salesforce, HubSpot, Pipedrive" },
  { id: "analytics", label: "Analytics", description: "Mixpanel, Amplitude, GA" },
  { id: "warehouse", label: "Data Warehouse", description: "Snowflake, BigQuery, Redshift" },
  { id: "support", label: "Support", description: "Zendesk, Intercom, Freshdesk" },
  { id: "billing", label: "Billing", description: "Stripe, Chargebee, Recurly" },
];

export default function SettingsPage() {
  const [interested, setInterested] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  async function handleInterest(integration: string) {
    setSaving(integration);
    try {
      await fetch("/api/integration-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration }),
      });
      setInterested((prev) => new Set(prev).add(integration));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-1">Connect Internal Systems</h3>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Coming soon. Register your interest and we&apos;ll notify you when integrations are available.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {integrations.map((i) => (
            <div
              key={i.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">{i.label}</h4>
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">{i.description}</p>
              {interested.has(i.id) ? (
                <span className="text-xs text-[var(--primary)]">Registered</span>
              ) : (
                <button
                  onClick={() => handleInterest(i.id)}
                  disabled={saving === i.id}
                  className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
                >
                  {saving === i.id ? "Saving..." : "I'm interested"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
