"use client";
import React, { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  sector: string | null;
  outputs?: Output[];
}

interface Output {
  id: string;
  workflowType: string;
  confidence: number | null;
  createdAt: string;
}

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  companies: Company[];
}

// ─── Sector badge colour ──────────────────────────────────────────────────────

function sectorColour(sector: string | null): { bg: string; text: string } {
  if (!sector) return { bg: "#f3f4f6", text: "#6b7280" };
  const s = sector.toLowerCase();
  if (s.includes("fintech") || s.includes("finance")) return { bg: "#eff6ff", text: "#1d4ed8" };
  if (s.includes("health") || s.includes("medtech")) return { bg: "#f0fdf4", text: "#166534" };
  if (s.includes("saas") || s.includes("software")) return { bg: "#faf5ff", text: "#7c3aed" };
  if (s.includes("market")) return { bg: "#fff7ed", text: "#c2410c" };
  if (s.includes("hr") || s.includes("people")) return { bg: "#fdf2f8", text: "#9d174d" };
  return { bg: "#f3f4f6", text: "#374151" };
}

const WORKFLOW_LABELS: Record<string, string> = {
  diagnose: "Diagnose",
  decide: "Decide",
  position: "Position",
  act: "Act",
};

const WORKFLOW_COLOURS: Record<string, { bg: string; text: string }> = {
  diagnose: { bg: "#eff6ff", text: "#1d4ed8" },
  decide:   { bg: "#f0fdf4", text: "#166534" },
  position: { bg: "#faf5ff", text: "#7c3aed" },
  act:      { bg: "#fff7ed", text: "#c2410c" },
};

const STAGE_KEYS = ["diagnose", "decide", "position", "act"] as const;
const TOTAL_STAGES = 5; // frame + 4 workflows

// Count how many of the 5 stages a company has outputs for.
// We treat "frame" as done if any workflow output exists (since frame is a prerequisite).
function completionCount(company: Company): number {
  if (!company.outputs || company.outputs.length === 0) return 0;
  const done = new Set(company.outputs.map((o) => o.workflowType));
  const workflowsDone = STAGE_KEYS.filter((k) => done.has(k)).length;
  // if any workflow exists, "frame" was also completed
  return workflowsDone > 0 ? workflowsDone + 1 : 0;
}

// Latest output per workflow for a company
function latestOutputByWorkflow(company: Company): Record<string, Output | null> {
  const result: Record<string, Output | null> = { diagnose: null, decide: null, position: null, act: null };
  if (!company.outputs) return result;
  for (const key of STAGE_KEYS) {
    const matching = company.outputs
      .filter((o) => o.workflowType === key)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    result[key] = matching[0] ?? null;
  }
  return result;
}

