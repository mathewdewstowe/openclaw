"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EMPTY_PRIORITIES = ["", "", ""];
const EMPTY_COMPETITORS = ["", "", ""];

export default function SelfScanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [companyUrl, setCompanyUrl] = useState("");
  const [icp, setIcp] = useState("");
  const [priorities, setPriorities] = useState<string[]>([...EMPTY_PRIORITIES]);
  const [bigBet, setBigBet] = useState("");
  const [aiAmbition, setAiAmbition] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([...EMPTY_COMPETITORS]);
  const [selfWeakness, setSelfWeakness] = useState("");

  function setPriority(i: number, val: string) {
    setPriorities((prev) => prev.map((p, idx) => (idx === i ? val : p)));
  }

  function setCompetitor(i: number, val: string) {
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? val : c)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/scan/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyUrl,
          icp,
          priorities,
          bigBet,
          aiAmbition,
          competitors,
          selfWeakness: selfWeakness.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start scan");
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
        <h2 className="text-2xl font-bold tracking-tight">Self Scan</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Strategic and competitive analysis based on your positioning, priorities, and market signals.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Your company URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            required
            placeholder="https://yourcompany.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            ICP — who you sell to <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={icp}
            onChange={(e) => setIcp(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Series B SaaS companies with 50–200 employees scaling their sales team"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            3 priorities right now <span className="text-red-400">*</span>
          </label>
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <input
                key={i}
                type="text"
                value={p}
                onChange={(e) => setPriority(i, e.target.value)}
                required
                placeholder={`Priority ${i + 1}`}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Your 1 big bet <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={bigBet}
            onChange={(e) => setBigBet(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Building an AI-native workflow layer on top of our core product"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            AI ambition <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={aiAmbition}
            onChange={(e) => setAiAmbition(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Use AI to reduce manual data entry by 80% within 12 months"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            3 main competitors <span className="text-red-400">*</span>
          </label>
          <div className="space-y-2">
            {competitors.map((c, i) => (
              <input
                key={i}
                type="url"
                value={c}
                onChange={(e) => setCompetitor(i, e.target.value)}
                required
                placeholder={`https://competitor${i + 1}.com`}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Where are you weakest vs competitors?{" "}
            <span className="text-[var(--muted-foreground)] font-normal">optional — max 2 bullets</span>
          </label>
          <textarea
            value={selfWeakness}
            onChange={(e) => setSelfWeakness(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder={"• We don't have a native mobile app\n• Our onboarding takes too long vs Competitor X"}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {selfWeakness.length}/400 — gives the analysis something to challenge
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
            {loading ? "Starting scan..." : "Run Self Scan →"}
          </button>
        </div>
      </form>
    </div>
  );
}
