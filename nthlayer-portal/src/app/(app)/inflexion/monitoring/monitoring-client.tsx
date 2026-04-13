"use client";

import { useState, useEffect } from "react";
import { MONITORING_STATUSES, statusKey, updateItemStatus, feedbackKey, saveItemFeedback, loadItemFeedback } from "@/lib/item-status";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"];

const STAGE_META: Record<string, { label: string; color: string; bg: string; dot: string; activeBorder: string }> = {
  frame:    { label: "Frame",    color: "#374151", bg: "#f3f4f6", dot: "#9ca3af", activeBorder: "#374151" },
  diagnose: { label: "Diagnose", color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6", activeBorder: "#1e40af" },
  decide:   { label: "Decide",   color: "#6d28d9", bg: "#ede9fe", dot: "#7c3aed", activeBorder: "#6d28d9" },
  position: { label: "Position", color: "#065f46", bg: "#d1fae5", dot: "#059669", activeBorder: "#065f46" },
  commit:   { label: "Commit",   color: "#92400e", bg: "#fef3c7", dot: "#d97706", activeBorder: "#92400e" },
};

export type OutputMonitor = {
  metric: string; target?: string; frequency?: string; stageId: string; outputId: string; createdAt?: string;
};

export default function MonitoringClient({ allItems, companyName, companyId, initialStatuses }: {
  allItems: OutputMonitor[];
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

  const filtered = activeStage ? allItems.filter((m) => m.stageId === activeStage) : allItems;
  const countByStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, allItems.filter((m) => m.stageId === s).length]));

  const indexMap = new Map<string, number>();
  const seenByOutput: Record<string, number> = {};
  for (const m of allItems) {
    const k = `${m.outputId}_monitoring`;
    if (seenByOutput[k] === undefined) seenByOutput[k] = 0;
    indexMap.set(`${m.outputId}_${m.metric}`, seenByOutput[k]++);
  }
  function getIndex(m: OutputMonitor) { return indexMap.get(`${m.outputId}_${m.metric}`) ?? 0; }

  async function handleStatusChange(m: OutputMonitor, idx: number, newStatus: string) {
    const key = statusKey(m.outputId, "monitoring", idx);
    setStatuses((prev) => ({ ...prev, [key]: newStatus }));
    await updateItemStatus({ outputId: m.outputId, companyId, itemType: "monitoring", itemIndex: idx, status: newStatus });
  }

  async function handleFeedback(m: OutputMonitor, idx: number, fb: "accepted" | "declined") {
    const key = feedbackKey(m.outputId, "monitoring", idx);
    const existing = feedbacks[key];
    const newFb = existing === fb ? undefined : fb;
    setFeedbacks((prev) => {
      const next = { ...prev };
      if (newFb) next[key] = newFb; else delete next[key];
      return next;
    });
    if (newFb) {
      await saveItemFeedback({ outputId: m.outputId, companyId, itemType: "monitor", itemIndex: idx, itemText: m.metric, workflowType: m.stageId, feedback: newFb });
    }
  }

  const acceptedCount = Object.values(feedbacks).filter((f) => f === "accepted").length;
  const declinedCount = Object.values(feedbacks).filter((f) => f === "declined").length;

  const stageSummary = STAGE_ORDER.map((s) => ({ stageId: s, count: filtered.filter((m) => m.stageId === s).length })).filter((s) => s.count > 0);
  const isMobile = useIsMobile();

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Metrics</h1>
          {allItems.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", borderRadius: 20, padding: "3px 10px" }}>
              {filtered.length}{filtered.length !== allItems.length ? ` of ${allItems.length}` : " total"}
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Metrics and signals to track across every strategy stage for {companyName}</p>
        <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 4, padding: "14px 18px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #10b981", background: "#d1fae5", color: "#065f46", fontSize: 13, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Accept</strong> — confirms this metric should be tracked as part of your strategy.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #ef4444", background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 700 }}>✗</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Reject</strong> — flags this metric as not relevant. It will be deprioritised in future analysis.</span>
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

      {/* Stage summary pills */}
      {stageSummary.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {stageSummary.map(({ stageId, count }) => {
            const meta = STAGE_META[stageId];
            return (
              <div key={stageId} style={{ display: "flex", alignItems: "center", gap: 6, background: meta.bg, borderRadius: 8, padding: "7px 14px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{count} from {meta.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ fontSize: 14, color: "#9ca3af", padding: "32px 0", textAlign: "center" }}>No monitoring items for this stage.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((m, i) => {
            const idx = getIndex(m);
            const statusK = statusKey(m.outputId, "monitoring", idx);
            const fbKey = feedbackKey(m.outputId, "monitoring", idx);
            const currentStatus = statuses[statusK] ?? "tracking";
            const currentFeedback = feedbacks[fbKey];
            const stage = STAGE_META[m.stageId] ?? { label: m.stageId, color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" };

            return (
              <div key={i} style={{ background: currentFeedback === "declined" ? "#fffbfb" : currentFeedback === "accepted" ? "#f0fdf4" : "#fff", border: "1px solid", borderColor: currentFeedback === "declined" ? "#fecaca" : currentFeedback === "accepted" ? "#bbf7d0" : "#e5e7eb", borderLeft: `4px solid ${currentFeedback === "declined" ? "#ef4444" : currentFeedback === "accepted" ? "#10b981" : stage.dot}`, borderRadius: 10, padding: "16px 20px", transition: "all 0.15s" }}>
                {/* Metric + stage badge + feedback */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: (m.target || m.frequency) ? 10 : 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.5, flex: 1 }}>{m.metric}</p>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <button
                      onClick={() => handleFeedback(m, idx, "accepted")}
                      title="This metric is the right one to track"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "accepted" ? "#10b981" : "#e5e7eb"}`, background: currentFeedback === "accepted" ? "#d1fae5" : "#fff", color: currentFeedback === "accepted" ? "#065f46" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✓</button>
                    <button
                      onClick={() => handleFeedback(m, idx, "declined")}
                      title="This metric is not relevant / wrong"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "declined" ? "#ef4444" : "#e5e7eb"}`, background: currentFeedback === "declined" ? "#fee2e2" : "#fff", color: currentFeedback === "declined" ? "#991b1b" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✗</button>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: stage.bg, color: stage.color, flexShrink: 0 }}>{stage.label}</span>
                  </div>
                </div>

                {/* Target / frequency */}
                {(m.target || m.frequency) && (
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
                    {m.target && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        <span style={{ fontSize: 12, color: "#6b7280" }}><span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Target</span>{m.target}</span>
                      </div>
                    )}
                    {m.frequency && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        <span style={{ fontSize: 12, color: "#6b7280" }}><span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Frequency</span>{m.frequency}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer: status buttons + citation */}
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 8 : 12 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {MONITORING_STATUSES.map((s) => (
                      <button key={s.value} onClick={() => handleStatusChange(m, idx, s.value)} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1.5px solid", borderColor: currentStatus === s.value ? s.color : "#e5e7eb", background: currentStatus === s.value ? s.bg : "#fff", color: currentStatus === s.value ? s.color : "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>
                        {currentStatus === s.value && <span style={{ marginRight: 4 }}>●</span>}
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {m.createdAt && (
                      <span style={{ fontSize: 10, color: "#d1d5db" }}>
                        {(() => {
                          const days = Math.floor((Date.now() - new Date(m.createdAt).getTime()) / (1000*60*60*24));
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
