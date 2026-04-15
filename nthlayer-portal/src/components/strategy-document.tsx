"use client";

import { useRef } from "react";

/* ── Types ── */
type StageMap = Record<string, { sections: Record<string, unknown>; confidence: number | null; createdAt: string } | undefined>;
type Risk = { risk: string; severity: string; mitigation: string };
type Assumption = { text: string; fragility: string; testable: string; status: string };
type Bet = {
  // New Inflexion format (structured-repeater keys)
  "Bet name"?: string;
  "Type"?: string;
  "Hypothesis"?: string;
  "Minimum viable test"?: string;
  // Legacy format (backwards compat)
  bet?: string;
  hypothesis?: string;
  investment?: string;
  horizon?: string;
  commitment?: string;
  if_wrong?: string;
  resource_implication?: string;
};
type OKR = { objective: string; key_results: string[] };
type DayPlan = { milestone: string; timeline: string; owner: string; deliverable: string };
type Monitoring = { metric: string; target: string; frequency: string };
type KillCriterion = { criterion: string; trigger: string; response: string };
type EvidenceBase = { sources?: { title?: string; url?: string }[]; quotes?: string[] };

const STAGE_LABELS: Record<string, string> = {
  frame: "Frame", diagnose: "Diagnose", decide: "Decide",
  position: "Position", commit: "Commit",
};

