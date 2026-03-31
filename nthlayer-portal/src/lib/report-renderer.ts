import { db } from "./db";

interface ReportSection {
  title: string;
  content: string;
  id: string;
}

export async function renderReport(
  scanId: string,
  userId: string,
  title: string,
  sections: ReportSection[]
): Promise<string> {
  const nav = sections
    .map((s) => `<a href="#${s.id}" class="nav-link">${s.title}</a>`)
    .join("\n");

  const body = sections
    .map(
      (s) => `
    <section id="${s.id}" class="report-section">
      <h2>${s.title}</h2>
      <div class="section-content">${s.content}</div>
    </section>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Nth Layer</title>
<style>
  :root { --bg: #09090b; --fg: #fafafa; --card: #18181b; --border: #27272a; --muted: #a1a1aa; --primary: #10b981; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--fg); font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; }
  .report-container { max-width: 800px; margin: 0 auto; padding: 3rem 2rem; }
  .report-header { margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border); }
  .report-header h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.025em; }
  .report-header .subtitle { color: var(--muted); font-size: 0.875rem; margin-top: 0.5rem; }
  .report-header .meta { display: flex; gap: 1.5rem; margin-top: 1rem; font-size: 0.75rem; color: var(--muted); font-family: 'JetBrains Mono', monospace; }
  .report-nav { position: sticky; top: 0; background: var(--bg); padding: 1rem 0; margin-bottom: 2rem; border-bottom: 1px solid var(--border); z-index: 10; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .nav-link { color: var(--muted); text-decoration: none; font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid var(--border); transition: all 0.15s; }
  .nav-link:hover { color: var(--primary); border-color: var(--primary); }
  .report-section { margin-bottom: 3rem; }
  .report-section h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: var(--primary); }
  .section-content { font-size: 0.9375rem; line-height: 1.8; }
  .section-content p { margin-bottom: 1rem; }
  .section-content ul, .section-content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
  .section-content li { margin-bottom: 0.5rem; }
  .section-content strong { color: var(--fg); }
  .section-content h3 { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
  .confidence-badge { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-family: 'JetBrains Mono', monospace; padding: 0.125rem 0.5rem; border-radius: 9999px; }
  .confidence-high { background: rgba(16,185,129,0.15); color: #10b981; }
  .confidence-medium { background: rgba(234,179,8,0.15); color: #eab308; }
  .confidence-low { background: rgba(239,68,68,0.15); color: #ef4444; }
  .footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--muted); text-align: center; }
  @media print { body { background: white; color: black; } .report-nav { display: none; } }
</style>
</head>
<body>
<div class="report-container">
  <div class="report-header">
    <h1>${title}</h1>
    <p class="subtitle">Nth Layer Strategic Signal Analysis</p>
    <div class="meta">
      <span>Generated ${new Date().toISOString().split("T")[0]}</span>
      <span>Public Signal Mode</span>
    </div>
  </div>
  <nav class="report-nav">${nav}</nav>
  ${body}
  <div class="footer">
    <p>Nth Layer — Structured Operator Judgement</p>
    <p>This analysis uses public signals only. Confidence levels are stated per section.</p>
  </div>
</div>
</body>
</html>`;

  const report = await db.report.create({
    data: {
      scanId,
      userId,
      title,
      htmlContent: html,
    },
  });

  return report.id;
}
