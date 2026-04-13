"use client";

import React from "react";
import { SECTION_ORDER, SECTION_LABELS, STAGE_SECTION_LABELS, STAGE_HIDDEN_SECTIONS } from "@/lib/types/output";
import { FreshnessBadge } from "@/components/freshness-badge";

interface OutputData {
  id: string;
  title: string;
  workflowType: string;
  outputType: string;
  sections: Record<string, unknown>;
  confidence: number | null;
  sources: string[];
  tags: string[];
  companyName: string;
  createdAt: string;
  version: number;
}

// Sections that sit in the right column (actionable / quantitative)
const RIGHT_COLUMN_SECTIONS = new Set(["risks", "actions", "monitoring", "kill_criteria", "okrs", "strategic_bets", "hundred_day_plan"]);

// Optional sections — only render when populated (backward compat with existing outputs)
const OPTIONAL_SECTIONS = new Set(["kill_criteria", "okrs", "strategic_bets", "hundred_day_plan"]);

// Stage colours
const STAGE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  frame:    { border: "#d1d5db", bg: "#f9fafb",  text: "#374151" },
  diagnose: { border: "#bfdbfe", bg: "#eff6ff",  text: "#1e40af" },
  decide:   { border: "#ddd6fe", bg: "#f5f3ff",  text: "#6d28d9" },
  position: { border: "#bbf7d0", bg: "#f0fdf4",  text: "#065f46" },
  commit:   { border: "#fde68a", bg: "#fffbeb",  text: "#92400e" },
};

