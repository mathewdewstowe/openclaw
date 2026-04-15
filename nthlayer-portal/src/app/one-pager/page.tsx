"use client";

import { useState } from "react";

/* ─── Nth Layer Marketing One-Pager — nthlayer.co.uk branding ──────────── */
/* Palette: white bg, #0d2b3e navy, Playfair Display headings, Inter body  */

export default function OnePagerPage() {
  const [lightbox, setLightbox] = useState<string | null>(null);

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
                  Product Strategy for Inflection Points
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
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-white cursor-default"
                  style={{ background: "#0d2b3e", borderRadius: 8, opacity: 0.75 }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a3e635", display: "inline-block" }} />
                  Coming Soon
                </a>
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
                  A five-figure engagement, six to twelve weeks, shaped by the consultant's pattern-matching as much as your situation. By the time it lands, the market has moved.
                </h2>
              </div>
              <div className="space-y-6 pt-1">
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>
                  Board-grade product strategy requires research, synthesis, judgement, alignment, and commitment. Done properly, that process takes weeks — and by the time it lands, the market has often moved again.
                </p>
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>
                  Inflexion compresses that timeline without cutting corners. It runs autonomous research against live market data — G2, Gartner, Forrester, SaaS benchmarks, competitor sites, hiring signals — and produces board-grade reports with explicit confidence scoring, evidence citation, and testable assumptions. Every claim is grounded. Where data is missing, the system says so.
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

            <div className="space-y-5">
              {[
                {
                  num: 1,
                  name: "Frame",
                  subtitle: "Define the decision",
                  desc: "What changed? What does winning look like? Frame establishes the boundaries of the strategic question. The system researches your positioning narrative, funding history, analyst placement across Gartner and Forrester, and independently identifies five to seven competitors through G2, analyst reports, and review sites. Output: a hypothesis register of 8–15 testable assumptions, each tagged to the stage that will test it.",
                },
                {
                  num: 2,
                  name: "Diagnose",
                  subtitle: "Establish what is true",
                  desc: "Where do you actually stand? Fifteen autonomous research tasks run across Gartner MQ and Forrester Wave positioning, competitor funding and product launches, market sizing triangulated from six analyst sources, NRR and growth benchmarks from SaaS Capital, OpenView, and Benchmarkit, and third-party reviews across G2, TrustRadius, Capterra, and Gartner Peer Insights. Output: the gap between aspiration and reality, with binding constraints named.",
                },
                {
                  num: 3,
                  name: "Decide",
                  subtitle: "Choose the direction",
                  desc: "Three to five genuine options — including status quo — scored in a weighted decision matrix across six criteria: resource fit, competitive defensibility, investor alignment, time-to-validation, risk profile, and market size. The system researches comparable PE-backed SaaS repositioning case studies and quantifies the cost of inaction. Output: one explicit recommendation, kill criteria, and two to three company analogies.",
                },
                {
                  num: 4,
                  name: "Position",
                  subtitle: "Define how you win",
                  desc: "Who do you serve and what makes it defensible? The system researches buyer search behaviour, G2 category placement, competitor positioning language, target buyer job descriptions to reveal procurement criteria, and publicly available RFP evaluation criteria. Output: a positioning statement, narrative gap analysis, competitive frame using Helmer\u2019s 7 Powers, and GTM execution requirements.",
                },
                {
                  num: 5,
                  name: "Commit",
                  subtitle: "Build the execution plan",
                  desc: "Three to five named strategic bets — each with a testable hypothesis, investment cost, minimum viable test, per-bet confidence score, and dependencies. Plus an anti-portfolio of what is explicitly not being pursued, three OKRs, a 100-day plan with 30/60/90-day gate criteria, and pre-agreed kill criteria with triggers and responses.",
                },
              ].map((stage) => (
                <div
                  key={stage.name}
                  className="p-6 sm:p-8"
                  style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 12 }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                    <div
                      className="flex items-center justify-center h-10 w-10 rounded-full text-white text-sm font-bold shrink-0"
                      style={{ background: "#0d2b3e" }}
                    >
                      {stage.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-2">
                        <h3
                          className="text-2xl"
                          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 700 }}
                        >
                          {stage.name}
                        </h3>
                        <span className="text-base font-medium" style={{ color: "#444" }}>{stage.subtitle}</span>
                      </div>
                      <p className="text-base leading-relaxed" style={{ color: "#555" }}>{stage.desc}</p>
                    </div>
                  </div>
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
                { step: "01", title: "Enter your company URL", desc: "We crawl your site and build an initial company profile automatically." },
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
                Decision-ready output, not process theatre
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
                  A Final Synthesis Report built for the board room
                </h2>
                <p className="text-base leading-relaxed mb-6" style={{ color: "#4a4a4a" }}>
                  After all five stages, Inflexion produces a single board-ready document — not a summary, but a synthesis. Fifteen sections. Four appendices. Every recommendation traceable to its evidence.
                </p>
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>
                  The appendices include a confidence waterfall decomposed by stage, an evidence gap register, a hypothesis register showing every assumption's validation status, and a complete deduplicated source list. Designed for PE and board audiences: quantified, evidence-cited, assumption-explicit, and structured around governance rhythms investors expect.
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
                    className="px-4 py-3 flex items-center gap-3"
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
            <div
              className="inline-flex items-center gap-2 px-10 py-4 text-base font-semibold"
              style={{ background: "#ffffff", color: "#0d2b3e", borderRadius: 8, opacity: 0.85 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a3e635", display: "inline-block" }} />
              Coming Soon
            </div>
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
{/* removed portal URL */}
          </div>
        </footer>
      </div>
    </>
  );
}
