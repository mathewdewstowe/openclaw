"use client";

import { useState, useRef, useEffect } from "react";
import { useCompany } from "@/lib/contexts/company";

const SECTORS = [
  "SaaS","FinTech","HealthTech","EdTech","MarTech","HRTech","LegalTech","PropTech","InsurTech","CleanTech",
  "AgriTech","FoodTech","RetailTech","LogisticsTech","Cybersecurity","DevTools","Data & Analytics",
  "AI / Machine Learning","E-commerce","Professional Services","Consulting","Media & Content",
  "Gaming","Social","Marketplace","Enterprise Software","Infrastructure","Payments",
  "Wealth Management","RegTech","BioTech","MedTech","Manufacturing","Supply Chain",
  "Automotive","Energy","Real Estate","Telecommunications","Defence","Public Sector",
];

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

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 15,
  color: "#111827",
  background: "#fff",
  border: "1.5px solid #d1d5db",
  borderRadius: 10,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 150ms",
};

function SectorMultiSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tags = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = SECTORS.filter((s) => s.toLowerCase().includes(query.toLowerCase()) && !tags.includes(s)).slice(0, 8);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function add(s: string) {
    onChange([...tags, s].join(", "));
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(s: string) {
    onChange(tags.filter((t) => t !== s).join(", "));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px",
          border: "1.5px solid #d1d5db", borderRadius: 10, background: "#fff",
          cursor: "text", minHeight: 46, alignItems: "center",
        }}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {tags.map((tag) => (
          <span key={tag} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "#111827", color: "#fff", fontSize: 13, fontWeight: 500,
            borderRadius: 6, padding: "3px 10px",
          }}>
            {tag}
            <button type="button" onMouseDown={(e) => { e.preventDefault(); remove(tag); }}
              style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 16 }}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={tags.length === 0 ? "Search sectors..." : ""}
          style={{ border: "none", outline: "none", fontSize: 15, color: "#111827", flex: 1, minWidth: 120, background: "transparent" }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          marginTop: 4, background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden",
        }}>
          {filtered.map((s) => (
            <button key={s} type="button" onMouseDown={() => add(s)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 14px", fontSize: 14, color: "#111827",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: "1px solid #f3f4f6",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function LocationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length > 0
    ? LOCATIONS.filter((l) => l.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : LOCATIONS.slice(0, 8);

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
        placeholder="Search city..."
        style={fieldStyle}
        onFocus={(e) => { setOpen(true); (e.target as HTMLInputElement).style.borderColor = "#111827"; }}
        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "#d1d5db"; }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          marginTop: 4, background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden",
        }}>
          {filtered.map((loc) => (
            <button key={loc} type="button" onMouseDown={() => select(loc)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 14px", fontSize: 14, color: "#111827",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: "1px solid #f3f4f6",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >{loc}</button>
          ))}
        </div>
      )}
    </div>
  );
}

type UserType = "operator" | "investor";

interface Step1Data { userType: UserType }
interface Step2Data { name: string; url: string; sector: string; location: string }

const USER_TYPES: { value: UserType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "operator",
    label: "Operator",
    description: "I run or lead a company — CEO, founder, CPO, or senior operator at growth stage.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 10.5 6.75 13.5 9.75l5.25-5.25M21 21H3M21 3v18" />
      </svg>
    ),
  },
  {
    value: "investor",
    label: "Investor",
    description: "I back companies — VC, PE, angel, or portfolio advisor tracking strategic performance.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0L12 17.25 6.43 14.25m11.141 0-4.179 2.25m0 0L21.75 16.5 12 21.75 2.25 16.5l4.179-2.25" />
      </svg>
    ),
  },
];

