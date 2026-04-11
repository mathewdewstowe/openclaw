"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("That doesn't look like a valid email address. Please check and try again."); return; }
    if (!password) { setError("Please enter your password"); return; }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      // Reset disclaimer so it shows again after every login
      try { sessionStorage.removeItem("nthlayer_disclaimer_accepted_v1"); } catch {}

      router.push("/inflexion/overview");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero banner */}
      <div
        className="relative h-52 sm:h-64 w-full bg-cover bg-center border-b-2 border-gray-900"
        style={{ backgroundImage: "url(/images/hero-tree.jpg)" }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex items-center gap-3 px-6 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 shadow-lg">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="1" width="22" height="22" stroke="white" strokeWidth="1.8" />
              <rect x="4.5" y="4.5" width="15" height="15" stroke="white" strokeWidth="1.5" />
              <rect x="7.5" y="7.5" width="9" height="9" stroke="white" strokeWidth="1.3" />
              <rect x="10" y="10" width="4" height="4" stroke="white" strokeWidth="1.1" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white drop-shadow">Nth Layer</span>
        </div>
      </div>

      {/* Two-column layout: marketing panel left, form right */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left: marketing panel */}
        <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12 lg:py-16 border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--muted)]/30">
          <div className="w-full max-w-lg space-y-6">
            <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium tracking-wide uppercase text-[var(--muted-foreground)]">
              Introducing Inflexion
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              The Product Strategy Engine for Investors and Operators.
            </h2>
            <p className="text-lg font-medium text-[var(--foreground)]">
              Stop second-guessing your next move. Inflexion does the strategic heavy lifting — so you arrive at better decisions, faster, with the evidence to back them up.
            </p>
            <p className="text-base text-[var(--muted-foreground)]">
              Built for the moments that define what a business becomes: when growth stalls, a deal closes, a competitor moves, or the board needs an answer.
            </p>
            <ul className="space-y-3 text-base text-[var(--muted-foreground)] leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Turn a product inflection point into a clear, evidenced strategic direction.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Decisions grounded in proven frameworks — not gut feel or generic advice.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Multi-stage agents that work through complexity so you don&apos;t have to.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Board-ready briefs that surface assumptions, not just conclusions.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Built for PE investors, VCs, and portfolio companies who move fast and need to be right.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right: sign-in form */}
        <div className="flex flex-1 items-center justify-start px-6 py-12 lg:px-12 lg:py-16">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-[var(--primary)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-sm text-[var(--muted-foreground)]">
            No account?{" "}
            <Link href="/register" className="text-[var(--primary)] hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
        </div>
      </div>
    </div>
  );
}
