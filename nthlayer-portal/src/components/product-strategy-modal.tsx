"use client";

import { useState, useEffect } from "react";
import { downloadStrategyDocument } from "@/lib/word-document";
import { useStrategyGeneration } from "@/lib/strategy-generation-context";

const SECTIONS = [
  { n: "01", label: "Executive Summary", source: "All stages", detail: "The answer stated quickly — strategic moment, recommended direction, why it is the right choice, and what the business is committing to now." },
  { n: "02", label: "The Strategic Moment", source: "Frame", detail: "What changed, why this decision matters now, the time horizon, and the scope of what is being decided." },
  { n: "03", label: "Current Reality", source: "Diagnose", detail: "The few facts that dominate the picture — constraints, contradictions, and the binding conditions the strategy must work within." },
  { n: "04", label: "Competitive Position", source: "Diagnose", detail: "Where the business sits relative to competitors, how the landscape shapes the decision, and what the competitive dynamics mean for strategy." },
  { n: "05", label: "Strategic Options Considered", source: "Decide", detail: "The real paths available — including doing nothing — with why each was or was not chosen. Shows the decision was made with alternatives in view." },
  { n: "06", label: "Recommended Direction", source: "Decide", detail: "One explicit recommended direction, the rationale for choosing it, and the trade-offs knowingly accepted." },
  { n: "07", label: "What Must Be True", source: "Decide", detail: "The testable assumptions the strategy rests on, the trade-offs accepted, and the conditions that would cause a reversal." },
  { n: "08", label: "Market Position", source: "Position", detail: "Target customer, primary economic buyer, buying trigger, value proposition, and competitive frame. How the company will be understood in market." },
  { n: "09", label: "Competitive Advantage", source: "Position", detail: "The initial wedge, what is real today versus what must be built, and how the position compounds over time." },
  { n: "10", label: "Strategic Bets", source: "Commit", detail: "3–5 named bets with hypotheses, what is committed now, what is deferred, and what changes if the hypothesis is wrong." },
  { n: "11", label: "First 100 Days & Success Measures", source: "Commit", detail: "Concrete milestones for the first phase with owners, plus the leading indicators that confirm the strategy is working." },
  { n: "12", label: "Governance, Risks & Kill Criteria", source: "Commit", detail: "Review cadence, strategic risks with mitigations, and pre-agreed triggers for when to pivot, pause, or stop." },
  { n: "13", label: "Strategic Trade-offs", source: "Commit", detail: "What is not being pursued and why — making explicit the paths rejected so the commitment to the chosen direction is unambiguous." },
  { n: "14", label: "Resource & Investment Implications", source: "Commit", detail: "What gets funded, protected, paused, or reallocated — connecting the strategy to actual capital and capacity decisions." },
  { n: "15", label: "Exit or Value-Creation Implications", source: "Commit", detail: "Why this strategy improves enterprise value, growth quality, defensibility, or exit attractiveness — the investor-grade rationale." },
  { n: "A",  label: "Appendix: Open Questions & Evidence Gaps", source: "All stages", detail: "Unresolved questions, major evidence gaps, and contradictions that could not be fully resolved — material to decision quality." },
];

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  "Frame":      { bg: "#f3f4f6", color: "#374151" },
  "Diagnose":   { bg: "#dbeafe", color: "#1e40af" },
  "Decide":     { bg: "#ede9fe", color: "#6d28d9" },
  "Position":   { bg: "#d1fae5", color: "#065f46" },
  "Commit":     { bg: "#fef3c7", color: "#92400e" },
  "All stages": { bg: "#f3f4f6", color: "#374151" },
};

const GEN_STEPS = [
  { label: "Resolve",        pct: 15 },
  { label: "Synthesise",     pct: 35 },
  { label: "Write sections", pct: 50 },
  { label: "Assemble",       pct: 82 },
  { label: "Done",           pct: 100 },
];

