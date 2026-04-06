"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteScanButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await fetch(`/api/scan/${scanId}`, { method: "DELETE" });
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          {loading ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-[var(--muted-foreground)] hover:underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
    >
      Delete
    </button>
  );
}
