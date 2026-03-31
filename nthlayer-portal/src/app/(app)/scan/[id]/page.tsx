"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface ScanStatus {
  id: string;
  type: string;
  status: string;
  progress: number;
  currentStep?: string;
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

const stepLabels: Record<string, string> = {
  step_company_research_complete: "Company research",
  step_competitor_research_complete: "Competitor research",
  step_positioning_complete: "Positioning analysis",
  step_competitive_complete: "Competitive analysis",
  step_workflow_complete: "Workflow analysis",
  step_ai_operating_model_complete: "AI operating model",
  step_value_creation_complete: "Value creation",
  step_strategic_bets_complete: "Strategic bets",
  step_ceo_actions_complete: "CEO actions",
  step_do_nothing_complete: "Do-nothing scenario",
  step_board_narrative_complete: "Board narrative",
  step_render_report_complete: "Report rendering",
  step_competitor_snapshot_complete: "Competitor snapshot",
  step_product_shape_complete: "Product analysis",
  step_ai_narrative_complete: "AI narrative",
  step_gtm_signals_complete: "GTM signals",
  step_strengths_complete: "Strengths",
  step_vulnerabilities_complete: "Vulnerabilities",
  step_next_moves_complete: "Next moves",
  step_response_strategy_complete: "Response strategy",
};

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [showTransparency, setShowTransparency] = useState(false);
  const [error, setError] = useState("");

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/${id}/status`);
      if (!res.ok) {
        setError("Failed to load scan");
        return;
      }
      const data: ScanStatus = await res.json();
      setStatus(data);

      if (data.status === "COMPLETED" && data.report) {
        const reportRes = await fetch(`/api/scan/${id}/report`);
        if (reportRes.ok) {
          setReport(await reportRes.json());
        }
      }
    } catch {
      setError("Failed to load scan status");
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

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--muted)] rounded w-1/3" />
          <div className="h-4 bg-[var(--muted)] rounded w-2/3" />
        </div>
      </div>
    );
  }

  // Running state
  if (status.status === "PENDING" || status.status === "RUNNING") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analysis Running</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            This typically takes 2-3 minutes.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{status.currentStep ? stepLabels[status.currentStep] || status.currentStep : "Starting..."}</span>
            <span className="font-mono text-[var(--primary)]">{status.progress}%</span>
          </div>
          <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-sm text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Processing...
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (status.status === "FAILED") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analysis Failed</h2>
        </div>
        <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {status.errorMessage || "An unknown error occurred."}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
        >
          Retry
        </button>
      </div>
    );
  }

  // Completed — show report
  if (report) {
    return (
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
              <a
                href={report.report.pdfUrl}
                className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
              >
                Download PDF
              </a>
            )}
          </div>
        </div>

        {showTransparency && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
            <h3 className="text-sm font-semibold">How This Was Produced</h3>
            <div>
              <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Mode</h4>
              <span className="text-xs bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded-full">
                {report.transparency.mode === "PUBLIC_SIGNAL" ? "Public Signal Analysis" : "Internal Evidence Analysis"}
              </span>
            </div>
            <div>
              <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Inputs</h4>
              <pre className="text-xs bg-[var(--muted)] rounded p-3 overflow-auto font-mono">
                {JSON.stringify(report.transparency.inputs, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Modules ({report.transparency.modules.length})</h4>
              <div className="space-y-1">
                {report.transparency.modules.map((m) => (
                  <div key={m.module} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{m.module}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--muted-foreground)]">{m.durationMs}ms</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        m.confidence >= 0.8 ? "bg-emerald-500/20 text-emerald-400" :
                        m.confidence >= 0.5 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>
                        {Math.round(m.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className="report-frame"
          dangerouslySetInnerHTML={{ __html: report.report.htmlContent }}
        />
      </div>
    );
  }

  return <p className="text-[var(--muted-foreground)]">Loading report...</p>;
}
