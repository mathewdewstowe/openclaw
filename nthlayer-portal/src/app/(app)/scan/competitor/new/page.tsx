"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompetitorTeardownPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/scan/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create scan");
        return;
      }

      const { scanId } = await res.json();
      router.push(`/scan/${scanId}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Competitor Teardown</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Full competitor analysis from a single URL. Public signals only.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Competitor URL *</label>
          <input
            type="url"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            required
            placeholder="https://competitor.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div className="rounded-md bg-[var(--muted)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
          This analysis uses public signals only. No uploads or confidential data required.
        </div>

        <div className="pt-4 border-t border-[var(--border)]">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating scan..." : "Run Teardown"}
          </button>
        </div>
      </form>
    </div>
  );
}
