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
    <div style={{ minHeight: "100vh", background: "#e8e8e8", display: "flex", flexDirection: "column", fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif", WebkitFontSmoothing: "antialiased" as const }}>

      {/* NAV */}
      <nav style={{ height: 64, minHeight: 64, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 32px", background: "#e8e8e8" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <svg viewBox="0 0 80 80" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="76" height="76" stroke="#111" strokeWidth="5"/>
            <rect x="14" y="14" width="52" height="52" stroke="#111" strokeWidth="5"/>
            <rect x="26" y="26" width="28" height="28" stroke="#111" strokeWidth="5"/>
            <rect x="35" y="35" width="10" height="10" fill="#111"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#111", lineHeight: 1.25 }}>
            The<br/>Nth Layer
          </span>
        </a>
      </nav>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: 420, background: "#d4d4d4", borderRadius: 20, padding: "48px 44px" }}>

          {done ? (
            <>
              <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 12 }}>Check your inbox</h2>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.65, marginBottom: 8 }}>
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
              </p>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 32 }}>
                Check your spam folder if you don&apos;t see it. The link expires in 1 hour.
              </p>
              <Link href="/login" style={{ fontSize: 13, color: "#1a9e40", textDecoration: "none", fontWeight: 600 }}>
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 8 }}>Reset your password</h2>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 32 }}>
                Enter your email and we&apos;ll send you a link to reset it.
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label htmlFor="email" style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#666", marginBottom: 8 }}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    style={{
                      width: "100%", padding: "13px 16px", fontSize: 14,
                      background: "#fff", border: "1px solid #c8c8c8",
                      borderRadius: 8, outline: "none", fontFamily: "inherit",
                      color: "#111", boxSizing: "border-box" as const,
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#39ff7a")}
                    onBlur={e => (e.target.style.borderColor = "#c8c8c8")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "14px 24px", fontSize: 12, fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase" as const,
                    background: "#39ff7a", color: "#0a1a0d", border: "none",
                    borderRadius: 8, cursor: loading ? "default" : "pointer",
                    fontFamily: "inherit", opacity: loading ? 0.6 : 1,
                    boxShadow: "0 0 18px rgba(57,255,122,0.4)",
                  }}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>

                <p style={{ textAlign: "center", fontSize: 13, color: "#666", margin: 0 }}>
                  Remember your password?{" "}
                  <Link href="/login" style={{ color: "#1a9e40", textDecoration: "none", fontWeight: 600 }}>
                    Sign in
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
