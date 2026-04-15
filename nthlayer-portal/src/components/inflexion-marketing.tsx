"use client";

/* ─── Nth Layer Marketing One-Pager — nthlayer.co.uk branding ──────────── */
/* Palette: white bg, #0d2b3e navy, Playfair Display headings, Inter body  */

export default function InflexionMarketing() {
  return (
    <>
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
          <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
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
            <a
              href="https://inflexion.nthlayer.co.uk/register"
              className="px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: "#0d2b3e", borderRadius: 8 }}
            >
              Start Free
            </a>
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
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
                  When the market changes, make the right call
                </h1>
              </div>
              {/* Right */}
              <div className="pt-4 lg:pt-16">
                <p className="text-lg leading-relaxed mb-8" style={{ color: "#4a4a4a" }}>
                  Markets shift. Competitors move. Technology rewrites the rules.{" "}
                  <strong>Inflexion</strong>{" "}takes you from &ldquo;something changed&rdquo; to a committed direction, strategic bets, and a 100-day execution plan &mdash; backed by live evidence, not gut feel.
                </p>
                <a
                  href="https://inflexion.nthlayer.co.uk/register"
                  className="inline-flex items-center px-8 py-3.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ background: "#0d2b3e", borderRadius: 8 }}
                >
                  Build your Strategy
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Hero image band ────────────────────────────────────────────── */}
        <div
          className="w-full h-48 sm:h-64 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/hero-tree.jpg)", backgroundPosition: "center 40%" }}
        />

        {/* ── THE PROBLEM ────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#0d2b3e" }}>
                The Problem
              </p>
              <h2
                className="text-3xl sm:text-4xl mb-3"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
              >
                Why strategy breaks at inflection points
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Signal Overload",
                  desc: "Market signals are everywhere \u2014 competitor launches, funding rounds, regulatory shifts, customer churn patterns. Filtering what matters from what doesn\u2019t is a full-time job nobody has time for.",
                },
                {
                  title: "Slow Synthesis",
                  desc: "By the time a consulting engagement or internal strategy cycle delivers its findings, the window for action has already narrowed.",
                },
                {
                  title: "Fragmented Evidence",
                  desc: "The information you need is scattered across websites, job postings, product pages, news, and internal data. No single view of reality exists.",
                },
                {
                  title: "Weak Decision Discipline",
                  desc: "Without a structured process, teams default to opinion, anchoring, or inaction. Assumptions go unexamined. Trade-offs stay implicit.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6"
                  style={{ border: "1px solid #e8e8e8", borderRadius: 12, background: "#fafafa" }}
                >
                  <h3 className="text-lg font-semibold mb-2" style={{ color: "#0d2b3e" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#666" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THE FRAMEWORK ──────────────────────────────────────────────── */}
        <section id="framework" className="py-12 sm:py-16" style={{ background: "#f7f7f5" }}>
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#0d2b3e" }}>
                The Framework
              </p>
              <h2
                className="text-3xl sm:text-4xl mb-4"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
              >
                From inflection point to execution plan
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
                  desc: "What changed? What\u2019s at stake? What does winning look like? Frame establishes the boundaries of the strategic decision \u2014 the inflection point, the timeframe, and the constraints \u2014 so everything downstream is solving the right problem.",
                },
                {
                  num: 2,
                  name: "Diagnose",
                  subtitle: "Establish what is true",
                  desc: "Where do you actually stand? Diagnose builds a structured fact base across product-market fit, competitive position, unit economics, and capability. Every claim is sourced and scored \u2014 so you know where the evidence is strong and where it\u2019s thin.",
                },
                {
                  num: 3,
                  name: "Decide",
                  subtitle: "Choose the direction",
                  desc: "What are the real options \u2014 including doing nothing? Decide surfaces genuine strategic alternatives, pressure-tests each one against what must be true for it to work, and commits to a direction with assumptions and trade-offs visible.",
                },
                {
                  num: 4,
                  name: "Position",
                  subtitle: "Define how you win",
                  desc: "Who do you serve, what do you do better than the alternatives, and what makes it defensible? Position translates the chosen direction into a precise market stance \u2014 target customer, value proposition, and competitive moat.",
                },
                {
                  num: 5,
                  name: "Commit",
                  subtitle: "Build the execution plan",
                  desc: "Turn the direction into action. Commit generates a portfolio of strategic bets \u2014 core, growth, and transformational \u2014 each with a hypothesis, success metrics, and time horizon. Then translates them into OKRs, a 100-day plan with named owners, and kill criteria for when to change course.",
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
                      <p className="text-sm leading-relaxed max-w-3xl" style={{ color: "#555" }}>{stage.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16" style={{ background: "#0d2b3e" }}>
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
              How It Works
            </p>
            <h2
              className="text-3xl sm:text-4xl mb-10"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#ffffff", fontWeight: 400 }}
            >
              From URL to execution plan
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
          <div className="mx-auto max-w-6xl px-6">
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

        {/* ── WHY NTH LAYER ──────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16" style={{ background: "#f7f7f5" }}>
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#0d2b3e" }}>
                Why Nth Layer
              </p>
              <h2
                className="text-3xl sm:text-4xl"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e", fontWeight: 400 }}
              >
                Why teams trust this over a slide deck
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Sourced, Not Generated",
                  desc: "Every finding links back to a real source. No fabricated claims, no unsupported assertions. If the evidence isn\u2019t there, the system says so.",
                },
                {
                  title: "15 Minutes, Not 6 Weeks",
                  desc: "Each stage completes in minutes. The full five-stage analysis runs in under an hour \u2014 with the same structured output a strategy engagement would take weeks to deliver.",
                },
                {
                  title: "Operator Logic",
                  desc: "Built around how experienced operators actually make decisions: define the problem, build the fact base, choose, position, then commit. Not a framework poster \u2014 an executable process.",
                },
                {
                  title: "Full Audit Trail",
                  desc: "Every input, source, confidence score, and assumption is visible. Your board, investors, or team can trace any recommendation back to its evidence.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6"
                  style={{ border: "1px solid #e8e8e8", borderRadius: 12, background: "#ffffff" }}
                >
                  <h3 className="text-xl font-semibold mb-2" style={{ color: "#0d2b3e" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#666" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PULL QUOTE ─────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <p
              className="text-2xl sm:text-3xl lg:text-4xl leading-relaxed"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#0d2b3e" }}
            >
              &ldquo;The quality of a strategy engagement, at the speed your business actually needs.&rdquo;
            </p>
          </div>
        </section>

        {/* ── BUILT FOR ──────────────────────────────────────────────────── */}
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#999" }}>
              Built For
            </p>
            <p className="text-base" style={{ color: "#555" }}>
              Founders&ensp;&middot;&ensp;Leadership Teams&ensp;&middot;&ensp;Operators&ensp;&middot;&ensp;Strategy Leads&ensp;&middot;&ensp;Advisors
            </p>
          </div>
        </section>

        {/* ── FOOTER CTA ─────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16" style={{ background: "#0d2b3e" }}>
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2
              className="text-3xl sm:text-4xl mb-5"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#ffffff", fontWeight: 400 }}
            >
              The market changed. What are you going to do about it?
            </h2>
            <p className="mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
              14-day trial. No card required. Cancel anytime.
            </p>
            <a
              href="https://inflexion.nthlayer.co.uk/register"
              className="inline-block px-10 py-4 text-base font-semibold hover:opacity-90 transition-opacity"
              style={{ background: "#ffffff", color: "#0d2b3e", borderRadius: 8 }}
            >
              Build your Strategy
            </a>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer className="py-8" style={{ borderTop: "1px solid #e8e8e8" }}>
          <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
