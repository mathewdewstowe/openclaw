"use client";

import { useCompany } from "@/lib/contexts/company";
import { useEntitlements } from "@/lib/contexts/entitlements";
import type { WorkflowType } from "@/lib/types/output";
import { WORKFLOW_META } from "@/lib/types/output";
import { useState, useEffect, useCallback } from "react";
import { PaywallGate } from "@/components/paywall-gate";

// ─── Context fields per workflow ──────────────────────────────

interface ContextField {
  key: string;
  label: string;
  hint?: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
}

const WORKFLOW_CONTEXT_FIELDS: Partial<Record<WorkflowType, ContextField[]>> = {
  diagnose: [
    { key: "inflection_point", label: "What's forcing a strategic decision right now?", type: "textarea", placeholder: "Moving from PLG to enterprise sales after Series B\nAI-native competitors entering our category\nScaling from founder-led to process-led GTM" },
    { key: "revenue_range", label: "Revenue range", type: "select", options: ["Pre-revenue", "Under £500k", "£500k–£2m", "£2m–£10m", "£10m+"] },
    { key: "growth_rate", label: "Growth rate (YoY)", type: "select", options: ["Declining", "Flat", "0–25%", "25–100%", "100%+"] },
    { key: "team_size", label: "Team size", type: "select", options: ["1–5", "6–15", "16–50", "51–150", "150+"] },
    { key: "recent_change", label: "Biggest thing that changed in the last 6 months", type: "textarea", placeholder: "Lost our biggest client, hired a new CRO, raised a round..." },
    { key: "recent_win", label: "Biggest recent win", type: "text", placeholder: "Closed a £200k enterprise contract" },
    { key: "recent_loss", label: "Biggest recent loss or setback", type: "text", placeholder: "Product launch missed targets, key hire left" },
  ],
  decide: [
    { key: "big_bet_1", label: "Strategic bet 1", type: "text", placeholder: "Enter market X, acquire company Y, build vs buy..." },
    { key: "big_bet_2", label: "Strategic bet 2", type: "text", placeholder: "Optional second bet you're weighing" },
    { key: "big_bet_3", label: "Strategic bet 3", type: "text", placeholder: "Optional third bet" },
    { key: "budget", label: "Budget available", type: "select", options: ["Under £50k", "£50k–£200k", "£200k–£1m", "£1m+", "Unallocated"] },
    { key: "time_horizon", label: "Time horizon", type: "select", options: ["6 months", "12 months", "18 months", "24 months"] },
    { key: "decisions_in_play", label: "Decisions actively being weighed right now", type: "textarea", placeholder: "Build vs buy CRM, hire AE vs agency, expand to US or not..." },
    { key: "ruled_out", label: "What have you already ruled out and why?", type: "textarea", placeholder: "We ruled out raising again — burn rate is manageable" },
    { key: "board_constraints", label: "Board or investor constraints", type: "textarea", placeholder: "Board mandated breakeven by Q3, investor wants 3x ARR growth" },
  ],
  position: [
    { key: "pricing_model", label: "Current pricing model", type: "select", options: ["Per seat", "Usage-based", "Retainer", "Project-based", "Freemium", "Hybrid"] },
    { key: "avg_deal_size", label: "Average deal size / ACV", type: "text", placeholder: "£18k ACV, £45k average project" },
    { key: "why_win", label: "Top reasons you win deals", type: "textarea", placeholder: "Speed of deployment, founder relationships, price..." },
    { key: "why_lose", label: "Top reasons you lose deals", type: "textarea", placeholder: "Lose to incumbents on brand, lose on price at SMB..." },
    { key: "customer_language", label: "How do customers describe you?", type: "textarea", placeholder: "Verbatim if possible — 'the people who actually get operators'" },
  ],
  act: [
    { key: "execution_owner", label: "Who owns execution?", type: "text", placeholder: "Name and role of the person driving this" },
    { key: "team_capacity", label: "Team capacity for new strategic work", type: "select", options: ["Under 10%", "~25%", "~50%", "Over 50%"] },
    { key: "in_flight", label: "What's already in flight that can't move?", type: "textarea", placeholder: "Product roadmap locked until Q2, sales team on existing quota..." },
    { key: "existing_okrs", label: "Existing OKRs or commitments", type: "textarea", placeholder: "Board committed to 40% ARR growth this year" },
    { key: "biggest_blocker", label: "Single biggest blocker to executing the strategy", type: "text", placeholder: "No engineering capacity, founder is the bottleneck..." },
  ],
};