// ─── Inline markdown renderer ────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const m = match[0];
    if (m.startsWith("**")) {
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: "#111827" }}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("`")) {
      parts.push(<code key={key++} style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 3, fontSize: "0.88em", fontFamily: "monospace" }}>{m.slice(1, -1)}</code>);
    } else {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownViewer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (line.trim() === "---") {
      elements.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "28px 0" }} />);
      i++; continue;
    }

    // H1
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 6px", lineHeight: 1.2 }}>
          {renderInline(line.slice(2))}
        </h1>
      );
      i++; continue;
    }

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "36px 0 12px", paddingBottom: 8, borderBottom: "2px solid #f3f4f6" }}>
          {renderInline(line.slice(3))}
        </h2>
      );
      i++; continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "22px 0 8px" }}>
          {renderInline(line.slice(4))}
        </h3>
      );
      i++; continue;
    }

    // Table
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.filter(l => !l.match(/^\s*\|[\s\-:|]+\|\s*$/));
      const parseRow = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());
      const [headerRow, ...bodyRows] = rows;
      if (headerRow) {
        elements.push(
          <div key={key++} style={{ overflowX: "auto", margin: "16px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {parseRow(headerRow).map((cell, ci) => (
                    <th key={ci} style={{ padding: "9px 14px", textAlign: "left", background: "#111827", color: "#fff", fontWeight: 600, whiteSpace: "nowrap" as const, fontSize: 12 }}>
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid #f3f4f6", background: ri % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    {parseRow(row).map((cell, ci) => (
                      <td key={ci} style={{ padding: "9px 14px", color: "#374151", verticalAlign: "top", lineHeight: 1.5 }}>
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} style={{ margin: "10px 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ fontSize: 14, color: "#374151", lineHeight: 1.65 }}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={key++} style={{ margin: "10px 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ fontSize: 14, color: "#374151", lineHeight: 1.65 }}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") { i++; continue; }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      lines[i].trim() !== "---" &&
      !lines[i].startsWith("#") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].startsWith("- ") &&
      !/^\d+\. /.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, margin: "0 0 12px" }}>
          {paraLines.map((l, li) => (
            <span key={li}>{renderInline(l)}{li < paraLines.length - 1 ? " " : ""}</span>
          ))}
        </p>
      );
    }
  }

  return <>{elements}</>;
}

