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
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #ffffff; color: #111827; font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.7; font-size: 15px; }
  .report-container { max-width: 820px; margin: 0 auto; padding: 3rem 2rem 5rem; }

  .report-header { margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 2px solid #059669; }
  .report-header h1 { font-size: 1.875rem; font-weight: 700; letter-spacing: -0.03em; color: #111827; line-height: 1.2; }
  .report-header .subtitle { color: #6b7280; font-size: 0.875rem; margin-top: 0.5rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
  .report-header .meta { display: flex; gap: 1.5rem; margin-top: 1rem; font-size: 0.75rem; color: #9ca3af; font-family: ui-monospace, monospace; }

  .report-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid #e5e7eb; }
  .nav-link { color: #374151; text-decoration: none; font-size: 0.75rem; font-weight: 500; padding: 0.375rem 0.875rem; border-radius: 9999px; border: 1px solid #d1d5db; background: #f9fafb; transition: all 0.15s; }
  .nav-link:hover { background: #059669; color: #ffffff; border-color: #059669; }

  .report-section { margin-bottom: 3.5rem; padding-bottom: 3.5rem; border-bottom: 1px solid #f3f4f6; }
  .report-section:last-child { border-bottom: none; }
  .report-section h2 { font-size: 1.125rem; font-weight: 700; margin-bottom: 1.25rem; color: #059669; letter-spacing: -0.01em; display: flex; align-items: center; gap: 0.5rem; }
  .report-section h2::before { content: ''; display: block; width: 3px; height: 1.125rem; background: #059669; border-radius: 2px; }

  .section-content { color: #374151; }
  .section-content p { margin-bottom: 1rem; }
  .section-content ul, .section-content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
  .section-content li { margin-bottom: 0.5rem; }
  .section-content strong { color: #111827; font-weight: 600; }
  .section-content h3 { font-size: 0.9375rem; font-weight: 600; color: #111827; margin: 1.75rem 0 0.75rem; padding-bottom: 0.375rem; border-bottom: 1px solid #f3f4f6; }

  .footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center; }

  @media print {
    .report-nav { display: none; }
    .report-section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="report-container">
  <div class="report-header">
    <div class="subtitle">Nth Layer · Competitor Intelligence</div>
    <h1>${title}</h1>
    <div class="meta">
      <span>Generated ${new Date().toISOString().split("T")[0]}</span>
      <span>Public Signal Mode</span>
    </div>
  </div>
  <nav class="report-nav">${nav}</nav>
  ${body}
  <div class="footer">
    <p>Nth Layer — Structured Operator Judgement · Public signals only · Confidence levels stated per section</p>
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
