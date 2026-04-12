"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  id: string;
  displayName: string;
}

export function UserPlanPicker({
  userId,
  currentPlanId,
  currentDisplayName,
  plans,
}: {
  userId: string;
  currentPlanId: string | null;
  currentDisplayName: string;
  plans: Plan[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(currentPlanId ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(planId: string) {
    setSelected(planId);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        setError("Failed to save");
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 12,
          color: "#111827",
          background: "#fff",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {!currentPlanId && <option value="">Free</option>}
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
      {saved && (
        <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Saved</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>
      )}
    </div>
  );
}
