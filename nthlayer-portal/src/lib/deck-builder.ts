// deck-builder.ts — pure TypeScript, no React, no "use client"
// Converts completed strategy output sections into structured slide data for PPTX rendering.

export type Sections = {
  executive_summary?: string;
  what_matters?: string;
  recommendation?: string;
  business_implications?: string;
  assumptions?: (string | { text: string; fragility: "low" | "medium" | "high"; testable: boolean; status: "unvalidated" | "validated" | "at_risk" | "invalidated" })[];
  confidence?: { score?: number; rationale?: string };
  risks?: { risk: string; severity: string; mitigation: string }[];
  actions?: { action: string; owner: string; deadline: string; priority: string }[];
  monitoring?: { metric: string; target: string; frequency: string }[];
  evidence_base?: { sources?: string[]; quotes?: string[] };
  kill_criteria?: { criterion: string; trigger: string; response: string }[];
  okrs?: { objective: string; key_results: string[] }[];
  strategic_bets?: { bet: string; hypothesis: string; investment: string }[];
  hundred_day_plan?: { milestone: string; timeline: string; owner: string; deliverable: string }[];
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
// Content helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort bullets: try list extraction first, then split on paragraph
 * breaks and keep lines that look like meaningful sentences (not headings).
 */
function asBullets(text: string, max: number): string[] {
  if (!text) return [];
  const bullets = extractBullets(text);
  if (bullets.length >= 2) return bullets.slice(0, max);
  return text
    .split(/\n{2,}/)
    .map((p) => cleanMarkdown(p).trim())
    .filter((p) => p.length > 15 && p.length < 240)
    .slice(0, max);
}

/** Clean prose body, capped at maxChars. */
function asBody(text: string, maxChars = 440): string {
  return truncate(cleanMarkdown(text), maxChars);
}

/** Format typed assumption objects into readable bullet strings. */
function fmtAssumptions(
  assumptions: Sections["assumptions"]
): string[] {
  if (!Array.isArray(assumptions) || assumptions.length === 0) return [];
  return assumptions.slice(0, 6).map((a) => {
    if (typeof a === "string") return a;
    const tag =
      a.status === "validated"   ? "✓"
      : a.status === "at_risk"   ? "⚠"
      : a.status === "invalidated" ? "✗"
      : "?";
    return `${tag}  ${a.text}`;
  });
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildDeckData(
  companyName: string,
  outputs: Record<string, Sections>
): DeckData {
  const get = (stage: string): Sections => outputs[stage] ?? {};

  const frame    = get("frame");
  const diagnose = get("diagnose");
  const decide   = get("decide");
  const position = get("position");
  const commit   = get("commit");

  const slides: SlideData[] = [];

  // 1 — Cover
  slides.push({
    id: "cover",
    theme: "dark",
    title: companyName,
    subtitle: `Product Strategy — ${currentMonthYear()}`,
  });

  // 2 — The Strategic Direction (recommendation FIRST)
  slides.push({
    id: "direction",
    theme: "dark",
    title: "The Strategic Direction",
    badge: "Decide",
    body: asBody(decide.recommendation ?? decide.executive_summary ?? "", 500),
  });

  // 3 — The Inflection Point (Frame)
  slides.push({
    id: "inflection",
    theme: "dark",
    title: "The Inflection Point",
    badge: "Frame",
    bullets: asBullets(frame.executive_summary ?? frame.recommendation ?? "", 5),
  });

  // 4 — What Matters (Frame)
  slides.push({
    id: "market",
    theme: "light",
    title: "What Matters",
    badge: "Frame",
    bullets: asBullets(frame.what_matters ?? frame.executive_summary ?? "", 5),
  });

  // 5 — Where We Stand (Diagnose)
  slides.push({
    id: "assessment",
    theme: "light",
    title: "Where We Stand",
    badge: "Diagnose",
    body: asBody(diagnose.executive_summary ?? "", 400),
    bullets: asBullets(diagnose.what_matters ?? "", 3),
  });

  // 6 — The Competitive Gap (Diagnose)
  slides.push({
    id: "competitive-gap",
    theme: "light",
    title: "The Competitive Gap",
    badge: "Diagnose",
    bullets: asBullets(
      diagnose.what_matters ?? diagnose.recommendation ?? "",
      5
    ),
  });

  // 7 — Options Considered (Decide)
  slides.push({
    id: "options",
    theme: "light",
    title: "Options Considered",
    badge: "Decide",
    bullets: asBullets(decide.executive_summary ?? decide.what_matters ?? "", 5),
  });

  // 8 — What Must Be True (Decide)
  const assumptionBullets = fmtAssumptions(decide.assumptions);
  slides.push({
    id: "wwhtbt",
    theme: "light",
    title: "What Must Be True",
    badge: "Decide",
    bullets:
      assumptionBullets.length > 0
        ? assumptionBullets
        : asBullets(decide.what_matters ?? "", 6),
  });

  // 9 — Our Position (Position)
  slides.push({
    id: "position",
    theme: "dark",
    title: "Our Position",
    badge: "Position",
    body: asBody(position.recommendation ?? position.executive_summary ?? "", 500),
  });

  // 10 — How We Win (Position)
  slides.push({
    id: "how-we-win",
    theme: "light",
    title: "How We Win",
    badge: "Position",
    bullets: asBullets(
      position.what_matters ?? position.business_implications ?? "",
      5
    ),
  });

  // 11 — Strategic Bets (Commit)
  const betsBullets =
    commit.strategic_bets && commit.strategic_bets.length > 0
      ? commit.strategic_bets.slice(0, 4).map((b) => `${b.bet} — ${b.hypothesis}`)
      : asBullets(commit.recommendation ?? commit.executive_summary ?? "", 4);
  slides.push({
    id: "bets",
    theme: "dark",
    title: "Strategic Bets",
    badge: "Commit",
    bullets: betsBullets,
  });

  // 12 — 100-Day Plan (Commit)
  const planBullets =
    commit.hundred_day_plan && commit.hundred_day_plan.length > 0
      ? commit.hundred_day_plan
          .slice(0, 7)
          .map((p) => `[${p.timeline}]  ${p.milestone}  →  ${p.owner}`)
      : asBullets(commit.business_implications ?? commit.what_matters ?? "", 7);
  slides.push({
    id: "plan",
    theme: "light",
    title: "100-Day Plan",
    badge: "Commit",
    bullets: planBullets,
  });

  // 13 — Kill Criteria & Governance (Commit)
  const killBullets =
    commit.kill_criteria && commit.kill_criteria.length > 0
      ? commit.kill_criteria.slice(0, 5).map((k) => `${k.criterion}  ·  ${k.trigger}`)
      : asBullets(commit.recommendation ?? "", 5);
  slides.push({
    id: "kill",
    theme: "light",
    title: "Kill Criteria & Governance",
    badge: "Commit",
    bullets: killBullets,
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
      const sources =
        (sec.evidence_base?.sources ?? []).slice(0, 2).join("  ·  ") || "—";
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
