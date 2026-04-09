"use client";

export function DownloadPdfButton({ scanId }: { scanId: string }) {
  return (
    <button
      onClick={() => window.open(`/api/scan/${scanId}/print`, "_blank")}
      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1"
      title="Download PDF"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      PDF
    </button>
  );
}
