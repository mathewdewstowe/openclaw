"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

interface ScanEvent {
  event: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface ScanStatus {
  id: string;
  type: string;
  status: string;
  progress: number;
  currentStep?: string;
  events: ScanEvent[];
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  report?: { id: string };
}

interface ReportData {
  report: {
    id: string;
    title: string;
    htmlContent: string;
    pdfUrl?: string;
    version: number;
  };
  transparency: {
    inputs: Record<string, unknown>;
    modules: Array<{
      module: string;
      confidence: number;
      durationMs: number;
      sources: string[];
    }>;
    mode: string;
  };
}

// Full ordered step list per scan type
const PIPELINE_STEPS: Record<string, Array<{ event: string; label: string }>> = {
  COMPETITOR_TEARDOWN: [
    { event: "step_competitor_snapshot_complete", label: "Company snapshot" },
    { event: "step_positioning_complete", label: "Positioning analysis" },
    { event: "step_product_shape_complete", label: "Product shape" },
    { event: "step_ai_narrative_complete", label: "AI narrative" },
    { event: "step_gtm_signals_complete", label: "GTM signals" },
    { event: "step_strengths_complete", label: "Strengths" },
    { event: "step_vulnerabilities_complete", label: "Vulnerabilities" },
    { event: "step_next_moves_complete", label: "Likely next moves" },
    { event: "step_response_strategy_complete", label: "Competitive response" },
    { event: "step_product_strategy_complete", label: "Product strategy" },
    { event: "step_public_financials_complete", label: "Public financials" },
    { event: "step_render_report_complete", label: "Generating report" },
  ],
  SELF_SCAN: [
    { event: "step_company_snapshot_complete", label: "Company snapshot" },
    { event: "step_positioning_complete", label: "Positioning analysis" },
    { event: "step_competitive_reality_complete", label: "Competitive reality" },
    { event: "step_value_creation_complete", label: "Value creation" },
    { event: "step_ai_feasibility_complete", label: "AI feasibility" },
    { event: "step_strategic_bets_complete", label: "Strategic bets" },
    { event: "step_render_report_complete", label: "Generating report" },
  ],
};

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [showTransparency, setShowTransparency] = useState(false);
  const [error, setError] = useState("");
  const errorCount = useRef(0);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/${id}/status`);
      if (!res.ok) {
        errorCount.current += 1;
        if (errorCount.current >= 4) setError("Failed to load scan");
        return; // retry next poll
      }
      errorCount.current = 0;
      const data: ScanStatus = await res.json();
      setStatus(data);

      if (data.status === "COMPLETED" && data.report) {
        const reportRes = await fetch(`/api/scan/${id}/report`);
        if (reportRes.ok) setReport(await reportRes.json());
      }
    } catch {
      errorCount.current += 1;
      if (errorCount.current >= 4) setError("Failed to load scan");
    }
  }, [id]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(() => {
      if (status && (status.status === "PENDING" || status.status === "RUNNING")) {
        pollStatus();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollStatus, status]);

  if (error) return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{error}</div>
    </div>
  );

  if (!status) return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-[var(--muted)] rounded w-1/3" />
      <div className="h-4 bg-[var(--muted)] rounded w-2/3" />
    </div>
  );

  if (status.status === "PENDING" || status.status === "RUNNING") {
    const completedEvents = new Set(
      (status.events || []).filter((e) => e.event.startsWith("step_") && e.event.endsWith("_complete")).map((e) => e.event)
    );
    const pipeline = PIPELINE_STEPS[status.type] ?? [];
    const currentStepIndex = pipeline.findIndex((s) => !completedEvents.has(s.event));

    const logs = (status.events || []).filter((e) => !e.event.startsWith("pipeline_advance_")).map((e) => {
      const time = new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const label = e.event
        .replace("step_", "")
        .replace("_complete", " ✓")
        .replace("_failed", " ✗")
        .replace("_started", " started")
        .replace(/_/g, " ");
      return { time, label, failed: e.event.endsWith("_failed") };
    });

    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analysis Running</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            This typically takes 2–3 minutes.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">
              {currentStepIndex > 0
                ? `Working on ${pipeline[currentStepIndex]?.label ?? "next step"}…`
                : "Starting up…"}
            </span>
            <span className="font-mono text-[var(--primary)] tabular-nums">{status.progress}%</span>
          </div>
          <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full transition-all duration-700"
              style={{ width: `${Math.max(status.progress, 1)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          {pipeline.map((step, i) => {
            const done = completedEvents.has(step.event);
            const active = !done && i === currentStepIndex;

            return (
              <div
                key={step.event}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 transition-colors ${
                  done ? "bg-[var(--background)]" : active ? "bg-[var(--primary)]/5" : "bg-[var(--background)]"
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4 text-[var(--primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : active ? (
                  <span className="h-4 w-4 flex items-center justify-center shrink-0">
                    <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse" />
                  </span>
                ) : (
                  <span className="h-4 w-4 flex items-center justify-center shrink-0">
                    <span className="h-2 w-2 rounded-full bg-[var(--border)]" />
                  </span>
                )}
                <span className={`text-sm ${done ? "text-[var(--foreground)]" : active ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {logs.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Activity log</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
            </div>
            <div className="px-4 py-3 space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[var(--muted-foreground)] shrink-0 tabular-nums">{l.time}</span>
                  <span className={l.failed ? "text-red-500" : "text-[var(--foreground)]"}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status.status === "FAILED") return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Analysis Failed</h2>
      <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
        {status.errorMessage || "An unknown error occurred."}
      </div>
    </div>
  );

  if (report) return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 bg-[var(--background)] border-b border-[var(--border)] -mx-8 px-8 py-3 flex items-center justify-between">
        <h2 className="font-semibold">{report.report.title}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTransparency(!showTransparency)}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)] rounded-md px-3 py-1.5"
          >
            {showTransparency ? "Hide" : "How this was produced"}
          </button>
          {report.report.pdfUrl && (
            <a href={report.report.pdfUrl} className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]">
              Download PDF
            </a>
          )}
        </div>
      </div>

      {showTransparency && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
          <h3 className="text-sm font-semibold">How This Was Produced</h3>
          <div className="space-y-1">
            {report.transparency.modules.map((m) => (
              <div key={m.module} className="flex items-center justify-between text-xs">
                <span className="font-mono">{m.module}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--muted-foreground)]">{m.durationMs}ms</span>
                  <span className={`px-1.5 py-0.5 rounded-full ${
                    m.confidence >= 0.8 ? "bg-emerald-500/20 text-emerald-600" :
                    m.confidence >= 0.5 ? "bg-yellow-500/20 text-yellow-600" :
                    "bg-red-500/20 text-red-500"
                  }`}>
                    {Math.round(m.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="report-frame" dangerouslySetInnerHTML={{ __html: report.report.htmlContent }} />
    </div>
  );

  return <p className="text-[var(--muted-foreground)]">Loading report…</p>;
}
