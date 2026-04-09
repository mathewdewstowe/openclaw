"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const COUNTRIES = [
  "United Kingdom","United States","Germany","France","Netherlands","Sweden","Denmark","Norway","Finland","Belgium",
  "Switzerland","Austria","Spain","Italy","Portugal","Ireland","Australia","Canada","New Zealand","Singapore",
  "Japan","South Korea","India","Brazil","Mexico","UAE","Saudi Arabia","South Africa","Nigeria","Kenya",
  "Israel","Poland","Czech Republic","Romania","Hungary","Greece","Turkey","Argentina","Chile","Colombia",
];

interface Profile {
  name: string;
  url: string;
  location: string;
  icp1: string;
  icp2: string;
  icp3: string;
  territories: string[];
  inflectionPoint: string;
  risks: string;
  bigBet: string;
  aiAmbition: string;
  selfWeakness: string;
  competitor1: string;
  competitor2: string;
  competitor3: string;
  competitor4: string;
  competitor5: string;
}

const EMPTY: Profile = {
  name: "", url: "", location: "",
  icp1: "", icp2: "", icp3: "",
  territories: [],
  inflectionPoint: "", risks: "",
  bigBet: "", aiAmbition: "", selfWeakness: "",
  competitor1: "", competitor2: "", competitor3: "", competitor4: "", competitor5: "",
};

function CountrySelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = COUNTRIES.filter(
    (c) => c.toLowerCase().includes(query.toLowerCase()) && !selected.includes(c)
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function add(country: string) {
    onChange([...selected, country]);
    setQuery("");
  }

  function remove(country: string) {
    onChange(selected.filter((c) => c !== country));
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="min-h-[38px] w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 flex flex-wrap gap-1.5 cursor-text"
        onClick={() => setOpen(true)}
      >
        {selected.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded bg-[var(--primary)]/10 text-[var(--primary)] text-xs px-2 py-0.5">
            {c}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(c); }} className="hover:opacity-70">
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Search countries…" : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm focus:outline-none placeholder:text-[var(--muted-foreground)]"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 20).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => add(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface StrategyScan {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
}

export default function CompanyPage() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [strategyScan, setStrategyScan] = useState<StrategyScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleRegenerate() {
    if (!confirm("Delete the existing product strategy report and regenerate from scratch? This takes ~12 minutes.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/company-profile/regenerate-strategy", { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate");
      const data = await res.json();
      if (data.strategyScan) setStrategyScan(data.strategyScan);
    } catch {
      setError("Failed to regenerate strategy");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete your company profile AND product strategy report? You'll need to fill in everything again.")) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/company-profile", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setProfile(EMPTY);
      setStrategyScan(null);
    } catch {
      setError("Failed to delete profile");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    fetch("/api/company-profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setProfile({
            name: data.profile.name ?? "",
            url: data.profile.url ?? "",
            location: data.profile.location ?? "",
            icp1: data.profile.icp1 ?? "",
            icp2: data.profile.icp2 ?? "",
            icp3: data.profile.icp3 ?? "",
            territories: data.profile.territories ?? [],
            inflectionPoint: data.profile.inflectionPoint ?? "",
            risks: data.profile.risks ?? "",
            bigBet: data.profile.bigBet ?? "",
            aiAmbition: data.profile.aiAmbition ?? "",
            selfWeakness: data.profile.selfWeakness ?? "",
            competitor1: data.profile.competitor1 ?? "",
            competitor2: data.profile.competitor2 ?? "",
            competitor3: data.profile.competitor3 ?? "",
            competitor4: data.profile.competitor4 ?? "",
            competitor5: data.profile.competitor5 ?? "",
          });
        }
        if (data.strategyScan) setStrategyScan(data.strategyScan);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e?: React.FormEvent | React.MouseEvent) {
    if (e) e.preventDefault();
    setError("");

    // Client-side validation: at least 1 competitor
    const competitorCount = [
      profile.competitor1, profile.competitor2, profile.competitor3, profile.competitor4, profile.competitor5,
    ].filter((c) => c.trim().length > 0).length;
    if (competitorCount < 1) {
      setError("Please add at least 1 competitor");
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const data = await res.json();
      if (data.strategyScan) setStrategyScan(data.strategyScan);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function set(field: keyof Profile) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setProfile((p) => ({ ...p, [field]: e.target.value }));
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-[var(--muted)] rounded w-1/3" />
        <div className="h-4 bg-[var(--muted)] rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Company</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              This context shapes every analysis we run for you.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm text-[var(--primary)]">Saved</span>
            )}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Generating..." : "Generate Strategy"}
            </button>
          </div>
        </div>
      </div>

      {strategyScan && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-semibold">Product Strategy</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {strategyScan.status === "COMPLETED"
                  ? "Your product strategy report is ready."
                  : strategyScan.status === "FAILED"
                  ? "Strategy generation failed."
                  : `Generating… ${strategyScan.progress}%`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {strategyScan.status === "COMPLETED" ? (
                <>
                  <Link
                    href={`/scan/${strategyScan.id}`}
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
                  >
                    View Report
                  </Link>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating || deleting}
                    className="rounded-md border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                  >
                    {regenerating ? "Regenerating..." : "Regenerate"}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={regenerating || deleting}
                    className="rounded-md border border-red-200 text-red-600 px-4 py-2 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete & Reset"}
                  </button>
                </>
              ) : strategyScan.status === "RUNNING" || strategyScan.status === "PENDING" ? (
                <>
                  <Link
                    href={`/scan/${strategyScan.id}`}
                    className="rounded-md border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    View Progress
                  </Link>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-md border border-red-200 text-red-600 px-4 py-2 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deleting ? "Cancelling..." : "Cancel & Reset"}
                  </button>
                </>
              ) : strategyScan.status === "FAILED" ? (
                <>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating || deleting}
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {regenerating ? "Regenerating..." : "Retry"}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={regenerating || deleting}
                    className="rounded-md border border-red-200 text-red-600 px-4 py-2 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete & Reset"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
          {(strategyScan.status === "RUNNING" || strategyScan.status === "PENDING") && (
            <div className="mt-3 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full transition-all duration-700"
                style={{ width: `${Math.max(strategyScan.progress, 2)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Company Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={set("name")}
            placeholder="Acme Corp"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Website URL</label>
          <input
            type="url"
            value={profile.url}
            onChange={set("url")}
            placeholder="https://yourcompany.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Location</label>
          <input
            type="text"
            value={profile.location}
            onChange={set("location")}
            placeholder="London, UK"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Territory</label>
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            Markets you sell into.
          </p>
          <CountrySelect
            selected={profile.territories}
            onChange={(v) => setProfile((p) => ({ ...p, territories: v }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Ideal Customer Profiles
          </label>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Describe each ICP in one sentence — who they are, their size, their pain.
          </p>
          <div className="space-y-2">
            {(["icp1", "icp2", "icp3"] as const).map((key, i) => (
              <div key={key} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs font-mono text-[var(--muted-foreground)] w-4 shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={profile[key]}
                  onChange={set(key)}
                  placeholder={
                    i === 0
                      ? "Series B SaaS, 50–200 employees, scaling sales"
                      : i === 1
                      ? "Enterprise HR teams, 500+ employees, HRIS replacement"
                      : "PE-backed software businesses pre-exit"
                  }
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Product Inflection Point</label>
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            The shift in your market, product, or customer that forces a new strategy. Where you are in your journey.
          </p>
          <textarea
            value={profile.inflectionPoint}
            onChange={set("inflectionPoint")}
            rows={6}
            placeholder={"e.g. 'Entering enterprise after 3 years of PLG — we need to move from self-serve to land-and-expand'\n'AI-native incumbents are entering our category and we need to ship our own AI layer in 6 months'\n'Post-Series B, scaling from 50 → 200 — breaking the founder-led GTM model'"}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-y placeholder:text-gray-400 leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Known Risks <span className="font-normal text-[var(--muted-foreground)]">optional</span>
          </label>
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            What keeps you up at night. We&apos;ll pressure-test these and surface risks you might have missed.
          </p>
          <textarea
            value={profile.risks}
            onChange={set("risks")}
            rows={6}
            placeholder={"e.g. 'Key engineering hires leaving for a competitor'\n'Our largest customer (30% of ARR) is up for renewal'\n'A well-funded competitor just launched an AI agent that replaces our core workflow'"}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-y placeholder:text-gray-400 leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">One Big Bet</label>
          <input
            type="text"
            value={profile.bigBet}
            onChange={set("bigBet")}
            placeholder="Building an AI-native workflow layer on top of our core product"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">AI Ambition</label>
          <input
            type="text"
            value={profile.aiAmbition}
            onChange={set("aiAmbition")}
            placeholder="Use AI to reduce manual data entry by 80% within 12 months"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Where are you weakest vs competitors?{" "}
            <span className="font-normal text-[var(--muted-foreground)]">optional — max 2 bullets</span>
          </label>
          <textarea
            value={profile.selfWeakness}
            onChange={set("selfWeakness")}
            maxLength={400}
            rows={3}
            placeholder={"• We don't have a native mobile app\n• Our onboarding takes too long vs Competitor X"}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
          />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {profile.selfWeakness.length}/400 — gives the analysis something to challenge
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Known Competitors <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Add at least 1 competitor (up to 5). We&apos;ll crawl each and analyse them.
          </p>
          <div className="space-y-2">
            {(["competitor1", "competitor2", "competitor3", "competitor4", "competitor5"] as const).map((key, i) => (
              <div key={key} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs font-mono text-[var(--muted-foreground)] w-4 shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={profile[key]}
                  onChange={set(key)}
                  placeholder={i === 0 ? "competitor.com" : ""}
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            ))}
          </div>
        </div>

      </form>

    </div>
  );
}
