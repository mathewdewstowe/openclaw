"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const serverError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [loading, setLoading] = useState(false);

  const error = validationError || serverError;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setValidationError("");

    if (!email.trim()) {
      e.preventDefault();
      setValidationError("Please enter your email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.preventDefault();
      setValidationError("That doesn't look like a valid email address.");
      return;
    }
    if (!password) {
      e.preventDefault();
      setValidationError("Please enter your password");
      return;
    }

    // Validation passed — let the native form submit to /api/auth/login-form
    // The server will set the cookie and redirect. No e.preventDefault().
    setLoading(true);
    try { sessionStorage.removeItem("nthlayer_disclaimer_accepted_v1"); } catch {}
  }

  return (
    <form
      method="post"
      action="/api/auth/login-form"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
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
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
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
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
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
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero banner */}
      <div
        className="relative h-52 sm:h-64 w-full bg-cover bg-center border-b-2 border-gray-900"
        style={{ backgroundImage: "url(/images/hero-tree.jpg)" }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
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
          <a
            href="https://inflexion.nthlayer.co.uk/inflexion"
            className="rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 px-5 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors"
          >
            Inflexion
          </a>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left: marketing panel */}
        <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12 lg:py-16 border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--muted)]/30">
          <div className="w-full max-w-2xl space-y-6">
            <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium tracking-wide uppercase text-[var(--muted-foreground)]">
              Inflexion
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Every product hits an inflection point. The signal is there — if you can cut through the noise.
            </h2>
            <p className="text-lg font-medium text-[var(--foreground)]">
              Inflexion cuts through market noise to surface the signals that matter — so when your product hits an inflection point, you know exactly what to do.
            </p>
            <p className="text-base text-[var(--muted-foreground)]">
              Growth plateaus. A competitor launches. Unit economics shift. The board wants a plan. The data is everywhere, but the signal is buried. Inflexion finds it — turning product inflection points into clear, evidenced strategy.
            </p>
            <ul className="space-y-3 text-base text-[var(--muted-foreground)] leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Cut through noise to detect inflection points before they become crises or missed opportunities.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Extract signal from market data, competitor moves, and customer behaviour.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Turn each inflection point into a clear strategic direction — backed by evidence, not gut feel.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Multi-stage agents that do the analytical heavy lifting so you can focus on the decision.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>Board-ready briefs that surface assumptions, not just conclusions.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right: sign-in form */}
        <div className="flex flex-1 items-start justify-start px-6 pt-20 pb-12 lg:px-12 lg:pt-28 lg:pb-16">
          <div className="w-full max-w-md space-y-8">
            <h1 className="text-4xl font-bold tracking-tight">Sign in</h1>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