interface OutputSummary {
  id: string;
  outputType: string;
  title: string;
  createdAt: string;
  confidence: number | null;
  executiveSummary: string | null;
  confidenceRationale: string | null;
}

interface JobSummary {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
}

interface DiagnoseOutputProp {
  id: string;
  title: string;
  companyName: string;
  sections: Record<string, unknown>;
}

export function WorkflowHub({
  workflow,
  outputs: initialOutputs,
  activeJobs: initialActiveJobs,
  diagnoseOutput,
}: {
  workflow: WorkflowType;
  outputs: OutputSummary[];
  activeJobs: JobSummary[];
  diagnoseOutput?: DiagnoseOutputProp | null;
}) {
  const meta = WORKFLOW_META[workflow];
  const { activeCompany } = useCompany();
  const { entitlements } = useEntitlements();
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<JobSummary[]>(initialActiveJobs);
  const [outputs, setOutputs] = useState<OutputSummary[]>(initialOutputs);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [context, setContext] = useState<Record<string, string>>({});

  const entitlementKey = `access_${workflow === "competitor_intel" ? "competitor" : workflow}` as keyof typeof entitlements;
  const hasAccess = !!entitlements[entitlementKey];
  const contextFields = WORKFLOW_CONTEXT_FIELDS[workflow] ?? [];
  const contextKey = activeCompany ? `workflow_context_${activeCompany.id}_${workflow}` : null;

  // Load context from localStorage
  useEffect(() => {
    if (!contextKey) return;
    try {
      const saved = localStorage.getItem(contextKey);
      if (saved) setContext(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [contextKey]);

  function updateContext(key: string, value: string) {
    const next = { ...context, [key]: value };
    setContext(next);
    if (contextKey) {
      try { localStorage.setItem(contextKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  }

  // Poll active jobs for status updates
  const pollJobs = useCallback(async () => {
    if (activeJobs.length === 0) return;

    const updatedJobs: JobSummary[] = [];
    let anyCompleted = false;
    let completedOutputId: string | null = null;

    for (const job of activeJobs) {
      try {
        const res = await fetch(`/api/jobs/${job.id}/status`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === "completed") {
          anyCompleted = true;
          completedOutputId = data.outputId ?? null;
        } else if (data.status === "failed") {
          // Remove failed jobs from the list
        } else {
          updatedJobs.push({ ...job, status: data.status, progress: data.progress ?? job.progress });
        }
      } catch {
        updatedJobs.push(job);
      }
    }

    setActiveJobs(updatedJobs);

    if (anyCompleted && completedOutputId) {
      // Navigate to the completed output
      window.location.href = `/inflexion/${workflow === "competitor_intel" ? "competitors" : workflow}/${completedOutputId}`;
    } else if (anyCompleted) {
      // No output ID — reload to get fresh data
      window.location.reload();
    }
  }, [activeJobs, workflow]);

  useEffect(() => {
    if (activeJobs.length === 0) return;
    const interval = setInterval(pollJobs, 2000);
    return () => clearInterval(interval);
  }, [activeJobs, pollJobs]);

  async function triggerJob() {
    if (!activeCompany || triggering) return;
    setTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: activeCompany.id, workflowType: workflow, metadata: { context } }),
      });
      const data = await res.json();
      if (res.ok) {
        // Add a pending job to the local state to show progress immediately
        const newJob: JobSummary = {
          id: data.jobId,
          status: "pending",
          progress: 0,
          createdAt: new Date().toISOString(),
        };
        setActiveJobs((prev) => [newJob, ...prev]);
      } else {
        if (data.error === "job_limit_reached") {
          setTriggerError("Monthly job limit reached. Upgrade your plan for more.");
        } else if (data.error === "upgrade_required") {
          setTriggerError("Your plan does not include this workflow. Upgrade to access.");
        } else {
          setTriggerError(data.error ?? "Failed to start job");
        }
      }
    } catch {
      setTriggerError("Network error. Please try again.");
    } finally {
      setTriggering(false);
    }
  }

  async function deleteOutput(id: string) {
    if (!confirm("Delete this output? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/outputs/${id}`, { method: "DELETE" });
      if (res.ok) {
        setOutputs((prev) => prev.filter((o) => o.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header + summary */}
      <div style={{
        padding: "28px 32px",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#f3f4f6",
        marginBottom: 24,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 24,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{meta.label}</h1>
          <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, maxWidth: 680 }}>{meta.detail}</p>
        </div>
        {hasAccess && activeCompany && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <button
              onClick={triggerJob}
              disabled={triggering}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: triggering ? "#9ca3af" : "#111827",
                border: "none",
                borderRadius: 8,
                cursor: triggering ? "default" : "pointer",
                transition: "background 150ms",
              }}
            >
              {triggering ? "Starting..." : `Run ${meta.label}`}
            </button>
            {triggerError && (
              <p style={{ fontSize: 12, color: "#dc2626", maxWidth: 260, textAlign: "right" }}>{triggerError}</p>
            )}
          </div>
        )}
      </div>

      {/* Not entitled — PaywallGate if diagnose done, simple lock if not */}
      {!hasAccess && workflow !== "diagnose" && workflow !== "competitor_intel" && (
        diagnoseOutput ? (
          <PaywallGate
            stage={workflow as "decide" | "position" | "act"}
            diagnoseOutput={{
              ...diagnoseOutput,
              sections: diagnoseOutput.sections as { executive_summary?: string; what_matters?: string; risks?: Array<{ risk: string; severity: "high" | "medium" | "low"; mitigation: string }> },
            }}
          />
        ) : (
          <div style={{
            padding: 40,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            textAlign: "center",
            background: "#fafafa",
          }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
              Complete Diagnose first
            </p>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16, maxWidth: 360, margin: "0 auto 16px" }}>
              Run a Diagnose analysis to see your strategic gaps — then unlock {meta.label} to act on them.
            </p>
            <a href="/inflexion/diagnose" style={{
              display: "inline-block",
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "#111827",
              borderRadius: 8,
              textDecoration: "none",
            }}>
              Go to Diagnose →
            </a>
          </div>
        )
      )}

      {/* No company */}
      {hasAccess && !activeCompany && (
        <div style={{
          padding: 32,
          border: "1px dashed #d1d5db",
          borderRadius: 12,
          textAlign: "center",
          color: "#6b7280",
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No company selected</p>
          <p style={{ fontSize: 14 }}>Add or select a company to run {meta.label.toLowerCase()} analysis.</p>
        </div>
      )}

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Running
          </h2>
          {activeJobs.map((j) => (
            <div key={j.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 16px",
              border: "1px solid #dbeafe",
              borderRadius: 8,
              background: "#eff6ff",
              marginBottom: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#3b82f6",
                    animation: "pulse 2s infinite",
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1e40af" }}>
                    Processing... {j.progress}%
                  </span>
                </div>
                <div style={{
                  marginTop: 8,
                  height: 4,
                  background: "#bfdbfe",
                  borderRadius: 2,
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${j.progress}%`,
                    background: "#3b82f6",
                    borderRadius: 2,
                    transition: "width 300ms",
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-column layout: always show when has access + company */}
      {hasAccess && activeCompany && activeJobs.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left panel: context form only */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Context form */}
            {contextFields.length > 0 && (
              <div style={{
                padding: "24px",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#f3f4f6",
              }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                  Context
                </p>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 18, lineHeight: 1.6 }}>
                  More context equals higher confidence outputs. Fill in what you know.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {contextFields.map((field) => (
                    <div key={field.key}>
                      <label style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 5,
                      }}>
                        {field.label}
                      </label>
                      {field.type === "select" ? (
                        <select
                          value={context[field.key] ?? ""}
                          onChange={(e) => updateContext(field.key, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "#111827",
                            background: "#fff",
                            border: "1.5px solid #e5e7eb",
                            borderRadius: 8,
                            outline: "none",
                            appearance: "none",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="">Select…</option>
                          {field.options?.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          value={context[field.key] ?? ""}
                          onChange={(e) => updateContext(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={4}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "#111827",
                            background: "#fff",
                            border: "1.5px solid #e5e7eb",
                            borderRadius: 8,
                            outline: "none",
                            resize: "vertical",
                            boxSizing: "border-box",
                            lineHeight: 1.5,
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={context[field.key] ?? ""}
                          onChange={(e) => updateContext(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "#111827",
                            background: "#fff",
                            border: "1.5px solid #e5e7eb",
                            borderRadius: 8,
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: latest report output OR empty state */}
          {outputs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Latest output — featured */}
              {(() => {
                const latest = outputs[0];
                const confColor = latest.confidence !== null
                  ? (latest.confidence >= 0.7 ? "#059669" : latest.confidence >= 0.4 ? "#d97706" : "#dc2626")
                  : "#9ca3af";
                const workflowPath = workflow === "competitor_intel" ? "competitors" : workflow;
                return (
                  <div style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "#fff",
                    overflow: "hidden",
                  }}>
                    {/* Header row */}
                    <div style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 4 }}>
                          Latest report
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {new Date(latest.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => deleteOutput(latest.id)}
                          disabled={deletingId === latest.id}
                          title="Delete output"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: deletingId === latest.id ? "default" : "pointer",
                            padding: "4px 6px",
                            borderRadius: 6,
                            color: "#d1d5db",
                            lineHeight: 1,
                            display: "flex",
                            alignItems: "center",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.background = "#fef2f2"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#d1d5db"; e.currentTarget.style.background = "none"; }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                        <a
                          href={`/inflexion/${workflowPath}/${latest.id}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#fff",
                            background: "#111827",
                            padding: "6px 14px",
                            borderRadius: 6,
                            textDecoration: "none",
                          }}
                        >
                          Open report →
                        </a>
                      </div>
                    </div>

                    {/* Confidence block */}
                    {latest.confidence !== null && (
                      <div style={{
                        padding: "14px 20px",
                        borderBottom: "1px solid #f3f4f6",
                        background: "#fafafa",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: latest.confidenceRationale ? 10 : 0 }}>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 4 }}>
                              Confidence
                            </p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: confColor, lineHeight: 1 }}>
                              {Math.round(latest.confidence * 100)}%
                            </p>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                width: `${Math.round(latest.confidence * 100)}%`,
                                background: confColor,
                                borderRadius: 3,
                                transition: "width 600ms ease",
                              }} />
                            </div>
                            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                              {latest.confidence >= 0.7 ? "High confidence — strong evidence base" : latest.confidence >= 0.4 ? "Medium confidence — some data gaps" : "Low confidence — limited direct evidence"}
                            </p>
                          </div>
                        </div>
                        {latest.confidenceRationale && (
                          <p style={{
                            fontSize: 12,
                            color: "#6b7280",
                            lineHeight: 1.6,
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "10px 12px",
                          }}>
                            <span style={{ fontWeight: 600, color: "#374151" }}>How we scored this: </span>
                            {latest.confidenceRationale}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Executive summary */}
                    {latest.executiveSummary && (
                      <div style={{ padding: "14px 20px" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 8 }}>
                          Summary
                        </p>
                        <p style={{
                          fontSize: 13,
                          color: "#374151",
                          lineHeight: 1.7,
                          display: "-webkit-box",
                          WebkitLineClamp: 6,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>
                          {latest.executiveSummary.replace(/\*\*/g, "")}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Previous outputs (if more than 1) */}
              {outputs.length > 1 && (
                <div style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff",
                  overflow: "hidden",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", padding: "12px 16px 8px", borderBottom: "1px solid #f3f4f6" }}>
                    Previous reports
                  </p>
                  {outputs.slice(1).map((o) => (
                    <div key={o.id} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      borderBottom: "1px solid #f9fafb",
                    }}>
                      <a
                        href={`/inflexion/${workflow === "competitor_intel" ? "competitors" : workflow}/${o.id}`}
                        style={{ flex: 1, minWidth: 0, textDecoration: "none" }}
                      >
                        <p style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                          {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {o.confidence !== null && (
                          <p style={{ fontSize: 11, color: o.confidence >= 0.7 ? "#059669" : o.confidence >= 0.4 ? "#d97706" : "#dc2626", marginTop: 1 }}>
                            {Math.round(o.confidence * 100)}% confidence
                          </p>
                        )}
                      </a>
                      <button
                        onClick={() => deleteOutput(o.id)}
                        disabled={deletingId === o.id}
                        title="Delete"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: deletingId === o.id ? "default" : "pointer",
                          padding: "4px",
                          color: "#d1d5db",
                          display: "flex",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#d1d5db"; }}
                      >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: "40px 32px",
              border: "1px dashed #d1d5db",
              borderRadius: 12,
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              gap: 12,
            }}>
              <div style={{
                width: 44, height: 44,
                borderRadius: 10,
                background: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#9ca3af">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>No analysis run yet</p>
              <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.5, maxWidth: 240 }}>
                Fill in the context on the left and hit Run {meta.label} to generate your first report.
              </p>
              {triggerError && (
                <p style={{ fontSize: 12, color: "#dc2626" }}>{triggerError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
