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
    setLoading(true);
    try { sessionStorage.removeItem("nthlayer_disclaimer_accepted_v1"); } catch {}
  }

  return (
    <form
      method="post"
      action="/api/auth/login-form"
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {error && (
        <div style={{
          background: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.2)",
          padding: "12px 16px",
          fontSize: 13,
          color: "#dc2626",
          lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: 8 }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          style={{
            width: "100%",
            background: "#fff",
            border: "1px solid #c8c8c8",
            color: "#111",
            padding: "13px 16px",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            borderRadius: 0,
            WebkitAppearance: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.target.style.borderColor = "#39ff7a")}
          onBlur={e => (e.target.style.borderColor = "#c8c8c8")}
        />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <label htmlFor="password" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666" }}>
            Password
          </label>
          <Link href="/forgot-password" style={{ fontSize: 11, color: "#1a9e40", textDecoration: "none", fontWeight: 600 }}>
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
          style={{
            width: "100%",
            background: "#fff",
            border: "1px solid #c8c8c8",
            color: "#111",
            padding: "13px 16px",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            borderRadius: 0,
            WebkitAppearance: "none",
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
          width: "100%",
          background: "#39ff7a",
          border: "none",
          color: "#0a1a0d",
          padding: "14px 24px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: loading ? "default" : "pointer",
          fontFamily: "inherit",
          opacity: loading ? 0.6 : 1,
          boxShadow: "0 0 18px rgba(57,255,122,0.4)",
          transition: "opacity 0.2s, box-shadow 0.2s",
          marginTop: 4,
        }}
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 8 }}>
        No account?{" "}
        <Link href="/register" style={{ color: "#1a9e40", textDecoration: "none", fontWeight: 600 }}>
          Register
        </Link>
      </p>
    </form>
  );
}

const DELIVERABLES = [
  {
    n: "01",
    title: "A costed move portfolio",
    body: "Do Now / Do Next / Park / Ignore / Stop — every move sequenced, owned, with build-buy-partner-wait decided.",
  },
  {
    n: "02",
    title: "Specific tool recommendations",
    body: "Named products tied to named moves, with costs. Plus an audit of what you're already paying for and not using.",
  },
  {
    n: "03",
    title: "A 90-day plan with proof metrics",
    body: "Week-numbered actions, named owners, lead and lag indicators the board can track.",
  },
  {
    n: "04",
    title: "The uncomfortable version",
    body: "Sector benchmarks, workflow exposure, and contradictions surfaced on the record — not smoothed for the deck.",
  },
];

export default function LoginPage() {
  return (
    <div className="login-page" style={{ minHeight: "100vh", background: "#e8e8e8", color: "#111", fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column" }}>
      <style>{`
        @media (max-width: 768px) {
          .login-main { flex-direction: column !important; padding: 16px !important; gap: 16px !important; }
          .login-left { display: none !important; }
          .login-right { padding: 36px 28px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        height: 64, minHeight: 64, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
        background: "#e8e8e8",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <svg viewBox="0 0 80 80" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="76" height="76" stroke="#111" strokeWidth="5"/>
            <rect x="14" y="14" width="52" height="52" stroke="#111" strokeWidth="5"/>
            <rect x="26" y="26" width="28" height="28" stroke="#111" strokeWidth="5"/>
            <rect x="35" y="35" width="10" height="10" fill="#111"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#111", lineHeight: 1.25 }}>
            The<br/>Nth Layer
          </span>
        </a>
        <a href="/inflexion" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>
          About Inflexion →
        </a>
      </nav>

      {/* ── MAIN TWO-COLUMN ── */}
      <div className="login-main" style={{ display: "flex", flex: 1, gap: 20, padding: "20px 24px 24px", alignItems: "stretch" }}>

        {/* ── LEFT: MARKETING BOX ── */}
        <div className="login-left" style={{
          flex: "0 0 55%",
          background: "#d4d4d4",
          borderRadius: 20,
          padding: "48px 56px 48px 60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          overflowY: "auto",
        }}>
          {/* Pill */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", border: "1px solid #aaa", display: "inline-block", padding: "5px 13px", borderRadius: 100, marginBottom: 32, alignSelf: "flex-start" }}>
            AI Transformation
          </div>

          {/* Heading */}
          <h1 style={{ fontSize: "clamp(32px, 3vw, 52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.0, color: "#111", marginBottom: 20 }}>
            AI Transformation<br/>Roadmap
          </h1>

          {/* Subhead */}
          <p style={{ fontSize: 20, color: "#333", lineHeight: 1.5, maxWidth: 700, marginBottom: 16 }}>
            Inflexion turns &ldquo;we need an AI strategy&rdquo; into a costed, sequenced, board-ready plan &mdash; in hours, not quarters.
          </p>

          {/* Body */}
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.8, maxWidth: 700, marginBottom: 28 }}>
            You answer five stages of questions about your product, your stack, your workflows, and your team. Inflexion goes away, does the research, and returns a ten-section executive report: where you&rsquo;re exposed, where you&rsquo;re wasting, what to do in the next 90 days, and what good looks like in twelve months.
          </p>

          {/* Deliverables */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#999", marginBottom: 12 }}>
              What you get
            </div>
            {DELIVERABLES.map((d) => (
              <div key={d.n} style={{ borderTop: "1px solid rgba(0,0,0,0.1)", padding: "12px 0", display: "grid", gridTemplateColumns: "36px 1fr", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#999", paddingTop: 3 }}>{d.n}</span>
                <div>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 4, letterSpacing: "-0.01em" }}>{d.title}</span>
                  <span style={{ display: "block", fontSize: 13, color: "#666", lineHeight: 1.65 }}>{d.body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: SIGN-IN BOX ── */}
        <div className="login-right" style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
          background: "#d4d4d4",
          borderRadius: 20,
        }}>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 8 }}>Sign in</h2>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 32, lineHeight: 1.6 }}>Your board-ready AI transformation report is waiting.</p>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>

      </div>
    </div>
  );
}
