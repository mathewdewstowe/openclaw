"use client";

import { useState } from "react";

const INTEGRATIONS = [
  {
    label: "CRM",
    detail: "Salesforce, HubSpot, Pipedrive",
    description: "Pull in deal history, pipeline stage, and account signals to enrich competitive analysis with real commercial context.",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    label: "Analytics",
    detail: "Mixpanel, Amplitude, GA",
    description: "Layer in product usage patterns, retention curves, and feature adoption to understand where you're winning and losing.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    label: "Data Warehouse",
    detail: "Snowflake, BigQuery, Redshift",
    description: "Connect your internal data warehouse to ground every analysis in your own proprietary signals, not just public data.",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  },
  {
    label: "Support",
    detail: "Zendesk, Intercom, Freshdesk",
    description: "Surface recurring objections, churn signals, and competitor mentions from support tickets to sharpen your positioning.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    label: "Billing",
    detail: "Stripe, Chargebee, Recurly",
    description: "Understand revenue patterns, expansion velocity, and churn triggers — and how they map to competitive pressure.",
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
];

export default function IntegrationsPage() {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");

  async function handleInterest(label: string) {
    if (!email) return;
    setSubmitting(label);
    try {
      await fetch("/api/integrations/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, integration: label }),
      });
      setSubmitted((s) => new Set(s).add(label));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Connect your internal systems to enrich every analysis with real evidence, not just public signals.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 mb-8 flex items-center gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com — notify me when available"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[var(--muted-foreground)]"
        />
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 rounded-lg bg-[var(--muted)] p-2 shrink-0">
                <svg className="h-5 w-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div>
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="ml-2 text-xs text-[var(--muted-foreground)]">{item.detail}</span>
                  </div>
                  <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full shrink-0">
                    Coming Soon
                  </span>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">{item.description}</p>
                <div className="mt-3">
                  {submitted.has(item.label) ? (
                    <span className="text-xs text-[var(--primary)]">We&apos;ll notify you</span>
                  ) : (
                    <button
                      onClick={() => handleInterest(item.label)}
                      disabled={!email || submitting === item.label}
                      className="text-xs border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] disabled:opacity-40 transition-colors"
                    >
                      {submitting === item.label ? "Saving…" : "Notify me"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
