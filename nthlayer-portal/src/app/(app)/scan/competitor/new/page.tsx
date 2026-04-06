"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompetitorTeardownPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [userQuestion, setUserQuestion] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/scan/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyUrl,
          userQuestion: userQuestion.trim() || undefined,
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
        <h2 className="text-2xl font-bold tracking-tight">New Teardown</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Sharp strategic read on any company using public signals only. No uploads required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Company name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            placeholder="e.g. Salesforce"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Company URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            required
            placeholder="https://company.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            What do you want to understand?{" "}
            <span className="text-[var(--muted-foreground)] font-normal">optional</span>
          </label>
          <textarea
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="e.g. How are they positioning against us in the mid-market?"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {userQuestion.length}/200 — focuses the final editorial
          </p>
        </div>

        <div className="rounded-md bg-[var(--muted)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
          Public signal analysis only. No confidential data required.
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Starting teardown..." : "Run Teardown →"}
          </button>
        </div>
      </form>
    </div>
  );
}
