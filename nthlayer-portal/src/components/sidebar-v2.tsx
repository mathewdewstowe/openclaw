"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEntitlements } from "@/lib/contexts/entitlements";
import { useCompany } from "@/lib/contexts/company";

// ─── Nav structure ───────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: string;
  section?: string;
  entitlement?: string; // key in PlanEntitlements
};

const NAV_ITEMS: NavItem[] = [
  { href: "/inflexion/overview", label: "Dashboard", icon: "grid" },
  { href: "/inflexion/strategy", label: "Frame", icon: "frame", section: "Strategy" },
  { href: "/inflexion/strategy", label: "Diagnose", icon: "search" },
  { href: "/inflexion/strategy", label: "Decide", icon: "scale" },
  { href: "/inflexion/strategy", label: "Position", icon: "target" },
  { href: "/inflexion/strategy", label: "Commit", icon: "zap" },
  { href: "/inflexion/competitors", label: "Competitors", icon: "crosshair", section: "Intelligence", entitlement: "access_competitor" },
  { href: "/inflexion/signals", label: "Signals", icon: "activity", entitlement: "access_decide" },
  { href: "/inflexion/monitor", label: "Monitor", icon: "eye", entitlement: "access_decide" },
  { href: "/inflexion/recommendations", label: "Recommendations", icon: "list", entitlement: "access_decide" },
  { href: "/inflexion/decisions", label: "Decisions", icon: "bookmark", entitlement: "access_decide" },
];

// ─── Icons ───────────────────────────────────────────────────

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  scale: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
    </svg>
  ),
  target: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  zap: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  ),
  crosshair: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
    </svg>
  ),
  layers: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0L12 17.25 6.43 14.25m11.141 0-4.179 2.25m0 0L21.75 16.5 12 21.75 2.25 16.5l4.179-2.25" />
    </svg>
  ),
  cog: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  lock: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  activity: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3l3-9 3 18 3-9 3 6h3" />
    </svg>
  ),
  "message-square": (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  "book-open": (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  frame: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25M3.75 6v2.25M3.75 6H2.25m1.5 12A2.25 2.25 0 0 0 6 20.25h2.25M3.75 18v-2.25M3.75 18H2.25m18-12A2.25 2.25 0 0 0 18 3.75h-2.25M20.25 6v2.25M20.25 6H21.75m-1.5 12A2.25 2.25 0 0 1 18 20.25h-2.25M20.25 18v-2.25M20.25 18H21.75M8.25 3.75h7.5M8.25 20.25h7.5M3.75 8.25v7.5M20.25 8.25v7.5" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  list: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
  bookmark: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  ),
};

// ─── Component ───────────────────────────────────────────────

