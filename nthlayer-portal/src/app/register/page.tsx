"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!name.trim()) { setError("Please enter your full name"); return; }
    if (!company.trim()) { setError("Please enter your company name"); return; }
    if (!jobTitle.trim()) { setError("Please enter your job title"); return; }
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("That doesn't look like a valid email address. Please check and try again."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), company: company.trim(), jobTitle: jobTitle.trim(), email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/company");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

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

      {/* Centered form */}
      <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-3 text-base text-[var(--muted-foreground)] max-w-sm mx-auto leading-relaxed">
            Product strategy, competitor teardowns &amp; market intelligence for investors and operators.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">Name <span className="text-red-500">*</span></label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your full name" className={inputClass} />
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium mb-1.5">Company <span className="text-red-500">*</span></label>
            <input id="company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="Your company name" className={inputClass} />
          </div>

          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium mb-1.5">Job Title <span className="text-red-500">*</span></label>
            <input id="jobTitle" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required placeholder="e.g. VP Product, Operating Partner" className={inputClass} />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email <span className="text-red-500">*</span></label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className={inputClass} />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">Password <span className="text-red-500">*</span></label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Minimum 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-[var(--muted-foreground)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--primary)] hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
      </div>
    </div>
  );
}
