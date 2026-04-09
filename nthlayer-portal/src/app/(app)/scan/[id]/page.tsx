"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
  PRODUCT_STRATEGY: [
    { event: "step_company_snapshot_complete", label: "Company snapshot" },
    { event: "step_market_positioning_complete", label: "Market positioning" },
    { event: "step_swot_analysis_complete", label: "SWOT analysis" },
    { event: "step_competitor_snapshot_complete", label: "Competitor landscape" },
    { event: "step_emerging_trends_complete", label: "Emerging trends" },
    { event: "step_pricing_monetisation_complete", label: "Pricing & monetisation" },
    { event: "step_gtm_fit_complete", label: "Go-to-market fit" },
    { event: "step_retention_moat_complete", label: "Retention & moat" },
    { event: "step_build_buy_partner_complete", label: "Build vs buy vs partner" },
    { event: "step_product_priorities_complete", label: "Product priorities" },
    { event: "step_ai_opportunity_complete", label: "AI opportunity" },
    { event: "step_risks_assessment_complete", label: "Risks assessment" },
    { event: "step_action_plan_complete", label: "90-day action plan" },
    { event: "step_render_report_complete", label: "Generating report" },
  ],
};

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [fatalError, setFatalError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const errorCount = useRef(0);
  const stopped = useRef(false);

  const pollStatus = useCallback(async () => {
    if (stopped.current) return;
    try {
      const res = await fetch(`/api/scan/${id}/status`);
      if (!res.ok) {
        // Only fatal on 404/401 — everything else is transient, keep retrying
        if (res.status === 404 || res.status === 401) {
          setFatalError("Scan not found or access denied.");
          stopped.current = true;
          return;
        }
        errorCount.current += 1;
        if (errorCount.current >= 3) setRetrying(true);
        return;
      }
      errorCount.current = 0;
      setRetrying(false);
      const data: ScanStatus = await res.json();
      setStatus(data);

      if (data.status === "COMPLETED" && data.report) {
        const reportRes = await fetch(`/api/scan/${id}/report`);
        if (reportRes.ok) setReport(await reportRes.json());
        stopped.current = true; // stop polling once done
      }
      if (data.status === "FAILED") {
        stopped.current = true;
      }
    } catch {
      errorCount.current += 1;
      if (errorCount.current >= 3) setRetrying(true);
    }
  }, [id]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => {
      clearInterval(interval);
      stopped.current = false; // reset on unmount
    };
  }, [pollStatus]);

  // Auto-print when navigated here with ?print=1
  useEffect(() => {
    if (report && searchParams.get("print") === "1") {
      setTimeout(() => window.print(), 500);
    }
  }, [report, searchParams]);

  if (fatalError) return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{fatalError}</div>
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

        {retrying && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            <svg className="h-3.5 w-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Connection issue — still running, retrying…
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

  if (report) {
    const title = report.report.title || "report";

    async function handleDownloadPDF() {
      const el = document.getElementById("report-content");
      if (!el) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).html2pdf) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
        document.head.appendChild(s);
        await new Promise<void>((r) => { s.onload = () => r(); });
      }
      const filename = title.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).html2pdf().set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      }).from(el).save();
    }

    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={handleDownloadPDF}
          className="print-hidden"
          style={{
            position: "absolute",
            top: 48,
            right: 32,
            zIndex: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#1e293b",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download PDF
        </button>
        <div id="report-content" className="report-frame" dangerouslySetInnerHTML={{ __html: report.report.htmlContent }} />
      </div>
    );
  }

  return <p className="text-[var(--muted-foreground)]">Loading report…</p>;
}
