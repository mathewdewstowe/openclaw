"use client";

import { useState, useEffect } from "react";
import { ACTION_STATUSES, statusKey, updateItemStatus, feedbackKey, saveItemFeedback, loadItemFeedback } from "@/lib/item-status";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

const STAGE_ORDER = ["frame", "diagnose", "decide", "position", "commit"];

const STAGE_META: Record<string, { label: string; color: string; bg: string; activeBorder: string }> = {
  frame:    { label: "Frame",    color: "#374151", bg: "#f3f4f6", activeBorder: "#374151" },
  diagnose: { label: "Diagnose", color: "#1e40af", bg: "#dbeafe", activeBorder: "#1e40af" },
  decide:   { label: "Decide",   color: "#6d28d9", bg: "#ede9fe", activeBorder: "#6d28d9" },
  position: { label: "Position", color: "#065f46", bg: "#d1fae5", activeBorder: "#065f46" },
  commit:   { label: "Commit",   color: "#92400e", bg: "#fef3c7", activeBorder: "#92400e" },
};

const PRIORITY_META: Record<string, { color: string; bg: string; dot: string; order: number }> = {
  High:   { color: "#991b1b", bg: "#fee2e2", dot: "#ef4444", order: 0 },
  Medium: { color: "#92400e", bg: "#fef3c7", dot: "#f59e0b", order: 1 },
  Low:    { color: "#065f46", bg: "#d1fae5", dot: "#10b981", order: 2 },
};

export type OutputAction = {
  action: string; owner?: string; deadline?: string; priority?: string; stageId: string; outputId: string; createdAt?: string;
};

export default function ActionsClient({ allActions, companyName, companyId, initialStatuses }: {
  allActions: OutputAction[];
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

  const filtered = activeStage ? allActions.filter((a) => a.stageId === activeStage) : allActions;
  const countByStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, allActions.filter((a) => a.stageId === s).length]));
  const counts = Object.entries(PRIORITY_META).map(([pri, meta]) => ({ pri, meta, count: filtered.filter((a) => a.priority === pri).length })).filter((c) => c.count > 0);

  const actionIndexMap = new Map<string, number>();
  const seenByOutput: Record<string, number> = {};
  for (const a of allActions) {
    const k = `${a.outputId}_action`;
    if (seenByOutput[k] === undefined) seenByOutput[k] = 0;
    actionIndexMap.set(`${a.outputId}_${a.action}`, seenByOutput[k]++);
  }
  function getIndex(a: OutputAction) { return actionIndexMap.get(`${a.outputId}_${a.action}`) ?? 0; }

  async function handleStatusChange(a: OutputAction, idx: number, newStatus: string) {
    const key = statusKey(a.outputId, "action", idx);
    setStatuses((prev) => ({ ...prev, [key]: newStatus }));
    await updateItemStatus({ outputId: a.outputId, companyId, itemType: "action", itemIndex: idx, status: newStatus });
  }

  async function handleFeedback(a: OutputAction, idx: number, fb: "accepted" | "declined") {
    const key = feedbackKey(a.outputId, "action", idx);
    const existing = feedbacks[key];
    const newFb = existing === fb ? undefined : fb;
    setFeedbacks((prev) => {
      const next = { ...prev };
      if (newFb) next[key] = newFb; else delete next[key];
      return next;
    });
    if (newFb) {
      await saveItemFeedback({ outputId: a.outputId, companyId, itemType: "action", itemIndex: idx, itemText: a.action, workflowType: a.stageId, feedback: newFb });
    }
  }

  const acceptedCount = Object.values(feedbacks).filter((f) => f === "accepted").length;
  const declinedCount = Object.values(feedbacks).filter((f) => f === "declined").length;
  const isMobile = useIsMobile();

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Actions</h1>
          {allActions.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", borderRadius: 20, padding: "3px 10px" }}>
              {filtered.length}{filtered.length !== allActions.length ? ` of ${allActions.length}` : " total"}
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>All priority actions across every strategy stage for {companyName}</p>
        <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 4, padding: "14px 18px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #10b981", background: "#d1fae5", color: "#065f46", fontSize: 13, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Accept</strong> — confirms this action is relevant and should be pursued.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1.5px solid #ef4444", background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 700 }}>✗</span>
            <span style={{ fontSize: 12, color: "#374151" }}><strong>Reject</strong> — flags this action as off-target. It will be deprioritised in future analysis.</span>
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

      {/* Priority pills */}
      {counts.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {counts.map(({ pri, meta, count }) => (
            <div key={pri} style={{ display: "flex", alignItems: "center", gap: 6, background: meta.bg, borderRadius: 8, padding: "7px 14px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{count} {pri}</span>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ fontSize: 14, color: "#9ca3af", padding: "32px 0", textAlign: "center" }}>No actions for this stage.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((a, i) => {
            const idx = getIndex(a);
            const statusK = statusKey(a.outputId, "action", idx);
            const fbKey = feedbackKey(a.outputId, "action", idx);
            const currentStatus = statuses[statusK] ?? "not_started";
            const currentFeedback = feedbacks[fbKey];
            const stage = STAGE_META[a.stageId] ?? { label: a.stageId, color: "#6b7280", bg: "#f3f4f6" };
            const priority = PRIORITY_META[a.priority ?? ""];

            return (
              <div key={i} style={{ background: currentFeedback === "declined" ? "#fffbfb" : currentFeedback === "accepted" ? "#f0fdf4" : "#fff", border: "1px solid", borderColor: currentFeedback === "declined" ? "#fecaca" : currentFeedback === "accepted" ? "#bbf7d0" : priority ? priority.bg : "#e5e7eb", borderLeft: `4px solid ${currentFeedback === "declined" ? "#ef4444" : currentFeedback === "accepted" ? "#10b981" : priority?.dot ?? "#e5e7eb"}`, borderRadius: 10, padding: "16px 20px", transition: "all 0.15s" }}>
                {/* Title + badges */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: (a.owner || a.deadline) ? 10 : 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.5, flex: 1 }}>{a.action}</p>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {/* Feedback buttons */}
                    <button
                      onClick={() => handleFeedback(a, idx, "accepted")}
                      title="This action is relevant / well-targeted"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "accepted" ? "#10b981" : "#e5e7eb"}`, background: currentFeedback === "accepted" ? "#d1fae5" : "#fff", color: currentFeedback === "accepted" ? "#065f46" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✓</button>
                    <button
                      onClick={() => handleFeedback(a, idx, "declined")}
                      title="This action is not relevant / off target"
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1.5px solid ${currentFeedback === "declined" ? "#ef4444" : "#e5e7eb"}`, background: currentFeedback === "declined" ? "#fee2e2" : "#fff", color: currentFeedback === "declined" ? "#991b1b" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                    >✗</button>
                    {priority && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: priority.bg, color: priority.color }}>{a.priority}</span>}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: stage.bg, color: stage.color }}>{stage.label}</span>
                  </div>
                </div>

                {/* Owner / deadline */}
                {(a.owner || a.deadline) && (
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
                    {a.owner && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                        <span style={{ fontSize: 12, color: "#6b7280" }}><span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Owner</span>{a.owner}</span>
                      </div>
                    )}
                    {a.deadline && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                        <span style={{ fontSize: 12, color: "#6b7280" }}><span style={{ fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, marginRight: 4 }}>Deadline</span>{a.deadline}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer: status buttons + citation */}
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 8 : 12 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ACTION_STATUSES.map((s) => (
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
