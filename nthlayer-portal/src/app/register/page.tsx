"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const POINTS = [
  {
    n: "01",
    title: "Answer five stages of questions",
    body: "Frame your context, diagnose your stack, decide your moves — in under an hour.",
  },
  {
    n: "02",
    title: "Get a ten-section executive report",
    body: "Costed moves, named tools, 90-day plan, sector benchmarks — board-ready.",
  },
  {
    n: "03",
    title: "Leave with a sequenced roadmap",
    body: "Do Now / Do Next / Park / Stop — every move owned, with build-buy-partner-wait decided.",
  },
];

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

    if (!name.trim()) { setError("Please enter your full name"); return; }
    if (!company.trim()) { setError("Please enter your company name"); return; }
    if (!jobTitle.trim()) { setError("Please enter your job title"); return; }
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("That doesn't look like a valid email address."); return; }
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

      router.push("/inflexion/strategy");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    color: "#fff",
    padding: "13px 16px",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    borderRadius: 0,
    WebkitAppearance: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#555",
    marginBottom: 8,
  };

  return (
    <div className="register-page" style={{ height: "100vh", background: "#fff", color: "#111", fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif", WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @media (max-width: 768px) {
          .register-page { height: auto; overflow: auto; }
          .register-nav { padding: 0 20px !important; }
          .register-main { flex-direction: column; overflow: visible; }
          .register-left { display: none; }
          .register-right { padding: 48px 24px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="register-nav" style={{ height: 64, minHeight: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", background: "#ffffff", borderBottom: "1px solid #e8e8e8" }}>
        <a href="/new" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <svg viewBox="0 0 80 80" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
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

      {/* TWO-COLUMN */}
      <div className="register-main" style={{ display: "flex", flex: 1, overflow: "auto" }}>

        {/* LEFT: MARKETING */}
        <div className="register-left" style={{ flex: "0 0 55%", background: "#f7f7f5", borderRight: "1px solid #e8e8e8", padding: "64px 64px 64px 72px", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#111", border: "1px solid #ccc", display: "inline-block", padding: "5px 13px", borderRadius: 100, marginBottom: 32, alignSelf: "flex-start" }}>
            AI Transformation
          </div>

          <h1 style={{ fontSize: "clamp(36px, 3.5vw, 56px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.0, color: "#111", marginBottom: 20 }}>
            AI Transformation<br/>Roadmap
          </h1>

          <p style={{ fontSize: 17, color: "#333", lineHeight: 1.6, maxWidth: 520, marginBottom: 20 }}>
            Inflexion turns &ldquo;we need an AI strategy&rdquo; into a costed, sequenced, board-ready plan &mdash; in hours, not quarters.
          </p>

          <p style={{ fontSize: 15, color: "#888", lineHeight: 1.85, maxWidth: 500, marginBottom: 44 }}>
            You answer five stages of questions about your product, your stack, your workflows, and your team. Inflexion goes away, does the research, and returns a ten-section executive report.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaa", marginBottom: 16 }}>
              How it works
            </div>
            {POINTS.map((p) => (
              <div key={p.n} style={{ borderTop: "1px solid #e4e4e4", padding: "10px 0", display: "grid", gridTemplateColumns: "32px 1fr", gap: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#aaa", paddingTop: 2 }}>{p.n}</span>
                <div>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 4, letterSpacing: "-0.01em" }}>{p.title}</span>
                  <span style={{ display: "block", fontSize: 13, color: "#888", lineHeight: 1.65 }}>{p.body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: FORM */}
        <div className="register-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 56px", background: "#111", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#fff", marginBottom: 8 }}>Create account</h2>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>Start your AI transformation roadmap today.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {error && (
                <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", padding: "12px 16px", fontSize: 13, color: "#dc2626", lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="name" style={labelStyle}>Full Name</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#555")} onBlur={e => (e.target.style.borderColor = "#2a2a2a")} />
              </div>

              <div>
                <label htmlFor="company" style={labelStyle}>Company</label>
                <input id="company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company name" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#555")} onBlur={e => (e.target.style.borderColor = "#2a2a2a")} />
              </div>

              <div>
                <label htmlFor="jobTitle" style={labelStyle}>Job Title</label>
                <input id="jobTitle" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. CPO, CTO, CEO" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#555")} onBlur={e => (e.target.style.borderColor = "#2a2a2a")} />
              </div>

              <div>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#555")} onBlur={e => (e.target.style.borderColor = "#2a2a2a")} />
              </div>

              <div>
                <label htmlFor="password" style={labelStyle}>Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#555")} onBlur={e => (e.target.style.borderColor = "#2a2a2a")} />
                <p style={{ fontSize: 11, color: "#444", marginTop: 6 }}>Minimum 8 characters</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: "100%", background: "#39ff7a", border: "none", color: "#0a1a0d", padding: "14px 24px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1, boxShadow: "0 0 18px rgba(57,255,122,0.4)", transition: "opacity 0.2s, box-shadow 0.2s", marginTop: 4 }}
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>

              <p style={{ textAlign: "center", fontSize: 12, color: "#444", marginTop: 8 }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#777", textDecoration: "none", borderBottom: "1px solid #333" }}>
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
