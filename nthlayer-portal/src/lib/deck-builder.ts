// deck-builder.ts — pure TypeScript, no React, no "use client"
// Converts completed strategy output sections into structured slide data for PPTX rendering.

export type Sections = {
  executive_summary?: string;
  what_matters?: string;
  recommendation?: string;
  business_implications?: string;
  assumptions?: string[];
  confidence?: { score?: number; rationale?: string };
  risks?: { risk: string; severity: string; mitigation: string }[];
  actions?: { action: string; owner: string; deadline: string; priority: string }[];
  monitoring?: { metric: string; target: string; frequency: string }[];
  evidence_base?: { sources?: string[]; quotes?: string[] };
};

export type SlideData = {
  id: string;
  title: string;
  subtitle?: string;
  theme: "dark" | "light" | "accent";
  bullets?: string[];
  body?: string;
  columns?: Array<{ heading: string; body: string }>;
  table?: { headers: string[]; rows: string[][] };
  badge?: string;
  confidence?: number;
};

export type DeckData = {
  companyName: string;
  generatedAt: string;
  slides: SlideData[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extracts the text after `### {heading}` until the next `### ` or end of string. */
export function extractSection(text: string, heading: string): string {
  if (!text) return "";
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`###\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=###|$)`, "i");
  const match = text.match(regex);
  if (!match) return "";
  return match[1].trim();
}

/** Splits on `\n` and extracts lines starting with `- ` or a numbered list prefix. */
export function extractBullets(text: string): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, "").replace(/^\d+\.\s+/, "").trim())
    .filter(Boolean);
}

/** Removes **bold**, *italic*, `### ` headings, trims whitespace. */
export function cleanMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/#{1,6}\s+[^\n]*/g, "") // remove headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // remove bold
    .replace(/\*(.+?)\*/g, "$1")     // remove italic
    .replace(/__(.+?)__/g, "$1")     // remove alt bold
    .replace(/_(.+?)_/g, "$1")       // remove alt italic
    .replace(/`(.+?)`/g, "$1")       // remove inline code
    .replace(/\n{3,}/g, "\n\n")      // collapse excess newlines
    .trim();
}

/** Truncates at a word boundary with an ellipsis. */
export function truncate(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + "…";
}

// ---------------------------------------------------------------------------
// Month/year label
// ---------------------------------------------------------------------------

