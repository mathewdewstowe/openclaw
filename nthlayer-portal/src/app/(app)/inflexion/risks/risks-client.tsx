"use client";

import { useState, useEffect } from "react";
import { RISK_STATUSES, statusKey, updateItemStatus, feedbackKey, saveItemFeedback, loadItemFeedback } from "@/lib/item-status";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"];

const STAGE_META: Record<string, { label: string; color: string; bg: string; activeBorder: string }> = {
  frame:    { label: "Frame",    color: "#374151", bg: "#f3f4f6", activeBorder: "#374151" },
  diagnose: { label: "Diagnose", color: "#1e40af", bg: "#dbeafe", activeBorder: "#1e40af" },
  decide:   { label: "Decide",   color: "#6d28d9", bg: "#ede9fe", activeBorder: "#6d28d9" },
  position: { label: "Position", color: "#065f46", bg: "#d1fae5", activeBorder: "#065f46" },
  commit:   { label: "Commit",   color: "#92400e", bg: "#fef3c7", activeBorder: "#92400e" },
};

const SEVERITY_META: Record<string, { color: string; bg: string; dot: string; order: number }> = {
  Critical: { color: "#7f1d1d", bg: "#fef2f2", dot: "#dc2626", order: 0 },
  High:     { color: "#991b1b", bg: "#fee2e2", dot: "#ef4444", order: 1 },
  Medium:   { color: "#92400e", bg: "#fef3c7", dot: "#f59e0b", order: 2 },
  Low:      { color: "#065f46", bg: "#d1fae5", dot: "#10b981", order: 3 },
};

export type OutputRisk = {
  risk: string; severity?: string; mitigation?: string; stageId: string; outputId: string; createdAt?: string;
};

