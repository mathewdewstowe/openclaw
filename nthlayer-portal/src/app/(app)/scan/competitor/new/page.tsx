"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CompetitorTeardownPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [userQuestion, setUserQuestion] = useState("");

  const [usage, setUsage] = useState<{ count: number; max: number; limitReached: boolean } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    fetch("/api/scan/competitor")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.count === "number") setUsage(data);
      })
      .catch(() => {})
      .finally(() => setUsageLoading(false));
  }, []);

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
        if (data.error === "LIMIT_REACHED") {
          setUsage({ count: data.count, max: data.max, limitReached: true });
          return;
        }
        setError(data.message || data.error || "Failed to create scan");
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

  async function handleRequestMore() {
    setRequesting(true);
    try {
      await fetch("/api/scan/competitor/request-more", { method: "POST" });
      setRequestSent(true);
    } catch {
      // silent
    } finally {
      setRequesting(false);
    }
  }

  if (usageLoading) {
    return (
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-[var(--muted)] rounded w-1/3" />
        <div className="h-4 bg-[var(--muted)] rounded w-2/3" />
      </div>
    );
  }

  if (usage?.limitReached) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">New Teardown</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Sharp strategic read on any company using public signals only.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold">You&apos;ve reached your limit</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-2 max-w-sm mx-auto">
            You&apos;ve used {usage.count} of {usage.max} competitor teardowns. Request more and we&apos;ll get back to you.
          </p>

          {requestSent ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Request sent — we&apos;ll be in touch.
            </div>
          ) : (
            <button
              onClick={handleRequestMore}
              disabled={requesting}
              className="mt-6 rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {requesting ? "Sending..." : "Request More"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Teardown</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Sharp strategic read on any company using public signals only. No uploads required.
          </p>
        </div>
        {usage && (
          <div className="shrink-0 rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
            {usage.count}/{usage.max} used
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
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
