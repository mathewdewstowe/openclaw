"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  id: string;
  displayName: string;
}

export function CompanyPlanPicker({
  companyId,
  currentPlanName,
  plans,
}: {
  companyId: string;
  currentPlanName: string | null;
  plans: Plan[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/companies/${companyId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selected }),
      });
      if (!res.ok) {
        setError("Failed to update");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#4b5563" }}>{currentPlanName ?? "—"}</span>
        <button
          onClick={() => { setSelected(""); setEditing(true); }}
          style={{
            fontSize: 11,
            color: "#6b7280",
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            padding: "1px 6px",
            cursor: "pointer",
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          fontSize: 13,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          padding: "3px 6px",
          color: "#111827",
          background: "#fff",
        }}
      >
        <option value="">Select plan…</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>{p.displayName}</option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={!selected || isPending}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          background: selected && !isPending ? "#111827" : "#9ca3af",
          border: "none",
          borderRadius: 5,
          padding: "3px 10px",
          cursor: selected && !isPending ? "pointer" : "default",
        }}
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        onClick={() => setEditing(false)}
        style={{
          fontSize: 12,
          color: "#6b7280",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "3px 4px",
        }}
      >
        Cancel
      </button>
      {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
    </div>
  );
}
