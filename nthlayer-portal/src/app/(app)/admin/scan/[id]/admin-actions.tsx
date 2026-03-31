"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminActions({
  scanId,
  scanStatus,
}: {
  scanId: string;
  scanStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: string) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/scan/${scanId}/${action}`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {(scanStatus === "FAILED" || scanStatus === "COMPLETED") && (
        <button
          onClick={() => handleAction("rerun")}
          disabled={loading !== null}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {loading === "rerun" ? "Rerunning..." : "Rerun Full Scan"}
        </button>
      )}
      {scanStatus === "COMPLETED" && (
        <button
          onClick={() => handleAction("regenerate-report")}
          disabled={loading !== null}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {loading === "regenerate-report" ? "Regenerating..." : "Regenerate Report"}
        </button>
      )}
    </div>
  );
}