// ─── Markdown → HTML for PDF print window ────────────────────────────────────

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "---") { out.push("<hr>"); i++; continue; }
    if (line.startsWith("# "))  { out.push(`<h1>${inline(line.slice(2))}</h1>`); i++; continue; }
    if (line.startsWith("## ")) { out.push(`<h2>${inline(line.slice(3))}</h2>`); i++; continue; }
    if (line.startsWith("### ")) { out.push(`<h3>${inline(line.slice(4))}</h3>`); i++; continue; }

    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i]); i++; }
      const parsed = rows.filter(l => !l.match(/^\s*\|[\s\-:|]+\|\s*$/));
      const cells = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());
      const [hdr, ...body] = parsed;
      if (hdr) {
        out.push("<table><thead><tr>" + cells(hdr).map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>");
        body.forEach(r => { out.push("<tr>" + cells(r).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>"); });
        out.push("</tbody></table>");
      }
      continue;
    }

    if (line.startsWith("- ")) {
      out.push("<ul>");
      while (i < lines.length && lines[i].startsWith("- ")) { out.push(`<li>${inline(lines[i].slice(2))}</li>`); i++; }
      out.push("</ul>"); continue;
    }
    if (/^\d+\. /.test(line)) {
      out.push("<ol>");
      while (i < lines.length && /^\d+\. /.test(lines[i])) { out.push(`<li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`); i++; }
      out.push("</ol>"); continue;
    }
    if (line.trim() === "") { i++; continue; }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && lines[i].trim() !== "---" && !lines[i].startsWith("#") && !lines[i].trim().startsWith("|") && !lines[i].startsWith("- ") && !/^\d+\. /.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    if (para.length) out.push(`<p>${para.map(inline).join(" ")}</p>`);
  }
  return out.join("\n");
}

function printAsPdf(content: string) {
  const body = markdownToHtml(content);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Example Strategy Document — Vectra</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.65; background: #fff; padding: 28mm 24mm; max-width: 210mm; margin: 0 auto; }
  h1 { font-size: 22pt; font-weight: 800; margin: 0 0 4pt; color: #111; }
  h2 { font-size: 14pt; font-weight: 700; margin: 28pt 0 8pt; padding-bottom: 5pt; border-bottom: 1.5pt solid #e5e7eb; color: #111; page-break-after: avoid; }
  h3 { font-size: 11pt; font-weight: 700; margin: 16pt 0 5pt; color: #111; page-break-after: avoid; }
  p  { margin: 0 0 8pt; }
  ul, ol { margin: 6pt 0; padding-left: 18pt; }
  li { margin-bottom: 3pt; }
  hr { border: none; border-top: 1pt solid #e5e7eb; margin: 20pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 9.5pt; page-break-inside: avoid; }
  th { background: #111827; color: #fff; font-weight: 600; padding: 6pt 9pt; text-align: left; white-space: nowrap; }
  td { padding: 6pt 9pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  strong { font-weight: 700; }
  em { font-style: italic; color: #4b5563; }
  code { background: #f3f4f6; padding: 1pt 4pt; border-radius: 2pt; font-family: monospace; font-size: 9pt; }
  @media print {
    body { padding: 0; }
    h2 { page-break-before: auto; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>${body}</body>
</html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ─── Example document overlay ────────────────────────────────────────────────

function ExampleDocModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/example-strategy-document.md")
      .then(r => r.text())
      .then(text => { setContent(text); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 1020, width: "100%", maxHeight: "94vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 100px rgba(0,0,0,0.4)" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid #e5e7eb", flexShrink: 0, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#111827", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Example Strategy Document</p>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, marginTop: 1 }}>Vectra · Revenue Intelligence Platform · Sample output — all data is illustrative</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => content && printAsPdf(content)}
              disabled={!content}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#fff", padding: "7px 14px", borderRadius: 7, border: "none", background: "#111827", cursor: content ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: content ? 1 : 0.5 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Download PDF
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "36px 52px 48px", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 14 }}>
              Loading…
            </div>
          ) : content ? (
            <MarkdownViewer content={content} />
          ) : (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Could not load the example document.</p>
          )}
        </div>

        {/* Footer note */}
        <div style={{ padding: "14px 28px", borderTop: "1px solid #f3f4f6", background: "#f9fafb", flexShrink: 0 }}>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, textAlign: "center" }}>
            This is a sample document generated from illustrative data. Your document will be synthesised from your own completed strategy stages.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function ProductStrategyModal({
  open,
  onClose,
  completedStages,
  companyName,
  companyId,
  outputs,
}: {
  open: boolean;
  onClose: () => void;
  completedStages: number;
  companyName: string;
  companyId: string;
  outputs: Record<string, unknown>;
}) {
  const { isGenerating, progress, step, detail, error, startGeneration, clearError } = useStrategyGeneration();
  const [showExample, setShowExample] = useState(false);

  if (!open) return null;

  const canDownload = completedStages >= 5;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: "#fff", borderRadius: 16, maxWidth: 1160, width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}
        >
          {/* Header */}
          <div style={{ background: "#111827", padding: "32px 40px 28px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Product Strategy</p>
                </div>
                <p style={{ fontSize: 15, color: "#9ca3af", margin: 0, lineHeight: 1.5, maxWidth: 560 }}>
                  A single authored strategy document — 15 sections plus appendix, synthesised from your completed stages. Not 5 stitched reports.{" "}
                  {completedStages < 5 ? "Complete all 5 stages to unlock." : isGenerating ? "Generating in background…" : "Ready to generate."}
                </p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Section list */}
          <div style={{ overflowY: "auto", padding: "24px 40px 28px", flex: 1 }}>

            {/* Example output CTA — top of modal body */}
            <button
              onClick={() => setShowExample(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 24, padding: "18px 22px", background: "#111827", borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, background: "rgba(163,230,53,0.12)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="1.6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Example Output</p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.4 }}>Read a complete example — 15 sections, fully written, so you know exactly what you&apos;re building toward.</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 16, background: "#a3e635", padding: "9px 16px", borderRadius: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" as const }}>Example</span>
              </div>
            </button>

            <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>
              What you get — 15 sections + appendix
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {SECTIONS.map((section) => {
                const stageStyle = STAGE_COLORS[section.source] ?? STAGE_COLORS["Frame"];
                return (
                  <div key={section.n} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 18px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", width: 26, flexShrink: 0, paddingTop: 2 }}>{section.n}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>{section.label}</p>
                      <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{section.detail}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: stageStyle.bg, color: stageStyle.color, flexShrink: 0, whiteSpace: "nowrap" as const, alignSelf: "flex-start", marginTop: 2 }}>
                      {section.source}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "20px 40px 28px", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>

            {/* Error */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 6, border: "1px solid #fecaca" }}>
                <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
                <button onClick={clearError} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 2, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Progress panel */}
            {isGenerating && (
              <div style={{ marginBottom: 20, background: "#111827", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg style={{ animation: "spin 1.2s linear infinite", flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                    </svg>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{step || "Starting…"}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#a3e635" }}>{progress}%</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ height: "100%", background: "#a3e635", borderRadius: 2, width: `${progress}%`, transition: "width 600ms ease-out" }} />
                </div>
                {detail && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{detail}</p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
                  {GEN_STEPS.map((s, i) => {
                    const done = progress >= s.pct;
                    const prevPct = i === 0 ? 1 : GEN_STEPS[i - 1].pct;
                    const active = progress >= prevPct && !done;
                    return (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: done ? "#a3e635" : active ? "rgba(163,230,53,0.4)" : "rgba(255,255,255,0.2)", transition: "background 400ms" }} />
                          <span style={{ fontSize: 10, color: done ? "#a3e635" : "rgba(255,255,255,0.35)", fontWeight: done ? 700 : 400, transition: "color 400ms" }}>{s.label}</span>
                        </div>
                        {i < GEN_STEPS.length - 1 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>›</span>}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "12px 0 0" }}>
                  Takes 2–4 minutes · Running in background — you can navigate away and the download will start automatically when ready
                </p>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <span style={{ fontSize: 14, color: "#6b7280" }}>{completedStages}/5 stages complete</span>
              </div>
              {canDownload ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { downloadStrategyDocument(companyName, outputs as Record<string, Record<string, unknown>>); onClose(); }}
                    disabled={isGenerating}
                    style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#374151", background: "#f3f4f6", borderRadius: 8, border: "none", cursor: isGenerating ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isGenerating ? 0.5 : 1 }}
                  >
                    Word Document
                  </button>
                  <button
                    onClick={() => startGeneration(companyId, companyName)}
                    disabled={isGenerating}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: "#fff", background: isGenerating ? "#6b7280" : "#111827", borderRadius: 8, border: "none", cursor: isGenerating ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                  >
                    {isGenerating ? (
                      <>
                        <svg style={{ animation: "spin 1.2s linear infinite" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
                        Generating…
                      </>
                    ) : "Download Strategy Document"}
                  </button>
                </div>
              ) : (
                <button disabled style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px", fontSize: 14, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", borderRadius: 8, border: "none", cursor: "not-allowed", fontFamily: "inherit" }}>
                  Unlock when 5 stages complete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Example document overlay — rendered above main modal */}
      {showExample && <ExampleDocModal onClose={() => setShowExample(false)} />}
    </>
  );
}
