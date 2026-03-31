"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DealDDScanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [investmentThesis, setInvestmentThesis] = useState("");

  function wordCount(s: string) {
    return s.trim() ? s.trim().split(/\s+/).length : 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/scan/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyUrl,
          investmentThesis: investmentThesis || undefined,
        }),
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
        <h2 className="text-2xl font-bold tracking-tight">Deal / DD Scan</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Assess a target company. Product risk, GTM risk, AI realism, and value creation levers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Target Company URL *</label>
          <input
            type="url"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            required
            placeholder="https://target-company.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Investment Thesis (optional)</label>
          <textarea
            value={investmentThesis}
            onChange={(e) => setInvestmentThesis(e.target.value)}
            rows={4}
            placeholder="What's the thesis? What do you believe about this company?"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
          />
          <span className={`text-xs ${wordCount(investmentThesis) > 200 ? "text-red-400" : "text-[var(--muted-foreground)]"}`}>
            {wordCount(investmentThesis)}/200 words
          </span>
        </div>

        <div className="pt-4 border-t border-[var(--border)]">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating scan..." : "Run DD Scan"}
          </button>
        </div>
      </form>
    </div>
  );
}