function avgConfidence(outputs: Output[]): number | null {
  const scores = outputs.map((o) => o.confidence).filter((c): c is number => c != null);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Stat Bar ─────────────────────────────────────────────────────────────────

function StatBar({ companies, allOutputs }: { companies: Company[]; allOutputs: Output[] }) {
  const totalCompanies = companies.length;
  const totalReports = allOutputs.length;
  const avg = avgConfidence(allOutputs);

  const stat = (label: string, value: string) => (
    <div style={{ flex: 1, padding: "16px 20px", borderRight: "1px solid #e5e7eb" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{value}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", marginBottom: 24, overflow: "hidden" }}>
      {stat("Companies", String(totalCompanies))}
      {stat("Total Reports", String(totalReports))}
      <div style={{ flex: 1, padding: "16px 20px" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Avg Confidence</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
          {avg != null ? `${Math.round(avg * 100)}%` : "—"}
        </p>
      </div>
    </div>
  );
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: Company }) {
  const byWorkflow = latestOutputByWorkflow(company);
  const done = completionCount(company);
  const latestDate = company.outputs && company.outputs.length > 0
    ? company.outputs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt
    : null;
  const allOutputs = company.outputs ?? [];
  const avg = avgConfidence(allOutputs);
  const sc = sectorColour(company.sector);

  return (
    <a
      href="/inflexion/strategy"
      style={{ display: "block", textDecoration: "none", padding: 20, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", transition: "border-color 150ms, box-shadow 150ms" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#d1d5db";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#e5e7eb";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{company.name}</p>
          {company.sector && (
            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text }}>
              {company.sector}
            </span>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "right", marginLeft: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>{done}/{TOTAL_STAGES}</p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>stages</p>
        </div>
      </div>

      {/* Workflow badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {STAGE_KEYS.map((key) => {
          const output = byWorkflow[key];
          const col = WORKFLOW_COLOURS[key];
          if (!output) {
            return (
              <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#f9fafb", color: "#d1d5db", border: "1px solid #e5e7eb" }}>
                {WORKFLOW_LABELS[key]}
              </span>
            );
          }
          const conf = output.confidence != null ? `${Math.round(output.confidence * 100)}%` : null;
          return (
            <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: col.bg, color: col.text }}>
              {WORKFLOW_LABELS[key]}{conf && <span style={{ opacity: 0.75 }}>{conf}</span>}
            </span>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {latestDate ? `Updated ${formatDate(latestDate)}` : "No reports yet"}
        </span>
        {avg != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
            Avg confidence: {Math.round(avg * 100)}%
          </span>
        )}
      </div>
    </a>
  );
}

// ─── Create Portfolio Modal ───────────────────────────────────────────────────

function CreatePortfolioModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Portfolio) => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create portfolio"); setLoading(false); return; }
      onCreated(data.portfolio as Portfolio);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, padding: 32, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
      >
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Create Portfolio</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Group companies to view aggregate strategic intelligence.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Portfolio name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Portfolio Q2 2026"
            autoFocus
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "inherit", color: "#111827", outline: "none", marginBottom: 8 }}
          />
          {error && <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 12px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{ flex: 2, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#fff", background: loading || !name.trim() ? "#9ca3af" : "#111827", border: "none", borderRadius: 8, cursor: loading || !name.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {loading ? "Creating…" : "Create Portfolio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[] | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolios")
      .then(async (res) => {
        if (res.status === 403) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        setHasAccess(true);
        setPortfolios(data.portfolios ?? []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setHasAccess(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 960 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Portfolio</h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>Loading…</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div style={{ maxWidth: 960 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Portfolio</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>Multi-company strategic intelligence</p>
        <div style={{ padding: 40, border: "1px solid #e5e7eb", borderRadius: 12, textAlign: "center", background: "#fafafa" }}>
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#9ca3af" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Portfolio view requires an upgrade</p>
          <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, margin: "0 auto 16px" }}>
            Aggregate strategic intelligence across multiple companies with the Portfolio plan.
          </p>
          <span style={{ display: "inline-block", padding: "10px 24px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#111827", borderRadius: 8, cursor: "pointer" }}>
            Upgrade Plan
          </span>
        </div>
      </div>
    );
  }

  const allCompanies = (portfolios ?? []).flatMap((p) => p.companies);
  const allOutputs = allCompanies.flatMap((c) => c.outputs ?? []);

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Portfolio</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>Multi-company strategic intelligence</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#111827", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
          New Portfolio
        </button>
      </div>

      {portfolios && portfolios.length > 0 && allCompanies.length > 0 && (
        <StatBar companies={allCompanies} allOutputs={allOutputs} />
      )}

      {(!portfolios || portfolios.length === 0) ? (
        <div style={{ padding: 40, border: "1px dashed #d1d5db", borderRadius: 12, textAlign: "center" }}>
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="#d1d5db" style={{ margin: "0 auto 12px", display: "block" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
          </svg>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No portfolios yet</p>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>Create a portfolio to group companies and track aggregate strategic intelligence.</p>
          <button
            onClick={() => setModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#111827", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Create Portfolio
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {portfolios!.map((portfolio) => (
            <div key={portfolio.id}>
              {/* Portfolio header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <a
                    href={`/inflexion/portfolio/${portfolio.id}`}
                    style={{ fontSize: 17, fontWeight: 700, color: "#111827", textDecoration: "none" }}
                  >
                    {portfolio.name}
                  </a>
                  <span style={{ fontSize: 13, color: "#9ca3af", marginLeft: 10 }}>
                    {portfolio.companies.length} {portfolio.companies.length === 1 ? "company" : "companies"}
                  </span>
                </div>
                <a
                  href={`/inflexion/portfolio/${portfolio.id}`}
                  style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 10px" }}
                >
                  View details
                </a>
              </div>

              {portfolio.companies.length === 0 ? (
                <div style={{ padding: 24, border: "1px dashed #d1d5db", borderRadius: 10, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  No companies in this portfolio yet
                </div>
              ) : (
                /* 2-column company grid */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                  {portfolio.companies.map((company) => (
                    <CompanyCard key={company.id} company={company} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <CreatePortfolioModal
          onClose={() => setModalOpen(false)}
          onCreated={(p) => {
            setPortfolios((prev) => [{ ...p, companies: [] }, ...(prev ?? [])]);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
