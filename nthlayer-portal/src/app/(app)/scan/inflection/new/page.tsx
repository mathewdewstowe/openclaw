"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InflectionScanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [companyUrl, setCompanyUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [priorities, setPriorities] = useState(["", "", ""]);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState([""]);
  const [competitors, setCompetitors] = useState(["", "", ""]);

  function wordCount(s: string) {
    return s.trim() ? s.trim().split(/\s+/).length : 0;
  }

  function addStep() {
    if (workflowSteps.length < 5) setWorkflowSteps([...workflowSteps, ""]);
  }

  function removeStep(i: number) {
    if (workflowSteps.length > 1) setWorkflowSteps(workflowSteps.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/scan/inflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyUrl,
          companyName: companyName || undefined,
          priorities: priorities.filter(Boolean),
          workflow: { name: workflowName, steps: workflowSteps.filter(Boolean) },
          competitors: competitors.filter(Boolean),
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
        <h2 className="text-2xl font-bold tracking-tight">Inflection Scan</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Full strategic scan. Positioning, competitive reality, value creation, and CEO actions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Company URL *</label>
          <input
            type="url"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            required
            placeholder="https://example.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Auto-detected if not provided"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Top 3 Strategic Priorities *</label>
          <div className="space-y-3">
            {priorities.map((p, i) => (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted-foreground)] w-4">{i + 1}.</span>
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => {
                      const next = [...priorities];
                      next[i] = e.target.value;
                      setPriorities(next);
                    }}
                    required
                    placeholder={`Priority ${i + 1}`}
                    className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
                <div className="ml-6 mt-1">
                  <span className={`text-xs ${wordCount(p) > 15 ? "text-red-400" : "text-[var(--muted-foreground)]"}`}>
                    {wordCount(p)}/15 words
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Key Workflow *</label>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            required
            placeholder="e.g. Customer onboarding"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <label className="block text-xs text-[var(--muted-foreground)] mb-2">
            Steps ({workflowSteps.length}/5)
          </label>
          <div className="space-y-2">
            {workflowSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)] w-4">{i + 1}.</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => {
                    const next = [...workflowSteps];
                    next[i] = e.target.value;
                    setWorkflowSteps(next);
                  }}
                  required
                  placeholder={`Step ${i + 1}`}
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                {workflowSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="text-[var(--muted-foreground)] hover:text-red-400 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {workflowSteps.length < 5 && (
            <button
              type="button"
              onClick={addStep}
              className="mt-2 text-sm text-[var(--primary)] hover:underline"
            >
              + Add step
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">3 Competitors *</label>
          <div className="space-y-3">
            {competitors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)] w-4">{i + 1}.</span>
                <input
                  type="url"
                  value={c}
                  onChange={(e) => {
                    const next = [...competitors];
                    next[i] = e.target.value;
                    setCompetitors(next);
                  }}
                  required
                  placeholder={`https://competitor${i + 1}.com`}
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border)]">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating scan..." : "Run Inflection Scan"}
          </button>
        </div>
      </form>
    </div>
  );
}
