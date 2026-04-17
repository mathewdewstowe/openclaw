import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserCompanies } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { SourceCard, type SourceItem } from "./source-card";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"] as const;
type Stage = (typeof STAGE_ORDER)[number];

const STAGE_META: Record<Stage, { label: string; color: string; bg: string; num: string }> = {
  frame:    { label: "Frame",    color: "#a3e635", bg: "rgba(163,230,53,0.1)",  num: "01" },
  diagnose: { label: "Diagnose", color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  num: "02" },
  decide:   { label: "Decide",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  num: "03" },
  position: { label: "Position", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", num: "04" },
  commit:   { label: "Commit",   color: "#f87171", bg: "rgba(248,113,113,0.1)", num: "05" },
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseSource(src: unknown): SourceItem | null {
  if (!src) return null;

  if (typeof src === "object" && src !== null) {
    const s = src as Record<string, unknown>;
    const url = typeof s.url === "string" ? s.url : "";
    const title = typeof s.title === "string" ? s.title : url;
    if (!url) return null;
    return { url, title: title || url, domain: extractDomain(url) };
  }

  if (typeof src === "string") {
    const str = src.trim();
    if (!str) return null;
    try {
      const u = new URL(str);
      return { url: str, title: u.hostname, domain: u.hostname };
    } catch {
      const sep = str.includes(" – ") ? " – " : str.includes(" - ") ? " - " : null;
      if (sep) {
        const idx = str.lastIndexOf(sep);
        const maybeTitle = str.slice(0, idx).trim();
        const maybeUrl = str.slice(idx + sep.length).trim();
        try {
          new URL(maybeUrl);
          return { url: maybeUrl, title: maybeTitle || maybeUrl, domain: extractDomain(maybeUrl) };
        } catch { /* fall through */ }
      }
      return { url: "", title: str, domain: "" };
    }
  }

  return null;
}

function dedupeSources(sources: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.url || s.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function KnowledgeBasePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyAccess = await getUserCompanies(user.id);
  const activeCompany = companyAccess[0]?.company;

  const stageData: Record<string, SourceItem[]> = {};

  if (activeCompany) {
    const outputs = await db.output.findMany({
      where: {
        companyId: activeCompany.id,
        workflowType: { in: [...STAGE_ORDER] },
      },
      select: { workflowType: true, sections: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const seen = new Set<string>();
    for (const o of outputs) {
      if (seen.has(o.workflowType)) continue;
      seen.add(o.workflowType);

      const sections = o.sections as Record<string, unknown>;
      const eb = sections?.evidence_base as { sources?: unknown[]; quotes?: string[] } | undefined;

      const rawSources: unknown[] = Array.isArray(eb?.sources) ? (eb!.sources as unknown[]) : [];
      const quotes: string[] = Array.isArray(eb?.quotes) ? (eb!.quotes as string[]) : [];

      const parsed = rawSources.map(parseSource).filter((s): s is SourceItem => s !== null);

      if (quotes.length > 0 && parsed.length > 0 && !parsed[0].quote) {
        parsed[0] = { ...parsed[0], quote: quotes[0] };
      }

      stageData[o.workflowType] = dedupeSources(parsed);
    }
  }

  const totalSources = Object.values(stageData).reduce((n, s) => n + s.length, 0);
  const stagesWithSources = STAGE_ORDER.filter((s) => (stageData[s]?.length ?? 0) > 0);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <h1 className="text-2xl sm:text-3xl" style={{ fontWeight: 800, color: "var(--foreground)", margin: 0 }}>
            Knowledge Base
          </h1>
          {totalSources > 0 && (
            <span style={{
              fontSize: 13, fontWeight: 700, color: "#111827",
              background: "#a3e635", padding: "3px 11px", borderRadius: 999,
            }}>
              {totalSources}
            </span>
          )}
        </div>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: 0 }}>
          Every source cited across your strategy reports — organised by stage.
          {stagesWithSources.length > 0 && (
            <span style={{ marginLeft: 8, color: "var(--muted-foreground)" }}>
              {stagesWithSources.length} stage{stagesWithSources.length !== 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>

      {/* Empty state */}
      {totalSources === 0 && (
        <div style={{
          textAlign: "center", padding: "80px 32px",
          background: "var(--card)", borderRadius: 16,
          border: "1px solid var(--border)",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "rgba(163,230,53,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#a3e635" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", margin: "0 0 8px" }}>
            No sources yet
          </p>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0 }}>
            Complete at least one strategy stage to see references appear here.
          </p>
        </div>
      )}

      {/* Per-stage sections */}
      {STAGE_ORDER.map((stage) => {
        const sources = stageData[stage] ?? [];
        if (sources.length === 0) return null;
        const meta = STAGE_META[stage];

        return (
          <section key={stage} style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                background: meta.bg, color: meta.color, padding: "3px 10px", borderRadius: 999,
              }}>
                {meta.num} · {meta.label}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "#6b7280",
              }}>
                {sources.length} source{sources.length !== 1 ? "s" : ""}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 8,
            }}>
              {sources.map((src, i) => (
                <SourceCard key={i} src={src} stageColor={meta.color} stageBg={meta.bg} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