/* ── Section definitions ── */
const DOCUMENT_SECTIONS = [
  {
    num: "01", title: "Executive Summary", stage: "all",
    extract: (d: StageMap) => {
      const c = d.commit?.sections;
      if (!c) return null;
      return { narrative: c.executive_summary as string };
    },
    guidance: "The strategic question, recommended direction, key bets, and critical risks — synthesised from all five stages.",
  },
  {
    num: "02", title: "The Strategic Moment", stage: "frame",
    extract: (d: StageMap) => {
      const f = d.frame?.sections;
      if (!f) return null;
      return { narrative: f.executive_summary as string, detail: f.what_matters as string };
    },
    guidance: "What changed, why this decision matters now, what winning looks like, and the constraints shaping the response.",
  },
  {
    num: "03", title: "Current Reality", stage: "diagnose",
    extract: (d: StageMap) => {
      const diag = d.diagnose?.sections;
      if (!diag) return null;
      return { narrative: diag.executive_summary as string, detail: diag.what_matters as string };
    },
    guidance: "Product-market fit, revenue and unit economics, key tensions, and the binding constraints the strategy must work within.",
  },
  {
    num: "04", title: "Competitive Position", stage: "diagnose",
    extract: (d: StageMap) => {
      const diag = d.diagnose?.sections;
      if (!diag) return null;
      return { narrative: diag.recommendation as string, detail: diag.business_implications as string };
    },
    guidance: "Market map, strengths and weaknesses relative to competitors, and how the competitive landscape shapes the decision.",
  },
  {
    num: "05", title: "Strategic Options Considered", stage: "decide",
    extract: (d: StageMap) => {
      const dec = d.decide?.sections;
      if (!dec) return null;
      return { narrative: dec.executive_summary as string, detail: dec.what_matters as string };
    },
    guidance: "The 3-4 paths evaluated — including doing nothing — scored on feasibility, risk, and expected outcome.",
  },
  {
    num: "06", title: "Recommended Direction", stage: "decide",
    extract: (d: StageMap) => {
      const dec = d.decide?.sections;
      if (!dec) return null;
      return { narrative: dec.recommendation as string };
    },
    guidance: "The chosen direction, why it wins, and the trade-offs accepted.",
  },
  {
    num: "07", title: "What Must Be True", stage: "decide",
    extract: (d: StageMap) => {
      const dec = d.decide?.sections;
      if (!dec) return null;
      const assumptions = dec.assumptions as Assumption[] | undefined;
      const killCriteria = (d.commit?.sections?.kill_criteria ?? dec.kill_criteria) as KillCriterion[] | undefined;
      return { narrative: dec.business_implications as string, assumptions, killCriteria };
    },
    guidance: "The critical assumptions behind the strategy — each marked as validated, unvalidated, or at risk. Includes reversal conditions.",
  },
  {
    num: "08", title: "Market Position", stage: "position",
    extract: (d: StageMap) => {
      const p = d.position?.sections;
      if (!p) return null;
      return { narrative: p.executive_summary as string, detail: p.recommendation as string };
    },
    guidance: "Target customer, job to be done, value proposition, and category framing.",
  },
  {
    num: "09", title: "Competitive Advantage", stage: "position",
    extract: (d: StageMap) => {
      const p = d.position?.sections;
      if (!p) return null;
      return { narrative: p.what_matters as string, detail: p.business_implications as string };
    },
    guidance: "The initial wedge, defensibility over time, and what must be built to sustain the position.",
  },
  {
    num: "10", title: "Strategic Bets", stage: "commit",
    extract: (d: StageMap) => {
      const c = d.commit?.sections;
      if (!c) return null;
      const bets = c.strategic_bets as Bet[] | undefined;
      return { bets, narrative: c.recommendation as string };
    },
    guidance: "3-5 named bets with hypotheses, commitments, resource implications, and what changes if the hypothesis is wrong.",
  },
  {
    num: "11", title: "Success Measures & 100-Day Plan", stage: "commit",
    extract: (d: StageMap) => {
      const c = d.commit?.sections;
      if (!c) return null;
      const okrs = c.okrs as OKR[] | undefined;
      const plan = c.hundred_day_plan as DayPlan[] | undefined;
      return { okrs, plan };
    },
    guidance: "OKRs tied to the strategic bets, plus concrete 30/60/90-day milestones with owners and deliverables.",
  },
  {
    num: "12", title: "Governance, Risks & Kill Criteria", stage: "all",
    extract: (d: StageMap) => {
      const allRisks: { stage: string; risks: Risk[] }[] = [];
      for (const [stage, data] of Object.entries(d)) {
        const r = data?.sections?.risks as Risk[] | undefined;
        if (r?.length) allRisks.push({ stage, risks: r });
      }
      const killCriteria = (d.commit?.sections?.kill_criteria ?? d.decide?.sections?.kill_criteria) as KillCriterion[] | undefined;
      const monitoring = d.commit?.sections?.monitoring as Monitoring[] | undefined;
      return { allRisks, killCriteria, monitoring };
    },
    guidance: "Review cadence, major risks with mitigations, and pre-agreed triggers for when to pivot, pause, or stop.",
  },
  {
    num: "13", title: "Appendix", stage: "all",
    extract: (d: StageMap) => {
      const sources: { stage: string; evidence: EvidenceBase }[] = [];
      const confidences: { stage: string; score: number | null; rationale?: string }[] = [];
      for (const [stage, data] of Object.entries(d)) {
        const ev = data?.sections?.evidence_base as EvidenceBase | undefined;
        if (ev) sources.push({ stage, evidence: ev });
        const conf = data?.sections?.confidence as { score?: number; rationale?: string } | undefined;
        confidences.push({ stage, score: conf?.score ?? data?.confidence ?? null, rationale: conf?.rationale });
      }
      return { sources, confidences };
    },
    guidance: "Evidence sources, confidence scores by stage, and unresolved questions.",
  },
];

