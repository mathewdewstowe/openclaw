"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ url, label, disabled }: { url: string; label: string; disabled?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (disabled) return null;

  if (confirming) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>Delete {label}?</span>
        <button
          onClick={async () => {
            setLoading(true);
            await fetch(url, { method: "DELETE" });
            router.refresh();
          }}
          disabled={loading}
          style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
            background: "#dc2626", color: "#fff", border: "none", cursor: "pointer",
          }}
        >
          {loading ? "..." : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
            background: "#f3f4f6", color: "#374151", border: "none", cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      style={{
        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
        background: "transparent", color: "#9ca3af", border: "1px solid #e5e7eb",
        cursor: "pointer",
      }}
    >
      Delete
    </button>
  );
}