export default function RisksClient({ allRisks, companyName, companyId, initialStatuses }: {
  allRisks: OutputRisk[];
  companyName: string;
  companyId: string;
  initialStatuses: Record<string, string>;
}) {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>(initialStatuses);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  useEffect(() => {
    loadItemFeedback(companyId).then(setFeedbacks);
  }, [companyId]);

  const filtered = activeStage ? allRisks.filter((r) => r.stageId === activeStage) : allRisks;
  const countByStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, allRisks.filter((r) => r.stageId === s).length]));
  const counts = Object.entries(SEVERITY_META).map(([sev, meta]) => ({ sev, meta, count: filtered.filter((r) => r.severity === sev).length })).filter((c) => c.count > 0);

  const riskIndexMap = new Map<string, number>();
  const seenByOutput: Record<string, number> = {};
  for (const r of allRisks) {
    const key = `${r.outputId}_risk`;
    if (seenByOutput[key] === undefined) seenByOutput[key] = 0;
    riskIndexMap.set(`${r.outputId}_${r.risk}`, seenByOutput[key]++);
  }
  function getIndex(r: OutputRisk) { return riskIndexMap.get(`${r.outputId}_${r.risk}`) ?? 0; }

  async function handleStatusChange(r: OutputRisk, idx: number, newStatus: string) {
    const key = statusKey(r.outputId, "risk", idx);
    setStatuses((prev) => ({ ...prev, [key]: newStatus }));
    await updateItemStatus({ outputId: r.outputId, companyId, itemType: "risk", itemIndex: idx, status: newStatus });
  }

  async function handleFeedback(r: OutputRisk, idx: number, fb: "accepted" | "declined") {
    const key = feedbackKey(r.outputId, "risk", idx);
    const existing = feedbacks[key];
    // toggle off if same
    const newFb = existing === fb ? undefined : fb;
    setFeedbacks((prev) => {
      const next = { ...prev };
      if (newFb) next[key] = newFb; else delete next[key];
      return next;
    });
    if (newFb) {
      await saveItemFeedback({ outputId: r.outputId, companyId, itemType: "risk", itemIndex: idx, itemText: r.risk, workflowType: r.stageId, feedback: newFb });
    }
  }

  const acceptedCount = Object.values(feedbacks).filter((f) => f === "accepted").length;
  const declinedCount = Object.values(feedbacks).filter((f) => f === "declined").length;
  const isMobile = useIsMobile();

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Risks</h1>
          {allRisks.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", borderRadius: 20, padding: "3px 10px" }}>
              {filtered.length}{filtered.length !== allRisks.length ? ` of ${allRisks.length}` : " total"}
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>All risks identified across every strategy stage for {companyName}</p>
        <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 4, padding: "14px 18px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #10b981", background: "#d1fae5", color: "#065f46", fontSize: 13, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Accept</strong> — confirms this is a real risk to monitor and mitigate.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #ef4444", background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 700 }}>✗</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Reject</strong> — flags this risk as not applicable. It will be deprioritised in future analysis.</span>
          </div>
        </div>
        {(acceptedCount > 0 || declinedCount > 0) && (
          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            {acceptedCount > 0 && <span style={{ fontSize: 12, color: "#065f46", background: "#d1fae5", borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>✓ {acceptedCount} accepted</span>}
            {declinedCount > 0 && <span style={{ fontSize: 12, color: "#991b1b", background: "#fee2e2", borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>✗ {declinedCount} declined</span>}
          </div>
        )}
      </div>

      {/* Stage filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: isMobile ? undefined : "wrap", overflowX: isMobile ? "auto" : undefined, paddingBottom: isMobile ? 4 : undefined }}>
        <button onClick={() => setActiveStage(null)} style={{ fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 20, border: "1.5px solid", borderColor: activeStage === null ? "#111827" : "#e5e7eb", background: activeStage === null ? "#111827" : "#fff", color: activeStage === null ? "#fff" : "#6b7280", cursor: "pointer" }}>All stages</button>
        {STAGE_ORDER.map((stageId) => {
          const meta = STAGE_META[stageId];
          const isActive = activeStage === stageId;
          const hasData = countByStage[stageId] > 0;
          return (
            <button key={stageId} onClick={() => hasData ? setActiveStage(isActive ? null : stageId) : undefined} style={{ fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 20, border: "1.5px solid", borderColor: isActive ? meta.activeBorder : "#e5e7eb", background: isActive ? meta.bg : "#fff", color: isActive ? meta.color : hasData ? "#374151" : "#d1d5db", cursor: hasData ? "pointer" : "default", opacity: hasData ? 1 : 0.6 }}>
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Severity pills */}
      {counts.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {counts.map(({ sev, meta, count }) => (
            <div key={sev} style={{ display: "flex", alignItems: "center", gap: 6, background: meta.bg, borderRadius: 8, padding: "7px 14px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{count} {sev}</span>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ fontSize: 14, color: "#9ca3af", padding: "32px 0", textAlign: "center" }}>No risks for this stage.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r, i) => {
            const idx = getIndex(r);
            const statusK = statusKey(r.outputId, "risk", idx);
            const fbKey = feedbackKey(r.outputId, "risk", idx);
            const currentStatus = statuses[statusK] ?? "open";
            const currentFeedback = feedbacks[fbKey];
            const stage = STAGE_META[r.stageId] ?? { label: r.stageId, color: "#6b7280", bg: "#f3f4f6" };
            const severity = SEVERITY_META[r.severity ?? ""];

            return (
              <div key={i} style={{ background: currentFeedback === "declined" ? "#fffbfb" : currentFeedback === "accepted" ? "#f0fdf4" : "#fff", border: "1px solid", borderColor: currentFeedback === "declined" ? "#fecaca" : currentFeedback === "accepted" ? "#bbf7d0" : severity ? severity.bg : "#e5e7eb", borderLeft: `4px solid ${currentFeedback === "declined" ? "#ef4444" : currentFeedback === "accepted" ? "#10b981" : severity?.dot ?? "#e5e7eb"}`, borderRadius: 10, padding: "16px 20px", transition: "all 0.15s" }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <p style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.5, flex: 1 }}>{r.risk}</p>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {/* Feedback buttons */}
                    <button
                      onClick={() => handleFeedback(r, idx, "accepted")}
                      title="This risk is accurate / relevant"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "accepted" ? "#10b981" : "#e5e7eb"}`, background: currentFeedback === "accepted" ? "#d1fae5" : "#fff", color: currentFeedback === "accepted" ? "#065f46" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✓</button>
                    <button
                      onClick={() => handleFeedback(r, idx, "declined")}
                      title="This risk is not relevant / inaccurate"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "declined" ? "#ef4444" : "#e5e7eb"}`, background: currentFeedback === "declined" ? "#fee2e2" : "#fff", color: currentFeedback === "declined" ? "#991b1b" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✗</button>
                    {severity && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: severity.bg, color: severity.color }}>{r.severity}</span>}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: stage.bg, color: stage.color }}>{stage.label}</span>
                  </div>
                </div>

                {/* Mitigation */}
                {r.mitigation && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                    </svg>
                    <p style={{ fontSize: 13, color: "#4b5563", margin: 0, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 600, color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 6 }}>Mitigation:</span>
                      {r.mitigation}
                    </p>
                  </div>
                )}

                {/* Footer: status + citation */}
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 8 : 12, marginTop: 4 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {RISK_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleStatusChange(r, idx, s.value)}
                        style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1.5px solid", borderColor: currentStatus === s.value ? s.color : "#e5e7eb", background: currentStatus === s.value ? s.bg : "#fff", color: currentStatus === s.value ? s.color : "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {currentStatus === s.value && <span style={{ marginRight: 4 }}>●</span>}
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {r.createdAt && (
                      <span style={{ fontSize: 10, color: "#d1d5db" }}>
                        {(() => {
                          const days = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (1000*60*60*24));
                          if (days === 0) return "Today";
                          if (days === 1) return "Yesterday";
                          if (days < 30) return `${days}d ago`;
                          if (days < 365) return `${Math.floor(days/30)}mo ago`;
                          return `${Math.floor(days/365)}y ago`;
                        })()}
                      </span>
                    )}
                    <a href="/inflexion/strategy" style={{ fontSize: 11, color: "#9ca3af", textDecoration: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                      {stage.label} Report
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16 }}>Sourced from the most recent completed report for each stage. Use ✓/✗ to rate accuracy — this helps improve future analysis.</p>
    </>
  );
}