/* ── Markdown renderer ── */
function boldify(t: string): string {
  return t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function isBullet(line: string): boolean {
  const t = line.trim();
  return t.startsWith("- ") || t.startsWith("• ") || /^\d+\.\s/.test(t);
}

function bulletText(line: string): string {
  const t = line.trim();
  if (t.startsWith("- ")) return t.slice(2);
  if (t.startsWith("• ")) return t.slice(2);
  return t.replace(/^\d+\.\s+/, "");
}

function RichText({ text }: { text: string | undefined }) {
  if (!text) return <p style={{ color: "#999", fontStyle: "italic", fontFamily: "Inter, sans-serif", fontSize: 13 }}>Not yet available</p>;
  const lines = text.split("\n");

  // Group consecutive bullet lines (ignoring blank lines between them)
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip blank lines
    if (!trimmed) {
      // Only add spacing if not adjacent to bullets
      const prevIsBullet = i > 0 && isBullet(lines[i - 1]);
      const nextIsBullet = i + 1 < lines.length && isBullet(lines[i + 1]);
      if (!prevIsBullet && !nextIsBullet) {
        elements.push(<div key={i} style={{ height: 6 }} />);
      }
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(<h4 key={i} style={styles.h3}>{trimmed.slice(4)}</h4>);
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(<h3 key={i} style={{ ...styles.h3, fontSize: 15 }}>{trimmed.slice(3)}</h3>);
      i++;
      continue;
    }

    // Collect consecutive bullets into a single <ul>
    if (isBullet(trimmed)) {
      const bullets: { key: number; html: string }[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (isBullet(t)) {
          bullets.push({ key: i, html: boldify(bulletText(t)) });
          i++;
        } else if (!t) {
          // Skip blank lines within a bullet group
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ul key={`ul-${bullets[0].key}`} style={{ margin: "8px 0", paddingLeft: 24 }}>
          {bullets.map(b => <li key={b.key} style={styles.li} dangerouslySetInnerHTML={{ __html: b.html }} />)}
        </ul>
      );
      continue;
    }

    elements.push(<p key={i} style={styles.p} dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />);
    i++;
  }

  return <div>{elements}</div>;
}

/* ── Table components ── */

function BetsCards({ bets }: { bets: Bet[] }) {
  return (
    <div>
      {bets.map((b, i) => (
        <div key={i} style={{ border: "1px solid #ddd", borderRadius: 4, padding: "20px 24px", marginBottom: 16, background: "#fafafa" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, color: "#666" }}>Bet {i + 1}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>{b["Bet name"] ?? b.bet}</span>
            {(b["Type"] ?? b.horizon) && (
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 3, marginLeft: "auto", border: "1px solid #ccc", color: "#666" }}>
                {b["Type"] ?? b.horizon}
              </span>
            )}
          </div>
          {(b["Hypothesis"] ?? b.hypothesis) && <><div style={styles.label}>Hypothesis</div><p style={styles.betP}>{b["Hypothesis"] ?? b.hypothesis}</p></>}
          {(b["Minimum viable test"] ?? b.commitment) && <><div style={styles.label}>Minimum viable test</div><p style={styles.betP}>{b["Minimum viable test"] ?? b.commitment}</p></>}
          {b.investment && !b.commitment && !b["Minimum viable test"] && <><div style={styles.label}>Investment</div><p style={styles.betP}>{b.investment}</p></>}
          {b.resource_implication && <><div style={styles.label}>Resource Implication</div><p style={styles.betP}>{b.resource_implication}</p></>}
          {b.if_wrong && <><div style={styles.label}>If Wrong</div><p style={styles.betP}>{b.if_wrong}</p></>}
        </div>
      ))}
    </div>
  );
}

