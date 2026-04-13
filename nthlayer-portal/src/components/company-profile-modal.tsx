"use client";

import React, { useState, useEffect } from "react";
import { CompanyProfileForm } from "@/components/company-profile-form";

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
  territory?: string;
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

function calcScore(company: CompanyData): number {
  const p = company.profile ?? {};
  let done = 0;
  const total = 7;
  if (company.name) done++;
  if (company.url) done++;
  if (company.sector) done++;
  if (company.location) done++;
  if (p.icp1) done++;
  if ((p.competitors ?? []).filter(Boolean).length > 0) done++;
  if (p.territory) done++;
  return Math.round((done / total) * 100);
}

export function CompanyProfileModal({
  company,
}: {
  company: CompanyData;
}) {
  const initialScore = calcScore(company);
  const [open, setOpen] = useState(initialScore < 100);
  const [currentCompany, setCurrentCompany] = useState(company);
  const canDismiss = initialScore > 0;

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("open-profile-modal", handleOpen);
    return () => window.removeEventListener("open-profile-modal", handleOpen);
  }, []);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const score = calcScore(currentCompany);
  const isComplete = score === 100;

  function handleSaved() {
    // Refresh company data by re-fetching isn't straightforward here,
    // so we close the modal optimistically after save
    setOpen(false);
    // Reload the page to reflect new profile data
    window.location.reload();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={canDismiss ? () => setOpen(false) : undefined}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 9000,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />

      {/* Modal card */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(92vw, 780px)",
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          zIndex: 9001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px 20px",
            borderBottom: "1px solid #e5e7eb",
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Logo mark */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 2 }}>
                {initialScore === 0 ? "Set up your company profile" : "Edit company profile"}
              </h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                {initialScore === 0
                  ? "Complete your profile to unlock the full Inflexion system."
                  : "Update your company details to improve analysis quality."}
              </p>
            </div>
          </div>
          {canDismiss && (
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 6,
                color: "#9ca3af",
                fontSize: 20,
                lineHeight: 1,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#111827"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#9ca3af"; }}
            >
              ×
            </button>
          )}
        </div>

        {/* Progress bar strip */}
        <div style={{ height: 3, background: "#f3f4f6", flexShrink: 0 }}>
          <div
            style={{
              height: "100%",
              width: `${score}%`,
              background: score === 100 ? "#059669" : "#a3e635",
              transition: "width 400ms",
            }}
          />
        </div>

        {/* Content — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 8px" }}>
          {!canDismiss && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 18px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 10,
                marginBottom: 24,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p style={{ fontSize: 13, color: "#92400e", margin: 0, lineHeight: 1.5 }}>
                <strong>Required to get started.</strong> Fill in your company details so Inflexion can generate accurate, relevant strategic analysis. This only takes a couple of minutes.
              </p>
            </div>
          )}

          <CompanyProfileForm
            company={currentCompany}
            onSaved={handleSaved}
            hideHeader={true}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 32px",
            borderTop: "1px solid #e5e7eb",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f9fafb",
          }}
        >
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {score < 100 ? `${score}% complete` : "Profile complete ✓"}
          </span>
          {!canDismiss && (
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
              You can always update this from Settings.
            </p>
          )}
          {canDismiss && (
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                color: "#6b7280",
                cursor: "pointer",
                padding: "4px 8px",
                textDecoration: "underline",
              }}
            >
              Complete later
            </button>
          )}
        </div>
      </div>
    </>
  );
}
