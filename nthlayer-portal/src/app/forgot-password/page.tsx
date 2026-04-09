"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setDone(true);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero banner */}
      <div
        className="relative h-24 sm:h-28 w-full bg-cover bg-center border-b-2 border-gray-900"
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

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
            <p className="mt-3 text-base text-[var(--muted-foreground)] max-w-sm mx-auto leading-relaxed">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {done ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-center">
              <p className="text-sm text-[var(--foreground)]">
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
              </p>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Check your inbox (and spam folder). The link expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="inline-block mt-4 text-sm text-[var(--primary)] hover:underline"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
              <p className="text-center text-sm text-[var(--muted-foreground)]">
                Remember your password?{" "}
                <Link href="/login" className="text-[var(--primary)] hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
