"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const check = useCallback(() => setIsMobile(window.innerWidth < 768), []);
  useEffect(() => {
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [check]);
  return isMobile;
}

const SECTORS = [
  "SaaS","FinTech","HealthTech","EdTech","MarTech","HRTech","LegalTech","PropTech","InsurTech","CleanTech",
  "AgriTech","FoodTech","RetailTech","LogisticsTech","Cybersecurity","DevTools","Data & Analytics",
  "AI / Machine Learning","E-commerce","Professional Services","Consulting","Media & Content",
  "Gaming","Social","Marketplace","Enterprise Software","Infrastructure","Payments",
  "Wealth Management","RegTech","BioTech","MedTech","Manufacturing","Supply Chain",
  "Automotive","Energy","Real Estate","Telecommunications","Defence","Public Sector",
];

const COUNTRIES = [
  "United Kingdom","United States","Canada","Australia","Germany","France","Netherlands","Sweden","Denmark","Norway",
  "Finland","Switzerland","Austria","Belgium","Ireland","Spain","Italy","Portugal","Poland","Czech Republic",
  "Hungary","Romania","Greece","Turkey","Israel","UAE","Saudi Arabia","South Africa","Nigeria","Kenya",
  "India","Singapore","Hong Kong","Japan","South Korea","China","Brazil","Mexico","Colombia","Argentina",
  "New Zealand","Malaysia","Indonesia","Thailand","Vietnam","Philippines","Pakistan","Bangladesh",
  "Global","Europe","EMEA","APAC","LATAM","North America",
];

