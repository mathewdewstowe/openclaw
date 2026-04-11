"use client";

import { useState } from "react";
import { useCompany } from "@/lib/contexts/company";

interface CompanyInfo {
  id: string;
  name: string;
  url: string | null;
  sector: string | null;
  role: string;
}

export function AddCompanyForm({ onAdded }: { onAdded?: (company: CompanyInfo) => void }) {
  const { setActiveCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", url: "", sector: "", location: "", description: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim() || null,
          sector: form.sector.trim() || null,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "company_limit_reached") {
          setError(`Company limit reached (max ${data.max}). Upgrade your plan to add more.`);
        } else {
          setError(data.error ?? "Failed to create company");
        }
        return;
      }

      const newCompany: CompanyInfo = {
        id: data.company.id,
        name: data.company.name,
        url: data.company.url ?? null,
        sector: data.company.sector ?? null,
        role: "owner",
      };

      setActiveCompany(newCompany);
      onAdded?.(newCompany);
      setOpen(false);
      setForm({ name: "", url: "", sector: "", location: "", description: "" });
      // Refresh to update server-rendered company list
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          background: "#111827",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Company
      </button>
    );
  }

  return (
    <div style={{
      padding: "20px 24px",
      border: "1px solid #d1d5db",
      borderRadius: 12,
      background: "#fafafa",
      marginTop: 12,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Add a company</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
              Company name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Ltd"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 14,
                color: "#111827",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
              Website
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://acme.com"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 14,
                color: "#111827",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
                Sector
              </label>
              <input
                type="text"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                placeholder="SaaS, FinTech..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 14,
                  color: "#111827",
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="London, UK"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 14,
                  color: "#111827",
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
              Brief description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this company do?"
              rows={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 14,
                color: "#111827",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#dc2626" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="submit"
            disabled={loading || !form.name.trim()}
            style={{
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: loading || !form.name.trim() ? "#9ca3af" : "#111827",
              border: "none",
              borderRadius: 8,
              cursor: loading || !form.name.trim() ? "default" : "pointer",
            }}
          >
            {loading ? "Creating..." : "Create Company"}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              color: "#6b7280",
              background: "transparent",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
