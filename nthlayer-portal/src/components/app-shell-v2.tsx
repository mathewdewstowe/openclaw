"use client";

import { useState } from "react";
import { SidebarV2 } from "./sidebar-v2";
import { EntitlementProvider } from "@/lib/contexts/entitlements";
import { CompanyProvider } from "@/lib/contexts/company";
import type { PlanEntitlements } from "@/lib/types/entitlements";

interface CompanyInfo {
  id: string;
  name: string;
  url: string | null;
  sector: string | null;
  role: string;
}

export function AppShellV2({
  email,
  planName,
  systemRole,
  entitlements,
  companies,
  children,
}: {
  email: string;
  planName: string;
  systemRole: string;
  entitlements: PlanEntitlements;
  companies: CompanyInfo[];
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <EntitlementProvider entitlements={entitlements} planName={planName} systemRole={systemRole}>
      <CompanyProvider initialCompanies={companies}>
        <div className="flex min-h-screen">
          <SidebarV2 open={sidebarOpen} onClose={() => setSidebarOpen(false)} email={email} />

          <main className="flex-1 min-w-0 lg:ml-[260px]">
            {/* Top bar */}
            <div className="border-b border-[var(--border)] px-4 sm:px-8 py-3 flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1 -ml-1"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <div className="hidden lg:block" />

              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">{email}</span>
                {(systemRole === "super_admin" || systemRole === "admin") && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background: "#fef3c7",
                    color: "#92400e",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}>
                    {systemRole === "super_admin" ? "Super Admin" : "Admin"}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-8">{children}</div>
          </main>
        </div>
      </CompanyProvider>
    </EntitlementProvider>
  );
}