function currentMonthYear(): string {
  const now = new Date();
  return now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildDeckData(
  companyName: string,
  outputs: Record<string, Sections>
): DeckData {
  const get = (stage: string): Sections => outputs[stage] ?? {};

  const frame = get("frame");
  const diagnose = get("diagnose");
  const decide = get("decide");
  const position = get("position");
  const commit = get("commit");

  const slides: SlideData[] = [];

  // 1 — Cover
  slides.push({
    id: "cover",
    theme: "dark",
    title: companyName,
    subtitle: `Strategic Review — ${currentMonthYear()}`,
    badge: undefined,
  });

  // 2 — Inflection Point
  const inflectionRaw = extractSection(frame.executive_summary ?? "", "The Strategic Problem");
  const inflectionBullets =
    extractBullets(inflectionRaw).length > 0
      ? extractBullets(inflectionRaw)
      : extractBullets(frame.executive_summary ?? "");
  slides.push({
    id: "inflection",
    theme: "dark",
    title: "The Inflection Point",
    badge: "Frame",
    bullets: inflectionBullets.slice(0, 4),
  });

  // 3 — Market Reality
  slides.push({
    id: "market",
    theme: "light",
    title: "Market Reality",
    badge: "Frame",
    columns: [
      {
        heading: "Macro Context",
        body: truncate(
          cleanMarkdown(extractSection(frame.what_matters ?? "", "Macro & Market Context")),
          200
        ),
      },
      {
        heading: "Winning Conditions",
        body: truncate(
          cleanMarkdown(extractSection(frame.what_matters ?? "", "Winning Conditions")),
          200
        ),
      },
      {
        heading: "Decision Boundaries",
        body: truncate(
          cleanMarkdown(extractSection(frame.what_matters ?? "", "Decision Boundaries")),
          200
        ),
      },
    ],
  });

  // 4 — Where We Stand
  const assessmentText =
    extractSection(diagnose.executive_summary ?? "", "Business Assessment") ||
    diagnose.executive_summary ||
    "";
  const pmfBullets = extractBullets(
    extractSection(diagnose.what_matters ?? "", "Product-Market Fit")
  ).slice(0, 3);
  slides.push({
    id: "assessment",
    theme: "light",
    title: "Where We Stand",
    badge: "Diagnose",
    body: truncate(cleanMarkdown(assessmentText), 500),
    bullets: pmfBullets,
  });

  // 5 — Competitive Gap
  const compLandscapeBullets = extractBullets(
    extractSection(diagnose.what_matters ?? "", "Competitive Landscape")
  ).slice(0, 5);
  const capabilityBody = truncate(
    cleanMarkdown(extractSection(diagnose.recommendation ?? "", "Capability Assessment")),
    300
  );
  slides.push({
    id: "competitive-gap",
    theme: "light",
    title: "The Competitive Gap",
    badge: "Diagnose",
    bullets: compLandscapeBullets,
    body: capabilityBody,
  });

  // 6 — Options Considered
  const optionsBullets = extractBullets(
    extractSection(decide.executive_summary ?? "", "Strategic Options") ||
      decide.executive_summary ||
      ""
  ).slice(0, 5);
  slides.push({
    id: "options",
    theme: "light",
    title: "Options Considered",
    badge: "Decide",
    bullets: optionsBullets,
  });

  // 7 — The Strategic Direction
  const directionBody = truncate(
    cleanMarkdown(
      extractSection(decide.recommendation ?? "", "Recommended Direction") ||
        decide.recommendation ||
        ""
    ),
    400
  );
  slides.push({
    id: "direction",
    theme: "dark",
    title: "The Strategic Direction",
    badge: "Decide",
    body: directionBody,
  });

  // 8 — What Must Be True
  const wwhtbtRaw =
    extractSection(decide.recommendation ?? "", "What Must Be True") ||
    (Array.isArray(decide.assumptions) ? decide.assumptions.join("\n") : "") ||
    "";
  const wwhtbtBullets = extractBullets(wwhtbtRaw).slice(0, 6);
  slides.push({
    id: "wwhtbt",
    theme: "light",
    title: "What Must Be True",
    badge: "Decide",
    bullets: wwhtbtBullets,
  });

  // 9 — Our Position
  const positionColumns = [
    {
      heading: "Target Customer",
      body: truncate(
        cleanMarkdown(extractSection(position.executive_summary ?? "", "Target Customer")),
        250
      ),
    },
    {
      heading: "Competitive Advantage",
      body: truncate(
        cleanMarkdown(extractSection(position.what_matters ?? "", "Competitive Advantage")),
        250
      ),
    },
  ];
  const positioningBody = truncate(
    cleanMarkdown(extractSection(position.recommendation ?? "", "Positioning Statement")),
    300
  );
  slides.push({
    id: "position",
    theme: "light",
    title: "Our Position",
    badge: "Position",
    columns: positionColumns,
    body: positioningBody,
  });

  // 10 — Strategic Bets
  const betsBullets = extractBullets(
    extractSection(commit.recommendation ?? "", "Strategic Bets") ||
      commit.recommendation ||
      ""
  ).slice(0, 5);
  slides.push({
    id: "bets",
    theme: "dark",
    title: "Strategic Bets",
    badge: "Commit",
    bullets: betsBullets,
  });

  // 11 — OKRs
  const okrBullets = extractBullets(
    extractSection(commit.what_matters ?? "", "OKRs") ||
      commit.what_matters ||
      ""
  ).slice(0, 8);
  slides.push({
    id: "okrs",
    theme: "light",
    title: "OKRs",
    badge: "Commit",
    bullets: okrBullets,
  });

  // 12 — 100-Day Plan
  const planBullets = extractBullets(
    extractSection(commit.business_implications ?? "", "100-Day Plan") ||
      commit.business_implications ||
      ""
  ).slice(0, 8);
  slides.push({
    id: "plan",
    theme: "light",
    title: "100-Day Plan",
    badge: "Commit",
    bullets: planBullets,
  });

  // 13 — Kill Criteria & Governance
  const killBullets = extractBullets(
    extractSection(commit.recommendation ?? "", "Kill Criteria")
  ).slice(0, 5);
  const resourceBody = truncate(
    cleanMarkdown(
      extractSection(commit.business_implications ?? "", "Resource Allocation")
    ),
    250
  );
  slides.push({
    id: "kill",
    theme: "light",
    title: "Kill Criteria & Governance",
    badge: "Commit",
    bullets: killBullets,
    body: resourceBody,
  });

  // 14 — Evidence & Confidence
  const stageNames: Record<string, string> = {
    frame: "Frame",
    diagnose: "Diagnose",
    decide: "Decide",
    position: "Position",
    commit: "Commit",
  };
  const tableRows: string[][] = ["frame", "diagnose", "decide", "position", "commit"]
    .filter((s) => !!outputs[s])
    .map((s) => {
      const sec = outputs[s];
      const pct = `${Math.round((sec.confidence?.score ?? 0) * 100)}%`;
      const sources = (sec.evidence_base?.sources ?? []).slice(0, 2).join(" · ") || "—";
      return [stageNames[s] ?? s, pct, sources];
    });

  slides.push({
    id: "appendix",
    theme: "light",
    title: "Evidence & Confidence",
    badge: "All Stages",
    table: {
      headers: ["Stage", "Confidence", "Key Sources"],
      rows: tableRows,
    },
  });

  return {
    companyName,
    generatedAt: new Date().toISOString(),
    slides,
  };
}