export function OutputRenderer({
  output,
  visibleSections,
}: {
  output: OutputData;
  visibleSections: number;
}) {
  const stage = output.workflowType;
  const stageColor = STAGE_COLORS[stage] ?? STAGE_COLORS.frame;

  // Hide sections that this stage does not produce, and skip empty optional sections
  const hiddenForStage = new Set(STAGE_HIDDEN_SECTIONS[stage] ?? []);
  const isVisible = (s: string) => {
    if (hiddenForStage.has(s)) return false;
    if (OPTIONAL_SECTIONS.has(s)) {
      const content = output.sections[s];
      return content !== undefined && content !== null && !(Array.isArray(content) && content.length === 0);
    }
    // Also hide required sections if agent returned empty array (backward compat)
    const content = output.sections[s];
    if (Array.isArray(content) && content.length === 0) return false;
    return true;
  };

  const leftSections  = SECTION_ORDER.filter((s) => !RIGHT_COLUMN_SECTIONS.has(s) && isVisible(s));
  const rightSections = SECTION_ORDER.filter((s) => RIGHT_COLUMN_SECTIONS.has(s) && isVisible(s));

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: stageColor.text,
            background: stageColor.bg,
            border: `1px solid ${stageColor.border}`,
            padding: "3px 10px",
            borderRadius: 999,
          }}>
            {output.workflowType}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>&middot;</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{output.companyName}</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>&middot;</span>
          <FreshnessBadge createdAt={output.createdAt} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{output.title}</h1>

        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: output.tags?.length ? 12 : 0 }}>
          v{output.version} &middot; {new Date(output.createdAt).toLocaleDateString("en-GB")}
        </p>

        {/* Stage-specific tags */}
        {output.tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {output.tags.map((tag) => (
              <span key={tag} style={{
                fontSize: 11,
                fontWeight: 600,
                color: stageColor.text,
                background: stageColor.bg,
                border: `1px solid ${stageColor.border}`,
                padding: "2px 10px",
                borderRadius: 999,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

        {/* Left column — narrative */}
        <div>
          {leftSections.map((sectionKey, index) => {
            const isVisible = index < visibleSections;
            return <SectionCard key={sectionKey} sectionKey={sectionKey} output={output} isVisible={isVisible} />;
          })}
        </div>

        {/* Right column — actions, risks, monitoring */}
        <div>
          {rightSections.map((sectionKey, index) => {
            // right-column sections start at visibleSections offset after left column count
            const globalIndex = leftSections.length + index;
            const isVisible = globalIndex < visibleSections;
            return <SectionCard key={sectionKey} sectionKey={sectionKey} output={output} isVisible={isVisible} compact />;
          })}
        </div>

      </div>
    </div>
  );
}

// ─── Shared section card ────────────────────────────────────────

function SectionCard({
  sectionKey,
  output,
  isVisible,
  compact = false,
}: {
  sectionKey: string;
  output: OutputData;
  isVisible: boolean;
  compact?: boolean;
}) {
  const content = output.sections[sectionKey];
  const stage = output.workflowType;
  const label = STAGE_SECTION_LABELS[stage]?.[sectionKey] ?? SECTION_LABELS[sectionKey];

  // Skip optional sections that have no data (backward compat)
  if (OPTIONAL_SECTIONS.has(sectionKey) && (!content || (Array.isArray(content) && content.length === 0))) {
    return null;
  }

  if (!isVisible) {
    return (
      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{
          padding: compact ? "16px" : "20px 24px",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          filter: "blur(4px)",
          userSelect: "none",
          pointerEvents: "none",
        }}>
          <h2 style={{ fontSize: compact ? 13 : 20, fontWeight: 700, color: "#374151", marginBottom: 8 }}>{label}</h2>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
            Upgrade to see this section.
          </p>
        </div>
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.7)",
          borderRadius: 12,
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#9ca3af" style={{ marginBottom: 6 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Upgrade to view</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        padding: compact ? "16px" : "20px 24px",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
      }}>
        <h2 style={{ fontSize: compact ? 13 : 20, fontWeight: 700, color: "#111827", marginBottom: 10, textTransform: compact ? "uppercase" : "none", letterSpacing: compact ? "0.04em" : "normal" }}>{label}</h2>
        <SectionContent sectionKey={sectionKey} content={content} compact={compact} />
      </div>
    </div>
  );
}

// ─── Section renderers ───────────────────────────────────────────

function SectionContent({ sectionKey, content, compact = false }: { sectionKey: string; content: unknown; compact?: boolean }) {
  if (!content) {
    return <p style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>No data available</p>;
  }

  switch (sectionKey) {
    case "executive_summary":
    case "what_matters":
    case "recommendation":
    case "business_implications":
      return <TextSection content={content as string} />;

    case "evidence_base":
      return <EvidenceSection content={content as { sources: string[]; quotes: string[] }} />;

    case "assumptions":
      return <ListSection items={content as (string | { text: string; fragility?: string; testable?: boolean; status?: string })[]} />;

    case "confidence":
      return <ConfidenceSection content={content as { score: number; rationale: string }} />;

    case "risks":
      return <RisksSection content={content as { risk: string; severity: string; mitigation: string }[]} compact={compact} />;

    case "actions":
      return <ActionsSection content={content as { action: string; owner: string; deadline: string; priority: string }[]} compact={compact} />;

    case "monitoring":
      return <MonitoringSection content={content as { metric: string; target: string; frequency: string }[]} />;

    case "kill_criteria":
      return <KillCriteriaSection content={content as { criterion: string; trigger: string; response: string }[]} />;

    case "okrs":
      return <OKRsSection content={content as { objective: string; key_results: string[] }[]} />;

    case "strategic_bets":
      return <StrategicBetsSection content={content as { bet: string; hypothesis: string; investment: string }[]} />;

    case "hundred_day_plan":
      return <HundredDayPlanSection content={content as { milestone: string; timeline: string; owner: string; deliverable: string }[]} />;

    default:
      return <TextSection content={String(content)} />;
  }
}

function renderMarkdown(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pi) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const inline = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
    });
    return <p key={pi} style={{ margin: "0 0 12px" }}>{inline}</p>;
  });
}

function TextSection({ content }: { content: string }) {
  return (
    <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.8 }}>
      {renderMarkdown(content)}
    </div>
  );
}