function OKRsTable({ okrs }: { okrs: OKR[] }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr><th style={styles.th}>Objective</th><th style={styles.th}>Key Results</th></tr>
      </thead>
      <tbody>
        {okrs.map((o, i) => (
          <tr key={i}>
            <td style={{ ...styles.td, fontWeight: 600 }}>{o.objective}</td>
            <td style={styles.td}>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {o.key_results?.map((kr, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.65, color: "#333" }}>{kr}</li>)}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayPlanTable({ plan }: { plan: DayPlan[] }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr><th style={styles.th}>Timeline</th><th style={styles.th}>Milestone</th><th style={styles.th}>Owner</th><th style={styles.th}>Deliverable</th></tr>
      </thead>
      <tbody>
        {plan.map((p, i) => (
          <tr key={i}>
            <td style={{ ...styles.td, fontWeight: 600 }}>{p.timeline}</td>
            <td style={styles.td}>{p.milestone}</td>
            <td style={styles.td}>{p.owner}</td>
            <td style={styles.td}>{p.deliverable}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RisksTable({ allRisks }: { allRisks: { stage: string; risks: Risk[] }[] }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr><th style={styles.th}>Stage</th><th style={styles.th}>Risk</th><th style={styles.th}>Severity</th><th style={styles.th}>Mitigation</th></tr>
      </thead>
      <tbody>
        {allRisks.flatMap(({ stage, risks }) =>
          risks.map((r, i) => (
            <tr key={`${stage}-${i}`}>
              <td style={{ ...styles.td, fontWeight: 500 }}>{STAGE_LABELS[stage] ?? stage}</td>
              <td style={styles.td}>{r.risk}</td>
              <td style={styles.td}><SeverityBadge s={r.severity} /></td>
              <td style={styles.td}>{r.mitigation}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function SeverityBadge({ s }: { s: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    high: { bg: "#fce4ec", fg: "#c62828" },
    medium: { bg: "#fff8e1", fg: "#f57f17" },
    low: { bg: "#e8f5e9", fg: "#2e7d32" },
  };
  const c = colors[s?.toLowerCase()] ?? colors.medium;
  return <span style={{ fontFamily: "Inter, sans-serif", display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>{s}</span>;
}

function KillCriteriaList({ criteria }: { criteria: KillCriterion[] }) {
  return (
    <div style={{ padding: "16px 20px", borderLeft: "3px solid #333", margin: "20px 0", background: "#f8f8f8", fontSize: 14, lineHeight: 1.65 }}>
      <strong>Trigger a strategy reassessment if any of the following occur:</strong>
      <ul style={{ margin: "8px 0 0 16px" }}>
        {criteria.map((c, i) => (
          <li key={i}><strong>{c.criterion}:</strong> {c.trigger} → {c.response}</li>
        ))}
      </ul>
    </div>
  );
}

function MonitoringTable({ monitoring }: { monitoring: Monitoring[] }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr><th style={styles.th}>Metric</th><th style={styles.th}>Target</th><th style={styles.th}>Frequency</th></tr>
      </thead>
      <tbody>
        {monitoring.map((m, i) => (
          <tr key={i}>
            <td style={styles.td}>{m.metric}</td>
            <td style={styles.td}>{m.target}</td>
            <td style={styles.td}>{m.frequency}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#999" }}>—</span>;
  const pct = Math.round(score * 100);
  const c = pct >= 70 ? { bg: "#e8f5e9", fg: "#2e7d32" } : pct >= 50 ? { bg: "#fff8e1", fg: "#f57f17" } : { bg: "#fce4ec", fg: "#c62828" };
  return <span style={{ fontFamily: "Inter, sans-serif", display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>{pct}%</span>;
}

/* ── Styles ── */
const styles = {
  p: { fontSize: 16, lineHeight: 1.75, color: "#1a1a1a", marginBottom: 14 } as React.CSSProperties,
  li: { fontSize: 16, lineHeight: 1.6, color: "#1a1a1a", marginBottom: 2 } as React.CSSProperties,
  h3: { fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "#333", margin: "32px 0 12px" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, margin: "20px 0", fontSize: 14 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "8px 12px", borderBottom: "2px solid #111", fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.03em", color: "#333" } as React.CSSProperties,
  td: { padding: "10px 12px", borderBottom: "1px solid #eee", color: "#333", verticalAlign: "top" as const } as React.CSSProperties,
  label: { fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 2 } as React.CSSProperties,
  betP: { fontSize: 14, lineHeight: 1.65, color: "#444", marginBottom: 8 } as React.CSSProperties,
};

/* ── Content renderer per section ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSectionContent(num: string, data: any) {
  switch (num) {
    case "07": // What Must Be True
      return (
        <>
          <RichText text={data.narrative} />
          {data.assumptions?.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Assumption</th><th style={styles.th}>Status</th><th style={styles.th}>Fragility</th></tr>
              </thead>
              <tbody>
                {data.assumptions.map((a: Assumption, i: number) => (
                  <tr key={i}>
                    <td style={styles.td}>{a.text}</td>
                    <td style={styles.td}><SeverityBadge s={a.status} /></td>
                    <td style={styles.td}>{a.fragility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.killCriteria?.length > 0 && <KillCriteriaList criteria={data.killCriteria} />}
        </>
      );
    case "10": // Strategic Bets
      return (
        <>
          <RichText text={data.narrative} />
          {data.bets?.length > 0 && <BetsCards bets={data.bets} />}
        </>
      );
    case "11": // Success Measures & 100-Day Plan
      return (
        <>
          {data.okrs?.length > 0 && (
            <>
              <h4 style={styles.h3}>OKRs</h4>
              <OKRsTable okrs={data.okrs} />
            </>
          )}
          {data.plan?.length > 0 && (
            <>
              <h4 style={styles.h3}>100-Day Plan</h4>
              <DayPlanTable plan={data.plan} />
            </>
          )}
        </>
      );
    case "12": // Governance, Risks & Kill Criteria
      return (
        <>
          {data.allRisks?.length > 0 && (
            <>
              <h4 style={styles.h3}>Major Risks</h4>
              <RisksTable allRisks={data.allRisks} />
            </>
          )}
          {data.killCriteria?.length > 0 && <KillCriteriaList criteria={data.killCriteria} />}
          {data.monitoring?.length > 0 && (
            <>
              <h4 style={styles.h3}>Monitoring</h4>
              <MonitoringTable monitoring={data.monitoring} />
            </>
          )}
        </>
      );
    case "13": // Appendix
      return (
        <>
          <h4 style={styles.h3}>Evidence & Confidence by Stage</h4>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Stage</th><th style={styles.th}>Confidence</th><th style={styles.th}>Rationale</th></tr>
            </thead>
            <tbody>
              {data.confidences?.map((c: { stage: string; score: number | null; rationale?: string }) => (
                <tr key={c.stage}>
                  <td style={{ ...styles.td, fontWeight: 500 }}>{STAGE_LABELS[c.stage] ?? c.stage}</td>
                  <td style={styles.td}><ConfidenceBadge score={c.score} /></td>
                  <td style={styles.td}>{c.rationale || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    default:
      // Narrative sections (01-06, 08-09)
      return (
        <>
          <RichText text={data.narrative} />
          {data.detail && <RichText text={data.detail} />}
        </>
      );
  }
}

/** Strip markdown syntax from plain text (for cover subtitle etc.) */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")       // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")  // bold
    .replace(/\*(.+?)\*/g, "$1")      // italic
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-•]\s+/gm, "")        // bullets
    .replace(/^\d+\.\s+/gm, "")       // numbered lists
    .trim();
}

/* ── Main component ── */
export function StrategyDocument({
  companyName,
  stageData,
  completedStages,
}: {
  companyName: string;
  stageData: StageMap;
  completedStages: readonly string[];
}) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollTo = (num: string) => {
    sectionRefs.current[num]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Extract strategic question from frame for cover — strip markdown
  const frameExecSummary = stageData.frame?.sections?.executive_summary as string | undefined;
  const coverSubtitle = frameExecSummary ? stripMarkdown(frameExecSummary) : undefined;

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Export button */}
      <div style={{ position: "fixed", top: 0, right: 0, padding: "16px 24px", zIndex: 10 }}>
        <button
          onClick={() => window.print()}
          style={{
            fontFamily: "Inter, sans-serif",
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px",
            background: "#111", color: "#fff", border: "none", borderRadius: 4,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          Export PDF
        </button>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "60px 72px 80px", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 16, lineHeight: 1.75, color: "#1a1a1a" }}>

        {/* ── Cover ── */}
        <div
          ref={(el) => { sectionRefs.current["cover"] = el; }}
          className="doc-cover"
          style={{ padding: "60px 0 80px", borderBottom: "2px solid #111", marginBottom: 48 }}
        >
          {/* Nth Layer logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="1" y="1" width="22" height="22" stroke="white" strokeWidth="1.8" />
                <rect x="4.5" y="4.5" width="15" height="15" stroke="white" strokeWidth="1.5" />
                <rect x="7.5" y="7.5" width="9" height="9" stroke="white" strokeWidth="1.3" />
                <rect x="10" y="10" width="4" height="4" stroke="white" strokeWidth="1.1" />
              </svg>
            </div>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: "#111" }}>Nth Layer</span>
          </div>

          {/* Hero image */}
          <div style={{ margin: "0 0 40px", borderRadius: 6, overflow: "hidden", maxHeight: 200 }}>
            <img
              src="/images/hero-tree.jpg"
              alt=""
              style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
            />
          </div>

          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: 24 }}>
            Product Strategy Document
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2, marginBottom: 20, color: "#111" }}>
            {companyName}
          </h1>
          {coverSubtitle && (
            <p style={{ fontSize: 20, fontWeight: 400, color: "#444", lineHeight: 1.5, marginBottom: 40, fontStyle: "italic" }}>
              {coverSubtitle.length > 200 ? coverSubtitle.slice(0, coverSubtitle.indexOf(".", 60) + 1) || coverSubtitle.slice(0, 200) + "..." : coverSubtitle}
            </p>
          )}
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#666", lineHeight: 2 }}>
            <div><strong style={{ color: "#333" }}>Date:</strong> {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
            <div><strong style={{ color: "#333" }}>Generated by</strong> Inflexion</div>
          </div>
        </div>

        {/* ── Table of Contents ── */}
        <div className="doc-toc" style={{ padding: "40px 0", borderBottom: "1px solid #ddd", marginBottom: 48 }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: 20 }}>
            Contents
          </div>
          <ul style={{ listStyle: "none", columns: 2, columnGap: 40, padding: 0, margin: 0 }}>
            {DOCUMENT_SECTIONS.map((s) => {
              const hasData = s.stage === "all" ? completedStages.length > 0 : completedStages.includes(s.stage);
              return (
                <li key={s.num} style={{ fontSize: 14, lineHeight: 2.2, color: hasData ? "#333" : "#bbb", breakInside: "avoid" }}>
                  <button
                    onClick={() => scrollTo(s.num)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontFamily: "inherit", fontSize: "inherit", padding: 0, textAlign: "left" }}
                  >
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: hasData ? "#999" : "#ddd", display: "inline-block", width: 24 }}>
                      {s.num}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Sections ── */}
        {DOCUMENT_SECTIONS.map((section) => {
          const data = section.extract(stageData);
          const hasData = !!data;
          const stageLabel = section.stage === "all" ? "All stages" : STAGE_LABELS[section.stage] ?? section.stage;

          return (
            <div
              key={section.num}
              ref={(el) => { sectionRefs.current[section.num] = el; }}
              className="doc-section"
              style={{
                paddingTop: 48,
                paddingBottom: 40,
                borderTop: "1px solid #eee",
                scrollMarginTop: 24,
              }}
            >
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: "#aaa" }}>
                  {section.num}
                </span>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>
                  {section.title}
                </span>
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 3,
                  textTransform: "uppercase", letterSpacing: "0.04em", marginLeft: "auto",
                  flexShrink: 0, border: "1px solid #ddd", color: "#888",
                }}>
                  {stageLabel}
                </span>
              </div>

              {!hasData ? (
                <div style={{ padding: "20px 0" }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#999", fontStyle: "italic", margin: "0 0 8px" }}>
                    {section.guidance}
                  </p>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#ccc", margin: 0 }}>
                    Complete the <strong>{stageLabel}</strong> stage to populate this section.
                  </p>
                </div>
              ) : (
                renderSectionContent(section.num, data)
              )}
            </div>
          );
        })}

        {/* ── Footer ── */}
        <div style={{
          marginTop: 40, paddingTop: 20, borderTop: "1px solid #ddd",
          fontFamily: "Inter, sans-serif", fontSize: 11, color: "#aaa", lineHeight: 1.6,
        }}>
          This document was generated by Inflexion from {completedStages.length} completed strategy stages.
          Every claim is sourced from the underlying stage reports. For full evidence, source links,
          and confidence breakdowns, refer to the individual stage reports within the Inflexion platform.
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap');
        @media print {
          body { background: #fff !important; }
          div[style*="position: fixed"] { display: none !important; }
          .doc-cover { page-break-after: always; }
          .doc-toc { page-break-after: always; }
          .doc-section { page-break-before: always; }
        }
      `}</style>
    </div>
  );
}
