"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { DisclaimerModal } from "./disclaimer-modal";

export function AppShell({
  role,
  email,
  children,
}: {
  role: string;
  email: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <DisclaimerModal />
      <Sidebar role={role} email={email} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — pushed right on desktop, full width on mobile */}
      <main className="flex-1 min-w-0 lg:ml-[260px]">
        <div className="border-b border-[var(--border)] px-4 sm:px-8 py-4 flex items-center justify-between">
          {/* Hamburger — mobile only */}
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
            <span className="text-sm text-[var(--muted-foreground)] hidden sm:inline">{email}</span>
            {role === "ADMIN" && (
              <span className="text-xs bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
        </div>
        <div className="p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
