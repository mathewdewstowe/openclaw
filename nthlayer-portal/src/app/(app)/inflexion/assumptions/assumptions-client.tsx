"use client";

import { useState, useEffect } from "react";
import { ASSUMPTION_STATUSES, statusKey, updateItemStatus, feedbackKey, saveItemFeedback, loadItemFeedback } from "@/lib/item-status";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"];

const STAGE_META: Record<string, { label: string; color: string; bg: string; dot: string; activeBorder: string }> = {
  frame:    { label: "Frame",    color: "#374151", bg: "#f3f4f6", dot: "#9ca3af", activeBorder: "#374151" },
  diagnose: { label: "Diagnose", color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6", activeBorder: "#1e40af" },
  decide:   { label: "Decide",   color: "#6d28d9", bg: "#ede9fe", dot: "#7c3aed", activeBorder: "#6d28d9" },
  position: { label: "Position", color: "#065f46", bg: "#d1fae5", dot: "#059669", activeBorder: "#065f46" },
  commit:   { label: "Commit",   color: "#92400e", bg: "#fef3c7", dot: "#d97706", activeBorder: "#92400e" },
};

export type OutputAssumption = { assumption: string; stageId: string; outputId: string; createdAt?: string };

export default function AssumptionsClient({ allAssumptions, companyName, companyId, initialStatuses }: {
  allAssumptions: OutputAssumption[];
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

  const filtered = activeStage ? allAssumptions.filter((a) => a.stageId === activeStage) : allAssumptions;
  const countByStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, allAssumptions.filter((a) => a.stageId === s).length]));

  const assumptionIndexMap = new Map<string, number>();
  const seenByOutput: Record<string, number> = {};
  for (const a of allAssumptions) {
    const k = `${a.outputId}_assumption`;
    if (seenByOutput[k] === undefined) seenByOutput[k] = 0;
    assumptionIndexMap.set(`${a.outputId}_${a.assumption}`, seenByOutput[k]++);
  }
  function getIndex(a: OutputAssumption) { return assumptionIndexMap.get(`${a.outputId}_${a.assumption}`) ?? 0; }

  async function handleStatusChange(a: OutputAssumption, idx: number, newStatus: string) {
    const key = statusKey(a.outputId, "assumption", idx);
    setStatuses((prev) => ({ ...prev, [key]: newStatus }));
    await updateItemStatus({ outputId: a.outputId, companyId, itemType: "assumption", itemIndex: idx, status: newStatus });
  }

  async function handleFeedback(a: OutputAssumption, idx: number, fb: "accepted" | "declined") {
    const key = feedbackKey(a.outputId, "assumption", idx);
    const existing = feedbacks[key];
    const newFb = existing === fb ? undefined : fb;
    setFeedbacks((prev) => {
      const next = { ...prev };
      if (newFb) next[key] = newFb; else delete next[key];
      return next;
    });
    if (newFb) {
      await saveItemFeedback({ outputId: a.outputId, companyId, itemType: "assumption", itemIndex: idx, itemText: a.assumption, workflowType: a.stageId, feedback: newFb });
    }
  }

  const acceptedCount = Object.values(feedbacks).filter((f) => f === "accepted").length;
  const declinedCount = Object.values(feedbacks).filter((f) => f === "declined").length;

  const stageSummary = STAGE_ORDER.map((s) => ({ stageId: s, count: filtered.filter((a) => a.stageId === s).length })).filter((s) => s.count > 0);
  const isMobile = useIsMobile();

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Assumptions</h1>
          {allAssumptions.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", borderRadius: 20, padding: "3px 10px" }}>
              {filtered.length}{filtered.length !== allAssumptions.length ? ` of ${allAssumptions.length}` : " total"}
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Key assumptions underlying the strategy for {companyName}</p>
        {/* Accept/Reject explanation */}
        <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 4, padding: "14px 18px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #10b981", background: "#d1fae5", color: "#065f46", fontSize: 13, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Accept</strong> — confirms this assumption is valid. It will be included in downstream analysis.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #ef4444", background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 700 }}>✗</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Reject</strong> — flags this assumption as incorrect or irrelevant. It will be deprioritised in future analysis.</span>
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
        <div style={{ fontSize: 14, color: "#9ca3af", padding: "32px 0", textAlign: "center" }}>No assumptions for this stage.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((a, i) => {
            const idx = getIndex(a);
            const statusK = statusKey(a.outputId, "assumption", idx);
            const fbKey = feedbackKey(a.outputId, "assumption", idx);
            const currentStatus = statuses[statusK] ?? "unvalidated";
            const currentFeedback = feedbacks[fbKey];
            const stage = STAGE_META[a.stageId] ?? { label: a.stageId, color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" };

            return (
              <div key={i} style={{ background: currentFeedback === "declined" ? "#fffbfb" : currentFeedback === "accepted" ? "#f0fdf4" : "#fff", border: "1px solid", borderColor: currentFeedback === "declined" ? "#fecaca" : currentFeedback === "accepted" ? "#bbf7d0" : "#e5e7eb", borderLeft: `4px solid ${currentFeedback === "declined" ? "#ef4444" : currentFeedback === "accepted" ? "#10b981" : stage.dot}`, borderRadius: 10, padding: "16px 20px", transition: "all 0.15s" }}>
                {/* Assumption text + stage badge + feedback */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0, lineHeight: 1.6 }}>{a.assumption}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <button
                      onClick={() => handleFeedback(a, idx, "accepted")}
                      title="This assumption is valid / correct"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "accepted" ? "#10b981" : "#e5e7eb"}`, background: currentFeedback === "accepted" ? "#d1fae5" : "#fff", color: currentFeedback === "accepted" ? "#065f46" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✓</button>
                    <button
                      onClick={() => handleFeedback(a, idx, "declined")}
                      title="This assumption is wrong / not relevant"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "declined" ? "#ef4444" : "#e5e7eb"}`, background: currentFeedback === "declined" ? "#fee2e2" : "#fff", color: currentFeedback === "declined" ? "#991b1b" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✗</button>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: stage.bg, color: stage.color, flexShrink: 0 }}>{stage.label}</span>
                  </div>
                </div>

                {/* Footer: status buttons + citation */}
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 8 : 12 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ASSUMPTION_STATUSES.map((s) => (
                      <button key={s.value} onClick={() => handleStatusChange(a, idx, s.value)} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1.5px solid", borderColor: currentStatus === s.value ? s.color : "#e5e7eb", background: currentStatus === s.value ? s.bg : "#fff", color: currentStatus === s.value ? s.color : "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>
                        {currentStatus === s.value && <span style={{ marginRight: 4 }}>●</span>}
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {a.createdAt && (
                      <span style={{ fontSize: 10, color: "#d1d5db" }}>
                        {(() => {
                          const days = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / (1000*60*60*24));
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