function ListSection({ items }: { items: (string | { text: string; fragility?: string; testable?: boolean; status?: string })[] }) {
  const fragilityColor: Record<string, { bg: string; text: string }> = {
    high:   { bg: "#fee2e2", text: "#991b1b" },
    medium: { bg: "#fef3c7", text: "#92400e" },
    low:    { bg: "#dcfce7", text: "#166534" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => {
        if (typeof item === "string") {
          return (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{item}</p>
            </div>
          );
        }
        const fColor = fragilityColor[item.fragility ?? "medium"] ?? fragilityColor.medium;
        return (
          <div key={i} style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", borderLeft: "4px solid " + fColor.bg.replace("fe", "f8") }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <p style={{ fontSize: 13, color: "#111827", margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{item.text}</p>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {item.fragility && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: fColor.bg, color: fColor.text, padding: "2px 6px", borderRadius: 4 }}>
                    {item.fragility} fragility
                  </span>
                )}
                {item.testable !== undefined && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: item.testable ? "#dbeafe" : "#f3f4f6", color: item.testable ? "#1e40af" : "#6b7280", padding: "2px 6px", borderRadius: 4 }}>
                    {item.testable ? "testable" : "hard to test"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvidenceSection({ content }: { content: { sources: string[]; quotes: string[] } }) {
  return (
    <div>
      {content.quotes?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {content.quotes.map((q, i) => (
            <blockquote key={i} style={{
              borderLeft: "3px solid #d1d5db",
              paddingLeft: 16,
              margin: "8px 0",
              fontSize: 14,
              color: "#4b5563",
              fontStyle: "italic",
              lineHeight: 1.6,
            }}>
              {q}
            </blockquote>
          ))}
        </div>
      )}
      {content.sources?.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Sources</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {content.sources.map((s, i) => {
              const isUrl = s.startsWith("http://") || s.startsWith("https://");
              return (
                <li key={i} style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  {isUrl ? (
                    <a
                      href={s}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#2563eb", textDecoration: "none", wordBreak: "break-all" }}
                      onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      {s}
                    </a>
                  ) : s}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConfidenceSection({ content }: { content: { score: number; rationale: string } }) {
  const pct = Math.round(content.score * 100);
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#d97706" : "#dc2626";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "var(--font-mono, monospace)" }}>
          {pct}%
        </div>
        <div style={{ flex: 1, height: 6, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
        </div>
      </div>
      <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{content.rationale}</p>
    </div>
  );
}

function RisksSection({ content, compact }: { content: { risk: string; severity: string; mitigation: string }[]; compact?: boolean }) {
  const [filter, setFilter] = React.useState<string>("all");
  const items = filter === "all" ? content : content.filter((r) => r.severity?.toLowerCase() === filter);

  const severityColor: Record<string, { bg: string; text: string }> = {
    high:   { bg: "#fee2e2", text: "#991b1b" },
    medium: { bg: "#fef3c7", text: "#92400e" },
    low:    { bg: "#dcfce7", text: "#166534" },
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["all", "high", "medium", "low"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
            border: `1.5px solid ${filter === f ? "#111827" : "#e5e7eb"}`,
            background: filter === f ? "#111827" : "#fff",
            color: filter === f ? "#fff" : "#6b7280",
            cursor: "pointer", textTransform: "capitalize",
          }}>{f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((r, i) => {
        const colors = severityColor[r.severity] ?? severityColor.medium;
        return (
          <div key={i} style={{ padding: compact ? "10px 12px" : "12px 16px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 4,
                background: colors.bg,
                color: colors.text,
                flexShrink: 0,
              }}>
                {r.severity}
              </span>
              <span style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: "#111827" }}>{r.risk}</span>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>
              <span style={{ fontWeight: 500, color: "#4b5563" }}>Mitigation:</span> {r.mitigation}
            </p>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function ActionsSection({ content, compact }: { content: { action: string; owner: string; deadline: string; priority: string }[]; compact?: boolean }) {
  const [filter, setFilter] = React.useState<string>("all");
  const items = filter === "all" ? content : content.filter((a) => a.priority?.toLowerCase() === filter);

  const priorityDot: Record<string, string> = {
    critical: "#ef4444",
    high:     "#f59e0b",
    medium:   "#3b82f6",
    low:      "#10b981",
  };
  const priorityBorder: Record<string, string> = {
    critical: "#fecaca",
    high:     "#fde68a",
    medium:   "#bfdbfe",
    low:      "#bbf7d0",
  };
  const priorityBg: Record<string, { bg: string; text: string }> = {
    critical: { bg: "#fee2e2", text: "#991b1b" },
    high:     { bg: "#fef3c7", text: "#92400e" },
    medium:   { bg: "#dbeafe", text: "#1e40af" },
    low:      { bg: "#dcfce7", text: "#065f46" },
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["all", "critical", "high", "medium", "low"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
            border: `1.5px solid ${filter === f ? "#111827" : "#e5e7eb"}`,
            background: filter === f ? "#111827" : "#fff",
            color: filter === f ? "#fff" : "#6b7280",
            cursor: "pointer", textTransform: "capitalize",
          }}>{f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((a, i) => {
        const dot = priorityDot[a.priority] ?? "#e5e7eb";
        const border = priorityBorder[a.priority] ?? "#e5e7eb";
        const badge = priorityBg[a.priority] ?? { bg: "#f3f4f6", text: "#6b7280" };
        return (
          <div key={i} style={{
            background: "#fff",
            border: `1px solid ${border}`,
            borderLeft: `4px solid ${dot}`,
            borderRadius: 10,
            padding: "14px 18px",
          }}>
            {/* Action text + priority badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.5, flex: 1 }}>{a.action}</p>
              {a.priority && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: badge.bg, color: badge.text, flexShrink: 0, textTransform: "capitalize" }}>
                  {a.priority}
                </span>
              )}
            </div>
            {/* Owner / deadline */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {a.owner && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    <span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Owner</span>
                    {a.owner}
                  </span>
                </div>
              )}
              {a.deadline && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    <span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Deadline</span>
                    {a.deadline}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function MonitoringSection({ content }: { content: { metric: string; target: string; frequency: string }[] }) {
  const [filter, setFilter] = React.useState<string>("all");
  const items = filter === "all" ? content : content.filter((m) => m.frequency?.toLowerCase().includes(filter));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["all", "weekly", "monthly", "quarterly"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
            border: `1.5px solid ${filter === f ? "#111827" : "#e5e7eb"}`,
            background: filter === f ? "#111827" : "#fff",
            color: filter === f ? "#fff" : "#6b7280",
            cursor: "pointer", textTransform: "capitalize",
          }}>{f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((m, i) => (
        <div key={i} style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderLeft: "4px solid #6366f1",
          borderRadius: 10,
          padding: "14px 18px",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 10px" }}>{m.metric}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {m.target && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  <span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Target</span>
                  {m.target}
                </span>
              </div>
            )}
            {m.frequency && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  <span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Frequency</span>
                  {m.frequency}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}

function KillCriteriaSection({ content }: { content: { criterion: string; trigger: string; response: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {content.map((k, i) => (
        <div key={i} style={{
          background: "#fff",
          border: "1px solid #fecaca",
          borderLeft: "4px solid #ef4444",
          borderRadius: 10,
          padding: "14px 18px",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 10px" }}>{k.criterion}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#991b1b", background: "#fee2e2", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Trigger</span>
              <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{k.trigger}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#065f46", background: "#dcfce7", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Response</span>
              <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{k.response}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OKRsSection({ content }: { content: { objective: string; key_results: string[] }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {content.map((okr, i) => (
        <div key={i} style={{
          background: "#fff",
          border: "1px solid #bfdbfe",
          borderLeft: "4px solid #3b82f6",
          borderRadius: 10,
          padding: "14px 18px",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>{okr.objective}</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {(okr.key_results ?? []).map((kr, j) => (
              <li key={j} style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 2 }}>{kr}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StrategicBetsSection({ content }: { content: { bet: string; hypothesis: string; investment: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {content.map((b, i) => (
        <div key={i} style={{
          background: "#fff",
          border: "1px solid #fde68a",
          borderLeft: "4px solid #f59e0b",
          borderRadius: 10,
          padding: "14px 18px",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 10px" }}>{b.bet}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#92400e", background: "#fef3c7", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Hypothesis</span>
              <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{b.hypothesis}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1e40af", background: "#dbeafe", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Investment</span>
              <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{b.investment}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HundredDayPlanSection({ content }: { content: { milestone: string; timeline: string; owner: string; deliverable: string }[] }) {
  const timelineColor: Record<string, string> = {
    "30 days": "#059669",
    "60 days": "#d97706",
    "90 days": "#7c3aed",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {content.map((m, i) => {
        const color = timelineColor[m.timeline] ?? "#6b7280";
        return (
          <div key={i} style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderLeft: `4px solid ${color}`,
            borderRadius: 10,
            padding: "14px 18px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color, padding: "2px 8px", borderRadius: 4 }}>{m.timeline}</span>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>{m.milestone}</p>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {m.owner && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{m.owner}</span>
                </div>
              )}
              {m.deliverable && (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4b5563", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>Deliverable</span>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{m.deliverable}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
