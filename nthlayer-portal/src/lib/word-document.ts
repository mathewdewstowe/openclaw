// word-document.ts — generates a Word-compatible HTML document and triggers download

type Sections = Record<string, unknown>;
type StageOutputs = Record<string, Sections>;
type Risk = { risk: string; severity: string; mitigation: string };
type Assumption = { text: string; fragility: string; status: string };
type Bet = {
  // New Inflexion format
  "Bet name"?: string;
  "Type"?: string;
  "Hypothesis"?: string;
  "Minimum viable test"?: string;
  // Legacy format
  bet?: string;
  hypothesis?: string;
  investment?: string;
  horizon?: string;
  commitment?: string;
  if_wrong?: string;
  resource_implication?: string;
};
type OKR = { objective: string; key_results: string[] };
type DayPlan = { milestone: string; timeline: string; owner: string; deliverable: string; gate?: string };
type KillCriterion = { criterion: string; trigger: string; response: string };
type Monitoring = { metric: string; target: string; frequency: string };

/** Strip all markdown to plain prose */
function clean(text: unknown): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .trim();
}

/** Convert markdown to Word-safe HTML */
function md(text: unknown): string {
  if (!text || typeof text !== "string") return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (/^#{1,3}\s+/.test(t)) {
      if (inList) { out.push("</ul>"); inList = false; }
      const heading = t.replace(/^#{1,3}\s+/, "");
      out.push(`<p style="font-family:Arial;font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.5pt;color:#333;margin:12pt 0 4pt;">${heading}</p>`);
      continue;
    }
    if (/^[-•]\s+/.test(t)) {
      if (!inList) { out.push('<ul style="margin:0 0 6pt 0;padding-left:18pt;">'); inList = true; }
      const item = t.replace(/^[-•]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      out.push(`<li style="margin-bottom:2pt;font-family:Georgia;font-size:11pt;color:#1a1a1a;">${item}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    const para = t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
    out.push(`<p style="margin:0 0 6pt;font-family:Georgia;font-size:11pt;line-height:1.55;color:#1a1a1a;">${para}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

/** Section header with page-break-before */
function sectionHeader(num: string, title: string): string {
  return `
    <p style="page-break-before:always;mso-break-type:page-break;font-family:Arial;font-size:9pt;color:#aaa;margin:0 0 3pt;">${num}</p>
    <p style="font-family:Georgia;font-size:18pt;font-weight:bold;color:#111;margin:0;padding-bottom:6pt;border-bottom:1.5pt solid #111;">${title}</p>
    <p style="margin:0 0 8pt;">&nbsp;</p>`;
}

function tableHtml(headers: string[], rows: string[][]): string {
  const ths = headers.map(h =>
    `<th style="text-align:left;padding:4pt 6pt;border-bottom:1.5pt solid #111;font-family:Arial;font-size:8pt;font-weight:bold;text-transform:uppercase;color:#333;background:#fff;">${h}</th>`
  ).join("");
  const trs = rows.map(r =>
    `<tr>${r.map(c =>
      `<td style="padding:5pt 6pt;border-bottom:0.75pt solid #ddd;font-family:Georgia;font-size:10pt;color:#333;vertical-align:top;">${c}</td>`
    ).join("")}</tr>`
  ).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 10pt;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function subheading(text: string): string {
  return `<p style="font-family:Arial;font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.5pt;color:#333;margin:14pt 0 6pt;">${text}</p>`;
}

/** Strip "[From Stage]" prefixes and truncate long text */
function cleanRisk(text: string, maxLen = 160): string {
  const stripped = text.replace(/^\[From [^\]]+\]\s*/i, "").trim();
  return stripped.length > maxLen ? stripped.slice(0, stripped.lastIndexOf(" ", maxLen)) + "…" : stripped;
}

/** Deduplicate risks — skip if first 50 chars already seen */
function deduplicateRisks(risks: string[][]): string[][] {
  const seen = new Set<string>();
  return risks.filter(r => {
    const key = r[1].slice(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Nth Layer logo as inline base64 SVG */
function nthLayerLogo(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 84"><rect x="2" y="2" width="78" height="78" fill="none" stroke="#111" stroke-width="4"/><rect x="13" y="13" width="56" height="56" fill="none" stroke="#111" stroke-width="4"/><rect x="24" y="24" width="34" height="34" fill="none" stroke="#111" stroke-width="4"/><rect x="35" y="35" width="12" height="12" fill="#111"/><text x="96" y="30" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="#111">THE</text><text x="96" y="58" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="#111">NTH</text><text x="96" y="86" font-family="Arial Black,Arial" font-weight="900" font-size="24" fill="#111">LAYER</text></svg>`;
  // btoa is available in browser context where this runs
  const b64 = typeof btoa !== "undefined" ? btoa(svg) : Buffer.from(svg).toString("base64");
  return `<img src="data:image/svg+xml;base64,${b64}" width="105" height="42" alt="The Nth Layer" style="display:block;" />`;
}

const STAGE_LABELS: Record<string, string> = {
  frame: "Frame", diagnose: "Diagnose", decide: "Decide",
  position: "Position", commit: "Commit",
};

export function downloadStrategyDocument(companyName: string, outputs: StageOutputs) {
  const get = (stage: string): Sections => (outputs[stage] as Sections) ?? {};

  const frame = get("frame");
  const diagnose = get("diagnose");
  const decide = get("decide");
  const position = get("position");
  const commit = get("commit");

  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const parts: string[] = [];

  // ── Cover ──────────────────────────────────────────────────
  const coverText = frame.executive_summary ? clean(String(frame.executive_summary)) : "";
  const coverSubtitle = coverText.length > 220
    ? (coverText.slice(0, coverText.lastIndexOf(" ", 220)) + "…")
    : coverText;

  parts.push(`
    <p style="margin:0;">&nbsp;</p><p style="margin:0;">&nbsp;</p><p style="margin:0;">&nbsp;</p>
    <p style="margin:0;">&nbsp;</p><p style="margin:0;">&nbsp;</p><p style="margin:0;">&nbsp;</p>
    <p style="font-family:Georgia;font-size:34pt;font-weight:bold;color:#111;margin:0 0 14pt;">${companyName}</p>
    ${coverSubtitle ? `<p style="font-family:Georgia;font-size:13pt;font-style:italic;color:#555;line-height:1.5;margin:0 0 36pt;">${coverSubtitle}</p>` : ""}
    <p style="font-family:Arial;font-size:10pt;color:#666;margin:0 0 4pt;"><b style="color:#333;">Date:</b> ${dateStr}</p>
    <p style="page-break-after:always;font-family:Arial;font-size:10pt;color:#666;margin:0;"><b style="color:#333;">Generated by</b> Inflexion · Nth Layer</p>
  `);

  // ── 01 Executive Summary ───────────────────────────────────
  if (commit.executive_summary) {
    parts.push(sectionHeader("01", "Executive Summary"));
    parts.push(md(commit.executive_summary));
  }

  // ── 02 The Strategic Moment ────────────────────────────────
  if (frame.executive_summary || frame.what_matters) {
    parts.push(sectionHeader("02", "The Strategic Moment"));
    if (frame.executive_summary) parts.push(md(frame.executive_summary));
    if (frame.what_matters) parts.push(md(frame.what_matters));
  }

  // ── 03 Current Reality ─────────────────────────────────────
  if (diagnose.executive_summary || diagnose.what_matters) {
    parts.push(sectionHeader("03", "Current Reality"));
    if (diagnose.executive_summary) parts.push(md(diagnose.executive_summary));
    if (diagnose.what_matters) parts.push(md(diagnose.what_matters));
  }

  // ── 04 Competitive Position ────────────────────────────────
  if (diagnose.recommendation || diagnose.business_implications || diagnose.icp_signal) {
    parts.push(sectionHeader("04", "Competitive Position"));
    if (diagnose.recommendation) parts.push(md(diagnose.recommendation));
    if (diagnose.business_implications) parts.push(md(diagnose.business_implications));
    const icp = diagnose.icp_signal as { stated_icp?: string; actual_icp?: string; alignment?: string; divergence_note?: string; signal_strength?: string } | undefined;
    if (icp?.stated_icp || icp?.actual_icp) {
      parts.push(subheading("ICP Signal"));
      parts.push(tableHtml(
        ["", ""],
        [
          ["<b>Stated ICP</b>", icp.stated_icp || "—"],
          ["<b>Actual ICP</b>", icp.actual_icp || "—"],
          ["<b>Alignment</b>", icp.alignment ? `${icp.alignment.charAt(0).toUpperCase() + icp.alignment.slice(1)} (${icp.signal_strength ?? ""} evidence)` : "—"],
          ...(icp.divergence_note ? [["<b>Gap</b>", icp.divergence_note]] : []),
        ]
      ));
    }
  }

  // ── 05 Strategic Options Considered ───────────────────────
  if (decide.executive_summary || decide.what_matters) {
    parts.push(sectionHeader("05", "Strategic Options Considered"));
    if (decide.executive_summary) parts.push(md(decide.executive_summary));
    if (decide.what_matters) parts.push(md(decide.what_matters));
  }

  // ── 06 Recommended Direction ──────────────────────────────
  if (decide.recommendation) {
    parts.push(sectionHeader("06", "Recommended Direction"));
    parts.push(md(decide.recommendation));
  }

  // ── 07 What Must Be True ──────────────────────────────────
  {
    const assumptions = decide.assumptions as Assumption[] | undefined;
    const kc = (commit.kill_criteria ?? decide.kill_criteria) as KillCriterion[] | undefined;
    const hasContent = decide.business_implications || assumptions?.length || kc?.length;
    if (hasContent) {
      parts.push(sectionHeader("07", "What Must Be True"));
      if (decide.business_implications) parts.push(md(decide.business_implications));
      if (assumptions?.length) {
        parts.push(subheading("Critical Assumptions"));
        parts.push(tableHtml(
          ["Assumption", "Status", "Fragility"],
          assumptions.map(a => [a.text || "—", a.status || "—", a.fragility || "—"])
        ));
      }
      if (kc?.length) {
        parts.push(subheading("Reversal Conditions"));
        parts.push(`<ul style="margin:0 0 8pt;padding-left:18pt;">${kc.map(c => `<li style="margin-bottom:4pt;font-family:Georgia;font-size:10pt;"><b>${c.criterion}:</b> ${c.trigger} → ${c.response}</li>`).join("")}</ul>`);
      }
    }
  }

  // ── 08 Market Position ────────────────────────────────────
  if (position.executive_summary || position.recommendation) {
    parts.push(sectionHeader("08", "Market Position"));
    if (position.executive_summary) parts.push(md(position.executive_summary));
    if (position.recommendation) parts.push(md(position.recommendation));
  }

  // ── 09 Competitive Advantage ──────────────────────────────
  if (position.what_matters || position.business_implications) {
    parts.push(sectionHeader("09", "Competitive Advantage"));
    if (position.what_matters) parts.push(md(position.what_matters));
    if (position.business_implications) parts.push(md(position.business_implications));
  }

  // ── 10 Strategic Bets ─────────────────────────────────────
  {
    const bets = commit.strategic_bets as Bet[] | undefined;
    if (bets?.length || commit.recommendation) {
      parts.push(sectionHeader("10", "Strategic Bets"));
      if (commit.recommendation) parts.push(md(commit.recommendation));
      if (bets?.length) {
        bets.forEach((b, i) => {
          const name = b["Bet name"] ?? b.bet ?? `Bet ${i + 1}`;
          const hypothesis = b["Hypothesis"] ?? b.hypothesis ?? "";
          const mvt = b["Minimum viable test"] ?? b.commitment ?? b.investment ?? "";
          const typeLabel = b["Type"] ?? b.horizon ?? "";
          const bodyParts = [
            hypothesis,
            mvt ? `Minimum viable test: ${mvt}` : "",
            b.if_wrong ? `If wrong: ${b.if_wrong}` : "",
          ].filter(Boolean).join(" ");
          const label = typeLabel ? ` (${typeLabel})` : "";
          parts.push(`<p style="margin:0 0 10pt;font-family:Georgia;font-size:11pt;line-height:1.6;color:#1a1a1a;"><b>Bet ${i + 1} \u2014 ${name}</b>${label}. ${bodyParts}</p>`);
        });
      }
    }
  }

  // ── 11 Success Measures & 100-Day Plan ────────────────────
  {
    const okrs = commit.okrs as OKR[] | undefined;
    const plan = commit.hundred_day_plan as DayPlan[] | undefined;
    if (okrs?.length || plan?.length) {
      parts.push(sectionHeader("11", "Success Measures & 100-Day Plan"));
      if (okrs?.length) {
        parts.push(subheading("OKRs"));
        parts.push(tableHtml(
          ["Objective", "Key Results"],
          okrs.map(o => [
            `<b>${o.objective}</b>`,
            `<ul style="margin:0;padding-left:14pt;">${o.key_results?.map(kr => `<li style="margin-bottom:2pt;">${kr}</li>`).join("") ?? ""}</ul>`
          ])
        ));
      }
      if (plan?.length) {
        parts.push(subheading("100-Day Plan"));
        parts.push(tableHtml(
          ["Timeline", "Milestone", "Owner", "Deliverable", "Gate"],
          plan.map(p => [p.timeline || "—", p.milestone || "—", p.owner || "—", p.deliverable || "—", p.gate || "—"])
        ));
      }
    }
  }

  // ── 12 Governance, Risks & Kill Criteria ──────────────────
  {
    // Collect HIGH severity risks only, deduplicated
    const allRisks: string[][] = [];
    for (const [stage, secs] of Object.entries(outputs)) {
      const s = secs as Sections;
      const risks = s?.risks as Risk[] | undefined;
      if (risks?.length) {
        risks
          .filter(r => (r.severity || "").toLowerCase() === "high")
          .forEach(r => allRisks.push([
            STAGE_LABELS[stage] ?? stage,
            cleanRisk(r.risk || "—"),
            cleanRisk(r.mitigation || "—", 140),
          ]));
      }
    }
    const uniqueRisks = deduplicateRisks(allRisks);

    const kc = (commit.kill_criteria ?? decide.kill_criteria) as KillCriterion[] | undefined;
    const monitoring = commit.monitoring as Monitoring[] | undefined;
    if (uniqueRisks.length || kc?.length || monitoring?.length) {
      parts.push(sectionHeader("12", "Governance, Risks & Kill Criteria"));
      if (uniqueRisks.length) {
        parts.push(subheading("Major Risks (High Severity)"));
        parts.push(tableHtml(["Stage", "Risk", "Mitigation"], uniqueRisks));
      }
      if (kc?.length) {
        parts.push(subheading("Kill Criteria"));
        parts.push(`<p style="margin:0 0 6pt;">&nbsp;</p>`);
        kc.forEach((c, i) => {
          const body = [c.trigger, c.response].filter(Boolean).join(" \u2192 ");
          parts.push(`<p style="margin:0 0 10pt;font-family:Georgia;font-size:11pt;line-height:1.6;color:#1a1a1a;"><b>Kill ${i + 1} \u2014 ${c.criterion}.</b> ${body}</p>`);
        });
      }
      if (monitoring?.length) {
        parts.push(subheading("Monitoring"));
        parts.push(tableHtml(["Metric", "Target", "Frequency"], monitoring.map(m => [m.metric || "—", m.target || "—", m.frequency || "—"])));
      }
    }
  }

  // ── 13 Appendix ───────────────────────────────────────────
  {
    const rows: string[][] = [];
    for (const [stage, secs] of Object.entries(outputs)) {
      const s = secs as Sections;
      const conf = s?.confidence as { score?: number; rationale?: string } | undefined;
      const score = conf?.score;
      const pct = score != null ? `${Math.round(Number(score) * 100)}%` : "—";
      rows.push([STAGE_LABELS[stage] ?? stage, pct, cleanRisk((conf?.rationale as string) || "—", 200)]);
    }
    if (rows.length) {
      parts.push(sectionHeader("13", "Appendix"));
      parts.push(subheading("Evidence & Confidence by Stage"));
      parts.push(tableHtml(["Stage", "Confidence", "Rationale"], rows));
    }
  }

  // ── Word-compatible HTML wrapper ──────────────────────────
  const logo = nthLayerLogo();
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${companyName} — Strategy Document</title>
<!--[if gte mso 9]><xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:SpellingState>Clean</w:SpellingState>
    <w:GrammarState>Clean</w:GrammarState>
    <w:DocumentKind>wdTypeDocument</w:DocumentKind>
  </w:WordDocument>
</xml><![endif]-->
<style>
  @page {
    size: A4;
    margin: 2.8cm 2.8cm 2.5cm 2.8cm;
    mso-header-margin: 1.2cm;
    mso-footer-margin: 1cm;
    mso-header: hdr1;
    mso-footer: ftr1;
  }
  body { font-family: Georgia, serif; font-size: 11pt; color: #1a1a1a; line-height: 1.55; }
  p { margin: 0 0 6pt; }
  h1, h2, h3 { page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: top; }
  ul, ol { margin: 2pt 0 6pt; padding-left: 18pt; }
  li { margin-bottom: 2pt; line-height: 1.5; }
</style>
</head>
<body>
<div style="mso-element:header" id="hdr1">
  <table style="width:100%;border-collapse:collapse;border-bottom:0.75pt solid #cccccc;padding-bottom:5pt;margin-bottom:4pt;">
    <tr>
      <td style="padding:0 0 5pt;vertical-align:middle;">${logo}</td>
    </tr>
  </table>
</div>
<div style="mso-element:footer" id="ftr1">
  <table style="width:100%;border-collapse:collapse;border-top:0.75pt solid #cccccc;"><tr><td style="padding:4pt 0 0;">&nbsp;</td></tr></table>
</div>
${parts.join("\n")}</body>
</html>`;

  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${companyName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}-Strategy-Document.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
