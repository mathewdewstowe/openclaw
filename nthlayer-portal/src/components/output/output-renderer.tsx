"use client";

import React from "react";
import { SECTION_ORDER, SECTION_LABELS } from "@/lib/types/output";
import { FreshnessBadge } from "@/components/freshness-badge";

interface OutputData {
  id: string;
  title: string;
  workflowType: string;
  outputType: string;
  sections: Record<string, unknown>;
  confidence: number | null;
  sources: string[];
  companyName: string;
  createdAt: string;
  version: number;
}

export function OutputRenderer({
  output,
  visibleSections,
}: {
  output: OutputData;
  visibleSections: number;
}) {
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#6b7280",
            background: "#f3f4f6",
            padding: "2px 8px",
            borderRadius: 999,
          }}>
            {output.workflowType.replace(/_/g, " ")}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>&middot;</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{output.companyName}</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{output.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            {output.outputType.replace(/_/g, " ")} &middot; v{output.version} &middot; {new Date(output.createdAt).toLocaleDateString("en-GB")}
          </p>
          <FreshnessBadge createdAt={output.createdAt} />
        </div>
      </div>

      {/* Sections */}
      {SECTION_ORDER.map((sectionKey, index) => {
        const isVisible = index < visibleSections;
        const content = output.sections[sectionKey];
        const label = SECTION_LABELS[sectionKey];

        if (!isVisible) {
          return (
            <div key={sectionKey} style={{ position: "relative", marginBottom: 24 }}>
              <div style={{
                padding: "20px 24px",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                filter: "blur(4px)",
                userSelect: "none",
                pointerEvents: "none",
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{label}</h2>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
                  This section contains strategic analysis and recommendations that require a plan upgrade to view. Upgrade to see the full output including evidence base, assumptions, confidence scoring, risks, actions, and monitoring plan.
                </p>
              </div>
              {/* Lock overlay */}
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
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#9ca3af" style={{ marginBottom: 8 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Upgrade to view</p>
              </div>
            </div>
          );
        }

        return (
          <div key={sectionKey} style={{ marginBottom: 24 }}>
            <div style={{
              padding: "20px 24px",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12 }}>{label}</h2>
              <SectionContent sectionKey={sectionKey} content={content} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section renderers ───────────────────────────────────────

function SectionContent({ sectionKey, content }: { sectionKey: string; content: unknown }) {
  if (!content) {
    return <p style={{ fontSize: 14, color: "#9ca3af", fontStyle: "italic" }}>No data available</p>;
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
      return <ListSection items={content as string[]} />;

    case "confidence":
      return <ConfidenceSection content={content as { score: number; rationale: string }} />;

    case "risks":
      return <RisksSection content={content as { risk: string; severity: string; mitigation: string }[]} />;

    case "actions":
      return <ActionsSection content={content as { action: string; owner: string; deadline: string; priority: string }[]} />;

    case "monitoring":
      return <MonitoringSection content={content as { metric: string; target: string; frequency: string }[]} />;

    default:
      return <TextSection content={String(content)} />;
  }
}

function renderMarkdown(text: string): React.ReactNode[] {
  // Split into paragraphs on blank lines
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pi) => {
    // Within each paragraph, parse **bold** inline
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
    <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
      {renderMarkdown(content)}
    </div>
  );
}

function ListSection({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 4 }}>{item}</li>
      ))}
    </ul>
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
          <p style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Sources</p>
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
  const bg = pct >= 70 ? "#dcfce7" : pct >= 40 ? "#fef3c7" : "#fee2e2";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          fontFamily: "var(--font-mono, monospace)",
        }}>
          {pct}%
        </div>
        <div style={{
          flex: 1,
          height: 8,
          background: "#f3f4f6",
          borderRadius: 4,
          overflow: "hidden",
        }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
        </div>
      </div>
      <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{content.rationale}</p>
    </div>
  );
}

function RisksSection({ content }: { content: { risk: string; severity: string; mitigation: string }[] }) {
  const severityColor: Record<string, { bg: string; text: string }> = {
    high: { bg: "#fee2e2", text: "#991b1b" },
    medium: { bg: "#fef3c7", text: "#92400e" },
    low: { bg: "#dcfce7", text: "#166534" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {content.map((r, i) => {
        const colors = severityColor[r.severity] ?? severityColor.medium;
        return (
          <div key={i} style={{ padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 4,
                background: colors.bg,
                color: colors.text,
              }}>
                {r.severity}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{r.risk}</span>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 500, color: "#4b5563" }}>Mitigation:</span> {r.mitigation}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ActionsSection({ content }: { content: { action: string; owner: string; deadline: string; priority: string }[] }) {
  const priorityColor: Record<string, { bg: string; text: string }> = {
    critical: { bg: "#fee2e2", text: "#991b1b" },
    high: { bg: "#fef3c7", text: "#92400e" },
    medium: { bg: "#dbeafe", text: "#1e40af" },
    low: { bg: "#f3f4f6", text: "#6b7280" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {content.map((a, i) => {
        const colors = priorityColor[a.priority] ?? priorityColor.medium;
        return (
          <div key={i} style={{ padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 4,
                background: colors.bg,
                color: colors.text,
              }}>
                {a.priority}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{a.action}</span>
            </div>
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              {a.owner} &middot; {a.deadline}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MonitoringSection({ content }: { content: { metric: string; target: string; frequency: string }[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Metric</th>
          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target</th>
          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Frequency</th>
        </tr>
      </thead>
      <tbody>
        {content.map((m, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ padding: "10px 12px", color: "#111827", fontWeight: 500 }}>{m.metric}</td>
            <td style={{ padding: "10px 12px", color: "#4b5563" }}>{m.target}</td>
            <td style={{ padding: "10px 12px", color: "#6b7280" }}>{m.frequency}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