export function OnboardingWizard() {
  const { setActiveCompany } = useCompany();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1, setStep1] = useState<Step1Data | null>(null);
  const [step2, setStep2] = useState<Step2Data>({ name: "", url: "", sector: "", location: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    if (!step1 || !step2.name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: step2.name.trim(),
          url: step2.url.trim() || null,
          sector: step2.sector.trim() || null,
          location: step2.location.trim() || null,
          profile: { userType: step1.userType },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create company");
        return;
      }

      setActiveCompany({
        id: data.company.id,
        name: data.company.name,
        url: data.company.url ?? null,
        sector: data.company.sector ?? null,
        role: "owner",
      });

      window.location.href = "/inflexion/overview";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8f9fb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48, justifyContent: "center" }}>
          <div style={{
            width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 10,
            background: "#111827",
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="1" width="22" height="22" stroke="white" strokeWidth="1.8" />
              <rect x="4.5" y="4.5" width="15" height="15" stroke="white" strokeWidth="1.5" />
              <rect x="7.5" y="7.5" width="9" height="9" stroke="white" strokeWidth="1.3" />
              <rect x="10" y="10" width="4" height="4" stroke="white" strokeWidth="1.1" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", lineHeight: 1 }}>Nth Layer</p>
            <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: "0.05em", marginTop: 2 }}>Inflexion</p>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32, justifyContent: "center" }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28,
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                background: s === step ? "#111827" : s < step ? "#111827" : "#e5e7eb",
                color: s <= step ? "#fff" : "#9ca3af",
                transition: "all 200ms",
              }}>
                {s < step ? (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : s}
              </div>
              {s < 2 && (
                <div style={{
                  width: 40, height: 1,
                  background: s < step ? "#111827" : "#e5e7eb",
                  transition: "background 200ms",
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: "40px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        }}>

          {/* ── Step 1: Role ── */}
          {step === 1 && (
            <>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                  What best describes you?
                </h1>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
                  This shapes the intelligence Inflexion surfaces for you.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                {USER_TYPES.map((t) => {
                  const selected = step1?.userType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setStep1({ userType: t.value })}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 16,
                        padding: "20px",
                        border: selected ? "2px solid #111827" : "1.5px solid #e5e7eb",
                        borderRadius: 12,
                        background: selected ? "#f8f9fb" : "#fff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 150ms",
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: selected ? "#111827" : "#f3f4f6",
                        color: selected ? "#fff" : "#6b7280",
                        transition: "all 150ms",
                      }}>
                        {t.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <p style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{t.label}</p>
                          {selected && (
                            <div style={{
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#111827",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, marginTop: 2 }}>{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!step1}
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  background: !step1 ? "#d1d5db" : "#111827",
                  border: "none",
                  borderRadius: 10,
                  cursor: !step1 ? "default" : "pointer",
                  transition: "background 150ms",
                }}
              >
                Continue
              </button>
            </>
          )}

          {/* ── Step 2: Company ── */}
          {step === 2 && (
            <>
              <div style={{ marginBottom: 32 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 13, color: "#9ca3af", background: "none", border: "none",
                    cursor: "pointer", padding: 0, marginBottom: 16,
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  Back
                </button>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                  {step1?.userType === "investor" ? "Which company are you analysing first?" : "Tell us about your company"}
                </h1>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
                  {step1?.userType === "investor"
                    ? "Start with one portfolio company. You can add more from your dashboard."
                    : "You can add more context later — just name and URL to start."}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                <div>
                  <label style={{
                    display: "block", fontSize: 12, fontWeight: 600, color: "#374151",
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                  }}>
                    Company name *
                  </label>
                  <input
                    type="text"
                    value={step2.name}
                    onChange={(e) => setStep2({ ...step2, name: e.target.value })}
                    placeholder="Acme Ltd"
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      fontSize: 15,
                      color: "#111827",
                      background: "#fff",
                      border: "1.5px solid #d1d5db",
                      borderRadius: 10,
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 150ms",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#111827"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>

                <div>
                  <label style={{
                    display: "block", fontSize: 12, fontWeight: 600, color: "#374151",
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                  }}>
                    Website
                  </label>
                  <input
                    type="url"
                    value={step2.url}
                    onChange={(e) => setStep2({ ...step2, url: e.target.value })}
                    placeholder="https://acme.com"
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      fontSize: 15,
                      color: "#111827",
                      background: "#fff",
                      border: "1.5px solid #d1d5db",
                      borderRadius: 10,
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 150ms",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#111827"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>

                <div>
                  <label style={{
                    display: "block", fontSize: 12, fontWeight: 600, color: "#374151",
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                  }}>
                    Sector
                  </label>
                  <SectorMultiSelect value={step2.sector} onChange={(v) => setStep2({ ...step2, sector: v })} />
                </div>

                <div>
                  <label style={{
                    display: "block", fontSize: 12, fontWeight: 600, color: "#374151",
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                  }}>
                    Location
                  </label>
                  <LocationSelect value={step2.location} onChange={(v) => setStep2({ ...step2, location: v })} />
                </div>
              </div>

              {error && (
                <p style={{ marginBottom: 16, fontSize: 13, color: "#dc2626" }}>{error}</p>
              )}

              <button
                onClick={handleFinish}
                disabled={loading || !step2.name.trim()}
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  background: loading || !step2.name.trim() ? "#d1d5db" : "#111827",
                  border: "none",
                  borderRadius: 10,
                  cursor: loading || !step2.name.trim() ? "default" : "pointer",
                  transition: "background 150ms",
                }}
              >
                {loading ? "Setting up..." : "Go to Inflexion →"}
              </button>

              <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
                You can add more company context from Settings at any time.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
