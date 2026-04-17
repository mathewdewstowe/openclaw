"use client";

import { useState } from "react";

/* ─── Nth Layer Marketing One-Pager — nthlayer.co.uk branding ──────────── */
/* Palette: white bg, #0d2b3e navy, Playfair Display headings, Inter body  */

type WaitlistState = "idle" | "loading" | "success" | "error";

export default function OnePagerPage() {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "" });
  const [waitlistState, setWaitlistState] = useState<WaitlistState>("idle");

  function openWaitlist() {
    setWaitlistState("idle");
    setForm({ name: "", email: "", company: "", role: "" });
    setWaitlistOpen(true);
  }

  async function submitWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) return;
    setWaitlistState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setWaitlistState("success");
      } else {
        setWaitlistState("error");
      }
    } catch {
      setWaitlistState("error");
    }
  }

  return (
    <>
      {/* ── LIGHTBOX ─────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Screenshot"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            style={{ objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none font-light hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      {/* ── WAITLIST MODAL ───────────────────────────────────────────────── */}
      {waitlistOpen && (
        <div
          className="fixed inset-0 z-[998] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setWaitlistOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-8 shadow-2xl"
            style={{ background: "#ffffff" }}
            onClick={(e) => e.stopPropagation()}
          >
            {waitlistState === "success" ? (
              <div className="text-center py-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: "#f0fdf4" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3
                  className="text-2xl mb-2"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 600 }}
                >
                  You&rsquo;re on the list
                </h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#6b7280" }}>
                  We&rsquo;ll be in touch when Inflexion opens for early access. We&rsquo;ll keep it short.
                </p>
                <button
                  onClick={() => setWaitlistOpen(false)}
                  className="text-sm font-semibold"
                  style={{ color: "#0d2b3e" }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-6">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold mb-4"
                    style={{ background: "#f0fdf4", color: "#16a34a" }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a3e635", display: "inline-block" }} />
                    Early Waitlist
                  </div>
                  <h3
                    className="text-2xl mb-1"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 600 }}
                  >
                    Get early access to Inflexion
                  </h3>
                  <p className="text-sm" style={{ color: "#6b7280" }}>
                    Board-ready product strategy, built in hours. We&rsquo;ll let you know when we&rsquo;re ready.
                  </p>
                </div>

                <form onSubmit={submitWaitlist} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                      Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your name"
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                      style={{ border: "1px solid #d1d5db", color: "#111827" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                      Work email <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                      style={{ border: "1px solid #d1d5db", color: "#111827" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                      Company <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Company name"
                      required
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                      style={{ border: "1px solid #d1d5db", color: "#111827" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                      Your role <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CEO, CPO, Operating Partner"
                      required
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                      style={{ border: "1px solid #d1d5db", color: "#111827" }}
                    />
                  </div>

                  {waitlistState === "error" && (
                    <p className="text-xs" style={{ color: "#ef4444" }}>Something went wrong — please try again.</p>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={waitlistState === "loading"}
                      className="flex-1 py-3 text-sm font-semibold text-white rounded-lg"
                      style={{ background: "#0d2b3e", opacity: waitlistState === "loading" ? 0.7 : 1 }}
                    >
                      {waitlistState === "loading" ? "Joining…" : "Join the Waitlist"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaitlistOpen(false)}
                      className="px-4 py-3 text-sm font-medium rounded-lg"
                      style={{ color: "#6b7280", background: "#f3f4f6" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen"
        style={{ background: "#ffffff", color: "#1a1a1a", fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}
      >
        {/* ── NAV ────────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b" style={{ borderColor: "#e8e8e8" }}>
          <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2.5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="1" y="1" width="22" height="22" stroke="#0d2b3e" strokeWidth="1.6" />
                <rect x="5" y="5" width="14" height="14" stroke="#0d2b3e" strokeWidth="1.3" />
                <rect x="8.5" y="8.5" width="7" height="7" stroke="#0d2b3e" strokeWidth="1.1" />
              </svg>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 600, color: "#0d2b3e" }}>
                The Nth Layer
              </span>
            </div>
            <button
              onClick={openWaitlist}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ background: "#0d2b3e" }}
            >
              Waitlist
            </button>
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left */}
              <div>
                <div
                  className="inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide uppercase mb-5"
                  style={{ borderColor: "#0d2b3e", color: "#0d2b3e" }}
                >
                  Inflexion
                </div>
                <h1
                  className="text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.15] mb-6"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
                >
                  Board-ready Product Strategy, built in hours — not months
                </h1>
              </div>
              {/* Right */}
              <div className="pt-4 lg:pt-16">
                <p className="text-lg leading-relaxed mb-8" style={{ color: "#4a4a4a" }}>
                  Markets shift. Competitors move. Technology rewrites the rules.{" "}
                  Inflexion takes you from &ldquo;something changed&rdquo; to a committed direction, strategic bets, and a 100-day execution plan &mdash; backed by live evidence, not gut feel.
                </p>
                <button
                  onClick={openWaitlist}
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-white"
                  style={{ background: "#0d2b3e", borderRadius: 8 }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a3e635", display: "inline-block" }} />
                  Waitlist
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Hero dashboard band ────────────────────────────────────────── */}
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div
            className="group cursor-zoom-in"
            onClick={() => setLightbox("/screenshot-dashboard.png")}
          >
            <img
              src="/screenshot-dashboard.png"
              alt="Inflexion Dashboard"
              className="w-full transition-opacity duration-300 group-hover:opacity-95"
              style={{ display: "block" }}
            />
          </div>
        </div>

        {/* ── THE PROBLEM ────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-xs font-semibold tracking-widest uppercase mb-6" style={{ color: "#0d2b3e" }}>
              The Problem
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <div>
                <h2
                  className="text-3xl sm:text-4xl mb-6"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
                >
                  Markets shift.<br />Competitors move.<br />You have weeks — not months.
                </h2>
              </div>
              <div className="space-y-6 pt-1">
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>
                  Inflection points don&rsquo;t wait. When something significant changes — your competitive position, the technology landscape, your funding situation — the window to respond with a clear, committed direction is short. Indecision is a choice, and it compounds.
                </p>
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>
                  Inflexion is built for exactly this moment. It runs autonomous research against live market data — G2, Gartner, Forrester, SaaS benchmarks, competitor sites, hiring signals — and produces board-grade strategy with explicit confidence scoring, evidence citation, and testable assumptions. From &ldquo;something changed&rdquo; to a committed direction, in hours.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── THE FRAMEWORK ──────────────────────────────────────────────── */}
        <section id="framework" className="py-12 sm:py-16" style={{ background: "#f7f7f5" }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#0d2b3e" }}>
                The Framework
              </p>
              <h2
                className="text-3xl sm:text-4xl mb-4"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
              >
                From Product Inflection to Execution Plan
              </h2>
              <p className="text-base leading-relaxed" style={{ color: "#666" }}>
                Five stages. Each one answers a specific question, builds on the last, and produces a decision-ready report. Answer 5&ndash;7 guided questions per stage &mdash; the platform handles the research and analysis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                {
                  num: 1,
                  name: "Frame",
                  subtitle: "Define the decision",
                  desc: "What changed and what does winning look like? Sets the strategic question and builds a register of testable assumptions.",
                },
                {
                  num: 2,
                  name: "Diagnose",
                  subtitle: "Establish what is true",
                  desc: "15 autonomous research tasks across analysts, competitors, benchmarks, and reviews. Names the gap between where you are and where you need to be.",
                },
                {
                  num: 3,
                  name: "Decide",
                  subtitle: "Choose the direction",
                  desc: "3–5 real options scored against six criteria. One explicit recommendation, with kill criteria and cost of inaction quantified.",
                },
                {
                  num: 4,
                  name: "Position",
                  subtitle: "Define how you win",
                  desc: "Who you serve and why it's defensible. Positioning statement, competitive frame, and GTM requirements — grounded in live buyer and market data.",
                },
                {
                  num: 5,
                  name: "Commit",
                  subtitle: "Build the execution plan",
                  desc: "Named strategic bets with confidence scores, a 100-day plan, OKRs, and pre-agreed kill criteria. No ambiguity about what happens next.",
                },
              ].map((stage) => (
                <div
                  key={stage.name}
                  className="p-6 flex flex-col"
                  style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 12 }}
                >
                  <div
                    className="flex items-center justify-center h-9 w-9 rounded-full text-white text-sm font-bold shrink-0 mb-4"
                    style={{ background: "#0d2b3e" }}
                  >
                    {stage.num}
                  </div>
                  <h3
                    className="text-2xl mb-1"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 700 }}
                  >
                    {stage.name}
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#aaa" }}>{stage.subtitle}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#555" }}>{stage.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16" style={{ background: "#0d2b3e" }}>
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
              How It Works
            </p>
            <h2
              className="text-3xl sm:text-4xl mb-10"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#ffffff", fontWeight: 400 }}
            >
              Signal in. Strategy out.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: "01", title: "Tell us about your business", desc: "A few basics about your company and market. Inflexion builds your profile and identifies your competitive context automatically." },
                { step: "02", title: "Answer guided questions", desc: "5\u20137 per stage, to scope the decision and bring in what only you know." },
                { step: "03", title: "Live research runs", desc: "Each stage pulls from live sources \u2014 competitor sites, funding data, news, job postings \u2014 and scores every claim." },
                { step: "04", title: "Review the output", desc: "Structured reports with sourced evidence, confidence scores, and clear recommendations. Ready to share or act on." },
              ].map((item) => (
                <div key={item.step}>
                  <span className="text-4xl sm:text-5xl font-bold mb-3 block" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {item.step}
                  </span>
                  <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHAT YOU GET ───────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#0d2b3e" }}>
                What You Get
              </p>
              <h2
                className="text-3xl sm:text-4xl"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
              >
                Evidence in. Decisions out.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Live Evidence",
                  desc: "Every stage pulls from current sources \u2014 not stale data or pre-built templates. The analysis reflects what\u2019s happening in your market right now.",
                },
                {
                  title: "Confidence Scores",
                  desc: "Every claim carries a confidence score. You see where the evidence is strong, where it\u2019s thin, and where the system says \u2018we don\u2019t know\u2019.",
                },
                {
                  title: "Cumulative Context",
                  desc: "Each stage builds on the last. Your company profile, prior decisions, and evidence carry forward \u2014 no re-briefing, no context loss.",
                },
                {
                  title: "Structured Reports",
                  desc: "Every stage produces a report you can share with your board, investors, or team. Assumptions surfaced, gaps flagged, recommendations ranked.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6"
                  style={{ border: "1px solid #e8e8e8", borderRadius: 12, background: "#fafafa" }}
                >
                  <h3 className="text-xl font-semibold mb-2" style={{ color: "#0d2b3e" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#666" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THE OUTPUT ─────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16" style={{ background: "#f7f7f5" }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#0d2b3e" }}>The Output</p>
                <h2
                  className="text-3xl sm:text-4xl mb-6"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
                >
                  Actionable. Board-ready. Every claim evidence-based.
                </h2>
                <p className="text-base leading-relaxed mb-6" style={{ color: "#4a4a4a" }}>
                  After all five stages, Inflexion produces a single board-ready document — not a summary, but a synthesis. Fifteen sections. Four appendices. Every recommendation traceable to its evidence.
                </p>
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>
                  The appendices include a confidence waterfall decomposed by stage, an evidence gap register, a hypothesis register showing every assumption&rsquo;s validation status, and a complete deduplicated source list. Designed for PE and board audiences: quantified, evidence-cited, assumption-explicit, and structured around governance rhythms investors expect.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "Executive Summary", "Strategic Moment", "Current Reality", "Competitive Landscape",
                  "Options & Decision Matrix", "Recommended Direction", "Strategic Trade-offs", "What Must Be True",
                  "Market Position", "Competitive Advantage", "Strategic Bets + Confidence", "100-Day Plan",
                  "Governance & Kill Criteria", "Resource Implications", "Exit & Value-Creation Implications",
                ].map((section, i) => (
                  <div
                    key={section}
                    className={`px-4 py-3 flex items-center gap-3${i === 0 ? " col-span-2 justify-center" : ""}`}
                    style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e8e8e8" }}
                  >
                    <span className="text-xs font-mono shrink-0" style={{ color: "#bbb" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-xs font-medium leading-tight" style={{ color: "#0d2b3e" }}>{section}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER CTA ─────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16" style={{ background: "#0d2b3e" }}>
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2
              className="text-3xl sm:text-4xl mb-5"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#ffffff", fontWeight: 400 }}
            >
              The market changed. What are you going to do about it?
            </h2>
            <p className="mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
              Built for PE portfolio reviews, board strategy sessions, and leadership teams at inflection points.
            </p>
            <button
              onClick={openWaitlist}
              className="inline-flex items-center gap-2 px-10 py-4 text-base font-semibold rounded-lg"
              style={{ background: "#ffffff", color: "#0d2b3e" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a3e635", display: "inline-block" }} />
              Waitlist
            </button>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer className="py-8" style={{ borderTop: "1px solid #e8e8e8" }}>
          <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="1" y="1" width="22" height="22" stroke="#0d2b3e" strokeWidth="1.6" />
                <rect x="5" y="5" width="14" height="14" stroke="#0d2b3e" strokeWidth="1.3" />
                <rect x="8.5" y="8.5" width="7" height="7" stroke="#0d2b3e" strokeWidth="1.1" />
              </svg>
              <span className="text-sm font-semibold" style={{ color: "#0d2b3e" }}>The Nth Layer</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
