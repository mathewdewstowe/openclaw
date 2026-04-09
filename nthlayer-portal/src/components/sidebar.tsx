"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/company", label: "Product Strategy", icon: "building", section: null, requiresStrategy: false, comingSoon: false },
  { href: "/company/charts/swot", label: "SWOT Analysis", icon: "chart", section: "Artefacts", requiresStrategy: true, comingSoon: false },
  { href: "/company/charts/competitors", label: "Competitor Matrix", icon: "chart", section: null, requiresStrategy: true, comingSoon: false },
  { href: "/company/charts/priorities", label: "Priority Matrix", icon: "chart", section: null, requiresStrategy: true, comingSoon: true },
  { href: "/company/charts/build-buy", label: "Build vs Buy", icon: "chart", section: null, requiresStrategy: true, comingSoon: true },
  { href: "/company/charts/roadmap", label: "90-Day Roadmap", icon: "chart", section: null, requiresStrategy: true, comingSoon: true },
  { href: "/company/charts/trends", label: "Trend Timeline", icon: "chart", section: null, requiresStrategy: true, comingSoon: true },
  { href: "/company/charts/magic-quadrant", label: "Magic Quadrant", icon: "quadrant", section: null, requiresStrategy: true, comingSoon: true },
  { href: "/dashboard", label: "Competitor Teardowns", icon: "list", section: "Intelligence", requiresStrategy: false, comingSoon: false },
  { href: "/scan/competitor/new", label: "New Teardown", icon: "plus", section: null, requiresStrategy: false, comingSoon: false },
  { href: "/news", label: "Competitor News", icon: "news", section: null, requiresStrategy: false, comingSoon: true },
  { href: "/integrations", label: "Integrations", icon: "link", section: "Account", requiresStrategy: false, comingSoon: false },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  building: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  list: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
  plus: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  news: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-4.5 5.25h4.5m2.25 2.25H6.75A2.25 2.25 0 014.5 15.75V5.25A2.25 2.25 0 016.75 3h5.586a1.5 1.5 0 011.06.44l3.415 3.414a1.5 1.5 0 01.439 1.061V15.75A2.25 2.25 0 0115 18h-4.5" />
    </svg>
  ),
  link: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  ),
  chart: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  quadrant: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v18h16.5M3.75 12h16.5M12 3v18" />
    </svg>
  ),
  cog: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
};

const ADMIN_EMAILS = ["matthew@nthlayer.co.uk"];

export function Sidebar({ role, email, open, onClose }: { role: string; email: string; open: boolean; onClose: () => void }) {
  const isAdmin = role === "ADMIN" || ADMIN_EMAILS.includes(email);
  const pathname = usePathname();
  const router = useRouter();
  const [strategyReady, setStrategyReady] = useState(false);

  useEffect(() => {
    fetch("/api/company-profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.strategyScan?.status === "COMPLETED") setStrategyReady(true);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isScanDetail =
    pathname.startsWith("/scan/") && !pathname.startsWith("/scan/competitor/");

  function active(href: string) {
    if (href === "/dashboard" && isScanDetail) return true;
    if (pathname === href) return true;
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    return false;
  }

  let lastSection: string | null = "__none__";

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-gray-200 transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 260 }}
      >
        {/* ── Brand ── */}
        <div style={{ padding: "22px 20px 18px" }} className="flex items-center gap-3 border-b border-gray-100">
          <div
            style={{ width: 48, height: 48 }}
            className="shrink-0 flex items-center justify-center rounded-xl bg-gray-900"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="1" width="22" height="22" stroke="white" strokeWidth="1.8" />
              <rect x="4.5" y="4.5" width="15" height="15" stroke="white" strokeWidth="1.5" />
              <rect x="7.5" y="7.5" width="9" height="9" stroke="white" strokeWidth="1.3" />
              <rect x="10" y="10" width="4" height="4" stroke="white" strokeWidth="1.1" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, color: "#111" }}>Nth Layer</p>
            <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.3 }}>Signal Portal</p>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="ml-auto lg:hidden"
            style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "8px 0" }}>
          {NAV_ITEMS.map((item) => {
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;
            const isActive = active(item.href);
            const disabled = item.comingSoon || (item.requiresStrategy && !strategyReady);

            return (
              <div key={item.href}>
                {showSection && (
                  <p
                    style={{
                      padding: "20px 20px 6px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                      color: "#9ca3af",
                    }}
                  >
                    {item.section}
                  </p>
                )}
                {disabled ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "2px 12px",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 500,
                      color: "#d1d5db",
                      cursor: "default",
                    }}
                  >
                    <span style={{ color: "#e5e7eb", flexShrink: 0 }}>{ICONS[item.icon]}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.comingSoon && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          background: "#f3f4f6",
                          color: "#9ca3af",
                          padding: "2px 6px",
                          borderRadius: 999,
                        }}
                      >
                        Soon
                      </span>
                    )}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "2px 12px",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 500,
                      textDecoration: "none",
                      color: isActive ? "#1e293b" : "#4b5563",
                      background: isActive ? "#f1f5f9" : "transparent",
                      transition: "background 150ms, color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "#f9fafb";
                        e.currentTarget.style.color = "#111827";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#4b5563";
                      }
                    }}
                  >
                    <span style={{ color: isActive ? "#334155" : "#9ca3af", flexShrink: 0 }}>
                      {ICONS[item.icon]}
                    </span>
                    {item.label}
                  </Link>
                )}
              </div>
            );
          })}

          {isAdmin && (
            <>
              <p
                style={{
                  padding: "20px 20px 6px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: "#9ca3af",
                }}
              >
                Admin
              </p>
              <Link
                href="/admin"
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "2px 12px",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active("/admin") ? "#1e293b" : "#4b5563",
                  background: active("/admin") ? "#f1f5f9" : "transparent",
                }}
              >
                <span style={{ color: active("/admin") ? "#334155" : "#9ca3af", flexShrink: 0 }}>
                  {ICONS.cog}
                </span>
                Admin
              </Link>
            </>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100" style={{ padding: "8px 12px" }}>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              color: "#9ca3af",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#374151";
              e.currentTarget.style.background = "#f9fafb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#9ca3af";
              e.currentTarget.style.background = "none";
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