function TagInput({ value, onChange, list, placeholder }: { value: string; onChange: (v: string) => void; list: string[]; placeholder?: string }) {
  const tags = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.length > 0
    ? list.filter((s) => s.toLowerCase().includes(query.toLowerCase()) && !tags.includes(s)).slice(0, 8)
    : list.filter((s) => !tags.includes(s)).slice(0, 8);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addTag(sector: string) {
    const next = [...tags, sector];
    onChange(next.join(", "));
    setQuery("");
    inputRef.current?.focus();
  }

  function removeTag(sector: string) {
    const next = tags.filter((t) => t !== sector);
    onChange(next.join(", "));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      const match = SECTORS.find((s) => s.toLowerCase() === query.toLowerCase());
      addTag(match ?? query.trim());
    }
    if (e.key === "Backspace" && !query && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "8px 10px",
          border: "1.5px solid #e5e7eb",
          borderRadius: 8,
          background: "#fff",
          cursor: "text",
          minHeight: 42,
          alignItems: "center",
        }}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {tags.map((tag) => (
          <span key={tag} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "#e5e7eb", color: "#374151", fontSize: 12, fontWeight: 500,
            borderRadius: 4, padding: "3px 8px",
          }}>
            {tag}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); removeTag(tag); }}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? (placeholder ?? "Search or add...") : ""}
          style={{ border: "none", outline: "none", fontSize: 14, color: "#111827", flex: 1, minWidth: 120, background: "transparent" }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          marginTop: 4, background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden",
        }}>
          {filtered.map((s) => (
            <button key={s} type="button" onMouseDown={() => addTag(s)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "9px 14px", fontSize: 14, color: "#111827",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: "1px solid #f3f4f6",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectorTagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <TagInput value={value} onChange={onChange} list={SECTORS} placeholder="Search or add a sector..." />;
}

function TerritoryTagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <TagInput value={value} onChange={onChange} list={COUNTRIES} placeholder="Search or add a country..." />;
}

const LOCATIONS = [
  "London, UK","Manchester, UK","Edinburgh, UK","Bristol, UK","Birmingham, UK","Leeds, UK","Glasgow, UK","Cardiff, UK","Liverpool, UK","Sheffield, UK","Newcastle, UK","Nottingham, UK","Leicester, UK","Swansea, UK","Belfast, UK","Dublin, Ireland",
  "Amsterdam, Netherlands","Berlin, Germany","Munich, Germany","Hamburg, Germany","Frankfurt, Germany","Paris, France","Barcelona, Spain","Madrid, Spain",
  "Stockholm, Sweden","Copenhagen, Denmark","Oslo, Norway","Helsinki, Finland","Zurich, Switzerland","Vienna, Austria","Brussels, Belgium",
  "New York, USA","San Francisco, USA","Los Angeles, USA","Boston, USA","Chicago, USA","Austin, USA","Seattle, USA","Miami, USA","Atlanta, USA",
  "Toronto, Canada","Vancouver, Canada","Montreal, Canada",
  "Sydney, Australia","Melbourne, Australia","Singapore","Hong Kong","Tokyo, Japan","Seoul, South Korea","Dubai, UAE","Tel Aviv, Israel",
  "Bangalore, India","Mumbai, India","São Paulo, Brazil","Mexico City, Mexico","Cape Town, South Africa","Nairobi, Kenya",
  "Remote","Global",
];

function LocationLookup({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length > 0
    ? LOCATIONS.filter((l) => l.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(loc: string) {
    setQuery(loc);
    onChange(loc);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search city or country..."
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: 14,
          color: "#111827",
          background: "#fff",
          border: "1.5px solid #e5e7eb",
          borderRadius: 8,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          zIndex: 50,
          marginTop: 4,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}>
          {filtered.map((loc) => (
            <button
              key={loc}
              type="button"
              onMouseDown={() => select(loc)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 14px",
                fontSize: 14,
                color: "#111827",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderBottom: "1px solid #f3f4f6",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              {loc}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CompanyProfile {
  userType?: "operator" | "investor";
  sector?: string;
  location?: string;
  description?: string;
  icp1?: string;
  icp2?: string;
  icp3?: string;
  inflectionPoint?: string;
  risks?: string | string[];
  bigBet?: string;
  competitors?: string[];
}

interface CompanyData {
  id: string;
  name: string;
  url: string | null;
  sector: string | null;
  location: string | null;
  description: string | null;
  profile: CompanyProfile | null;
}

function completionScore(company: CompanyData): { score: number; missing: string[] } {
  const missing: string[] = [];
  const profile = company.profile ?? {};

  if (!company.name) missing.push("company name");
  if (!company.url) missing.push("website");
  if (!company.sector) missing.push("sector");
  if (!company.location) missing.push("location");
  if (!(profile as { territory?: string }).territory) missing.push("territory");
  if (!profile.icp1) missing.push("ideal customer 1");
  const hasCompetitors = (profile.competitors ?? []).filter(Boolean).length > 0;
  if (!hasCompetitors) missing.push("competitor 1");

  const total = 8;
  const done = total - missing.length;
  return { score: Math.round((done / total) * 100), missing };
}

export function CompanyProfileForm({ company }: { company: CompanyData }) {
  const isMobile = useIsMobile();
  const profile = company.profile ?? {};

  const [form, setForm] = useState({
    name: company.name,
    url: company.url ?? "",
    sector: company.sector ?? "",
    location: company.location ?? "",
    description: company.description ?? "",
    icp1: profile.icp1 ?? "",
    icp2: profile.icp2 ?? "",
    icp3: profile.icp3 ?? "",
    inflectionPoint: profile.inflectionPoint ?? "",
    risks: (() => {
      const r = profile.risks;
      const arr = Array.isArray(r) ? r : (r ? [r] : []);
      return [...arr, ...Array(Math.max(0, 5 - arr.length)).fill("")].slice(0, 5) as string[];
    })(),
    bigBet: profile.bigBet ?? "",
    territory: (profile as { territory?: string }).territory ?? "",
    competitors: [
      ...(profile.competitors ?? []),
      ...Array(Math.max(0, 5 - (profile.competitors ?? []).length)).fill(""),
    ].slice(0, 5) as string[],
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { score, missing } = completionScore({
    ...company,
    url: form.url || null,
    sector: form.sector || null,
    profile: {
      ...profile,
      icp1: form.icp1 || undefined,
      inflectionPoint: form.inflectionPoint || undefined,
      bigBet: form.bigBet || undefined,
      competitors: form.competitors.filter(Boolean),
    },
  });

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim() || null,
          sector: form.sector.trim() || null,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
          profile: {
            ...profile,
            icp1: form.icp1.trim() || undefined,
            icp2: form.icp2.trim() || undefined,
            icp3: form.icp3.trim() || undefined,
            inflectionPoint: form.inflectionPoint.trim() || undefined,
            risks: form.risks.filter(Boolean).map((r) => r.trim()),
            bigBet: form.bigBet.trim() || undefined,
            territory: form.territory.trim() || undefined,
            competitors: form.competitors.filter(Boolean).map((c) => c.trim()),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function setRisk(index: number, value: string) {
    const next = [...form.risks];
    next[index] = value;
    setForm({ ...form, risks: next });
  }

  function setCompetitor(index: number, value: string) {
    const next = [...form.competitors];
    next[index] = value;
    setForm({ ...form, competitors: next });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 14,
    color: "#111827",
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  };

  const sectionStyle: React.CSSProperties = {
    padding: "24px",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
  };

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-start", gap: isMobile ? 12 : 0, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Company Profile</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            Context that shapes the quality of every analysis.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {saved && <span style={{ fontSize: 13, color: "#059669", fontWeight: 500 }}>Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: saving ? "#9ca3af" : "#111827",
              border: "none",
              borderRadius: 8,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Completion bar */}
      <div style={{ ...sectionStyle, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Profile Completeness</p>
          <span style={{ fontSize: 13, fontWeight: 700, color: score >= 80 ? "#059669" : score >= 50 ? "#d97706" : "#dc2626" }}>
            {score}%
          </span>
        </div>
        <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
          <div style={{
            height: "100%",
            width: `${score}%`,
            background: score >= 80 ? "#059669" : score >= 50 ? "#d97706" : "#111827",
            borderRadius: 3,
            transition: "width 400ms",
          }} />
        </div>
        {missing.length > 0 && (
          <p style={{ fontSize: 12, color: "#9ca3af" }}>
            Missing: {missing.join(" · ")}
          </p>
        )}
        {score === 100 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>Profile complete</p>
            <a
              href="/inflexion/strategy"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "#111827",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Start Strategy
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>
        </div>
      )}

      {/* 3-column layout — single column on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 20, alignItems: "stretch" }}>

        {/* Column 1: Company */}
        <div style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, padding: "24px" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: 0, marginBottom: 18 }}>Company</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Company name <span style={{ color: "#dc2626" }}>*</span></label>
              <input style={inputStyle} type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Website <span style={{ color: "#dc2626" }}>*</span></label>
              <input style={inputStyle} type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://acme.com" />
            </div>
            <div>
              <label style={labelStyle}>Sector <span style={{ color: "#dc2626" }}>*</span></label>
              <SectorTagInput value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} />
            </div>
            <div>
              <label style={labelStyle}>Location <span style={{ color: "#dc2626" }}>*</span></label>
              <LocationLookup value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            </div>
            <div>
              <label style={labelStyle}>Territory <span style={{ color: "#dc2626" }}>*</span></label>
              <TerritoryTagInput value={form.territory} onChange={(v) => setForm({ ...form, territory: v })} />
            </div>
          </div>
        </div>

        {/* Column 2: ICP */}
        <div style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, padding: "24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: 0, marginBottom: 4 }}>Ideal Customer Profile</p>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18, lineHeight: 1.5 }}>
            Describe the people or companies you sell to most successfully.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={labelStyle}>Ideal customer 1 <span style={{ color: "#dc2626" }}>*</span></label>
              <textarea style={{ ...inputStyle, flex: 1, resize: "none", minHeight: 80 }} value={form.icp1} onChange={(e) => setForm({ ...form, icp1: e.target.value })} placeholder="Series B SaaS founders scaling GTM" />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={labelStyle}>Ideal customer 2</label>
              <textarea style={{ ...inputStyle, flex: 1, resize: "none", minHeight: 80 }} value={form.icp2} onChange={(e) => setForm({ ...form, icp2: e.target.value })} placeholder="PE-backed software operators pre-exit" />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={labelStyle}>Ideal customer 3 <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></label>
              <textarea style={{ ...inputStyle, flex: 1, resize: "none", minHeight: 80 }} value={form.icp3} onChange={(e) => setForm({ ...form, icp3: e.target.value })} placeholder="Optional third ICP..." />
            </div>
          </div>
        </div>

        {/* Column 3: Competitors */}
        <div style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, padding: "24px" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: 0, marginBottom: 4 }}>Competitors</p>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18, lineHeight: 1.5 }}>
            Domain or name, up to 5. Used in analysis and teardowns.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 23 }}>
            {form.competitors.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? "#dc2626" : "#d1d5db", width: 16, textAlign: "right", flexShrink: 0 }}>{i + 1}{i === 0 ? " *" : ""}</span>
                <input style={{ ...inputStyle, flex: 1 }} type="text" value={c} onChange={(e) => setCompetitor(i, e.target.value)} placeholder={i === 0 ? "competitor.com" : ""} />
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