export function SidebarV2({ open, onClose, email }: { open: boolean; onClose: () => void; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { entitlements, planName, systemRole } = useEntitlements();
  const { activeCompany, companies, setActiveCompany } = useCompany();
  const [avatarOpen, setAvatarOpen] = useState(false);

  const isAdmin = systemRole === "super_admin" || systemRole === "admin";

  function isActive(href: string) {
    if (href === "/inflexion/strategy") return pathname === href || pathname.startsWith("/inflexion/strategy");
    if (pathname === href) return true;
    if (href !== "/inflexion/overview" && pathname.startsWith(href + "/")) return true;
    return false;
  }

  function isLocked(item: NavItem): boolean {
    if (!item.entitlement) return false;
    return !(entitlements as unknown as Record<string, unknown>)[item.entitlement];
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }


  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-gray-200 transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 260 }}
      >
        {/* ── Brand ── */}
        <div style={{ padding: "22px 20px 18px" }} className="flex items-center gap-3 border-b border-gray-100">
          <div
            style={{ width: 44, height: 44 }}
            className="shrink-0 flex items-center justify-center rounded-xl bg-gray-900"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="1" width="22" height="22" stroke="white" strokeWidth="1.8" />
              <rect x="4.5" y="4.5" width="15" height="15" stroke="white" strokeWidth="1.5" />
              <rect x="7.5" y="7.5" width="9" height="9" stroke="white" strokeWidth="1.3" />
              <rect x="10" y="10" width="4" height="4" stroke="white" strokeWidth="1.1" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: "#111" }}>Nth Layer</p>
            <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.3, letterSpacing: "0.02em" }}>Inflexion</p>
          </div>
          <button onClick={onClose} className="ml-auto lg:hidden" style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Company switcher ── */}
        {companies.length > 0 && (
          <div style={{ padding: "12px 16px 8px" }}>
            <select
              value={activeCompany?.id ?? ""}
              onChange={(e) => {
                const c = companies.find((c) => c.id === e.target.value);
                if (c) setActiveCompany(c);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 13,
                fontWeight: 500,
                color: "#374151",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                cursor: "pointer",
                appearance: "auto",
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "4px 0" }}>
          {NAV_ITEMS.map((item, idx) => {
            const showSection = !!item.section && (idx === 0 || NAV_ITEMS[idx - 1].section !== item.section);
            const active = isActive(item.href);
            const locked = isLocked(item);

            return (
              <div key={`${item.href}-${item.label}`}>
                {showSection && (
                  <p style={{
                    padding: "20px 20px 6px",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#9ca3af",
                  }}>
                    {item.section}
                  </p>
                )}

                {locked ? (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      margin: "1px 12px",
                      padding: "9px 12px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#d1d5db",
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ color: "#e5e7eb", flexShrink: 0 }}>{ICONS[item.icon]}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{ color: "#d1d5db" }}>{ICONS.lock}</span>
                  </Link>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      margin: "1px 12px",
                      padding: "9px 12px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      textDecoration: "none",
                      color: active ? "#111827" : "#4b5563",
                      background: active ? "#f1f5f9" : "transparent",
                      transition: "background 150ms, color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "#f9fafb";
                        e.currentTarget.style.color = "#111827";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#4b5563";
                      }
                    }}
                  >
                    <span style={{ color: active ? "#334155" : "#9ca3af", flexShrink: 0 }}>{ICONS[item.icon]}</span>
                    {item.label}
                  </Link>
                )}
              </div>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <>
              <p style={{
                padding: "20px 20px 6px",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#9ca3af",
              }}>
                Admin
              </p>
              {[
                { href: "/inflexion/admin", label: "Dashboard" },
                { href: "/inflexion/admin/users", label: "Users" },
                { href: "/inflexion/admin/plans", label: "Plans" },
                { href: "/inflexion/admin/companies", label: "Companies" },
                { href: "/inflexion/admin/jobs", label: "Jobs" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    margin: "1px 12px",
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: "none",
                    color: isActive(item.href) ? "#111827" : "#4b5563",
                    background: isActive(item.href) ? "#f1f5f9" : "transparent",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive(item.href)) e.currentTarget.style.background = "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive(item.href)) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ color: "#9ca3af", flexShrink: 0 }}>{ICONS.cog}</span>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* ── Footer: Avatar ── */}
        <div className="border-t border-gray-100" style={{ padding: "12px", position: "relative" }}>
          {/* Avatar dropdown menu */}
          {avatarOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setAvatarOpen(false)} />
              <div style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: 12,
                right: 12,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 50,
                overflow: "hidden",
              }}>
                {/* Email + plan */}
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <p style={{ fontSize: 12, color: "#111827", fontWeight: 500, marginBottom: 4 }}>{email}</p>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background: planName === "Free" ? "#f3f4f6" : "#dbeafe",
                    color: planName === "Free" ? "#6b7280" : "#1d4ed8",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}>
                    {planName}
                  </span>
                </div>
                {/* Menu items */}
                <div style={{ padding: "4px" }}>
                  <Link
                    href="/inflexion/settings/company"
                    onClick={() => { setAvatarOpen(false); onClose(); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "#374151", textDecoration: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {ICONS.cog}
                    Company Profile
                  </Link>
                  <Link
                    href="/inflexion/settings"
                    onClick={() => { setAvatarOpen(false); onClose(); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "#374151", textDecoration: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {ICONS.cog}
                    Settings
                  </Link>
                  <div style={{ borderTop: "1px solid #f3f4f6", margin: "4px 0" }} />
                  <button
                    onClick={handleLogout}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "#374151", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Avatar trigger button */}
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: 10,
              padding: "8px 8px",
              borderRadius: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#111827",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
              letterSpacing: "0.02em",
            }}>
              {email ? email[0].toUpperCase() : "?"}
            </div>
            <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
              <p style={{ fontSize: 11, color: "#9ca3af" }}>{planName}</p>
            </div>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#9ca3af", flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
